# Документация Treeline Tracker

**Treeline Tracker** — Защищенная распределенная система обеспечения безопасности, мониторинга и координации туристических групп в условиях дикой природы с гибридным транспортом передачи данных (Internet / Mesh-сети LoRa) и содействием поисково-спасательным операциям (SAR).

---

## 🧭 Навигация по разделам

### 📐 [Главная архитектурная спецификация](./architecture.md)
* [Архитектура системы, C4, RBAC, Схемы PostGIS, Real-time WebSockets, LoRa Mesh и ИИ](./architecture.md)

### [00. Аудит репозитория (Audit)](./00-audit/)
* [Аудит репозитория и анализ технического долга](./00-audit/repository-audit.md) — детальный анализ исходного кода, выявление дубликатов, оценка безопасности и статусов компонентов.

### [01. О продукте (Product)](./01-product/)
* [Команда проекта](./01-product/team.md) — профиль команды (Даниил, Александр, Кирилл), зоны ответственности и инженерные принципы.
* [Проблема](./01-product/problem.md) — вызовы безопасности в дикой природе, слепые зоны сотовой связи и риски приватности.
* [Видение](./01-product/vision.md) — концепция privacy-preserving outdoor safety платформы.
* [Границы и область охвата](./01-product/scope.md) — разграничение реальной функциональности, симуляции и физического оборудования.
* [Персоны пользователей](./01-product/personas.md) — профили пользователей (руководитель похода, участник, координатор спасательных работ).
* [Сценарии использования (Use Cases)](./01-product/use-cases.md) — детальное описание основных пользовательских сценариев.

### [02. Требования (Requirements)](./02-requirements/)
* [Функциональные требования](./02-requirements/functional.md) — спецификация требований `FR-001` – `FR-032`.
* [Нефункциональные требования](./02-requirements/non-functional.md) — безопасность, производительность, надежность `NFR-001` – `NFR-017`.
* [Критерии приемки (Acceptance Criteria)](./02-requirements/acceptance-criteria.md) — критерии готовности фич по Definition of Done.

### [03. Архитектура системы (Architecture)](./03-architecture/)
* [Системная архитектура](./03-architecture/system.md) — многоуровневая архитектура C4 (Клиент, Бэкенд, PostGIS, MQTT, LoRa Mesh).
* [Фронтенд-архитектура](./03-architecture/frontend.md) — модульный реестр экранов View Registry, ViewErrorBoundary, физика рельефа и Leaflet.
* [Бэкенд и хранение данных](./03-architecture/backend.md) — архитектура Express, Drizzle ORM, пространственные запросы PostGIS, REST-репозитории, WebSocket engine.
* [Коммуникационный слой](./03-architecture/communication.md) — Transport Manager, многоканальная модель: HTTPS REST ➔ WSS ➔ LoRa Mesh ➔ Оффлайн-очередь IndexedDB.
* [Потоки данных (Data Flow)](./03-architecture/data-flow.md) — схемы прохождения пакетов от GPS-приемника до отображения на тактической карте.
* **[Архитектурные решения (ADR)](./03-architecture/adr/):**
  * [ADR-001: Выбор Next.js App Router](./03-architecture/adr/ADR-001-why-nextjs.md)
  * [ADR-002: Выбор Leaflet](./03-architecture/adr/ADR-002-why-leaflet.md)
  * [ADR-003: Репозиторный паттерн хранилищ (Устарело, см. ADR-012)](./03-architecture/adr/ADR-003-why-firebase-and-mock-repositories.md)
  * [ADR-004: Использование спецификации MeshCore / Meshtastic](./03-architecture/adr/ADR-004-why-meshcore.md)
  * [ADR-005: Гибридный транспорт и отказоустойчивость (Failover)](./03-architecture/adr/ADR-005-hybrid-connectivity-and-failover.md)
  * [ADR-006: Стратегия сквозного шифрования (E2EE)](./03-architecture/adr/ADR-006-encryption-strategy.md)
  * [ADR-007: Политика хранения и минимизации геоданных](./03-architecture/adr/ADR-007-location-retention-policy.md)
  * [ADR-008: ИИ как система поддержки принятия решений (Decision Support)](./03-architecture/adr/ADR-008-ai-as-decision-support.md)
  * [ADR-009: Архитектура детерминированного симулятора](./03-architecture/adr/ADR-009-simulation-architecture.md)
  * [ADR-010: Автономное определение региона и физико-рельефная классификация](./03-architecture/adr/ADR-010-autonomous-terrain-and-geographic-classification.md)
  * [ADR-011: Модульный реестр экранов View Registry и изоляция сбоев](./03-architecture/adr/ADR-011-view-registry-and-error-isolation.md)
  * [ADR-012: Миграция на собственный бэкенд PostgreSQL/PostGIS, REST и WebSockets](./03-architecture/adr/ADR-012-self-hosted-postgis-and-rest-migration.md)

### [04. Безопасность и Приватность (Security & Privacy)](./04-security/)
* [Модель угроз (Threat Model)](./04-security/threat-model.md) — классификация ассетов, акторов, защита секретов и гардрейлы ИИ.
* [Идентификация и RBAC-модель](./04-security/identity.md) — роли пользователей (`hiker`, `guide`, `rescuer`, `admin`), JWT-сессии, Argon2 и Web Crypto.
* [Политика приватности геоданных](./04-security/privacy.md) — минимизация, режимы приватности (`NORMAL`, `REDUCED`, `STEALTH`) и очистка истории.
* [Спецификация шифрования](./04-security/encryption.md) — структура EncryptedPacket, nonce, authTag, цифровая подпись Ed25519.
* [Управление ключами (Key Management)](./04-security/key-management.md) — обмен групповыми ключами AES-256-GCM и жизненный цикл.

### [05. Mesh-сети и исследование MeshCore (MeshCore Research)](./05-mesh/)
* [Исследование MeshCore и Meshtastic](./05-mesh/meshcore-research.md) — анализ протокола, пакетная модель, топология, аппаратно-программные интерфейсы WebSerial / WebBluetooth.

### [09. Управление проектом (Project Management)](./09-project-management/)
* [Дорожная карта (Roadmap)](./09-project-management/roadmap.md) — фазы 0–8 (включая Фазу 6: PostGIS бэкенд и LoRa Mesh подсистему).
* [Бэклог задач (Backlog)](./09-project-management/backlog.md) — детальный реестр задач с приоритетами и критериями приемки.
* [Матрица прослеживаемости (Traceability Matrix)](./09-project-management/traceability-matrix.md) — связка: Требование ➔ Архитектура ➔ Код ➔ Тест ➔ Документ.

---

## 🏷️ Статусы компонентов и функциональности

| Статус | Значение |
|---|---|
| `IMPLEMENTED` | Реализовано в коде и полностью функционально |
| `SIMULATED` | Работает через программную симуляцию/эмуляцию |
| `PROTOTYPE` | Работающий прототип / концепт с известными ограничениями |
| `RESEARCH` | Проведено техническое исследование / анализ |
| `PLANNED` | Запланировано к разработке в будущих фазах |
| `NOT_IMPLEMENTED` | Осознанно не реализовано в текущей версии |
| `OUT_OF_SCOPE` | Выходит за рамки учебного/инженерного прототипа |
