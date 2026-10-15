# Функциональные требования (Functional Requirements)

**Статус документа:** `COMPLETED & FULLY VERIFIED`  
**Категория:** Требования (`02-requirements`)  
**Актуализация:** Октябрь 2026 г. (Версия кодовой базы: 0.4.0)

---

## Реестр функциональных требований Treeline Tracker

| ID | Категория | Формулировка требования | Приоритет | Текущий статус | Местоположение в коде |
|---|---|---|---|---|---|
| **FR-001** | Идентификация & Профиль | Пользователь может создать пару ключей Ed25519, управлять профилем и отслеживать процент заполнения (0–100%). | High | `IMPLEMENTED` | `src/views/profile-page.tsx`, `src/core/security/identity-manager.ts` |
| **FR-001a** | Аутентификация | Пользователь может регистрироваться и входить в систему через Email/Пароль, гостевой вход и симуляцию сессий. | Critical | `IMPLEMENTED` | `src/components/auth-rbac-modal.tsx`, `src/core/security/rbac-service.ts` |
| **FR-001b** | Связывание аккаунтов | Пользователь может связать гостевой сеанс с постоянной учетной записью без потери криптографической идентичности и маршрутов. | High | `IMPLEMENTED` | `src/core/security/rbac-service.ts`, `src/core/repositories` |
| **FR-001c** | Авторизация & RBAC | Система валидирует ролевой доступ (RBAC: `hiker`, `guide`, `rescuer`, `admin`) через Firebase Custom Claims и доменные интерцепторы. | Critical | `IMPLEMENTED` | `src/core/security/rbac-service.ts`, `firestore.rules` |
| **FR-001d** | Многофакторная защита (MFA) | Пользователи с ролями `rescuer` и `admin` проходят двухфакторную верификацию (TOTP-код) для доступа к расширенным оперативным данным. | High | `IMPLEMENTED` | `src/components/auth-rbac-modal.tsx`, `src/core/security/rbac-service.ts` |
| **FR-001e** | Управление сессией | Система поддерживает обновление JWT-сессии, статус активного пользователя и безопасный выход (Sign Out) с очисткой кэшей. | High | `IMPLEMENTED` | `src/core/security/rbac-service.ts` |
| **FR-002** | Группы & Геозоны | Руководитель может создать закрытую группу экспедиции с заданием названия, описания и безопасного радиуса геозоны (`safeRadiusMeters`). | High | `IMPLEMENTED` | `src/features/group-management/ui/create-group-form.tsx`, `src/views/map-view.tsx` |
| **FR-003** | Группы & Ключи | Пользователь может присоединиться к группе по коду/приглашению и получить групповой ключ шифрования. | High | `IMPLEMENTED` | `src/features/group-management`, `src/core/repositories` |
| **FR-004** | Маршруты & GPX | Пользователь может нарисовать, сохранить, экспортировать в GPX (`gpx-exporter.ts`) и отредактировать трек. | High | `IMPLEMENTED` | `src/features/route-drawing`, `src/core/utils/gpx-exporter.ts` |
| **FR-005** | Маршруты & DEM | Система автоматически рассчитывает общую дистанцию, набор/сброс высоты и профиль трека по точкам. | Medium | `IMPLEMENTED` | `src/features/route-drawing`, `src/views/route-planner.tsx` |
| **FR-006** | Локация & Фильтры | Real-time трекинг координат с адаптивным Deadband (5 м), Throttle (5 с / 30 с при разряде) и spatial geohash (geofire-common). | High | `IMPLEMENTED` | `src/core/location/location-filter.ts`, `src/core/location/geohash.ts` |
| **FR-007** | E2EE Шифрование | Координаты упаковываются в `LocationUpdate` и шифруются алгоритмом AES-256-GCM AEAD перед отправкой. | Critical | `IMPLEMENTED` | `src/core/security/crypto-service.ts`, `src/core/security/secure-packet-service.ts` |
| **FR-008** | Цифровые подписи | Каждый передаваемый пакет подписывается закрытым ключом отправителя (Ed25519 Web Crypto API). | Critical | `IMPLEMENTED` | `src/core/security/crypto-service.ts`, `src/core/security/secure-packet-service.ts` |
| **FR-009** | Защита от повторов | Пакеты защищаются от повторов с помощью `packetId`, монотонного `sequenceNumber` и 10-минутного окна свежести. | Critical | `IMPLEMENTED` | `src/core/security/replay-protection.ts` |
| **FR-010** | Отказоустойчивый транспорт | `TransportManager` прозрачно выбирает активный канал передачи данных (Internet ➔ MeshCore ➔ OfflineQueue). | High | `IMPLEMENTED` | `src/core/transport/transport-manager.ts` |
| **FR-011** | Интернет-транспорт | Система поддерживает отправку пакетов через `InternetTransport` (Cloud Firestore / HTTPS). | High | `IMPLEMENTED` | `src/core/transport/internet-transport.ts`, `src/firebase` |
| **FR-012** | Mesh-сеть (LoRa) | Программная эмуляция ячеистой сети `MockMeshCoreTransport` с симуляцией RSSI (-70..-105 dBm) и задержек. | High | `SIMULATED` | `src/core/transport/meshcore-transport.ts` |
| **FR-013** | Оффлайн-очередь | При потере связи пакеты сохраняются в `OfflineQueue` на базе `IndexedDB` (с LocalStorage фоллбэком) с приоритетом `EMERGENCY_SOS`. | High | `IMPLEMENTED` | `src/core/transport/offline-queue.ts`, `src/core/transport/indexeddb-queue-storage.ts` |
| **FR-014** | Авто-сброс очереди | При восстановлении связи накопленные оффлайн-пакеты автоматически отправляются и дедуплицируются. | High | `IMPLEMENTED` | `src/core/transport/transport-manager.ts`, `src/core/transport/offline-queue.ts` |
| **FR-015** | Сигнал SOS | Пользователь может активировать сигнал бедствия SOS с удержанием кнопки подтверждения (3 секунды). | Critical | `IMPLEMENTED` | `src/views/emergency-services.tsx`, `src/components/expedition-status-bar.tsx` |
| **FR-016** | SOS Телеметрия | Сигнал SOS содержит координаты, высоту, метку времени, процент заряда аккумулятора и цифровую подпись Ed25519. | Critical | `IMPLEMENTED` | `src/core/transport/interfaces.ts`, `src/views/emergency-services.tsx` |
| **FR-017** | SAR-шлюз | Симулированный шлюз спасателей `MockEmergencyGateway` регистрирует сигнал SOS с обязательным правовым дисклеймером. | Medium | `SIMULATED` | `src/views/emergency-services.tsx`, `src/features/emergency-services` |
| **FR-018** | ИИ-поиск пропавших | Построение вероятностных полигонов поиска пропавшего туриста на базе Google Genkit и модели Gemini 2.5 Flash. | Medium | `IMPLEMENTED` | `src/app/api/search-areas/route.ts`, `src/features/hiker-search/ui/lost-hiker-tool.tsx` |
| **FR-019** | Достоверность ИИ | ИИ-выдача содержит уровень достоверности (`confidenceLevel`), факторы рельефа и координаты замкнутого полигона для карты. | Medium | `IMPLEMENTED` | `src/app/api/search-areas/route.ts`, `src/ai/flows` |
| **FR-020** | Чат группы | Участники экспедиции могут обмениваться защищенными сессионными текстовыми сообщениями. | Medium | `SIMULATED` | `src/views/group-chat.tsx` |
| **FR-021** | Прогноз погоды | Отображение базового прогноза погоды и параметров безопасности для контрольных точек маршрута. | Low | `SIMULATED` | `src/views/weather-forecast.tsx` |
| **FR-022** | Фильтр геоприватности | Селектор режимов приватности (`NORMAL`, `REDUCED` с огрублением сетки 200х200м, `STEALTH` с запретом вещания). | High | `IMPLEMENTED` | `src/core/security/privacy-filter.ts`, `src/views/profile-page.tsx` |
| **FR-023** | Статус-бар экспедиции | Единая панель состояния: GPS фикс (±3–5м), канал связи (`Интернет`/`Mesh`/`Очередь`), E2EE, батарея, RBAC-роль. | High | `IMPLEMENTED` | `src/features/expedition/ui/expedition-status-bar.tsx` |
| **FR-024** | Хаос-симулятор сбоев | Интерактивная панель разработчика для моделирования обрыва сотовой связи, радиопомех, потери пакетов (до 75%) и разряда батареи. | High | `IMPLEMENTED` | `src/core/transport/chaos-simulator.ts`, `src/components/chaos-control-modal.tsx` |
| **FR-025** | Журнал аудита событий | Потоковый аудит-лог событий по категориям `[GPS]`, `[SECURITY]`, `[TRANSPORT]`, `[OCC]`, `[AUTH]`, `[SOS]` с возможностью экспорта в JSON. | Medium | `IMPLEMENTED` | `src/core/transport/audit-logger.ts`, `src/components/audit-log-modal.tsx` |
