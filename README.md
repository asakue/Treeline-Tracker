# Treeline Tracker 🌲🛰️

[![CI Pipeline](https://github.com/asakue/Treeline-Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/asakue/Treeline-Tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black)](https://nextjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1+-fbf0df?logo=bun)](https://bun.sh/)
[![Firebase](https://img.shields.io/badge/Firebase-v11-orange)](https://firebase.google.com/)
[![Genkit](https://img.shields.io/badge/Genkit-Gemini%202.5%20Flash-blue)](https://firebase.google.com/docs/genkit)

**Treeline Tracker** — современная защищенная веб-платформа для координации туристических групп, мониторинга местоположения участников в реальном времени и содействия поисково-спасательным операциям (Search & Rescue / SAR) в условиях дикой природы и высокогорья.

---

## 👥 Команда проекта (Core Team)

* **Дмитрий** — Автор идеи (надежность и полевые требования к снаряжению и софту).
* **Даниил** — Главный архитектор и ведущий разработчик (архитектура FSD, отказоустойчивость, безопасность).
* **Илья** — Руководитель проекта (стратегия, продуктовое развитие и координация).
* **Александр** — Разработчик (функциональные модули, картография и интеграции).
* **Кирилл** — Разработчик (клиентские и серверные компоненты, оптимизация работы системы).

---

## 🚀 Ключевые возможности (Key Features)

* **📡 Real-time трекинг с гео-индексацией:** Синхронизация координат участников через слушатели `onSnapshot` Firestore и пространственный поиск на базе `geofire-common` (geohash 7–8) с адаптивным троттлингом (5–10 сек) и deadband-фильтрацией для экономии батареи.
* **🛡️ Многоуровневая ролевая модель (RBAC):** Четкое разделение прав (`hiker` / турист, `guide` / `leader` / лидер группы, `rescuer` / `operator` / оператор спасательной службы, `admin` / администратор) с принудительной проверкой в `firestore.rules`.
* **🚨 Экстренный диспетчерский пункт и SOS-маяк:** Мгновенный сигнал бедствия с фиксацией координат, высоты и заряда батареи, выделенный канал связи со спасателями.
* **🤖 Безопасный ИИ-поиск пропавших (SAR AI):** Построение вероятностных полигонов поиска с учетом рельефа и темпа движения через Genkit и Gemini 2.5 Flash с защитой от Prompt Injection, строгими Zod-схемами и неизменяемым аудиторским логом.
* **🗺️ Интерактивная карта и профили высот:** Высокопроизводительная отрисовка треков на базе Leaflet с кластеризацией маркеров (`leaflet.markercluster`) и оптимизацией рендеринга.
* **⚡ Offline-First устойчивость:** Персистентный кэш Firestore (`persistentLocalCache`) и локальный буфер в IndexedDB для работы в слепых зонах связи.
* **🔀 Разрешение конфликтов (OCC):** Оптимистическая блокировка версий маршрутов при одновременном редактировании несколькими гидами.

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
│   ├── features/           # [Features Layer] Пользовательские фичи (group-management, hiker-search, route-drawing)
│   ├── entities/           # [Entities Layer] Доменные бизнес-сущности (group, route, hiker, app)
│   ├── core/               # [Core Domain] Архитектурное ядро
│   │   ├── domain/         # Интерфейсы доменных моделей
│   │   ├── repositories/   # Абстракции репозиториев (Firebase / LocalStorage)
│   │   ├── security/       # Криптографические протоколы (E2EE, генерация ключевых пар)
│   │   └── utils/          # Вспомогательные утилиты ядра
│   ├── ai/                 # [AI Subsystem] Конфигурация Genkit и модели Gemini
│   │   ├── genkit.ts       # Инициализация Genkit AI runtime
│   │   └── flows/          # AI-флоу поиска пропавших (lost-hiker-flow)
│   ├── firebase/           # [Infrastructure] Клиентская инициализация Firebase SDK и контекст-провайдеры
│   ├── shared/             # [Shared Layer] Переиспользуемая инфраструктура
│   │   ├── ui/             # UI-компоненты (shadcn/ui, Radix primitives)
│   │   ├── lib/            # Базовые утилиты (geohash, tailwind-merge, clsx)
│   │   ├── config/         # Конфигурационные константы
│   │   └── hooks/          # Инфраструктурные хуки (use-debounce, use-geolocation)
│   ├── components/         # UI-компоненты и виджеты приложения
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
* **Картография:** Leaflet, React-Leaflet, `geofire-common`.
* **База данных и Auth:** Cloud Firestore, Firebase Authentication, Firebase Security Rules (RBAC).
* **Искусственный Интеллект:** Google Genkit, Gemini 2.5 Flash (`@google/genai`).
* **Валидация:** Zod runtime validation.
* **Безопасность:** TruffleHog, Git Hooks, Zod Schemas.

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

## 📜 Доступные команды и скрипты

| Команда (Bun) | Команда (npm) | Назначение |
|---|---|---|
| `bun run dev` | `npm run dev` | Запуск локального сервера разработки на порту 3000 |
| `bun run build` | `npm run build` | Компиляция оптимизированной production-сборки |
| `bun run start` | `npm run start` | Запуск собранного production-сервера |
| `bun run lint` | `npm run lint` | Проверка кода линтером ESLint 9 |
| `bun run typecheck` | `npm run typecheck` | Статическая проверка типов TypeScript (`tsc --noEmit`) |
| `bun run security:scan` | `npm run security:scan` | Ручной запуск сканера секретов и опасных файлов |
| `bun run hooks:install` | `npm run hooks:install` | Привязка pre-commit хуков с TruffleHog к Git |
| `bun run analyze` | `npm run analyze` | Анализ размера клиентского бандла через bundle-analyzer |

---

## 📚 Документация проекта

* 📐 [Архитектурная спецификация (C4, RBAC, Firestore схемы, OCC)](./docs/architecture.md)
* 🔐 [Модель угроз и безопасность](./docs/04-security/threat-model.md)
* 👥 [Команда проекта и зоны ответственности](./docs/01-product/team.md)
* 📋 [Журнал изменений (CHANGELOG)](./CHANGELOG.md)
* 🔍 [Аудит кодовой базы и техдолга](./docs/00-audit/repository-audit.md)
