# Бэклог задач проекта (Project Backlog)

**Статус документа:** `COMPLETED & UPDATED`  
**Категория:** Управление проектом (`09-project-management`)  
**Актуализация:** Октябрь 2026 г. (Версия: 0.5.0)

---

## Реестр декомпозированных инженерных задач

| ID | Название задачи | Приоритет | Зависимости | Критерии приемки (DoD) | Статус | Требование |
|---|---|---|---|---|---|---|
| **TASK-001** | Полный аудит кодовой базы и инвентаризация зависимостей | Critical | None | Сформирован `docs/00-audit/repository-audit.md` | `DONE` | NFR-013 |
| **TASK-002** | Формирование продуктового пула документации (Vision, Scope, Problem) | High | TASK-001 | Созданы файлы в `docs/01-product/` | `DONE` | FR-001..025 |
| **TASK-003** | Разработка реестра требований и критериев приемки | High | TASK-002 | Созданы `functional.md`, `non-functional.md` | `DONE` | NFR-001..017 |
| **TASK-004** | Разработка системной архитектуры C4 и потоков данных | High | TASK-003 | Созданы `system.md`, `data-flow.md` | `DONE` | NFR-013 |
| **TASK-005** | Разработка пакета архитектурных решений (ADR 001–009) | High | TASK-004 | Созданы 9 ADR в `docs/03-architecture/adr/` | `DONE` | NFR-013 |
| **TASK-006** | Разработка модели угроз и матрицы безопасности | Critical | TASK-003 | Сформирован `docs/04-security/threat-model.md` | `DONE` | NFR-001..004 |
| **TASK-007** | Исследование протокола MeshCore и BLE API | High | TASK-003 | Создан `docs/05-mesh/meshcore-research.md` | `DONE` | FR-012 |
| **TASK-008** | Формирование дорожной карты и бэклога задач | High | TASK-001 | Созданы `roadmap.md`, `backlog.md` | `DONE` | NFR-013 |
| **TASK-009** | Создание доменных интерфейсов LocationUpdate и Group | High | TASK-004 | Чистые TypeScript типы в `src/core/domain/` | `DONE` | FR-006, FR-007 |
| **TASK-010** | Реализация интерфейса IGroupRepository и LocalStorage адаптера | High | TASK-009 | Изоляция групп за абстрактным интерфейсом | `DONE` | FR-002, FR-003 |
| **TASK-011** | Реализация IRouteRepository для работы с маршрутами | Medium | TASK-009 | Вынос треков из монолитных компонентов | `DONE` | FR-004, FR-005 |
| **TASK-012** | Устранение дубликатов файлов между `components` и `views` | High | TASK-009 | Единая консистентная структура каталогов | `DONE` | NFR-013 |
| **TASK-013** | Генерация ключевых пар Ed25519 (Identity Service) | Critical | TASK-009 | Создание профиля с открытым и закрытым ключом | `DONE` | FR-001, NFR-004 |
| **TASK-014** | Реализация шифрования полезной нагрузки AES-256-GCM | Critical | TASK-013 | Функция `encryptPayload(data, groupKey)` | `DONE` | FR-007, NFR-002 |
| **TASK-015** | Реализация цифровой подписи пакета Ed25519 | Critical | TASK-013 | Функция `signPacket(data, privateKey)` | `DONE` | FR-008, NFR-002 |
| **TASK-016** | Реализация дешифрования и валидации целостности AEAD | Critical | TASK-014 | Функция `decryptPayload(packet, groupKey)` | `DONE` | FR-007, NFR-003 |
| **TASK-017** | Реализация защиты от повторов (Sequence & Freshness Window) | Critical | TASK-016 | Отклонение старых пакетов с `timestamp` > 10m | `DONE` | FR-009, NFR-003 |
| **TASK-018** | Реализация режимов приватности (Normal, Reduced, Stealth, Emergency) | High | TASK-014 | Огрубление координат и аварийный байпас при SOS | `DONE` | FR-022, NFR-005 |
| **TASK-019** | Создание интерфейса ITransport и базовых типов результата | High | TASK-009 | Контракт `sendLocation`, `sendEmergency` | `DONE` | FR-010 |
| **TASK-020** | Реализация InternetTransport (Fetch/WSS адаптер) | High | TASK-019 | Отправка пакета при наличии сотовой сети | `DONE` | FR-011 |
| **TASK-021** | Реализация программного симулятора MockMeshCoreTransport | High | TASK-019 | Виртуальная топология узлов и задержки | `DONE` | FR-012, NFR-014 |
| **TASK-022** | Реализация TransportManager и Failover Controller | High | TASK-020, TASK-021 | Автопереключение `Internet ➔ Mesh ➔ Queue` | `DONE` | FR-010, NFR-010 |
| **TASK-023** | Реализация локальной очереди Store-and-Forward | High | TASK-022 | IndexedDB буфер с лимитом 500 пакетов | `DONE` | FR-013, NFR-012 |
| **TASK-024** | Реализация алгоритма дедупликации и фоновой синхронизации | High | TASK-023 | Сброс буфера при возврате сети без дублей | `DONE` | FR-014 |
| **TASK-025** | Разработка интерактивной панели управления симуляцией отказов | High | TASK-022 | UI переключатели потерь, задержек и атак | `DONE` | FR-024, NFR-014 |
| **TASK-026** | Реализация лога событий симулятора (Observability Log) | Medium | TASK-025 | Потоковый лог событий в реальном времени | `DONE` | FR-025 |
| **TASK-027** | Разработка панели статуса безопасности (Safety Bar UI) | High | TASK-022 | Индикация GPS, транспорта, шифрования, АКБ | `DONE` | FR-023 |
| **TASK-028** | Реализация экстренной кнопки SOS с защитой от ложного нажатия | Critical | TASK-009 | Удержание кнопки 3 секунды + звуковой сигнал | `DONE` | FR-015 |
| **TASK-029** | Формирование подписанного EmergencyEvent и рассылка | Critical | TASK-028, TASK-015 | Экстренная рассылка по всем каналам связи | `DONE` | FR-016 |
| **TASK-030** | Реализация MockEmergencyGateway (шлюз 112 со спас-статусом) | Medium | TASK-029 | Имитация ответа координатора спасателей | `DONE` | FR-017 |
| **TASK-031** | Доработка ИИ-инструмента поиска пропавших (Lost Hiker Tool) | Medium | TASK-004 | Расчет confidence и факторов рельефа/погоды | `DONE` | FR-018, FR-019 |
| **TASK-032** | Добавление явного дисклеймера в ИИ-выдачу | High | TASK-031 | Предупреждение о рекомендательном характере | `DONE` | FR-019 |
| **TASK-033** | Написание юнит-тестов доменных сущностей, утилит и GPX | High | TASK-009 | 100% покрытие типов, утилит и GPX тестами (`gpx-exporter.test.ts`) | `DONE` | NFR-013 |
| **TASK-034** | Написание Security-тестов на крипто-стойкость и replay-атаки | Critical | TASK-017 | Автотесты Ed25519, AES-GCM AEAD, Anti-Replay (`security-phase2.test.ts`) | `DONE` | NFR-002, NFR-003 |
| **TASK-035** | Написание тестов транспорта и сценариев Failover | High | TASK-022 | Тесты переключения Internet ➔ Mesh ➔ Queue | `DONE` | NFR-010 |
| **TASK-036** | Разработка руководства пользователя (User Guide) | Medium | TASK-027 | Документы в `docs/user/` | `PLANNED` | FR-001..027 |
| **TASK-037** | Разработка руководства разработчика (Developer Guide) | Medium | TASK-004 | Документы в `docs/development/` | `PLANNED` | NFR-013 |
| **TASK-038** | Разработка отчета о разрыве с промышленным уровнем (Production Gap) | High | TASK-007 | `docs/08-deployment/production-migration.md` | `PLANNED` | NFR-001..017 |
| **TASK-039** | Разработка интерфейса профиля и безопасности (`ProfilePage`) | High | TASK-013, TASK-018 | Расчет прогресса, Ed25519 key UI, селектор приватности (`profile-page.tsx`) | `DONE` | FR-001, FR-022 |
| **TASK-040** | Автотесты интерфейса профиля и криптографии (Vitest + RTL) | High | TASK-039 | 16 проверок в `src/views/__tests__/profile-page.test.tsx` (100% pass) | `DONE` | NFR-013, FR-001 |
| **TASK-041** | Интеграция провайдеров аутентификации Firebase (Email, Google, Anonymous) | Critical | TASK-013 | Поддержка входа по Email/Паролю, Google OAuth и гостевого входа | `DONE` | FR-001a |
| **TASK-042** | Механизм связывания гостевого аккаунта с постоянным профилем (Account Linking) | High | TASK-041 | Бесшовный перенос накопленных треков и групп из анонимного сеанса | `DONE` | FR-001b |
| **TASK-043** | Ролевой контроль RBAC и валидация Custom Claims (`hiker`, `guide`, `rescuer`, `admin`) | Critical | TASK-041 | Защита маршрутов, групп и координат в `firestore.rules` и UI-Guard | `DONE` | FR-001c |
| **TASK-044** | Двухфакторная аутентификация MFA (TOTP / SMS) для спасателей и администраторов | High | TASK-043 | Обязательная проверка 2FA для доступа к спасательному дашборду | `DONE` | FR-001d |
| **TASK-045** | Разработка UI-компонентов авторизации (модальные окна, восстановление пароля) | High | TASK-041 | Отзывчивые формы авторизации с валидацией Zod и индикацией ошибок | `DONE` | FR-001a, FR-001e |
| **TASK-046** | Автотесты аутентификации, сессионного хранилища и валидации ролей RBAC | High | TASK-045 | Комплект тестов на регистрацию, восстановление пароля и права доступа | `DONE` | NFR-013, FR-001c |
| **TASK-047** | Реализация геозон безопасности (`safeRadiusMeters`) и контроля выхода из зоны | High | TASK-010 | Настройка радиуса, отрисовка круга на Leaflet, Haversine проверка и баннер тревоги | `DONE` | FR-002, UC-02 |
| **TASK-048** | GNSS-фильтрация: Deadband (<5м) и адаптивный троттлинг (5с/30с) | High | TASK-009 | Класс `LocationFilter`, отсечение джиттера, энергосбережение и SOS байпас | `DONE` | FR-006, NFR-008 |
| **TASK-049** | Персистентная оффлайн-очередь IndexedDB и многовкладочный кэш Firestore | High | TASK-023 | Модуль `IndexedDBQueueStorage` и `persistentLocalCache` с `persistentMultipleTabManager` | `DONE` | FR-013, FR-014 |
| **TASK-050** | Сквозное E2EE-шифрование группового чата (AES-256-GCM AEAD) | Critical | TASK-014, TASK-016 | Шифрование полезной нагрузки, `encryptedPayload` (`ciphertext`, `iv`, `authTag`), бейдж защиты в UI | `DONE` | FR-020, NFR-002 |
| **TASK-051** | Управление групповыми ключами в `IdentityManager` | High | TASK-013 | Методы `getOrCreateGroupKey`, `setGroupKey`, `getGroupKey`, автогенерация в `use-groups.ts` | `DONE` | FR-003, NFR-004 |
| **TASK-052** | Экстренный байпас огрубления координат (Emergency Privacy Bypass) | Critical | TASK-018 | Режим `EMERGENCY` и флаг `isEmergency: true` гарантируют 100% точность GNSS при SOS | `DONE` | FR-015, FR-022, NFR-001 |
| **TASK-053** | Защита API-роутов, скользящий Rate Limiter и строгая Zod-валидация | High | TASK-004 | Модуль `src/core/security/api-security.ts`, лимиты 60 req/min, унификация ответов 422/429 | `DONE` | FR-026, NFR-016 |
| **TASK-054** | Комплексный тестовый сьют E2EE и Backend Security (9 тестов) | Critical | TASK-050..053 | Сьют `backend-security-e2ee.test.ts` (100% pass, суммарно 67 тестов / 7 сьютов) | `DONE` | NFR-013, NFR-002 |
| **TASK-055** | Харденинг HTTP заголовков безопасности по стандарту OWASP | High | TASK-006 | Strict CSP, HSTS (max-age 1 год), X-Frame-Options: DENY в `next.config.ts` | `DONE` | FR-027, NFR-017 |
