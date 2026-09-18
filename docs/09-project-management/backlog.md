# Бэклог задач проекта (Project Backlog)

**Статус документа:** `COMPLETED`  
**Категория:** Управление проектом (`09-project-management`)

---

## Реестр декомпозированных инженерных задач

| ID | Название задачи | Приоритет | Зависимости | Критерии приемки (DoD) | Статус | Требование |
|---|---|---|---|---|---|---|
| **TASK-001** | Полный аудит кодовой базы и инвентаризация зависимостей | Critical | None | Сформирован `docs/00-audit/repository-audit.md` | `DONE` | NFR-013 |
| **TASK-002** | Формирование продуктового пула документации (Vision, Scope, Problem) | High | TASK-001 | Созданы файлы в `docs/01-product/` | `DONE` | FR-001..025 |
| **TASK-003** | Разработка реестра требований и критериев приемки | High | TASK-002 | Созданы `functional.md`, `non-functional.md` | `DONE` | NFR-001..015 |
| **TASK-004** | Разработка системной архитектуры C4 и потоков данных | High | TASK-003 | Созданы `system.md`, `data-flow.md` | `DONE` | NFR-013 |
| **TASK-005** | Разработка пакета архитектурных решений (ADR 001–009) | High | TASK-004 | Созданы 9 ADR в `docs/03-architecture/adr/` | `DONE` | NFR-013 |
| **TASK-006** | Разработка модели угроз и матрицы безопасности | Critical | TASK-003 | Сформирован `docs/04-security/threat-model.md` | `DONE` | NFR-001..004 |
| **TASK-007** | Исследование протокола MeshCore и BLE API | High | TASK-003 | Создан `docs/05-mesh/meshcore-research.md` | `DONE` | FR-012 |
| **TASK-008** | Формирование дорожной карты и бэклога задач | High | TASK-001 | Созданы `roadmap.md`, `backlog.md` | `DONE` | NFR-013 |
| **TASK-009** | Создание доменных интерфейсов LocationUpdate и Group | High | TASK-004 | Чистые TypeScript типы в `src/core/domain/` | `PLANNED` | FR-006, FR-007 |
| **TASK-010** | Реализация интерфейса IGroupRepository и LocalStorage адаптера | High | TASK-009 | Изоляция групп за абстрактным интерфейсом | `PLANNED` | FR-002, FR-003 |
| **TASK-011** | Реализация IRouteRepository для работы с маршрутами | Medium | TASK-009 | Вынос треков из монолитных компонентов | `PLANNED` | FR-004, FR-005 |
| **TASK-012** | Устранение дубликатов файлов между `components` и `views` | High | TASK-009 | Единая консистентная структура каталогов | `PLANNED` | NFR-013 |
| **TASK-013** | Генерация ключевых пар Ed25519 (Identity Service) | Critical | TASK-009 | Создание профиля с открытым и закрытым ключом | `PLANNED` | FR-001, NFR-004 |
| **TASK-014** | Реализация шифрования полезной нагрузки AES-256-GCM | Critical | TASK-013 | Функция `encryptPayload(data, groupKey)` | `PLANNED` | FR-007, NFR-002 |
| **TASK-015** | Реализация цифровой подписи пакета Ed25519 | Critical | TASK-013 | Функция `signPacket(data, privateKey)` | `PLANNED` | FR-008, NFR-002 |
| **TASK-016** | Реализация дешифрования и валидации целостности AEAD | Critical | TASK-014 | Функция `decryptPayload(packet, groupKey)` | `PLANNED` | FR-007, NFR-003 |
| **TASK-017** | Реализация защиты от повторов (Sequence & Freshness Window) | Critical | TASK-016 | Отклонение старых пакетов с `timestamp` > 10m | `PLANNED` | FR-009, NFR-003 |
| **TASK-018** | Реализация режимов приватности (Normal, Reduced, Stealth) | High | TASK-014 | Огрубление координат при `REDUCED_PRIVACY` | `PLANNED` | FR-022, NFR-005 |
| **TASK-019** | Создание интерфейса ITransport и базовых типов результата | High | TASK-009 | Контракт `sendLocation`, `sendEmergency` | `PLANNED` | FR-010 |
| **TASK-020** | Реализация InternetTransport (Fetch/WSS адаптер) | High | TASK-019 | Отправка пакета при наличии сотовой сети | `PLANNED` | FR-011 |
| **TASK-021** | Реализация программного симулятора MockMeshCoreTransport | High | TASK-019 | Виртуальная топология узлов и задержки | `PLANNED` | FR-012, NFR-014 |
| **TASK-022** | Реализация TransportManager и Failover Controller | High | TASK-020, TASK-021 | Автопереключение `Internet ➔ Mesh ➔ Queue` | `PLANNED` | FR-010, NFR-010 |
| **TASK-023** | Реализация локальной очереди Store-and-Forward | High | TASK-022 | IndexedDB буфер с лимитом 500 пакетов | `PLANNED` | FR-013, NFR-012 |
| **TASK-024** | Реализация алгоритма дедупликации и фоновой синхронизации | High | TASK-023 | Сброс буфера при возврате сети без дублей | `PLANNED` | FR-014 |
| **TASK-025** | Разработка интерактивной панели управления симуляцией отказов | High | TASK-022 | UI переключатели потерь, задержек и атак | `PLANNED` | FR-024, NFR-014 |
| **TASK-026** | Реализация лога событий симулятора (Observability Log) | Medium | TASK-025 | Потоковый лог событий в реальном времени | `PLANNED` | FR-025 |
| **TASK-027** | Разработка панели статуса безопасности (Safety Bar UI) | High | TASK-022 | Индикация GPS, транспорта, шифрования, АКБ | `PLANNED` | FR-023 |
| **TASK-028** | Реализация экстренной кнопки SOS с защитой от ложного нажатия | Critical | TASK-009 | Удержание кнопки 3 секунды + звуковой сигнал | `PLANNED` | FR-015 |
| **TASK-029** | Формирование подписанного EmergencyEvent и рассылка | Critical | TASK-028, TASK-015 | Экстренная рассылка по всем каналам связи | `PLANNED` | FR-016 |
| **TASK-030** | Реализация MockEmergencyGateway (шлюз 112 со спас-статусом) | Medium | TASK-029 | Имитация ответа координатора спасателей | `PLANNED` | FR-017 |
| **TASK-031** | Доработка ИИ-инструмента поиска пропавших (Lost Hiker Tool) | Medium | TASK-004 | Расчет confidence и факторов рельефа/погоды | `PLANNED` | FR-018, FR-019 |
| **TASK-032** | Добавление явного дисклеймера в ИИ-выдачу | High | TASK-031 | Предупреждение о рекомендательном характере | `PLANNED` | FR-019 |
| **TASK-033** | Написание юнит-тестов доменных сущностей и Zod схем | High | TASK-009 | 100% покрытие базовых типов тестами | `PLANNED` | NFR-013 |
| **TASK-034** | Написание Security-тестов на крипто-стойкость и replay-атаки | Critical | TASK-017 | Тесты на отклонение измененного шифротекста | `PLANNED` | NFR-002, NFR-003 |
| **TASK-035** | Написание тестов транспорта и сценариев Failover | High | TASK-022 | Тесты переключения Internet ➔ Mesh ➔ Queue | `PLANNED` | NFR-010 |
| **TASK-036** | Разработка руководства пользователя (User Guide) | Medium | TASK-027 | Документы в `docs/user/` | `PLANNED` | FR-001..025 |
| **TASK-037** | Разработка руководства разработчика (Developer Guide) | Medium | TASK-004 | Документы в `docs/development/` | `PLANNED` | NFR-013 |
| **TASK-038** | Разработка отчета о разрыве с промышленным уровнем (Production Gap) | High | TASK-007 | `docs/08-deployment/production-migration.md` | `PLANNED` | NFR-001..015 |
