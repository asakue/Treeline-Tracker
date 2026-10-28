# Treeline Tracker: Комплексная инженерная архитектура и спецификация системы

**Версия документа:** 0.5.4  
**Статус:** `PRODUCTION_READY_SPEC`  
**Ведущий архитектор:** Даниил  
**Команда разработки:** Даниил (руководитель, ведущий архитектор), Александр (разработчик ядра и карт), Кирилл (клиентский разработчик, безопасность) • Группа ВИС31 (09.03.02)

---

## 1. Системный обзор и C4-архитектура

Treeline Tracker спроектирован как защищенная, высоконадежная платформа координации туристических групп и содействия поисково-спасательным операциям (Search & Rescue / SAR).

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                                                                                   |
|  [ Tourist / Hiker App ]       [ Group Leader / Guide ]     [ Rescuer / Dispatcher] |
|   - GPS Telemetry Reporter      - Route Manager & Group HUD  - Multi-Group Heatmap|
|   - SOS Beacon & Chat           - Geofence Safety Monitor    - AI SAR Zone Predict|
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
| **`guide`** (Лидер группы / Гид) | Руководитель группы | Полный CRUD над маршрутом своей группы, управление составом участников, контроль чекпоинтов, настройка безопасного радиуса геозоны (`safeRadiusMeters`), получение алертов об отклонении. |
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
   - `safeRadiusMeters`: number (от 50 до 10 000 м, по умолчанию 500)
   - `status`: `'planned' | 'active' | 'completed' | 'emergency'`
   - `currentSector`: string (напр. `'caucasus-elbrus-south'`)
   - `version`: number (Optimistic Concurrency Control)
   - `updatedAt`: Timestamp

3. **`telemetry/{telemetryId}`**
   - `userId`: string
   - `groupId`: string
   - `latitude`: number (от -90 до 90)
   - `longitude`: number (от -180 до 180)
   - `altitude`: number (высота в метрах)
   - `batteryLevel`: number (0–100%)
   - `speed`: number (м/с)
   - `geohash`: string (Geohash точности 7–8, ~19–150 м, base32 geofire-common)
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
1. Клиент вычисляет `geohash` при отправке координаты (`src/core/location/geohash.ts`).
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

