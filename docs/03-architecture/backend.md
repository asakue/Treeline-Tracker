# Бэкенд и хранение данных (Backend & Persistence Architecture)

**Статус документа:** `COMPLETED`  
**Категория:** Архитектурная спецификация (`03-architecture`)

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
