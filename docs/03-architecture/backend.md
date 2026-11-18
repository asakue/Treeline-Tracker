# Бэкенд и хранение данных (Backend & Persistence Architecture)

**Статус документа:** `PRODUCTION_READY`  
**Категория:** Архитектурная спецификация (`03-architecture`)  
**Актуализация:** Ноябрь 2026 г. (Версия: 0.6.0)  
**Авторы:** Даниил (системная архитектура), Кирилл (серверная разработка, REST/WS), Александр (геопространственные запросы)

---

## 1. Обзор архитектуры бэкенда

Бэкенд Treeline Tracker спроектирован как высокопроизводительный, суверенный сервис на базе **Node.js, Express, TypeScript, Drizzle ORM и PostgreSQL 16 с расширением PostGIS 3.4**. Архитектура полностью исключает зависимость от проприетарных облачных платформ и оптимизирована для работы как в глобальной сети, так и в автономных полевых развертываниях поисково-спасательных отрядов (SAR).

```
                      [ Клиентские приложения / Web PWA ]
                         |                       |
           REST API v1   |                       |  WebSocket Real-Time
           (HTTPS / JSON)|                       |  (WSS / Binary / JSON)
                         v                       v
      +--------------------------------------------------------+
      |                 EXPRESS BACKEND SERVER                 |
      |                                                        |
      |  [ Auth & Security ]   [ Rate Limiter ]  [ Zod Guard ] |
      |   - JWT + Refresh       - Sliding Window  - Request Body
      |   - Argon2 Hash         - SOS Bypass      - Schema Safe|
      |                                                        |
      |  [ REST API Routes ]   [ WebSocket Hub ] [ MQTT Bridge]|
      |   - /auth, /teams       - Rooms & Sessions- Sub to RF  |
      |   - /tracks, /waypoints - Live Telemetry  - Mesh Relay |
      |   - /geofences, /sos    - Distress Alert  - Pub to Node|
      |                                                        |
      |               [ Drizzle ORM Data Layer ]               |
      +--------------------------------------------------------+
                         |                       |
               SQL Pool  |                       |  MQTT Protocol
                         v                       v
      +----------------------------+   +-----------------------+
      |  PostgreSQL 16 + PostGIS   |   | Eclipse Mosquitto 2.0 |
      |   - Spatial GiST Indices   |   |   - LoRa Gateway Hub  |
      |   - ST_Contains, ST_DWithin|   |   - Port 1883 / 9001  |
      |   - Time-series Telemetry  |   +-----------------------+
      +----------------------------+
```

---

## 2. СУБД: PostgreSQL 16 + PostGIS 3.4

Все пространственные и атрибутивные данные хранятся в реляционной СУБД PostgreSQL с расширением PostGIS.

### Ключевые таблицы схемы данных (`backend/schema.sql`, `backend/src/db/schema.ts`):

1. **`users` (Пользователи и аккаунты):**
   - `id`: UUID (Primary Key)
   - `email`: `varchar(255)` (Unique)
   - `password_hash`: `text` (Argon2 / Crypto PBKDF2)
   - `display_name`: `varchar(100)`
   - `role`: `user_role` enum (`'hiker'`, `'guide'`, `'rescuer'`, `'admin'`)
   - `public_key_fingerprint`: `varchar(64)` (отпечаток открытого ключа Ed25519)
   - `created_at`, `updated_at`: `timestamptz`

2. **`teams` (Туристические группы и экспедиционные отряды):**
   - `id`: UUID (Primary Key)
   - `name`: `varchar(100)`
   - `description`: `text`
   - `leader_id`: UUID (FK `users.id`)
   - `safe_radius_meters`: `integer` (по умолчанию 500 м, диапазон 50–10 000 м)
   - `privacy_mode`: `privacy_mode` enum (`'NORMAL'`, `'REDUCED'`, `'STEALTH'`)
   - `encryption_key`: `text` (зашифрованный групповой ключ симметричной защиты)
   - `version`: `integer` (Optimistic Concurrency Control, OCC)
   - `created_at`, `updated_at`: `timestamptz`

