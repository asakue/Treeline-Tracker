# ADR-003: Паттерн репозиториев для абстракции хранилищ данных

* **Статус:** `SUPERSEDED` (Заменено решением [ADR-012: Миграция на собственный бэкенд PostgreSQL/PostGIS и REST](./ADR-012-self-hosted-postgis-and-rest-migration.md))
* **Дата:** Октябрь 2026 г. (Обновлено: Ноябрь 2026 г.)
* **Контекст решения:** Фаза 1 прототипирования

---

## 1. Исходный контекст (Historical Context)

На этапе MVP требовалось быстрое создание прототипа с real-time синхронизацией без развертывания выделенной серверной инфраструктуры. Было принято решение использовать Google Firebase (Cloud Firestore) в связке с локальным хранилищем (`LocalStorageRepository`) и тестовым моком (`MockRepository`).

Для изоляции кода от конкретного провайдера был внедрен классический паттерн **Repository**:
- `IGroupRepository`
- `IRouteRepository`
- `ILocationRepository`
- `IEmergencyRepository`

---

## 2. Актуальный статус

В версии **0.6.0** в рамках решения [ADR-012](./ADR-012-self-hosted-postgis-and-rest-migration.md) проект полностью завершил отказ от Cloud Firestore в пользу автономного бэкенда на **PostgreSQL 16 + PostGIS 3.4**, Express и WebSockets.

Слой абстракции репозиториев доказал свою эффективность: интерфейсы `IGroupRepository`, `IRouteRepository` и др. были сохранены на 100%, а облачные реализации заменены на продакшн-репозитории REST API:
- `RestGroupRepository` (`src/infrastructure/repositories/rest/rest-group-repository.ts`)
- `RestRouteRepository` (`src/infrastructure/repositories/rest/rest-route-repository.ts`)
- `RestEmergencyRepository` (`src/infrastructure/repositories/rest/rest-emergency-repository.ts`)
- `RestLocationRepository` (`src/infrastructure/repositories/rest/rest-location-repository.ts`)
с сохранением автономного фоллбэка на `LocalStorageRepository` при работе в оффлайне.
