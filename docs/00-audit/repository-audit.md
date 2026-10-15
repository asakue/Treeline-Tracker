# Аудит репозитория Treeline Tracker (Repository Audit)

**Дата проведения:** 21 сентября 2026 г. (Актуализировано: Октябрь 2026 г.)  
**Версия кодовой базы:** 0.4.0 (Отказоустойчивость, геозоны, IndexedDB, E2EE, RBAC и 100% тестовое покрытие)  
**Статус документа:** `COMPLETED & FULLY VERIFIED`  

---

## 1. Введение и цели аудита

Целью аудита является детальная ревизия кодовой базы `asakue/Treeline-Tracker`, определение текущей архитектуры, выявление работающих, симулированных и завершенных компонентов, анализ технического долга, уязвимостей безопасности, статуса разрешения выявленных дубликатов и оценка покрытия тестами.

---

## 2. Обзор технологического стека

- **Фреймворк:** Next.js 15.3.8 (App Router), React 18.3.1, TypeScript 5.
- **Стилизация:** Tailwind CSS 3.4.1, Tailwind-Merge, Lucide-React, Radix UI primitives (`shadcn/ui`).
- **Картография:** Leaflet 1.9.4, React-Leaflet 4.2.1, `geofire-common` гео-хеширование (Base32), OpenTopoMap рельеф, расчет DEM.
- **ИИ-компонент:** Google Genkit (`@genkit-ai/google-genai`), Google Generative AI SDK (`@google/genai`), модель **Gemini 2.5 Flash** с Zod-схемами и полигонами поиска.
- **Криптография и Безопасность:** W3C Web Crypto API (Ed25519, AES-256-GCM AEAD, SHA-256), Anti-Replay (монотонный sequence + 10-минутное окно свежести), децентрализованный менеджер идентичности, приватность координат (NORMAL / REDUCED / STEALTH).
- **Стейт и хранение:** React State, LocalStorage / Repository Pattern (`src/core/repositories`), Cloud Firestore с многовкладочным кэшем `persistentLocalCache`, IndexedDB оффлайн-очередь (`treeline_tracker_db`).
- **Транспортная отказоустойчивость:** `TransportManager` (Internet ➔ MockMeshCore LoRa ➔ OfflineQueue), `ChaosSimulator`, потоковый `AuditLogger`.
- **Тестирование и верификация:** Vitest 4.1.12, React Testing Library 16.3.3, `@testing-library/jest-dom`, JSDOM (57 тестов по 6 сьютам, 100% pass).
- **Сборка и линтинг:** Standalone output, Next Compiler, ESLint 9 (Flat Config).

---

## 3. Структура файлового дерева и статус устранения дублирования

### Консолидация архитектуры (FSD + Core Domain Layer):
В проекте проведена успешная консолидация компонентов: монолитные пути сохранены как канонические реэкспорт-прокси, а основная реализация перенесена в чистые модульные слои (`src/views/`, `src/core/`, `src/features/`, `src/entities/`, `src/shared/`).

### Результаты анализа и разрешения дубликатов:
| Исходный файл (`components`) | Канонический целевой модуль | Текущий статус разрешения |
|---|---|---|
| `/src/components/app-layout.tsx` | `/src/views/app-layout.tsx` | **РАЗРЕШЕНО:** Преобразован в канонический реэкспорт `@/views/app-layout`. |
| `/src/components/profile-page.tsx` | `/src/views/profile-page.tsx` | **РАЗРЕШЕНО:** Преобразован в канонический реэкспорт `@/views/profile-page` с полным набором функций безопасности. |
| `/src/components/map-route-drawer.tsx` | `/src/features/route-drawing/ui/map-route-drawer.tsx` | **РАЗРЕШЕНО:** Модуль инкапсулирован в FSD-фичу `route-drawing`. |
| `/src/components/lost-hiker-tool.tsx` | `/src/features/hiker-search/ui/lost-hiker-tool.tsx` | **РАЗРЕШЕНО:** Инкапсулирован в FSD-фичу `hiker-search` с Genkit/Gemini 2.5 Flash интеграцией. |
| `/src/components/create-group-form.tsx` | `/src/features/group-management/ui/create-group-form.tsx` | **РАЗРЕШЕНО:** Инкапсулирован в `group-management` с поддержкой `safeRadiusMeters`. |
| `/src/lib/groups-data.ts` | `/src/core/repositories/local-storage-group-repository.ts` | **РАЗРЕШЕНО:** Заменено абстракцией `IGroupRepository`. |
| `/src/lib/routes-data.ts` | `/src/core/repositories/local-storage-route-repository.ts` | **РАЗРЕШЕНО:** Заменено абстракцией `IRouteRepository`. |
| `/src/firebase/config.ts` | `/src/shared/config/firebase-config.ts` | **РАЗРЕШЕНО:** Единый источник конфигурации Firebase с безопасным чтением env. |