### Троттлинг и deadband-фильтрация (Энергосбережение — `LocationFilter`)
* **Deadband Filter:** Если расстояние смещения `< 5 метров` (`deadbandMeters = 5`) и скорость близка к 0, передача отфильтровывается для устранения GNSS-джиттера.
* **Адаптивный троттлинг:** Базовый интервал отправки — **5 секунд**. При падении заряда аккумулятора $\le 15\%$ интервал автоматически увеличивается до **30 секунд** для продления жизни устройства.
* **SOS Bypass:** При активации экстренного сигнала бедствия фильтры Deadband и Throttle мгновенно отключаются (instant bypass).

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
* **Vitest + React Testing Library + JSDOM:** Развернут полноценный тестовый раннер со строгой изоляцией окружения. В проекте активны 14 комплексных сьютов тестов (**170 тестов, 100% pass**):
  1. `src/views/__tests__/profile-page.test.tsx` (16 тестов) — верификация рендеринга профиля, реактивного расчета процентов заполнения (0%–100%), валидации модального окна, переключения вкладок, ротации ключей Ed25519 и селектора приватности.
  2. `src/test/profile-page.test.tsx` (6 тестов) — базовые проверки поведения компонента профиля и модальных окон.
  3. `src/test/api-security-and-weather.test.ts` (18 тестов) — проверка безопасности API: лимиты скорости (Rate Limiting), валидация Zod, кэширование метеоданных Open-Meteo, защита от SSRF и инъекций.
  4. `src/core/security/__tests__/security-phase2.test.ts` (1 комплексный сьют, 39 ассершенов) — сквозная проверка криптографического ядра Web Crypto: генерация и подпись Ed25519, шифрование AES-256-GCM AEAD с контролем authTag, фильтрация приватности (NORMAL, REDUCED 200м, STEALTH) и защита от replay-атак (10-минутное окно свежести).
  5. `src/core/security/__tests__/backend-security-e2ee.test.ts` (9 тестов) — сквозная E2EE верификация: снятие приватности при SOS в STEALTH/REDUCED режимах, декодирование Base64 с санитизацией пробелов и переносов строк, генерация симметричных ключей групп AES-256 в IdentityManager, скользящий Rate Limiter по IP и сквозная отправка экстренных пакетов SecurePacket.
  6. `src/features/routing/__tests__/terrain-physics.test.ts` (21 тест) — тестирование биомеханики энергозатрат Минетти (Alberto E. Minetti metabolic cost), функции темпа Тоблера (Tobler's Hiking Function с уклонами), классификации сложности SAC (T1–T4), синтеза нелинейных траекторий обхода естественных преград и оценки времени движения.
  7. `src/test/resilience-and-rbac.test.ts` (18 тестов) — Optimistic Concurrency Control (OCC), ролевые права RBAC, вызов MFA-челленджа, устойчивость транспорта к сбоям, дедупликация очередей и сброс оффлайн-буфера при восстановлении сети.
  8. `src/test/location-and-offline.test.ts` (16 тестов) — GNSS deadband фильтр (<5м), адаптивный троттлинг (5с/30с при АКБ $\le 15\%$), экстренный байпас SOS, Geohash spatial hashing (base32 geofire-common), расчет геозон Haversine (`INSIDE`/`WARNING`/`BREACH`), персистентная оффлайн-очередь IndexedDB и LocalStorage fallback.
  9. `src/core/location/__tests__/route-navigation-and-debounce.test.ts` (18 тестов) — дебаунс гео-трекинга, сглаживание спутниковых шумов и навигационные математические утилиты.
  10. `src/features/routing/__tests__/auto-classification.test.ts` (24 теста) — автономная классификация: полигональное определение географического региона (Кавказ, Алтай, Хибины, Урал, Байкал, Камчатка, Саяны), автоматический выбор профиля маршрутизации (foot-hiking, foot-walking, mountain-climbing) и расчет категории сложности по DEM-метрикам без ручного ввода.
  11. `src/test/firebase-firestore-and-hosting.test.ts` (8 тестов) — интеграция репозиториев Firestore (`FirebaseRouteRepository`, `FirebaseGroupRepository`) с защитой от таймаута (`withFirestoreTimeout` 2000мс) и локальным кэшированием.
  12. `src/app/api/routes/classify/__tests__/route.test.ts` (3 теста) — валидация серверного эндпоинта `/api/routes/classify`: Zod-схема, обработка ошибок 400 при некорректном теле запроса, лимиты геометрии.
  13. `src/test/view-registry-and-error-boundary.test.tsx` (11 тестов) — модульный реестр представлений `VIEW_REGISTRY`, группировка навигации (Desktop / Mobile / Safety), изоляция сбоев `ViewErrorBoundary` и контекстное восстановление.
  14. `src/core/utils/__tests__/gpx-exporter.test.ts` (1 тест) — валидация генерации GPX XML-треков с высотными отметками и метаданными маршрута.
* **Typecheck & Lint:** Обязательная проверка типов `tsc --noEmit` и линтинг ESLint 9 перед каждым коммитом.

### CI/CD Workflow (`.github/workflows/ci.yml`)
* Триггер: `push` в ветку `main` и создание `pull_request`.
* Шаги конвейера:
  1. `Security Scan` (TruffleHog на наличие утечек ключей и `scripts/secret-scan.mjs`).
  2. `Lint & Typecheck` (ESLint 9, TypeScript 5).
  3. `Run Unit & Integration Tests` (Vitest: 14 сьютов, 170 тестов).
  4. `Production Build` (Next.js build).
  5. `Deploy to Firebase App Hosting` (при успешном прохождении тестов в `main`).

---

## 10. Оптимизация производительности

* **Кластеризация маркеров Leaflet:** Использование `leaflet.markercluster` при отображении большого количества участников на карте.
* **Кэширование погоды:** Серверное кэширование метеоданных с TTL = 15 минут.
* **Анализ бандла и Lazy Loading:** Использование `@next/bundle-analyzer`, динамический импорт тяжелых модулей (`next/dynamic` для Leaflet и Recharts) для минимизации начального размера страницы.

---

## 11. Offline-First архитектура и устойчивость

1. **Многовкладочный кэш Firestore:** Включение `initializeFirestore` с `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` для сохранения структуры групп, маршрутов и телеметрии на устройстве с координацией между вкладками.
2. **Очередь телеметрии в IndexedDB:** Модуль `IndexedDBQueueStorage` создает базу данных `treeline_tracker_db` с хранилищами `offline_packets` и `dedup_ids`. Пакеты индексируются по времени и приоритету. Сообщения `EMERGENCY_SOS` получают наивысший приоритет и передаются первыми.
3. **Отказоустойчивый фоллбэк:** При работе в приватных режимах браузера или инкогнито, где IndexedDB заблокирован, `OfflineQueue` автоматически переключается на `localStorage`.
4. **Совместимость с Mesh-протоколами:** Структуры телеметрии сериализуются в компактные бинарные пакеты (< 256 байт) для передачи по LoRa / Bluetooth Mesh.

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

---

## 15. Автономная маршрутизация, физика рельефа и гео-классификация (Zero-Select Architecture)

Для устранения человеческих ошибок при планировании переходов в диких условиях реализована концепция **Zero-Select Architecture**: все региональные привязки, профили проходимости и категории сложности определяются автоматически на основе координат и цифровых моделей рельефа (DEM).

### Биомеханика энергозатрат (Alberto E. Minetti Polynomial)
Метаболические энергозатраты человека при ходьбе по наклонной поверхности вычисляются с использованием полинома пятой степени Альберто Минетти:
$$C_w = 280.5 \cdot i^5 - 58.7 \cdot i^4 - 289.2 \cdot i^3 + 60.1 \cdot i^2 + 52.8 \cdot i + 284.3 \quad [\text{Дж}/(\text{кг}\cdot\text{км})]$$
где $i = \tan(\theta)$ — уклон сегмента.  
Расход энергии в килокалориях для сегмента длиной $d$ (км) и туриста массой $M$ (кг, по умолчанию 75 кг):
$$E_{\text{kcal}} = \frac{C_w \cdot M \cdot d}{4184}$$
Формула точно моделирует физиологический минимум энергозатрат при спуске под уклоном $-0.10$ ($-10\%$) и лавинообразный рост затрат при подъемах круче $+15\%$.

### Функция темпа Тоблера (Tobler's Hiking Function)
Расчет ходового времени учитывает влияние уклона на скорость пешего туриста:
$$W = 6 \cdot \exp\left(-3.5 \cdot |\tan(\theta) + 0.05|\right) \quad [\text{км}/\text{ч}]$$
При уклонах круче $+25\%$ накладывается дополнительный штрафной коэффициент усталости и снижения темпа.

### Автоматическая классификация сложности (SAC Hiking Scale T1–T4)
Сложность маршрута присваивается автоматически по метрикам DEM:
* **T1 (Легкий / Hiking):** Уклон $\le 12\%$, максимальная высота $< 1000$ м.
* **T2 (Средний / Mountain Hiking):** Уклон до $22\%$, высота до $2000$ м.
* **T3 (Сложный / Demanding Mountain Hiking):** Уклон до $35\%$, высота до $3000$ м.
* **T4 (Экстремальный / Alpine Hiking):** Уклон $> 35\%$ или высота $> 3000$ м.

### Серверный API классификации (`/api/routes/classify`)
Серверный эндпоинт принимает координаты трека и опциональные DEM-метрики, валидирует вход через Zod, ограничивает трафик (100 rpm per IP) и возвращает расчет региона, категории и профиля с нулевым риском SSRF.

---

## 16. Модульный реестр представлений (View Registry) и изоляция сбоев

Для устранения монолитных циклических зависимостей интерфейс приложения декомпозирован через централизованный реестр представлений (`src/features/view-registry/view-registry.ts`):
1. **Ленивая загрузка (Code Splitting):** Каждое представление (`MapView`, `ProfilePage`, `AboutUsPage`, `GroupManagementPage`) подключается через `React.lazy()` и упаковывается в отдельный бандл Webpack/Turbopack.
2. **Изоляция сбоев (`ViewErrorBoundary`):** Каждое представление обернуто в изолированный предохранитель ошибок React. Сбой в отдельном виджете или на странице не приводит к краху всего приложения — пользователю отображается контекстный экран восстановления с сохранением фоновой телеметрии и SOS-мониторинга.
3. **Декларативная маршрутизация:** Главная навигационная панель и селекторы экранов рендерятся динамически на базе метаданных реестра (`id`, `title`, `icon`, `badge`, `roles`).

---

## 17. Оффлайн-кэширование тайлов карты и защита от зависания Firestore

### IndexedDB кэширование картографических тайлов
* В модуль карты внедрен специализированный кэшер тайлов (`src/core/map/offline-map-cache.ts`), сохраняющий растровые тайлы OpenStreetMap в IndexedDB базу `treeline_map_tiles_cache` (хранилище `tiles`).
* Фоновый Service Worker (`public/sw.js`) перехватывает сетевые запросы тайлов Leaflet и при отсутствии соединения мгновенно отдает кэшированные тайлы с HTTP 200.

### Защита от 10-секундного зависания Firestore SDK
* По умолчанию Cloud Firestore SDK при отсутствии интернет-соединения предпринимает длительные сетевые попытки длительностью до 10 секунд перед переходом в оффлайн-режим, блокируя UI-потоки и засоряя консоль предупреждениями `Could not reach Cloud Firestore backend`.
* В Treeline Tracker реализована обертка `withFirestoreTimeout(promise, 2000)`: если облачный бекенд не отвечает за 2000 мс, запрос безопасно прерывается с мгновенным переключением на локальный оффлайн-репозиторий без зависания интерфейса.
* Логирование Firestore SDK сконфигурировано через `setLogLevel('error')`, устраняя лишний шум предупреждений в продакшене.


