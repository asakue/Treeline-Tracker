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
   - Интеграция с Firestore при наличии сети.
   - **Важно:** В Firestore передаются только зашифрованные полезные нагрузки (`ciphertext`) и метаданные сессии. Сырые координаты на сервере не сохраняются.
3. **`MockGroupRepository` (Тестовый репозиторий):**
   - Используется для детерминированных автотестов и симуляции сетевых ошибок.

---

## 3. Модель хранения оффлайн-очереди (Store-and-Forward Buffer)

- Пакеты, не отправленные из-за отсутствия сети, сохраняются в `IndexedDB` / `LocalStorage` очереди `offline_packet_queue`.
- Очередь имеет ограничение по размеру (по умолчанию 500 пакетов) и политику вытеснения по принципу FIFO для обычных пакетов телеметрии.
- Пакеты `EmergencyEvent` имеют приоритет `HIGH` и никогда не вытесняются обычными пакетами.