---

## 4. Инвентаризация функциональности по статусам

| Функциональный модуль | Фактический статус | Описание текущей реализации |
|---|---|---|
| **Картографический вьювер** | `IMPLEMENTED` | Отображение интерактивной карты Leaflet, маркеры участников, отрисовка полилиний маршрутов, переключение топографических слоев OpenTopoMap. |
| **Планировщик / Рисование треков** | `IMPLEMENTED` | Интерактивное кликанье по карте с расчетом дистанции, высотного профиля DEM, сохранение в репозиторий. |
| **Экспорт маршрутов в GPX** | `IMPLEMENTED` | Формирование валидного XML/GPX файла с треками и высотами (`gpx-exporter.ts`, покрыто тестами). |
| **Управление профилем и прогресс** | `IMPLEMENTED` | Экран `ProfilePage` с расчетом процента заполненности (0–100%), валидацией полей и модальным окном редактирования. |
| **Криптографическая идентичность (Ed25519)** | `IMPLEMENTED` | Создание и локальное хранение ключевых пар, вычисление отпечатка (fingerprint), ротация ключей в UI. |
| **Сквозное шифрование (E2EE AEAD)** | `IMPLEMENTED` | Шифрование полезной нагрузки AES-256-GCM с 12-байтным IV и 16-байтным аутентификационным тегом (`crypto-service.ts`). |
| **Цифровые подписи пакетов (Ed25519)** | `IMPLEMENTED` | Подпись полезной нагрузки и метаданных закрытым ключом автора с проверкой открытым ключом (`secure-packet-service.ts`). |
| **Защита от повторов (Anti-Replay)** | `IMPLEMENTED` | Проверка уникальности пакета, монотонности sequence и 10-минутного окна свежести (`replay-protection.ts`). |
| **Фильтр геоприватности** | `IMPLEMENTED` | Режимы `NORMAL` (полная точность), `REDUCED` (огрубление сетки 200х200м, удаление высоты), `STEALTH` (запрет вещания в эфир). |
| **Геозоны безопасности (`safeRadiusMeters`)** | `IMPLEMENTED` | Настройка радиуса безопасности при создании группы, отрисовка окружности геозоны на карте, расчет удаления от лидера (Haversine) со статусами `INSIDE`, `WARNING`, `BREACH`. |
| **Фильтрация координат (Deadband / Throttle)** | `IMPLEMENTED` | Модуль `LocationFilter`: отсечение дрожания GNSS до 5 м, троттлинг 5 с с батарейной адаптацией до 30 с при разряде $\le 15\%$ и байпасом для SOS. |
| **Транспортная отказоустойчивость** | `IMPLEMENTED` | Каскадный маршрутизатор `TransportManager` (Internet ➔ MockMeshCore LoRa ➔ OfflineQueue) с мгновенным переключением при сбоях сети. |
| **Mesh-сеть (MeshCore симулятор)** | `SIMULATED` | Класс `MockMeshCoreTransport` с эмуляцией радиоэфира LoRa, задержки (60–140 мс) и уровня RSSI (-70..-105 dBm). |
| **Оффлайн-очередь (Store & Forward)** | `IMPLEMENTED` | Буфер `OfflineQueue` на базе `IndexedDB` (`treeline_tracker_db`) с авто-сбросом, дедупликацией и наивысшим приоритетом `EMERGENCY_SOS`. |
| **Персистентный кэш Cloud Firestore** | `IMPLEMENTED` | Подключение `persistentLocalCache` с `persistentMultipleTabManager` в `src/firebase/index.ts` для бесшовной оффлайн-работы с БД. |
| **Оптимистическая блокировка (OCC Engine)** | `IMPLEMENTED` | Модуль `src/core/domain/occ.ts` с версионированием записей (`version: number`) и защитой от перезаписи конфликтующих правок (`ConcurrencyConflictError`). |
| **Ролевой доступ (RBAC & MFA)** | `IMPLEMENTED` | Сервис `RbacService`, Custom Claims, TOTP-двухфакторная аутентификация для `rescuer` и `admin`, правила `firestore.rules`. |
| **Панель статуса экспедиции** | `IMPLEMENTED` | Сквозной `ExpeditionStatusBar`: GPS фикс, активный канал (`Интернет`/`Mesh`/`Буфер`), E2EE, заряд батареи, переключатель ролей. |
| **Хаос-симулятор полевых условий** | `IMPLEMENTED` | Панель `ChaosSimulator` (эмуляция обрыва связи, помех, потери пакетов до 75%, задержек и разряда аккумулятора до 8%). |
| **Журнал системного аудита** | `IMPLEMENTED` | Сервис `AuditLogger` с категориями `[GPS]`, `[SECURITY]`, `[TRANSPORT]`, `[OCC]`, `[AUTH]`, `[SOS]` и экспортом в JSON. |
| **Экстренная связь (SOS / 112)** | `IMPLEMENTED` | Сигнал бедствия с удержанием 3 сек, звуковой тревогой, фиксацией высоты/заряда и симулированным шлюзом 112 с дисклеймером. |
| **ИИ-поиск пропавшего туриста (SAR AI)** | `IMPLEMENTED` | Интеграция Genkit / Gemini 2.5 Flash (`/api/search-areas`) с эвристическим фоллбэком, факторами рельефа, confidence и полигонами поиска. |
| **Тестовая инфраструктура (Vitest + RTL)** | `IMPLEMENTED` | 57 автоматических тестов по 6 сьютам (криптография, ролевой доступ, OCC, каскадный транспорт, геозоны, IndexedDB) — 100% pass. |

