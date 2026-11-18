# Treeline Tracker 🌲🛰️

[![CI Pipeline](https://github.com/asakue/Treeline-Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/asakue/Treeline-Tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%20%2B%20PostGIS-16-336791.svg?logo=postgresql&logoColor=white)](https://postgis.net/)
[![Docker](https://img.shields.io/badge/Docker%20Compose-Orchestrated-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![MQTT](https://img.shields.io/badge/MQTT-Mosquitto%202.0-660066.svg)](https://mosquitto.org/)
[![Tests](https://img.shields.io/badge/Tests-431%20Passed-brightgreen)](https://github.com/asakue/Treeline-Tracker)

**Treeline Tracker** — современная защищенная программная платформа для координации туристических групп, мониторинга местоположения участников в реальном времени и содействия поисково-спасательным операциям (Search & Rescue / SAR) в условиях дикой природы, плотного лесного массива и высокогорья.

Платформа построена на базе микросервисной и монорепозиторной архитектуры с гибридным транспортом: прямая работа через Интернет (REST API + WebSockets), радиосеть LoRa Meshtastic (WebSerial / WebBluetooth / MQTT), а также автономный оффлайн-режим (IndexedDB / LocalStorage) с автоматической синхронизацией.

---

## 👥 Команда проекта (Core Team)

Разработка ведётся студентами группы ВИС31 направления подготовки 09.03.02 «Информационные системы и технологии» в рамках дисциплины «Проектный практикум»:
* **Даниил** — Проект-менеджер, ведущий архитектор (координация, системная архитектура, PostGIS-инфраструктура, шифрование E2EE).
* **Александр** — Разработчик ядра и картографии (гео-алгоритмы, BRouter, высотные профили, пакетная подсистема LoRa Mesh).
* **Кирилл** — Клиентский и серверный разработчик (REST API, WebSocket engine, оптимизация производительности, безопасность).

---

## 🚀 Ключевые возможности (Key Features)

* **🗺️ Автономный бэкенд на PostgreSQL 16 + PostGIS:** Высокопроизводительный сервер на Node.js / Express с ORM Drizzle. Пространственные SQL-запросы (`ST_Contains`, `ST_DWithin`, `ST_MakePoint`), контроль вхождения в геозоны, отслеживание треков и пространственное индексирование без внешних облачных зависимостей.
* **📡 Аппаратная подсистема LoRa Mesh (`@treeline/lora-mesh`):** Реализация протокола Meshtastic на чистом TypeScript: кодеки Protobuf (MeshPacket, Data, Position, NodeInfo/User, Telemetry, Waypoint), FSM-парсер WebSerial с кадровыми маркерами `0x94 0xC3`, транспорт WebBluetooth BLE GATT, мост MQTT Bridge и дедупликация пакетов.
* **⚡ Потоковый WebSocket-движок реального времени:** Сервер комнат (rooms) с подписками на телеметрию команд, чат, проверкой heartbeat-пингов, троттлингом соединений и наивысшим приоритетом диспетчеризации для аварийных SOS-сигналов (SOS bypass).
* **🧭 Панель состояния экспедиции (Expedition Status Bar):** Сквозной мониторинг GPS-фикса (±3–5 м), активного канала связи (`Интернет`, `MeshCore LoRa`, `Офлайн-буфер IndexedDB`), статуса E2EE и заряда аккумулятора с быстрым переключателем ролей RBAC.
* **⛰️ Автономное геоопределение региона и типа маршрута (Zero-Select):** Сервис `detectRouteRegion` автоматически определяет горный район (Приэльбрусье, Домбай, Безенги, Красная Поляна, Алтай, Байкал, Саяны, Хибины, Камчатка, Крым, Урал, Альпы), а `autoDetectRouteType` классифицирует маршрут на «Горный» / «Равнинный» по уклону ($\ge 15^\circ$), абсолютной высоте ($\ge 900$ м) и набору высоты ($\ge 250$ м).
* **⚡ Физиологическое моделирование энергозатрат и темпа:** Расчет расхода энергии по уравнению Alberto E. Minetti ($C = 280.5 \cdot i^5 - 58.7 \cdot i^4 - 289.2 \cdot i^3 + 60.1 \cdot i^2 + 52.8 \cdot i + 284.3$ Дж/(кг·км)), пешеходная функция Тоблера (Tobler's Hiking Function) и шкала сложности SAC (T1–T4) в модальном окне `RouteTerrainAnalyticsModal`.
* **🧩 Модульный реестр экранов View Registry и изоляция сбоев:** Децентрализованная архитектура представлений `view-registry.ts` с динамической ленивой загрузкой (`React.lazy`), централизованной проверкой прав и изоляцией каждого экрана через `ViewErrorBoundary`. Ошибка в одном виджете не нарушает работу трекера.
* **💾 Многоуровневый оффлайн-кэш тайлов карты и очереди:** Кэширование тайлов OpenTopoMap в IndexedDB (`treeline_map_tiles_cache`) и Service Worker (`sw.js`). Декуплированные репозитории (`RestGroupRepository`, `RestRouteRepository`, `RestEmergencyRepository`, `RestLocationRepository`) с прозрачным переключением на локальное хранилище (`LocalStorageRepository`).
* **🛡️ Геозоны безопасности и контроль дистанции (FR-002, UC-02):** Настройка безопасного радиуса группы (50–10 000 м) и полигональных зон отчуждения. Геопространственный мониторинг PostGIS с генерацией статусов `INSIDE`, `WARNING` и `BREACH`.
* **📡 Адаптивная фильтрация GNSS (Deadband + Throttle, FR-006):** Модуль `LocationFilter` отсекает статическое дрожание координат (< 5 м), троттлит отправку (5 с) с адаптивным энергосбережением (до 30 с при заряде $\le 15\%$), Geohash-кодированием и мгновенным байпасом для SOS.
* **🔐 Zero-Knowledge сквозное шифрование (E2EE) и цифровая подпись:** Реализация на базе W3C Web Crypto API: аутентифицированное шифрование AES-256-GCM AEAD для сообщений и телеметрии, подпись закрытым ключом Ed25519, защита от атак воспроизведения (Anti-Replay) с монотонным счетчиком и 10-минутным окном свежести.
* **🔐 Единый комплекс авторизации и аутентификации (`src/features/auth`):**
  - **Вход (Sign In):** Поддержка учетных записей email/password с выпуском криптографических JWT access/refresh токенов, а также мгновенный полевой гостевой вход без необходимости подключения к сети.
  - **Регистрация (Sign Up):** Указание позывного (Call sign) для радиоэфира LoRa, имени, email, пароля и выбор оперативной роли.
  - **Сброс пароля (Password Reset):** Двухэтапное восстановление доступа с одноразовым криптографическим кодом подтверждения.
  - **Сессия и безопасность (Session & 2FA):** Управление активными сессиями, проверка срока действия токенов, подтверждение двухфакторной аутентификации (MFA / TOTP) и функция безопасного экстренного стирания кэша устройства (Device Cache Wipe).
* **🎨 Тактический дизайн-система (Unslop Design):**
  - Полное избавление от «AI-slop» артефактов (фиолетовых градиентов, неонового свечения, смайликов в кнопках и неровных отступов).
  - Строгая 4px пространственная сетка, матовые графитовые поверхности (`slate/zinc`), контрастная field-ready типографика и тактические статусные маркеры (`● MESH: ACTIVE`, `● GPS: 3D FIX`).
  - Минималистичный и спокойный хром интерфейса, концентрирующий внимание на топографической карте и профиле высот.
* **👥 Ролевая модель RBAC и адаптивный контекстный интерфейс (`RoleActionHud`):**
  - **Турист (Hiker / Member):** Минималистичный интерфейс личной безопасности: трекинг координат, оффлайн-буфер breadcrumbs, компас/азимут, групповой чат и защищенная от случайного нажатия кнопка экстренного вызова SOS (с задержкой удержания 1.5 с).
  - **Инструктор (Guide / Leader):** Командный пункт группы: планировщик маршрутов, редактор путевых точек, GPX-экспорт, таблица дистанции участников с контролем схода с тропы (Off-track alert), настройка геозон безопасности и рассылка пинг-опроса группы.
  - **Спасатель (Rescuer):** Оперативный штаб ПСО: ИИ-расчет секторов поиска пропавших (SAR AI на базе Gemini), журнал входящих сигналов бедствия SOS, пеленг радиомаяков LoRa и сквозная телеметрия всех отрядов.
  - **Администратор (Admin):** Системный узел: конфигурация частот радиоэфира LoRa Mesh (433 / 868 / 915 МГц), журнал криптографического аудита, хаос-стресс-тестирование каналов связи и управление учетными записями.
* **📡 Многоканальный отказоустойчивый транспорт (`TransportManager`):** Каскадный маршрутизатор: первичный канал (REST/WebSocket HTTPS/WSS) ➔ радиосеть LoRa Meshtastic (-70..-105 dBm) ➔ персистентная оффлайн-очередь store-and-forward (`OfflineQueue`) с автоматическим сбросом и дедупликацией.
* **🧪 Хаос-симулятор полевых условий (`ChaosSimulator`):** Панель хаос-тестирования (FR-024) для моделирования экстремальных условий: глушение сотовой связи, потеря радиопакетов (до 75%), задержки и критический разряд батареи.
* **🤖 Безопасный ИИ-поиск пропавших (SAR AI):** Построение вероятностных полигонов поиска с учетом рельефа и темпа движения через Google Genkit и Gemini 2.5 Flash со строгими Zod-схемами и аудиторским логом.
* **🧪 Автоматизированное тестирование (431 тест со 100% успехом):**
  - **290 тестов Vitest:** Монорепозиторные модульные и интеграционные тесты (фронтенд, бэкенд, криптография, WebSocket, физика рельефа, LoRa-кодеки).
  - **141 тест E2E Runner:** 4-уровневый изолированный тестовый стенд (Tier 1: Feature Coverage, Tier 2: Boundary Cases, Tier 3: Cross-Feature Combinations, Tier 4: Real-World Scenarios).

---

## 📂 Структура проекта (Repository Architecture)

Репозиторий представляет собой современный npm-монорепозиторий (workspaces):

```
.
├── backend/                    # Standalone бэкенд-сервис (Node.js / Express / Drizzle)
│   ├── src/
│   │   ├── api/routes/         # REST API маршруты (auth, teams, tracks, waypoints, geofences, telemetry, emergency, mesh)
│   │   ├── auth/               # JWT аутентификация, ротация токенов, Argon2 хеширование, RBAC
│   │   ├── db/                 # Drizzle ORM схемы, подключение к PostGIS, seed-скрипты
│   │   ├── middleware/         # Auth guards, валидация Zod, Rate Limiting, обработчики ошибок
│   │   ├── repositories/       # Drizzle и In-Memory репозитории
│   │   ├── utils/              # Геопространственные расчеты (Haversine, PostGIS хелперы)
│   │   └── websocket/          # Потоковый WebSocket-сервер, менеджер комнат и сессий
│   ├── tests/                  # Модульные и интеграционные тесты бэкенда (Vitest)
│   ├── Dockerfile              # Мультистейдж Docker-образ бэкенда
│   └── schema.sql              # DDL-инициализация PostgreSQL + PostGIS (таблицы, индексы, триггеры)
├── packages/
│   └── lora-mesh/              # Библиотека взаимодействия с LoRa Meshtastic (@treeline/lora-mesh)
│       ├── src/
│       │   ├── codec/          # Кодеки компактных радио-фреймов (GPS, Distress, Chat)
│       │   ├── crypto/         # Хеширование радио-каналов и шифрование пакетов
│       │   ├── protobuf/       # Декодер/энкодер Meshtastic Protobuf (MeshPacket, Position, etc.)
│       │   ├── routing/        # База данных узлов (NodeDB) и дедупликатор пакетов
│       │   └── transports/     # Аппаратные транспорты (WebSerial FSM, WebBluetooth BLE, MQTT Bridge)
│       └── __tests__/          # Тесты протокола и кодеков
├── tests/
│   └── e2e/                    # Комплексный 4-уровневый E2E тестовый раннер
│       ├── harness/            # Тестовый сервер, HTTP-клиент, WS-клиент, генератор пакетов
│       ├── runner.ts           # Автономный раннер тестов с CLI и итоговой матрицей
│       ├── tier1_feature_coverage.test.ts   # 60 тестов покрытия функциональности
│       ├── tier2_boundary_corner.test.ts    # 60 граничных тестов
│       ├── tier3_cross_feature.test.ts      # 15 кросс-функциональных тестов
│       └── tier4_real_world.test.ts         # 6 масштабных операционных сценариев
├── src/                        # Фронтенд Next.js 15 (App Router + FSD)
│   ├── app/                    # Страницы и системные роуты
│   ├── views/                  # Полностраничные модульные экраны (map-view, profile, emergency)
│   ├── features/               # Бизнес-фичи (route-drawing, routing, elevation, hiker-search, expedition)
│   ├── entities/               # Сущности (group, route, hiker, app)
│   ├── core/                   # Архитектурное ядро (domain, location, transport, security)
│   ├── infrastructure/         # Репозитории REST API (RestGroupRepository, RestRouteRepository, etc.)
│   ├── ai/                     # Genkit & Gemini 2.5 Flash SAR-поиск
│   └── shared/                 # Общие компоненты UI, offline cache, утилиты
├── docs/                       # Полная архитектурная и проектная документация (C4, ADR, RBAC)
├── docker-compose.yml          # Оркестрация стека (PostgreSQL/PostGIS, Mosquitto MQTT, Backend)
├── mosquitto.conf              # Конфигурация MQTT-брокера
├── .env.example                # Шаблон переменных окружения
└── vitest.config.ts            # Конфигурация Vitest для монорепозитория
```

---

## 🏛️ Архитектура системы (C4 Architecture)

```
+---------------------------------------------------------------------------------------------------+
|                                           CLIENT TIER                                             |
|                                                                                                   |
|  [ Tourist / Hiker App ]          [ Expedition Guide HUD ]          [ Rescuer SAR Command Center] |
|   - GPS / Deadband Filter          - Tactical Map & Track OCC        - Multi-Group Overview       |
|   - SOS Beacon & Encrypted Chat    - Geofence Safety Monitor         - AI SAR Heatmap Generation  |
|   - WebSerial / BLE LoRa Radio     - Key Management & QR Share       - Emergency Dispatch Feed    |
|   - IndexedDB Tile & Packet Cache  - Elevation & Metabolic Profile   - MQTT Gateway Monitor       |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                     +----------------------------+---------------------------+
                     | HTTPS / REST v1            | WSS (Binary / JSON)       | WebSerial / BLE / MQTT
                     v                            v                           v
+---------------------------------------------------------------------------------------------------+
|                                         APPLICATION TIER                                          |
|                                                                                                   |
|  [ Standalone Express Backend ]               [ WebSocket Realtime Server ]  [ @treeline/lora-mesh]
|   - /api/v1/auth (JWT, Argon2, Refresh)        - Squad Telemetry Rooms        - Protobuf Wire Codec
|   - /api/v1/teams & /api/v1/tracks (OCC)       - Heartbeat & Auto-Reconnect   - WebSerial FSM
|   - /api/v1/geofences (Spatial SQL)            - Rate-Limited Channels        - BLE GATT Transport
|   - /api/v1/emergency (Priority SOS)           - High-Priority SOS Broadcast  - MQTT Bridge Relay
|   - Zod Schema Validation & Rate Limiter       - Zero-Leak Channel Isolation  - NodeDB & Dedup
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                     +----------------------------+---------------------------+
                     | SQL Queries / Transactions                             | MQTT Pub / Sub
                     v                                                        v
+----------------------------------------------------+   +------------------------------------------+
|                  DATA STORAGE TIER                 |   |              MESSAGING TIER              |
|                                                    |   |                                          |
|  [ PostgreSQL 16 + PostGIS ]                       |   |  [ Eclipse Mosquitto 2.0 ]               |
|   - PostGIS Spatial Queries (ST_DWithin, Contain)  |   |   - MQTT Port 1883 (TCP)                 |
|   - Telemetry Time-Series & Geospatial Indices     |   |   - WebSockets Port 9001 (WSS Bridge)    |
|   - Teams, Tracks, Waypoints, Emergency Logs       |   |   - LoRa Gateway Telemetry Ingress       |
+----------------------------------------------------+   +------------------------------------------+
```

---

## 🔒 Безопасность и регламент работы с секретами

В проекте действует строгий регламент безопасности:
1. **Pre-commit хуки и сканирование утечек:** Настроен скрипт `scripts/secret-scan.mjs` и поддержка **TruffleHog**. Проверяются API-ключи, приватные сертификаты (`*.pem`, `*.key`), учетные записи сервисных аккаунтов. При обнаружении секрета коммит немедленно прерывается.
2. **Активация хуков в локальном репозитории:**
   ```bash
   npm run hooks:install
   ```
3. **Исключение секретов в `.gitignore`:** Локальные файлы `.env`, `.env.local`, `.idx/`, приватные ключи исключены из версионного контроля.
4. **Безопасность API (OWASP):** Rate Limiter по IP для защиты от DoS, строгие Zod-схемы на всех эндпоинтах, заголовки безопасности HSTS, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff в `next.config.ts`.

---

## 🛠️ Технологический стек

| Слой | Технологии |
|---|---|
| **Веб-интерфейс** | Next.js 15 (App Router), React 18, TypeScript 5, Tailwind CSS, Radix UI Primitives, Lucide Icons |
| **Картография и геоданные** | Leaflet, React-Leaflet, Leaflet Markercluster, OpenTopoMap, BRouter API, Open-Meteo DEM |
| **Бэкенд-сервис** | Node.js, Express 4.x, TypeScript 5, Drizzle ORM, Drizzle Kit, ws (WebSockets) |
| **База данных** | PostgreSQL 16 с расширением **PostGIS 3.4** (контейнер `postgis/postgis:16-3.4-alpine`) |
| **Очереди и радио-мост** | Eclipse Mosquitto 2.0 (MQTT / WebSocket), `@treeline/lora-mesh` (Protobuf, WebSerial, BLE) |
| **Искусственный интеллект** | Google Genkit (`@genkit-ai/google-genai`), Gemini 2.5 Flash для вероятностного SAR-поиска |
| **Криптография** | W3C Web Crypto API (Ed25519 подписи, AES-256-GCM AEAD, SHA-256), JWT + Refresh Tokens, Argon2 |
| **Тестирование** | Vitest 4.x, React Testing Library, JSDOM, Standalone E2E Runner (141 тест, 4 уровня) |
| **Оркестрация** | Docker, Docker Compose, Linux / Cloud VPS |

---

## ⚡️ Быстрый старт (Getting Started)

### 1. Клонирование репозитория
```bash
git clone https://github.com/asakue/Treeline-Tracker.git
cd Treeline-Tracker
```

### 2. Установка зависимостей монорепозитория
```bash
npm install
```

### 3. Настройка переменных окружения
Скопируйте шаблоны переменных:
```bash
cp .env.example .env.local
cp backend/.env.example backend/.env
```

### 4. Активация хуков безопасности
```bash
npm run hooks:install
```

### 5. Запуск инфраструктуры через Docker Compose
Запустите базу данных PostgreSQL/PostGIS, MQTT-брокер Mosquitto и бэкенд:
```bash
docker compose up -d
```
Службы будут доступны:
- **PostgreSQL / PostGIS:** `localhost:5432`
- **MQTT Broker:** `localhost:1883` (TCP) / `localhost:9001` (WebSocket)
- **Treeline Backend REST & WS:** `http://localhost:4000`

### 6. Запуск веб-приложения Next.js
В корневом каталоге запустите фронтенд:
```bash
npm run dev
```
Интерфейс откроется по адресу [http://localhost:3000](http://localhost:3000).

---

## 🧪 Запуск автоматических тестов

В проекте реализована двухуровневая система всестороннего тестирования:

### Модульные и интеграционные тесты (Vitest)
Запуск 290 тестов по всем пакетам монорепозитория (фронтенд, бэкенд, кодеки, криптография):
```bash
npm test
```

### Полный сквозной стенд (E2E Test Runner)
Запуск 141 теста сквозного тестирования через встроенный автономный раннер:
```bash
# Запуск всех 4 уровней (141 тест):
npx tsx tests/e2e/runner.ts

# Запуск конкретного уровня:
npx tsx tests/e2e/runner.ts --tier=1   # 60 тестов: функциональное покрытие
npx tsx tests/e2e/runner.ts --tier=2   # 60 тестов: граничные и стресс-тесты
npx tsx tests/e2e/runner.ts --tier=3   # 15 тестов: кросс-функциональные сценарии
npx tsx tests/e2e/runner.ts --tier=4   # 6 тестов: реальные полевые спасательные операции

# Фильтрация тестов по шаблону:
npx tsx tests/e2e/runner.ts --filter="SOS"
```

---

## 📜 Доступные команды и скрипты (Available Scripts)

| Скрипт (npm) | Описание и назначение |
|---|---|
| `npm run dev` | Запуск локального сервера разработки Next.js на порту 3000. |
| `npm run test` | Запуск полного набора автотестов Vitest (290 тестов, 35 сьютов). |
| `npm run test:watch` | Интерактивный запуск тестов в режиме отслеживания изменений. |
| `npm run typecheck` | Строгая проверка типов во всем проекте (`tsc --noEmit`). |
| `npm run lint` | Проверка кода линтером ESLint 9 на соответствие стандартам. |
| `npm run build` | Оптимизированная сборка фронтенда Next.js. |
| `npm run security:scan` | Проверка staged-файлов скриптом `secret-scan.mjs`. |
| `npm run hooks:install` | Привязка git-хуков из каталога `.githooks/`. |
| `npm run genkit:dev` | Запуск панели Genkit Developer UI для отладки ИИ-моделей. |

---

## 📚 Документация проекта

Подробные спецификации размещены в каталоге [`docs/`](./docs/):

* 📐 [Архитектурная спецификация (C4, PostGIS схемы, OCC)](./docs/architecture.md)
* 🖥️ [Архитектура бэкенда и хранилищ данных (Express, PostGIS, WS)](./docs/03-architecture/backend.md)
* 🚂 [Руководство по развертыванию на Railway](./docs/railway-deployment.md)
* 📡 [Коммуникационный слой и гибридный транспорт](./docs/03-architecture/communication.md)
* 🔄 [Потоки данных и жизненный цикл пакетов](./docs/03-architecture/data-flow.md)
* 📋 [Функциональные требования (FR-001 – FR-032)](./docs/02-requirements/functional.md)
* ✅ [Критерии приемки и Definition of Done (AC-01 – AC-08)](./docs/02-requirements/acceptance-criteria.md)
* 🔐 [Модель угроз и безопасность](./docs/04-security/threat-model.md)
* 👤 [Идентификация и ролевая модель RBAC](./docs/04-security/identity.md)
* 📻 [Исследование и интеграция LoRa MeshCore](./docs/05-mesh/meshcore-research.md)
* 🗺️ [Матрица прослеживаемости (Traceability Matrix)](./docs/09-project-management/traceability-matrix.md)
* 👥 [Команда проекта и зоны ответственности](./docs/01-product/team.md)
* 📋 [Журнал изменений (CHANGELOG)](./CHANGELOG.md)
* 🔍 [Аудит кодовой базы и техдолга](./docs/00-audit/repository-audit.md)
