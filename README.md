# Treeline Tracker 🌲🛰️

[![CI Pipeline](https://github.com/asakue/Treeline-Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/asakue/Treeline-Tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black)](https://nextjs.org/)
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
* **🛡️ Многоуровневая ролевая модель (RBAC):** Четкое разделение прав (`hiker` / турист, `guide` / гид-лидер, `rescuer` / оператор спасательной службы, `admin` / администратор) с принудительной проверкой в `firestore.rules`.
* **🚨 Экстренный диспетчерский пункт и SOS-маяк:** Мгновенный сигнал бедствия с фиксацией координат, высоты и заряда батареи, выделенный канал связи со спасателями.
* **🤖 Безопасный ИИ-поиск пропавших (SAR AI):** Построение вероятностных полигонов поиска с учетом рельефа и темпа движения через Genkit и Gemini 2.5 Flash с защитой от Prompt Injection, строгими Zod-схемами и аудиторским логом.
* **🗺️ Интерактивная карта и профили высот:** Высокопроизводительная отрисовка треков на базе Leaflet с кластеризацией маркеров (`leaflet.markercluster`) и оптимизацией рендеринга.
* **⚡ Offline-First устойчивость:** Персистентный кэш Firestore (`persistentLocalCache`) и локальный буфер в IndexedDB для работы в слепых зонах связи.
* **🔀 Разрешение конфликтов (OCC):** Оптимистическая блокировка версий маршрутов при одновременном редактировании несколькими гидами.

---

## 📂 Архитектура проекта (Feature-Sliced Design)

Проект построен строго по методологии **Feature-Sliced Design (FSD)** с изоляцией слоев:

```
.
├── public/                 # Статические ассеты (иконки, карты)
├── src/
│   ├── app/                # [Layer] Next.js App Router, провайдеры и API-роуты (/api/*)
│   ├── views/              # [Layer] Полностраничные композиции (страницы приложения)
│   ├── widgets/            # [Layer] Композитные UI-блоки (навигация, сайдбары, картографический HUD)
│   ├── features/           # [Layer] Пользовательские сценарии (sar-ai, route-drawing, group-management)
│   ├── entities/           # [Layer] Бизнес-сущности и доменные вычисления (group, route, hiker, emergency)
│   └── shared/             # [Layer] Переиспользуемый платформенный код без бизнес-логики
│       ├── config/         # Конфигурация Firebase и окружения
│       ├── hooks/          # Базовые хуки (use-debounce, use-geolocation)
│       ├── lib/            # Утилиты (geohash, formatters, cn)
│       └── ui/             # Атомарные компоненты (shadcn/ui, Radix)
├── docs/                   # Инженерная спецификация, схемы и ADR
├── .env.example            # Шаблон переменных окружения (без секретов)
├── firestore.rules         # Декларативные правила безопасности базы данных
├── package.json
└── README.md
```

---

## 🔒 Безопасность и управление секретами

1. **Защита ключей:** Никаких секретов в репозитории. Файлы `.env` и `.env.local` внесены в `.gitignore`.
2. **Управление секретами:** В production все приватные ключи (`GEMINI_API_KEY`, токены) хранятся в **Google Secret Manager** / **Firebase App Hosting Secrets** и доступны исключительно в server-side роутах (`/api/*`).
3. **Pre-commit проверки:** Интеграция `trufflehog` / `git-secrets` для блокировки случайного коммита приватных ключей.
4. **Валидация данных:** Все входящие координаты, идентификаторы и сообщения валидируются с помощью Zod на границе API.
5. **Изоляция ИИ:** LLM не имеет прямого доступа к записи в базу данных; все рекомендации проходят валидацию и подтверждение оператором.

---

## 🛠️ Технологический стек

* **Frontend & Backend:** Next.js 15+ (App Router), React 18, TypeScript 5.
* **Стилизация:** Tailwind CSS, Radix UI Primitives, Lucide Icons.
* **Картография:** Leaflet, React-Leaflet, `geofire-common`.
* **База данных и Auth:** Cloud Firestore, Firebase Authentication, Firebase Security Rules.
* **Искусственный Интеллект:** Google Genkit, Gemini 2.5 Flash (`@google/genai`).
* **Валидация:** Zod runtime schema validation.
* **Тестирование:** Vitest, React Testing Library.
* **CI/CD:** GitHub Actions (Lint, Typecheck, Test, Build, Firebase Deployment).

---

## ⚡️ Быстрый старт (Getting Started)

### 1. Клонирование репозитория
```bash
git clone https://github.com/asakue/Treeline-Tracker.git
cd Treeline-Tracker
```

### 2. Установка зависимостей
```bash
npm install
```

### 3. Настройка переменных окружения
Скопируйте шаблон `.env.example` в `.env.local` и укажите необходимые ключи:
```bash
cp .env.example .env.local
```

### 4. Запуск сервера разработки
```bash
npm run dev
```
Приложение будет доступно по адресу [http://localhost:3000](http://localhost:3000).

---

## 📜 Доступные npm-скрипты

* `npm run dev` — Запуск локального сервера разработки.
* `npm run build` — Компиляция production-сборки.
* `npm run start` — Запуск скомпилированного сервера.
* `npm run lint` — Статический анализ кода ESLint.
* `npm run typecheck` — Проверка типов TypeScript без генерации файлов.
* `npm run test` — Запуск модульных и интеграционных тестов (Vitest).

---

## 📚 Подробная документация (Documentation)

* 📐 [Архитектурная спецификация и C4-диаграмма](./docs/architecture.md)
* 🔐 [Модель угроз и безопасность](./docs/04-security/threat-model.md)
* 👥 [Профиль команды и зона ответственности](./docs/01-product/team.md)
* 📋 [Журнал изменений (CHANGELOG)](./CHANGELOG.md)
* 🔍 [Аудит кодовой базы](./docs/00-audit/repository-audit.md)
