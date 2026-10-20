# Treeline Tracker 🌲🛰️

[![CI Pipeline](https://github.com/asakue/Treeline-Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/asakue/Treeline-Tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black)](https://nextjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1+-fbf0df?logo=bun)](https://bun.sh/)
[![Firebase](https://img.shields.io/badge/Firebase-v11-orange)](https://firebase.google.com/)
[![Genkit](https://img.shields.io/badge/Genkit-Gemini%202.5%20Flash-blue)](https://firebase.google.com/docs/genkit)
[![Tests](https://img.shields.io/badge/Tests-57%2F57%20Passed-brightgreen)](https://github.com/asakue/Treeline-Tracker)

**Treeline Tracker** — современная защищенная веб-платформа для координации туристических групп, мониторинга местоположения участников в реальном времени и содействия поисково-спасательным операциям (Search & Rescue / SAR) в условиях дикой природы и высокогорья.

---

## 👥 Команда проекта (Core Team)

Разработка ведётся студентами группы ВИС31 направления подготовки 09.03.02 «Информационные системы и технологии» в рамках дисциплины «Проектный практикум»:
* **Даниил** — Проект-менеджер, разработчик (координация, сроки, Канбан-доска, системная архитектура FSD, шифрование).
* **Александр** — Разработчик (функциональные модули, картография, высотные профили, интеграции).
* **Кирилл** — Разработчик (клиентские и серверные компоненты, оптимизация работы системы, гео-хеширование, шифрование).

---

## 🚀 Ключевые возможности (Key Features)

* **🧭 Панель состояния экспедиции (Expedition Status Bar):** Сквозной мониторинг статуса геопозиционирования (GPS фикс ±3–5м), активного канала связи (`Интернет`, `MeshCore LoRa`, `Офлайн-буфер IndexedDB`), E2EE-защиты и заряда аккумулятора с быстрым переключателем ролей RBAC.
* **🛡️ Геозоны безопасности (`safeRadiusMeters`) и контроль дистанции (FR-002, UC-02):** Интерактивная настройка безопасного радиуса группы (от 50 до 10 000м), отрисовка геозоны вокруг лидера на Leaflet, расчет удаления участников по формуле Haversine со статусами `INSIDE` (в зоне), `WARNING` (приближение к границе) и `BREACH` (выход из зоны с тревожным баннером и алертом в аудит-лог).
* **📡 Адаптивная фильтрация GNSS (Deadband + Throttle, FR-006):** Модуль `LocationFilter` отсекает статическое дрожание координат (< 5м), троттлит частоту отправки (5с) с адаптивным энергосбережением (до 30с при заряде батареи $\le 15\%$), пространственным base32 Geohash (стандарт `geofire-common`) и мгновенным байпасом для сигналов SOS.
* **🔐 Zero-Knowledge сквозное шифрование (E2EE) и цифровая подпись:** Реализация на базе W3C Web Crypto API: аутентифицированное шифрование AES-256-GCM AEAD, цифровая подпись каждого пакета закрытым ключом Ed25519, защита от атак повторного воспроизведения (Anti-Replay) с монотонным sequence и 10-минутным окном свежести.
* **📡 Многоканальный отказоустойчивый транспорт (`TransportManager`):** Прозрачный каскадный маршрутизатор передачи данных: первичный интернет-канал (Cloud Firestore / HTTPS) ➔ радиосеть LoRa `MeshCore` (-70..-105 dBm) ➔ персистентная оффлайн-очередь store-and-forward (`OfflineQueue`) с автоматическим сбросом и дедупликацией при восстановлении связи.
* **💾 Оффлайн-хранилище на IndexedDB и персистентный кэш Firestore (Требование 3.1.2):** Адаптер `IndexedDBQueueStorage` (`treeline_tracker_db`) с индексацией по времени/приоритетам и наивысшим приоритетом экстренных пакетов `EMERGENCY_SOS`. Полноценный кэш `persistentLocalCache` с `persistentMultipleTabManager` для Cloud Firestore.
* **🧪 Хаос-симулятор полевых условий (`ChaosSimulator`):** Встроенная панель хаос-тестирования (FR-024) для моделирования экстремального высокогорья: глушение сотовой связи, экранирование радиоэфира, искусственная потеря пакетов (до 75%), сетевая задержка и критический разряд батареи (8%).
* **📜 Прозрачный журнал аудита событий (`AuditLogger`):** Сквозной стриминг и экспорт структурированных системных событий по категориям `[GPS]`, `[SECURITY]`, `[TRANSPORT]`, `[OCC]`, `[AUTH]`, `[SOS]` в JSON-формате.
* **🔀 Разрешение конфликтов (OCC Engine с авто-ретраем):** Оптимистическая блокировка версий (`validateAndIncrementVersion`) с автоматическим повтором мутаций (`withOccRetry`) для предотвращения затирания данных при одновременном редактировании треков несколькими гидами.
* **🛡️ Многоуровневая ролевая модель (RBAC & MFA):** Четкое разделение прав (`hiker` / турист, `guide` / лидер группы, `rescuer` / спасатель, `admin` / администратор) с поддержкой двухфакторной аутентификации (MFA TOTP) и декларативной защитой в `firestore.rules`.
* **👤 Профиль туриста и криптографическая идентичность:** Интерактивный экран `ProfilePage` с динамическим индикатором заполненности (0%–100%), локальной генерацией и ротацией ключей Ed25519, визуализацией отпечатка (fingerprint) и селектором режимов геоприватности (`NORMAL`, `REDUCED`, `STEALTH`).
* **🚨 Экстренный диспетчерский пункт и SOS-маяк:** Мгновенный сигнал бедствия с фиксацией координат, высоты и заряда батареи, звуковой тревоги, мигания экрана и интерактивного экстренного чата с диспетчером 112.
* **🤖 Безопасный ИИ-поиск пропавших (SAR AI):** Построение вероятностных полигонов поиска с учетом рельефа и темпа движения через Genkit и Gemini 2.5 Flash с защитой от Prompt Injection, строгими Zod-схемами и неизменяемым аудиторским логом.
* **🗺️ Интерактивная карта, BRouter-автомаршрутизация и кластеризация:** Отрисовка треков на Leaflet с кластеризацией участников (`leaflet.markercluster`), автоматической трассировкой пеших троп между точками А и Б, расчетом набора/сброса высоты и экспортом в GPX.
* **📱 Адаптивный эргономичный интерфейс:** 5-кнопочная нижняя панель навигации для смартфонов (`Карта`, `Трекер`, `Маршруты`, `SOS`, `Меню`) с увеличенными тач-зонами (≥ 44×44px) для работы в перчатках.
* **🧪 Автоматизированное тестирование (Vitest + RTL):** 100% прохождение **58 интеграционных и юнит-тестов по 6 сьютам** (криптография, ролевой доступ, каскадный транспорт, OCC auto-retry, геозоны, оффлайн-очередь IndexedDB и рендеринг компонентов).

---

## 📂 Реальная структура проекта (Actual Directory Structure)

Репозиторий сочетает принципы **Feature-Sliced Design (FSD)** с доменным ядром и интеграциями:

```
.
├── .github/workflows/      # CI/CD автоматизация (Lint, Typecheck, Secret Scan, Build)
├── .githooks/              # Git-хуки для разработчиков (pre-commit с TruffleHog)
├── docs/                   # Полная архитектурная и продуктовая документация (C4, ADR, RBAC)
├── public/                 # Статические ассеты (иконки, изображения, картографические стили)
├── scripts/                # Скрипты автоматизации и проверки безопасности (secret-scan.mjs)
├── src/
│   ├── app/                # [App Layer] Next.js App Router (layout.tsx, page.tsx, API /api/*)
│   ├── views/              # [Views Layer] Полностраничные экраны (map-view, profile, about, emergency)
│   ├── features/           # [Features Layer] Пользовательские фичи (group-management, hiker-search, expedition)
│   ├── entities/           # [Entities Layer] Доменные бизнес-сущности (group, route, hiker, app)
│   ├── core/               # [Core Domain] Архитектурное ядро
│   │   ├── domain/         # Интерфейсы доменных моделей и OCC engine (types.ts, schemas.ts, occ.ts)
│   │   ├── location/       # Гео-фильтрация (location-filter.ts, geohash.ts, Haversine, Deadband, Throttle)
│   │   ├── transport/      # Отказоустойчивый транспорт (TransportManager, OfflineQueue, IndexedDB, Chaos)
│   │   ├── security/       # Криптографические протоколы (E2EE AES-GCM, Ed25519, ReplayProtection, RBAC)
│   │   ├── repositories/   # Абстракции репозиториев (Firebase / LocalStorage)
│   │   └── utils/          # Вспомогательные утилиты ядра (gpx-exporter.ts)
│   ├── ai/                 # [AI Subsystem] Конфигурация Genkit и модели Gemini 2.5 Flash
│   ├── firebase/           # [Infrastructure] Клиентская инициализация Firebase SDK (persistentLocalCache)
│   ├── shared/             # [Shared Layer] Переиспользуемая инфраструктура (UI, config, hooks, lib)
│   ├── components/         # UI-компоненты и модальные виджеты приложения
│   ├── test/               # Комплексные автотесты (57 тестов: location, offline, rbac, occ, security)
│   ├── hooks/              # Прикладные React-хуки (use-groups, use-routes, use-simulation)
│   └── lib/                # Данные маршрутов, серверные БД-адаптеры и гео-вычисления
├── .env.example            # Эталонный шаблон переменных окружения (без секретов)
├── .gitignore              # Исключения версионного контроля (.env*, .idx/, .modified, ключи)
├── bun.lock                # Фиксация зависимостей для Bun
├── package.json            # Манифест зависимостей и команд запуска
├── firestore.rules         # Декларативные правила безопасности Cloud Firestore (RBAC)
└── firebase-blueprint.json # Спецификация схемы данных Firestore
```

---

## 🔒 Безопасность и автоматические Pre-commit хуки

В проекте действует строгий регламент предотвращения утечек учетных данных:

1. **Pre-commit хуки с TruffleHog:** В проекте настроен хук `.githooks/pre-commit` и скрипт `scripts/secret-scan.mjs`. При каждом вызове `git commit`:
   - Автоматически вызывается **TruffleHog** (если установлен локально или через Docker) для глубокого анализа энтропии и паттернов коммита.
   - Скрипт `scripts/secret-scan.mjs` проверяет подготовленные к коммиту файлы (staged files) на наличие API-ключей Gemini/Google (`AIzaSy...`), приватных ключей (`.pem`, `.key`, `id_rsa`), `.env`-файлов и JSON-сервисных аккаунтов.
   - При обнаружении любого секрета коммит немедленно прерывается с кодом ошибки.
   - **Активация хуков в локальном репозитории:**
     ```bash
     npm run hooks:install
     # или: bun run hooks:install
     ```
2. **Исключение служебных файлов в `.gitignore`:**
   - Файлы окружения `.env`, `.env.local`, `.env.production`
   - Служебные каталоги IDE и рабочих окружений: `.idx/`, `.modified`
   - Приватные криптографические ключи и сертификаты: `*.pem`, `*.key`, `id_rsa*`
3. **Хранение секретов в продакшене:** В боевом контуре ключи (`GEMINI_API_KEY`) передаются через **Firebase App Hosting Secrets** или **Google Secret Manager** и никогда не попадают в клиентский бандл.
4. **CI-верификация:** В GitHub Actions (`.github/workflows/ci.yml`) при каждом pull request и push запускаются шаги TruffleHog OSS Scan и проверка репозитория.

---

## 🛠️ Менеджер пакетов и технологический стек

Проект поддерживает два основных менеджера пакетов:
* **[Bun](https://bun.sh/) (Рекомендуется для локальной разработки):** В репозитории присутствует `bun.lock`, обеспечивающий мгновенную установку зависимостей и высокую скорость выполнения.
* **[npm](https://www.npmjs.com/) (Стандартный менеджер Node.js):** Полная совместимость для CI/CD-пайплайнов и сред на базе Node.js 20+.

**Основной стек:**
* **Frontend & Backend:** Next.js 15+ (App Router), React 18, TypeScript 5.
* **Стилизация:** Tailwind CSS, Radix UI Primitives, Lucide Icons.
* **Картография:** Leaflet, React-Leaflet, `geofire-common` spatial hashing.
* **База данных и Auth:** Cloud Firestore с `persistentLocalCache`, Firebase Authentication, Firebase Security Rules (RBAC).
* **Искусственный Интеллект (AI Subsystem):** **Google Genkit** (`genkit` + `@genkit-ai/google-genai`) с моделью **Gemini 2.5 Flash**. Используется для оркестрации поисково-спасательного ИИ-агента (`suggestSearchAreasForLostHiker`), структурированного Zod-вывода и защищенных серверных флоу.
* **Криптография и Безопасность:** W3C Web Crypto API (Ed25519, AES-256-GCM AEAD, SHA-256), Anti-Replay, TruffleHog scanner.
* **Тестирование:** Vitest 4.x, React Testing Library, JSDOM (57 тестов, 100% pass).
* **Валидация:** Zod runtime schema validation.

---

## ⚡️ Быстрый старт (Getting Started)

### 1. Клонирование репозитория
```bash
git clone https://github.com/asakue/Treeline-Tracker.git
cd Treeline-Tracker
```

### 2. Установка зависимостей

**С использованием Bun (рекомендуется):**
```bash
bun install
```

**Или с использованием npm:**
```bash
npm install
```

### 3. Активация pre-commit хуков безопасности
```bash
# Настраивает Git на использование хуков из каталога .githooks/
bun run hooks:install
# или: npm run hooks:install
```

### 4. Настройка переменных окружения
Скопируйте шаблон `.env.example` в `.env.local` и укажите необходимые ключи:
```bash
cp .env.example .env.local
```

### 5. Запуск сервера разработки

**С использованием Bun:**
```bash
bun run dev
```

**Или с использованием npm:**
```bash
npm run dev
```

Приложение откроется по адресу [http://localhost:3000](http://localhost:3000).

---

## 📜 Доступные команды и скрипты (Available Scripts)

| Скрипт (npm / Bun) | Описание и назначение | Когда запускать |
|---|---|---|
| `npm run dev` | Запуск локального сервера разработки на порту 3000 (Next.js Turbo/HMR). | Во время активной разработки интерфейса и API. |
| `npm run test` | Запуск полного набора автоматических тестов (Vitest + RTL: 57 тестов по 6 сьютам). | **Обязательно перед созданием PR и коммитом.** |
| `npm run test:watch` | Запуск Vitest в интерактивном watch-режиме с мгновенным перезапуском при изменениях. | При разработке новых тестов и TDD. |
| `npm run typecheck` | Строгая проверка типов TypeScript (`tsc --noEmit`). | Перед каждым коммитом и в CI конвейере. |
| `npm run lint` | Проверка кода линтером ESLint 9 на соответствие кодстайлу. | Перед коммитом и в CI пайплайне. |
| `npm run security:scan` | Запуск `scripts/secret-scan.mjs` и сканера TruffleHog на утечки ключей и `.env`. | **Обязательно перед деплоем и публикацией релизов.** |
| `npm run analyze` | Запуск production-сборки с анализатором размера бандла (`@next/bundle-analyzer`). | При оптимизации размера клиентских бандлов перед релизом. |
| `npm run build` | Компиляция оптимизированной production-сборки приложения (Next.js standalone). | При подготовке к деплою в Cloud Run / App Hosting. |
| `npm run start` | Запуск скомпилированного production-сервера. | На сервере или в Docker-контейнере в проде. |
| `npm run genkit:dev` | Запуск локальной панели инструментов Genkit Developer UI (`src/ai/dev.ts`). | При тестировании и отладке промптов/флоу ИИ. |

---

## 📚 Документация проекта

* 📐 [Архитектурная спецификация (C4, RBAC, Firestore схемы, OCC)](./docs/architecture.md)
* 📋 [Функциональные требования (FR-001 – FR-025)](./docs/02-requirements/functional.md)
* ✅ [Критерии приемки и Definition of Done (AC-01 – AC-08)](./docs/02-requirements/acceptance-criteria.md)
* 🗺️ [Матрица прослеживаемости (Traceability Matrix)](./docs/09-project-management/traceability-matrix.md)
* 🔐 [Модель угроз и безопасность](./docs/04-security/threat-model.md)
* 👥 [Команда проекта и зоны ответственности](./docs/01-product/team.md)
* 📋 [Журнал изменений (CHANGELOG)](./CHANGELOG.md)
* 🔍 [Аудит кодовой базы и техдолга](./docs/00-audit/repository-audit.md)
