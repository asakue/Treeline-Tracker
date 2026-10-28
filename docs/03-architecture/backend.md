# Бэкенд и хранение данных (Backend & Persistence Architecture)

**Статус документа:** `COMPLETED & VERIFIED`  
**Категория:** Архитектурная спецификация (`03-architecture`)  
**Актуализация:** Октябрь 2026 г. (Версия: 0.5.4)

---

## 1. Паттерн Репозитория (Repository Pattern)

Для устранения жесткой привязки к конкретной СУБД или облачному провайдеру все операции с данными изолированы за интерфейсами репозиториев:

```typescript
// src/core/repositories/group-repository.interface.ts
export interface IGroupRepository {
  getGroup(id: string): Promise<Group | null>;
  getAllGroups(): Promise<Group[]>;
  createGroup(group: CreateGroupDTO): Promise<Group>;
  updateGroup(id: string, update: Partial<Group>): Promise<Group>;
  deleteGroup(id: string): Promise<void>;
}
```

---

## 2. Реализации хранилищ и Zero-Hang отказоустойчивость

1. **`LocalStorageRepository` (Автономное локальное хранилище):**
   - Хранение данных групп, треков и настроек в браузере клиента.
   - Позволяет приложению работать на 100% оффлайн без внешних облачных зависимостей.
2. **`FirebaseGroupRepository`, `FirebaseRouteRepository`, `FirebaseEmergencyRepository`:**
   - Интеграция с Cloud Firestore при наличии сети.
   - Инициализируется с локальным многовкладочным кэшированием:
     ```typescript
     initializeFirestore(app, {
       localCache: persistentLocalCache({
         tabManager: persistentMultipleTabManager()
       })
     });
     ```
   - **Защита от 10-секундных сетевых зависаний (`withFirestoreTimeout`):**
     По умолчанию Firestore SDK при отсутствии внешнего интернета предпринимает повторные попытки соединения длительностью до 10 секунд, замораживая UI-потоки.  
     В Treeline Tracker все облачные вызовы обернуты в `withFirestoreTimeout(promise, 2000)`:
     ```typescript
     export async function withFirestoreTimeout<T>(
       promise: Promise<T>,
       timeoutMs = 2000,
       fallbackValue?: T
     ): Promise<T>
     ```
     Если облачный сервер не ответил за 2000 мс, операция мгновенно переходит в оффлайн-режим с локальным кэшем без задержек.
   - **Подавление предупреждений SDK в оффлайне:**
     Вызов `setLogLevel('error')` в `src/firebase/index.ts` устраняет шумные ворнинги `@firebase/firestore: Could not reach Cloud Firestore backend`.
   - **Zero-Knowledge безопасность:** В Firestore передаются только зашифрованные полезные нагрузки (`ciphertext`) и метаданные сессии. Сырые координаты на сервере не сохраняются.
3. **`MockGroupRepository` (Тестовый репозиторий):**
   - Используется для детерминированных автотестов и симуляции сетевых ошибок.

---

## 3. Модель хранения оффлайн-данных в IndexedDB

### Очередь исходящей телеметрии (`IndexedDBQueueStorage`)
- Реализован адаптер `IndexedDBQueueStorage` (`src/core/transport/indexeddb-queue-storage.ts`).
- **База данных IndexedDB:** `treeline_tracker_db` (версия 1)
  - Хранилище объектов `offline_packets` (ключ: `packetId`, индексы: `timestamp`, `priority`).
  - Хранилище объектов `dedup_ids` (кэш обработанных пакетов для исключения дублирования).
- Очередь поддерживает емкость до 500 пакетов с автоматической очисткой устаревших точек (FIFO).
- Пакеты типа `EMERGENCY_SOS` получают статус `priority: 1` (`HIGH`) и обрабатываются первыми при вызове `flushQueue()`, никогда не вытесняясь регулярной телеметрией.
- **Отказоустойчивость:** При блокировке IndexedDB (приватные вкладки Safari/Chrome) система прозрачно переключается на синхронный `localStorage` фоллбэк.

### Кэш картографических тайлов (`offline-map-cache.ts`)
- **База данных IndexedDB:** `treeline_map_tiles_cache` (версия 1, хранилище `tiles`).
- Кэширует растровые тайлы OpenStreetMap по ключу `z_x_y`.
- В связке с Service Worker (`public/sw.js`) обеспечивает работу оффлайн-карты без подключения к сети.

---

## 4. Оптимистическая блокировка версий (OCC Engine)

Для исключения конфликтов одновременного редактирования маршрутов и списков групп:
- Все доменные сущности снабжены целочисленным полем `version: number` и `updatedAt: number`.
- Метод `validateAndIncrementVersion(currentEntity, clientVersion)` валидирует ревизию: при несоответствии выбрасывается типизированная ошибка `ConcurrencyConflictError`, предотвращая слепую перезапись изменений другого гида.

---

## 5. Защита API и серверные эндпоинты (Next.js Server Layer)

Все серверные эндпоинты платформы (`/api/locations`, `/api/emergency`, `/api/groups`, `/api/profile`, `/api/routes`, `/api/routes/classify`, `/api/search-areas`) защищены централизованным слоем `src/core/security/api-security.ts`:

- **Скользящий Rate Limiter по IP-адресу:**
  - Отслеживает запросы в скользящем 60-секундном окне.
  - Лимиты:
    - 60 запросов в минуту — стандартные CRUD операции.
    - 100 запросов в минуту — `/api/routes/classify`.
    - 120 запросов в минуту — передача телеметрии (`/api/locations`).
  - При превышении отдается статус `429 Too Many Requests` с заголовками `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` и `X-RateLimit-Reset`.
- **Строгая Zod-валидация DTO:**
  - Входные данные парсятся методом `validateBody(request, schema)`.
  - При несоответствии схемы возвращается стандартизированный `400 Bad Request` или `422 Unprocessable Entity` с массивом полей и причин отклонения.
- **Серверный маршрут `/api/routes/classify`:**
  - Автономная классификация: определяет горный регион (Кавказ, Алтай, Хибины, Урал, Байкал, Камчатка, Саяны), профиль проходимости, физику рельефа (Minetti/Tobler) и альпийскую категорию сложности SAC (T1–T4).
  - Схема `ClassifyRouteRequestSchema`: проверяет массив точек от 2 до 10 000 координат с диапазонами широт [-90, 90] и долгот [-180, 180].
  - Полная безопасность: чистые геометрические и DEM-вычисления без исходящих непроверенных запросов (Zero-SSRF).
- **Безопасная санитизация ошибок:**
  - Метод `handleApiError` логирует полную информацию на сервере, но клиенту возвращает безопасное сообщение без внутренних stack trace и системных путей.
