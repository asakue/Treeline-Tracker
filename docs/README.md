# Документация Treeline Tracker

**Treeline Tracker** — Прототип защищенной системы обеспечения безопасности и координации туристических групп в условиях дикой природы с гибридным транспортом передачи данных (Internet / Mesh-сети) и сквозным шифрованием (E2EE).

---

## 🧭 Навигация по разделам

### [00. Аудит репозитория (Audit)](./00-audit/)
- [Аудит репозитория и анализ технического долга](./00-audit/repository-audit.md) — детальный анализ исходного кода, выявление дубликатов, хардкода, оценка безопасности и статусов компонентов.

### [01. О продукте (Product)](./01-product/)
- [Проблема](./01-product/problem.md) — вызовы безопасности в дикой природе, слепые зоны сотовой связи и риски приватности.
- [Видение](./01-product/vision.md) — концепция privacy-preserving outdoor safety платформы.
- [Границы и область охвата](./01-product/scope.md) — разграничение реальной функциональности, симуляции и ограничений прототипа.
- [Персоны пользователей](./01-product/personas.md) — профили пользователей (руководитель похода, участник, координатор спасательных работ).
- [Сценарии использования (Use Cases)](./01-product/use-cases.md) — детальное описание основных пользовательских сценариев.

### [02. Требования (Requirements)](./02-requirements/)
- [Функциональные требования](./02-requirements/functional.md) — спецификация требований `FR-001` – `FR-030`.
- [Нефункциональные требования](./02-requirements/non-functional.md) — безопасность, производительность, надежность `NFR-001` – `NFR-015`.
- [Критерии приемки (Acceptance Criteria)](./02-requirements/acceptance-criteria.md) — критерии готовности фич по Definition of Done.

### [03. Архитектура системы (Architecture)](./03-architecture/)
- [Системная архитектура](./03-architecture/system.md) — многоуровневая архитектура C4 (Context, Container, Component).
- [Фронтенд-архитектура](./03-architecture/frontend.md) — разделение на UI, Application и Domain слои.
- [Бэкенд и хранение данных](./03-architecture/backend.md) — абстракция репозиториев, Firebase и Local Storage.
- [Коммуникационный слой](./03-architecture/communication.md) — Transport Manager, гибридная модель Internet + Mesh.
- [Потоки данных (Data Flow)](./03-architecture/data-flow.md) — схемы прохождения пакетов от GPS до рендеринга на карте.
- **[Архитектурные решения (ADR)](./03-architecture/adr/):**
  - [ADR-001: Выбор Next.js App Router](./03-architecture/adr/ADR-001-why-nextjs.md)
  - [ADR-002: Выбор Leaflet](./03-architecture/adr/ADR-002-why-leaflet.md)
  - [ADR-003: Паттерн репозиториев для Firebase и LocalStorage](./03-architecture/adr/ADR-003-why-firebase-and-mock-repositories.md)
  - [ADR-004: Использование спецификации MeshCore](./03-architecture/adr/ADR-004-why-meshcore.md)
  - [ADR-005: Гибридный транспорт и отказоустойчивость (Failover)](./03-architecture/adr/ADR-005-hybrid-connectivity-and-failover.md)
  - [ADR-006: Стратегия сквозного шифрования (E2EE)](./03-architecture/adr/ADR-006-encryption-strategy.md)
  - [ADR-007: Политика хранения и минимизации геоданных](./03-architecture/adr/ADR-007-location-retention-policy.md)
  - [ADR-008: ИИ как система поддержки принятия решений (Decision Support)](./03-architecture/adr/ADR-008-ai-as-decision-support.md)
  - [ADR-009: Архитектура детерминированного симулятора](./03-architecture/adr/ADR-009-simulation-architecture.md)

### [04. Безопасность и Приватность (Security & Privacy)](./04-security/)
- [Модель угроз (Threat Model)](./04-security/threat-model.md) — классификация ассетов (A1–A7), акторов (T1–T7) и матрица митигации.
- [Политика приватности геоданных](./04-security/privacy.md) — минимизация, режимы приватности и очистка истории.
- [Спецификация шифрования](./04-security/encryption.md) — структура EncryptedPacket, nonce, authTag, цифровая подпись.
- [Идентификация и ключевые пары](./04-security/identity.md) — генерация ключей и цифровая идентификация участников.
- [Управление ключами (Key Management)](./04-security/key-management.md) — обмен групповыми ключами и жизненный цикл.

### [05. Mesh-сети и исследование MeshCore (MeshCore Research)](./05-mesh/)
- [Исследование MeshCore](./05-mesh/meshcore-research.md) — анализ протокола, пакетная модель, топология, BLE-интерфейс и симуляция.

### [09. Управление проектом (Project Management)](./09-project-management/)
- [Дорожная карта (Roadmap)](./09-project-management/roadmap.md) — фазы 0–8.
- [Бэклог задач (Backlog)](./09-project-management/backlog.md) — детальный реестр задач с приоритетами и критериями приемки.
- [Матрица прослеживаемости (Traceability Matrix)](./09-project-management/traceability-matrix.md) — связка Требование ➔ Архитектура ➔ Код ➔ Тест ➔ Документ.

---

## 🏷️ Статусы компонентов и функциональности

В проекте строго соблюдается разделение статусов:

| Статус | Значение |
|---|---|
| `IMPLEMENTED` | Реализовано в коде и полностью функционально |
| `SIMULATED` | Работает через программную симуляцию/эмуляцию |
| `PROTOTYPE` | Работающий прототип / концепт с известными ограничениями |
| `RESEARCH` | Проведено техническое исследование / анализ |
| `PLANNED` | Запланировано к разработке в будущих фазах |
| `NOT_IMPLEMENTED` | Осознанно не реализовано в текущей версии |
| `OUT_OF_SCOPE` | Выходит за рамки учебного/инженерного прототипа |