3. **`team_members` (Состав групп):**
   - `team_id`: UUID (FK `teams.id`)
   - `user_id`: UUID (FK `users.id`)
   - `role`: `user_role`
   - `joined_at`: `timestamptz`

4. **`tracks` (Маршруты и пройденные треки):**
   - `id`: UUID (Primary Key)
   - `team_id`: UUID (FK `teams.id`)
   - `creator_id`: UUID (FK `users.id`)
   - `name`: `varchar(150)`
   - `region`: `varchar(100)` (автономно определенный горный район)
   - `route_type`: `varchar(50)` (`'mountain'` / `'plain'`)
   - `profile`: `varchar(50)` (`'foot-hiking'`, `'mountain-trekking'`)
   - `sac_scale`: `varchar(10)` (`'T1'`, `'T2'`, `'T3'`, `'T4'`)
   - `geojson`: `jsonb` (геометрия трека)
   - `distance_meters`: `double precision`
   - `elevation_gain`: `double precision`
   - `elevation_loss`: `double precision`
   - `estimated_time_seconds`: `integer` (расчет по функции Тоблера)
   - `calories_minetti`: `double precision` (расчет по полиному Минетти)
   - `version`: `integer` (OCC)
   - `is_archived`: `boolean`

5. **`waypoints` (Контрольные точки и навигационные метки):**
   - `id`: UUID (Primary Key)
   - `team_id`: UUID (FK `teams.id`)
   - `creator_id`: UUID (FK `users.id`)
   - `name`: `varchar(100)`
   - `description`: `text`
   - `type`: `varchar(50)` (`'checkpoint'`, `'camp'`, `'water'`, `'hazard'`, `'summit'`)
   - `location`: `geography(Point, 4326)` (пространственная точка PostGIS)
   - `latitude`, `longitude`, `altitude`: `double precision`
   - `sequence`: `integer`

6. **`geofences` (Геозоны безопасности и секторы отчуждения):**
   - `id`: UUID (Primary Key)
   - `team_id`: UUID (FK `teams.id`)
   - `name`: `varchar(100)`
   - `type`: `varchar(20)` (`'circle'` / `'polygon'`)
   - `center_point`: `geography(Point, 4326)` (для круговых зон)
   - `radius_meters`: `double precision`
   - `polygon_geom`: `geometry(Polygon, 4326)` (для полигональных зон отчуждения)
   - `is_active`: `boolean`
   - `alert_on_breach`: `boolean`

7. **`telemetry` (Временные ряды геопозиций):**
   - `id`: UUID (Primary Key)
   - `team_id`: UUID (FK `teams.id`)
   - `user_id`: UUID (FK `users.id`)
   - `node_id`: `varchar(32)` (идентификатор узла LoRa Meshtastic)
   - `location`: `geography(Point, 4326)`
   - `latitude`, `longitude`, `altitude`: `double precision`
   - `accuracy`: `double precision` (погрешность фикса GPS в метрах)
   - `speed`: `double precision`
   - `heading`: `double precision`
   - `battery_percent`: `smallint`
   - `privacy_mode`: `privacy_mode`
   - `source`: `varchar(20)` (`'gps'`, `'mesh'`, `'manual'`)
   - `raw_payload`: `text` (зашифрованный E2EE-пакет)
   - `recorded_at`: `timestamptz`

8. **`emergency_sos` (Аварийные события и статус бедствия):**
   - `id`: UUID (Primary Key)
   - `team_id`: UUID (FK `teams.id`)
   - `user_id`: UUID (FK `users.id`)
   - `location`: `geography(Point, 4326)`
   - `latitude`, `longitude`, `altitude`: `double precision`
   - `battery_percent`: `smallint`
   - `message`: `text`
   - `status`: `emergency_status` (`'ACTIVE'`, `'ACKNOWLEDGED'`, `'RESOLVED'`)
   - `acknowledged_by`: UUID (FK `users.id`)
   - `resolved_by`: UUID (FK `users.id`)
   - `created_at`, `updated_at`: `timestamptz`

