# Бэкенд и хранение данных (Backend & Persistence Architecture)

**Статус документа:** `COMPLETED & VERIFIED`  
**Категория:** Архитектурная спецификация (`03-architecture`)  
**Актуализация:** Октябрь 2026 г. (Версия: 0.5.0)

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

## 2. Реализации хранилищ

1. **`LocalStorageRepository` (Текущая реализация по умолчанию):**
   - Автономное хранение данных групп, треков и настроек в браузере клиента.
   - Позволяет приложению работать на 100% оффлайн без внешних облачных зависимостей.
2. **`FirebaseGroupRepository` (Адаптер для облачной синхронизации):**
   - Интеграция с Cloud Firestore при наличии сети.
   - Инициализируется с локальным многовкладочным кэшированием:
     ```typescript
     initializeFirestore(app, {
       localCache: persistentLocalCache({
         tabManager: persistentMultipleTabManager()
       })
     });
     ```
   - **Важно:** В Firestore передаются только зашифрованные полезные нагрузки (`ciphertext`) и метаданные сессии. Сырые координаты на сервере не сохраняются (Zero-Knowledge).
3. **`MockGroupRepository` (Тестовый репозиторий):**
   - Используется для детерминированных автотестов и симуляции сетевых ошибок.

---

## 3. Модель хранения оффлайн-очереди (`IndexedDBQueueStorage`)

- Для надежного сохранения исходящей телеметрии в оффлайн-режиме реализован специализированный адаптер `IndexedDBQueueStorage` (`src/core/transport/indexeddb-queue-storage.ts`).
- **База данных IndexedDB:** `treeline_tracker_db` (версия 1)
  - Хранилище объектов `offline_packets` (ключ: `packetId`, индексы: `timestamp`, `priority`).
  - Хранилище объектов `dedup_ids` (кэш обработанных пакетов для исключения дублирования).
- Очередь поддерживает емкость до 500 пакетов с автоматической очисткой устаревших точек (FIFO).
- Пакеты типа `EMERGENCY_SOS` получают статус `priority: 1` (`HIGH`) и обрабатываются первыми при вызове `flushQueue()`, никогда не вытесняясь регулярной телеметрией.
- **Отказоустойчивость:** При блокировке IndexedDB (приватные вкладки Safari/Chrome) система прозрачно переключается на синхронный `localStorage` фоллбэк.

---

## 4. Оптимистическая блокировка версий (OCC Engine)

Для исключения конфликтов одновременного редактирования маршрутов и списков групп:
- Все доменные сущности снабжены целочисленным полем `version: number` и `updatedAt: number`.
- Метод `validateAndIncrementVersion(currentEntity, clientVersion)` валидирует ревизию: при несоответствии выбрасывается типизированная ошибка `ConcurrencyConflictError`, предотвращая слепую перезапись изменений другого гида.

---

## 5. Защита API и Rate Limiting (Next.js Server Layer)

Все серверные эндпоинты платформы (`/api/locations`, `/api/emergency`, `/api/groups`, `/api/profile`, `/api/routes`, `/api/search-areas`) защищены централизованным слоем `src/core/security/api-security.ts`:

- **Скользящий Rate Limiter по IP-адресу:**
  - Отслеживает запросы в скользящем 60-секундном окне.
  - По умолчанию установлен лимит 60 запросов в минуту (с расширением до 120 для телеметрии).
  - При превышении отдается статус `429 Too Many Requests` с заголовками `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` и `X-RateLimit-Reset`.
- **Строгая Zod-валидация DTO:**
  - Входные данные парсятся методом `validateBody(request, schema)`.
  - При несоответствии схемы возвращается стандартизированный `422 Unprocessable Entity` с массивом полей и причин отклонения.
- **Безопасная санитизация ошибок:**
  - Метод `handleApiError` логирует полную информацию на сервере, но клиенту возвращает безопасное сообщение без внутренних stack trace и системных путей.