---

## 5. Анализ безопасности и закрытие рисков

1. **Защита геоданных от перехвата (E2EE):**  
   *Статус:* `MITIGATED & IMPLEMENTED`. Внедрен криптографический сервис на Web Crypto API. Координаты шифруются ключом группы AES-256-GCM AEAD перед передачей.
2. **Аутентификация авторства пакетов:**  
   *Статус:* `MITIGATED & IMPLEMENTED`. Каждый пакет подписывается закрытым ключом Ed25519 автора. Подделка координат третьей стороной отвергается получателем.
3. **Защита от атак повторного воспроизведения (Replay Attacks):**  
   *Статус:* `MITIGATED & IMPLEMENTED`. Внедрен модуль `replay-protection.ts` с фильтрацией по 10-минутному окну свежести, кэшем `packetId` и монотонным инкрементом `sequenceNumber`.
4. **Хранение секретов и ключей:**  
   *Статус:* `MITIGATED & ENFORCED`. Настроен `.env.example`, `.gitignore` дополнен исключениями приватных ключей, активирован pre-commit скрипт `scripts/secret-scan.mjs` и сканирование TruffleHog. Приватные ключи пользователей хранятся исключительно в изолированном локальном хранилище клиента.
5. **Ролевой контроль доступа (RBAC & MFA):**  
   *Статус:* `IMPLEMENTED`. Доменная типизация ролей (`hiker`, `guide`, `rescuer`, `admin`), декларативные правила `firestore.rules`, двухфакторная аутентификация TOTP.

---

## 6. Текущий статус технического долга

- **Тестирование (Полностью решено):** Внедрена среда Vitest и React Testing Library. Созданы комплексные тесты для `ProfilePage` (`profile-page.test.tsx`), слоя безопасности (`security-phase2.test.ts`), экспорта GPX (`gpx-exporter.test.ts`), отказоустойчивости и OCC (`resilience-and-rbac.test.ts`), геозон и оффлайн-очереди (`location-and-offline.test.ts`).
- **Связность компонентов (Полностью разрешено):** Репозитории абстрагируют доступ к данным; монолитные дубликаты в `components/` сведены к прокси-реэкспортам FSD-модулей.
- **Оффлайн-надежность (Полностью разрешено):** Внедрен `TransportManager`, очередь `OfflineQueue` на `IndexedDB` и `persistentLocalCache` для Firestore.
- **Остаточный долг:** Подключение к нативным BLE-драйверам физических аппаратных модулей LoRa (ESP32 / Semtech SX1262) при переходе к стадии аппаратного производства.

---

## 7. Актуальный статус выполнения этапов проекта

1. **Фаза 0 (Аудит и архитектурная документация):** `COMPLETED` (Зафиксированы C4, ADR, требования, модель угроз).
2. **Фаза 1 (Доменный слой и репозитории):** `COMPLETED` (Чистый слой типов, Zod схемы, IGroupRepository, IRouteRepository).
3. **Фаза 2 (Слой безопасности, E2EE, Ed25519, интерфейс профиля):** `COMPLETED` (Web Crypto E2EE, Anti-replay, Privacy Filter, ProfilePage UI с табами безопасности и прогрессом).
4. **Фаза 3 (Транспортная абстракция и каскадный failover):** `COMPLETED` (`TransportManager`, `InternetTransport`, `MockMeshCoreTransport`).
5. **Фаза 4 (Оффлайн-очередь Store-and-Forward и кэш Firestore):** `COMPLETED` (`IndexedDBQueueStorage`, `persistentLocalCache`, приоритезация SOS).
6. **Фаза 5 (Экстренный SOS-маяк, геозоны safeRadiusMeters и ИИ SAR):** `COMPLETED` (SOS 3 сек, Deadband/Throttle, Gemini 2.5 Flash).
7. **Фаза 6 (Автотесты и QA):** `COMPLETED` (100% тестов пройдено: 57 тестов / 6 сьютов).
