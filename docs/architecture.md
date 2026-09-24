# Treeline Tracker: Комплексная инженерная архитектура и спецификация системы

**Версия документа:** 0.4.0  
**Статус:** `PRODUCTION_READY_SPEC`  
**Ведущий архитектор:** Даниил  
**Команда разработки:** Дмитрий (автор идеи), Даниил (архитектор), Илья (руководитель), Александр (разработчик), Кирилл (разработчик)

---

## 1. Системный обзор и C4-архитектура

Treeline Tracker спроектирован как защищенная, высоконадежная платформа координации туристических групп и содействия поисково-спасательным операциям (Search & Rescue / SAR).

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                                                                                   |
|  [ Tourist / Hiker App ]       [ Group Leader / Guide ]     [ Rescuer / Dispatcher] |
|   - GPS Telemetry Reporter      - Route Manager & Group HUD  - Multi-Group Heatmap|
|   - SOS Beacon & Chat           - Member Safety Monitor      - AI SAR Zone Predict|
|   - Offline Cache & Queue       - Checkpoint Verifier        - Emergency Dispatch |
+------------------------------------------+----------------------------------------+
                                           | HTTPS / WSS / Firestore Snapshot
                                           v
+-----------------------------------------------------------------------------------+
|                             NEXT.JS / BACKEND LAYER                               |
|                                                                                   |
|  [ API Routes (/api/*) ]       [ Genkit / AI Workflows ]    [ Auth & RBAC Guard ] |
|   - Telemetry Ingestion         - SAR Probability Polygon    - Role Verification  |
|   - Weather Proxy Cache (TTL)   - Weather Risk Assessment    - Custom Claims Check|
|   - Audit Logging Engine        - Prompt Sanitizer & Guard   - Zod Input Schemas  |
+------------------------------------------+----------------------------------------+
                                           | Firebase Admin SDK / gRPC
                                           v
+-----------------------------------------------------------------------------------+
|                           PERSISTENCE & CLOUD SERVICES                            |
|                                                                                   |
|  [ Cloud Firestore ]           [ Firebase Auth ]            [ Gemini 2.5 Flash ]  |
|   - Geo-indexed Telemetry       - Custom Claims (RBAC)       - Fast SAR Inferences|
|   - Groups, Routes & Waypoints  - Session Management         - Bounded Schemas    |
|   - Real-time SOS Channels      - MFA for Rescuers           - Audit Trail Log    |
+-----------------------------------------------------------------------------------+
```

---

## 2. Модель разграничения доступа (RBAC Matrix)

Система реализует строгую ролевую модель на базе Firebase Authentication Custom Claims и правил `firestore.rules`:

| Роль | Назначение | Права доступа к данным |
| :--- | :--- | :--- |
| **`hiker`** (Турист) | Участник похода | Запись своей GPS-телеметрии, чтение маршрута и состава своей группы, отправка сообщений и SOS-сигналов в чат своей группы. Запрещен доступ к данным чужих групп. |
| **`guide`** (Лидер группы / Гид) | Руководитель группы | Полный CRUD над маршрутом своей группы, управление составом участников, контроль чекпоинтов, получение алертов об отклонении от маршрута. |
| **`rescuer`** (Оператор спасательной службы / МЧС) | Спасатель-координатор | Чтение телеметрии всех активных групп в доверенном секторе, доступ к emergency-каналам, запуск ИИ-генерации поисковых секторов, координация спасработ. |
| **`admin`** (Администратор) | Системный контроль | Управление ролями пользователей, аудит журналов безопасности, мониторинг системных метрик и лимитов API. |

---

## 3. Схема коллекций Cloud Firestore и индексов

### Коллекции

1. **`users/{userId}`**
   - `uid`: string (Primary Key)
   - `email`: string
   - `displayName`: string
   - `role`: `'hiker' | 'guide' | 'rescuer' | 'admin'`
   - `activeGroupId`: string | null
   - `lastSeen`: Timestamp
   - `createdAt`: Timestamp

2. **`groups/{groupId}`**
   - `id`: string
   - `name`: string
   - `guideId`: string (User UID)
   - `memberIds`: string[] (Массив UID участников)
   - `routeId`: string
   - `status`: `'planned' | 'active' | 'completed' | 'emergency'`
   - `currentSector`: string (напр. `'caucasus-elbrus-south'`)
   - `updatedAt`: Timestamp

3. **`telemetry/{telemetryId}`**
   - `userId`: string
   - `groupId`: string
   - `latitude`: number (от -90 до 90)
   - `longitude`: number (от -180 до 180)
   - `altitude`: number (высота в метрах)
   - `batteryLevel`: number (0–100%)
   - `speed`: number (м/с)
   - `geohash`: string (Geohash точности 7–8, ~19–150 м)
   - `timestamp`: Timestamp

4. **`routes/{routeId}`**
   - `id`: string
   - `groupId`: string
   - `name`: string
   - `waypoints`: Array<{ lat: number, lng: number, alt: number, name?: string }>
   - `distanceKm`: number
   - `elevationGainM`: number
   - `version`: number (Optimistic Concurrency Control)
   - `updatedAt`: Timestamp

5. **`emergencies/{emergencyId}`**
   - `id`: string
   - `groupId`: string
   - `reporterId`: string
   - `severity`: `'low' | 'medium' | 'critical' | 'sos'`
   - `location`: { lat: number, lng: number, alt: number }
   - `sarZone`: { polygon: Array<[number, number]>, confidence: number, generatedAt: Timestamp } | null
   - `messages`: Array<{ senderId: string, role: string, text: string, timestamp: Timestamp }>
   - `status`: `'open' | 'dispatched' | 'resolved'`

### Составные индексы (Composite Indexes)
* `telemetry`: `[groupId ASC, timestamp DESC]` — для получения трека группы за интервал времени.
* `telemetry`: `[geohash ASC, timestamp DESC]` — для пространственных срезов спасателей.
* `emergencies`: `[status ASC, severity DESC, timestamp DESC]` — для диспетчерского экрана ЧС.

---

## 4. Real-time трекинг и пространственные гео-запросы

### Подписки Firestore `onSnapshot` vs Polling
* Полный отказ от интервального polling'а в пользу реактивных подписок `onSnapshot`. Это исключает избыточные HTTP-запросы и обеспечивает доставку координат в течение 100–300 мс.

### Гео-индексация с помощью `geofire-common`
Для быстрых радиальных запросов вида *"Найти всех участников в радиусе 5 км от точки аварии"*:
1. Клиент вычисляет `geohash` при отправке координаты.
2. Сервер/клиент спасателя рассчитывает диапазоны геохэшей:
   ```typescript
   import { geohashQueryBounds, distanceBetween } from 'geofire-common';

   const center: [number, number] = [43.3499, 42.4453];
   const radiusInM = 5000;
   const bounds = geohashQueryBounds(center, radiusInM);

   const queries = bounds.map((b) => {
     return query(
       collection(db, 'telemetry'),
       orderBy('geohash'),
       startAt(b[0]),
       endAt(b[1])
     );
   });
   ```
3. Итоговая выборка фильтруется формулой Haversine для отсечения угловых ложных совпадений.

### Троттлинг и deadband-фильтрация (Энергосбережение)
* Координаты отправляются не чаще одного раза в **5–10 секунд**.
* **Deadband Filter:** Если расстояние смещения `< 3 метров` и скорость `< 0.2 м/с`, отправка откладывается до следующего движения или интервала сердцебиения (heartbeat 60 сек), сохраняя заряд батареи в походе.

---

## 5. Защита ИИ и безопасность данных (AI Guardrails & Prompt Defense)

1. **Запрет прямой записи LLM в базу данных:** ИИ-модель работает исключительно в режиме генерации гипотез и предложений. Применение полигона поиска на карте требует подтверждения диспетчера/руководителя.
2. **Санитизация промптов:** Очистка пользовательских описаний местности и сообщений перед передачей в Genkit для предотвращения атак типа **Prompt Injection**.
3. **Строгая валидация схем ответов через Zod:** Выходные данные модели валидируются схемой `SarZoneSchema`:
   - Геометрически замкнутый многоугольник (`points >= 3`).
   - Валидные границы широт [-90, 90] и долгот [-180, 180].
   - Оценка уверенности (confidence) в диапазоне [0.0, 1.0].
4. **Аудиторский лог ИИ-решений:** Все запросы к Gemini логируются (хеш промпта, параметры поисковой зоны, время вызова, идентификатор оператора) для ретроспективного анализа поисковых операций.

---

## 6. Безопасность окружения и управление секретами

* **Никаких захардкоженных секретов:** Файлы `.env` и `.env.local` строго исключены в `.gitignore`.
* **Шаблон `.env.example`:** Документирует все требуемые переменные с четким разделением клиентских (`NEXT_PUBLIC_*`) и серверных секретов (`GEMINI_API_KEY`).
* **Firebase App Hosting & Google Secret Manager:** В проде ключи инжектируются через защищенные менеджеры секретов.
* **Pre-commit защита:** Использование `trufflehog` и `git-secrets` на уровне pre-commit хуков и CI для предотвращения коммита секретов.
* **Серверная валидация Zod:** Все входящие тела запросов к API (`/api/telemetry`, `/api/emergency`, `/api/sar-ai`) проходят строгую валидацию типов и диапазонов.

---

## 7. Организация слоев Feature-Sliced Design (FSD)

* **`app/`**: Инициализация Next.js, глобальные провайдеры, API-роуты (`/api/*`).
* **`views/`**: Полностраничные представления (Map View, Profile, About Us, Emergency Dispatch).
* **`widgets/`**: Композитные блоки интерфейса (сайдбар, панель инструментов карты, карточка погоды).
* **`features/`**: Изолированные пользовательские сценарии (`features/sar-ai`, `features/route-drawing`, `features/group-management`, `features/emergency-chat`).
* **`entities/`**: Бизнес-сущности (`entities/hiker`, `entities/route`, `entities/group`, `entities/emergency`) с доменными расчетами и моделями данных.
* **`shared/`**: Инфраструктурный слой без бизнес-логики (UI-компоненты `shared/ui`, утилиты `shared/lib/geohash`, конфиг `shared/config/firebase`).

---

## 8. Единый источник правды (Single Source of Truth)

* Исключено раздвоение локального стейта и серверной БД.
* Все клиентские компоненты подписываются на единый поток Firestore.
* Локальные оптимистичные обновления применяются через транзакции с автоматическим откатом при сетевых ошибках.

---

## 9. Стратегия тестирования и CI/CD

### Тестирование
* **Vitest + React Testing Library + JSDOM:** Развернут полноценный тестовый раннер со строгой изоляцией окружения. В проекте активны 4 комплексных сьюта тестов (24 теста, 100% pass):
  1. `src/views/__tests__/profile-page.test.tsx` (16 тестов) — верификация рендеринга профиля, реактивного расчета процентов заполнения (0%–100%), валидации модального окна, переключения вкладок, ротации ключей Ed25519 и селектора приватности.
  2. `src/core/security/__tests__/security-phase2.test.ts` (39 ассершенов) — сквозная проверка криптографического ядра Web Crypto: генерация и подпись Ed25519, шифрование AES-256-GCM AEAD с контролем authTag, фильтрация приватности (NORMAL, REDUCED 200м, STEALTH) и защита от replay-атак (10-минутное окно свежести).
  3. `src/core/utils/__tests__/gpx-exporter.test.ts` — валидация генерации GPX XML-треков с высотными отметками.
  4. `src/test/profile-page.test.tsx` (6 тестов) — базовые проверки поведения компонента профиля.
* **Typecheck & Lint:** Обязательная проверка типов `tsc --noEmit` и линтинг ESLint 9 перед каждым коммитом.

### CI/CD Workflow (`.github/workflows/ci.yml`)
* Триггер: `push` в ветку `main` и создание `pull_request`.
* Шаги конвейера:
  1. `Security Scan` (TruffleHog на наличие утечек ключей).
  2. `Lint & Typecheck` (ESLint 9, TypeScript 5).
  3. `Run Unit & Integration Tests` (Vitest).
  4. `Production Build` (Next.js build).
  5. `Deploy to Firebase App Hosting` (при успешном прохождении тестов в `main`).

---

## 10. Оптимизация производительности

* **Кластеризация маркеров Leaflet:** Использование `leaflet.markercluster` при отображении большого количества участников на карте.
* **Кэширование погоды:** Серверное кэширование метеоданных с TTL = 15 минут.
* **Анализ бандла и Lazy Loading:** Использование `@next/bundle-analyzer`, динамический импорт тяжелых модулей (`next/dynamic` для Leaflet и Recharts) для минимизации начального размера страницы.

---

## 11. Offline-First архитектура и устойчивость

1. **Кэш Firestore:** Включение `persistentLocalCache` для сохранения структуры групп и маршрутов на устройстве.
2. **Очередь телеметрии в IndexedDB:** При отсутствии связи точки сохраняются в локальный буфер с монотонными таймстемпами и сбрасываются пакетом в Firestore при восстановлении сети.
3. **Совместимость с Mesh-протоколами:** Структуры телеметрии сериализуются в компактные бинарные пакеты (< 64 байт) для передачи по LoRa / Bluetooth Mesh.

---

## 12. Разрешение конфликтов одновременного редактирования (OCC)

При совместном редактировании маршрута гидами используется **Optimistic Concurrency Control**:
1. Документ маршрута содержит целочисленное поле `version`.
2. Изменение применяется внутри транзакции `runTransaction`:
   ```typescript
   await runTransaction(db, async (tx) => {
     const doc = await tx.get(routeRef);
     if (doc.data()?.version !== clientVersion) {
       throw new Error('CONFLICT_DETECTED: Маршрут изменен другим гидом.');
     }
     tx.update(routeRef, {
       ...newRouteData,
       version: clientVersion + 1,
       updatedAt: serverTimestamp()
     });
   });
   ```
3. При конфликте интерфейс предлагает интерактивное визуальное слияние треков.

---

## 13. Бюджет и оптимизация расходов (Cost Optimization)

* Использование экономичной и быстрой модели **Gemini 2.5 Flash** с лаконичными системными инструкциями и структурированным выводом JSON.
* Снижение числа операций записи Firestore благодаря троттлингу (5–10 сек), deadband-фильтрации стоянок и групповой пакетной отправке.

---

## 14. Децентрализованный криптографический контур и приватность (Zero-Knowledge)

* **Независимость от облака в дикой природе:** Наряду с Firebase Auth в приложении развернут автономный криптографический контур на W3C Web Crypto API (`Ed25519` + `AES-256-GCM AEAD`).
* **Ротация и управление ключами:** Пользователь управляет своей ключевой парой прямо из вкладки «Безопасность» экрана профиля (`ProfilePage`), имея возможность сгенерировать новую пару в один клик.
* **Гибкая приватность геоданных:** Поддержка трех нативных режимов приватности (`NORMAL`, `REDUCED_PRIVACY`, `STEALTH`), ограничивающих точность или полностью исключающих вещание геометрии в эфир.