### Пространственные индексы GiST:
Для ускорения геопространственных расчетов созданы специализированные индексы:
```sql
CREATE INDEX idx_telemetry_location ON telemetry USING GIST (location);
CREATE INDEX idx_waypoints_location ON waypoints USING GIST (location);
CREATE INDEX idx_geofences_center ON geofences USING GIST (center_point);
CREATE INDEX idx_geofences_polygon ON geofences USING GIST (polygon_geom);
```

### Проверка вхождения в геозону через PostGIS:
```sql
-- Проверка радиальной геозоны безопасности
SELECT id, name, 
       ST_DWithin(center_point, ST_MakePoint($lon, $lat)::geography, radius_meters) AS is_inside
FROM geofences
WHERE team_id = $team_id AND type = 'circle' AND is_active = true;

-- Проверка полигонального сектора опасности / отчуждения
SELECT id, name,
       ST_Contains(polygon_geom, ST_SetSRID(ST_MakePoint($lon, $lat), 4326)) AS is_inside
FROM geofences
WHERE team_id = $team_id AND type = 'polygon' AND is_active = true;
```

---

## 3. Спецификация REST API v1

Все эндпоинты защищены централизованными middleware:
* `AuthGuard`: Проверка JWT-токена в заголовке `Authorization: Bearer <token>`.
* `RoleGuard`: Проверка ролей пользователя (`hiker`, `guide`, `rescuer`, `admin`).
* `RateLimiter`: Скользящее окно запросов по IP (100 запросов/мин, эндпоинт `/emergency/sos` имеет безусловный приоритетный bypass).
* `Validation`: Проверка тел запросов через схемы Zod.

| Префикс | Метод | Маршрут | Описание | Роли |
|---|---|---|---|---|
| **/auth** | POST | `/api/v1/auth/register` | Регистрация нового пользователя | Публичный |
| | POST | `/api/v1/auth/login` | Вход, выдача Access (15м) и Refresh (7д) токенов | Публичный |
| | POST | `/api/v1/auth/refresh` | Ротация Refresh-токена | Публичный |
| | POST | `/api/v1/auth/logout` | Отзыв активного токена | Авторизован |
| **/teams** | GET | `/api/v1/teams` | Список доступных групп пользователя | Все роли |
| | POST | `/api/v1/teams` | Создание новой группы | `guide`, `admin` |
| | GET | `/api/v1/teams/:id` | Детальная информация о группе и список участников | Участники, `rescuer` |
| | PUT | `/api/v1/teams/:id` | Обновление настроек группы (OCC `version`) | `guide`, `admin` |
| | POST | `/api/v1/teams/:id/members` | Добавление участника в группу | `guide`, `admin` |
| | DELETE | `/api/v1/teams/:id/members/:userId` | Удаление участника | `guide`, `admin` |
| **/tracks** | GET | `/api/v1/tracks` | Получение маршрутов группы | Все роли |
| | POST | `/api/v1/tracks` | Сохранение трека с расчетом Minetti/Tobler | `guide`, `admin` |
| | GET | `/api/v1/tracks/:id` | Геометрия трека и профиль высот | Все роли |
| | PUT | `/api/v1/tracks/:id` | Редактирование трека (контроль версии OCC) | `guide`, `admin` |
| | DELETE | `/api/v1/tracks/:id` | Архивирование трека | `guide`, `admin` |
| **/waypoints**| GET | `/api/v1/waypoints` | Список навигационных точек группы | Все роли |
| | POST | `/api/v1/waypoints` | Создание контрольной или опасной точки | `guide`, `rescuer` |
| | PUT | `/api/v1/waypoints/:id` | Обновление точки | `guide`, `rescuer` |
| | DELETE | `/api/v1/waypoints/:id` | Удаление точки | `guide`, `admin` |
| **/geofences**| GET | `/api/v1/geofences` | Список активных геозон группы | Все роли |
| | POST | `/api/v1/geofences` | Создание геозоны (радиальной или полигона) | `guide`, `rescuer` |
| | POST | `/api/v1/geofences/check` | Проверка координат на вхождение в геозоны | Все роли |
| **/telemetry**| POST | `/api/v1/telemetry` | Запись точки телеметрии участника | `hiker`, `guide` |
| | POST | `/api/v1/telemetry/batch` | Пакетный прием телеметрии (из оффлайн-буфера) | Все роли |
| | GET | `/api/v1/telemetry/history` | История перемещения за указанный интервал | `guide`, `rescuer` |
| **/emergency**| POST | `/api/v1/emergency/sos` | Активация сигнала бедствия (SOS Bypass) | Все роли |
| | GET | `/api/v1/emergency/active` | Список всех активных инцидентов SOS | `rescuer`, `admin` |
| | POST | `/api/v1/emergency/:id/ack` | Принятие вызова диспетчером спасателей | `rescuer` |
| | POST | `/api/v1/emergency/:id/resolve`| Завершение аварийного инцидента | `rescuer`, `admin` |
| **/mesh** | POST | `/api/v1/mesh/packet` | Прием сырого Protobuf-пакета из LoRa-моста | Системный |
| | GET | `/api/v1/mesh/nodes` | Список активных радиоузлов сети | `guide`, `rescuer` |

---

## 4. Потоковый WebSocket-движок (`backend/src/websocket/`)

Для мгновенного обмена координатами, текстовыми сообщениями и сигналами тревоги развернут WebSocket-сервер:
* **Аутентификация при рукопожатии:** Проверка JWT-токена в query-параметре `ws://host/ws?token=<jwt>`.
* **Архитектура комнат (Rooms):** Клиент подписывается на события своей группы (`room: team_<teamId>`).
* **Контроль соединений:** Heartbeat-пинг каждые 30 секунд. Клиенты, не ответившие на `pong` в течение 10 секунд, принудительно закрываются.
* **Приоритет SOS-сообщений:** Пакеты с флагом `EMERGENCY_SOS` транслируются во все доверенные спасательные каналы без задержек и ограничений троттлинга.

---

## 5. Клиентский слой репозиториев (`src/infrastructure/repositories`)

Фронтенд-приложение взаимодействует с данными через фасад `RepositoryContainer` (`src/core/repositories/index.ts` ➔ `src/infrastructure/repositories/index.ts`):

```typescript
export class RepositoryContainer {
  public static getGroupRepository(): IGroupRepository {
    const forceLocal = process.env.NEXT_PUBLIC_STORAGE_MODE === 'local';
    return forceLocal ? new LocalStorageGroupRepository() : new RestGroupRepository();
  }
  public static getRouteRepository(): IRouteRepository {
    const forceLocal = process.env.NEXT_PUBLIC_STORAGE_MODE === 'local';
    return forceLocal ? new LocalStorageRouteRepository() : new RestRouteRepository();
  }
  public static getEmergencyRepository(): IEmergencyRepository {
    const forceLocal = process.env.NEXT_PUBLIC_STORAGE_MODE === 'local';
    return forceLocal ? new LocalStorageEmergencyRepository() : new RestEmergencyRepository();
  }
  public static getLocationRepository(): ILocationRepository {
    const forceLocal = process.env.NEXT_PUBLIC_STORAGE_MODE === 'local';
    return forceLocal ? new LocalStorageLocationRepository() : new RestLocationRepository();
  }
}
```

### Автоматический роутинг путей:
Класс `BaseRestRepository` транслирует локальные пути Next.js API (`/api/groups`) в пути выделенного бэкенда (`/api/v1/teams`), что обеспечивает плавную миграцию и совместимость со всеми компонентами интерфейса.

---

## 6. Развертывание в Docker Compose

Все компоненты бэкенд-инфраструктуры поднимаются единой командой:

```bash
docker compose up -d
```

Конфигурация `docker-compose.yml` запускает:
1. `treeline-postgres`: образ `postgis/postgis:16-3.4-alpine`, авто-инициализация через `backend/schema.sql`, персистентный том `postgres_data`.
2. `treeline-mosquitto`: образ `eclipse-mosquitto:2.0`, порты 1883 (TCP) и 9001 (WebSocket).
3. `treeline-backend`: мультистейдж сборка `backend/Dockerfile`, проверка готовности PostgreSQL (`condition: service_healthy`) перед стартом.
