# Спецификация шифрования и структуры пакетов (Encryption Specification)

**Статус документа:** `COMPLETED`  
**Категория:** Безопасность и Приватность (`04-security`)

---

## 1. Криптографические примитивы

В соответствии с требованием запрета самописной криптографии используются стандартные криптографические алгоритмы:

- **Цифровая подпись и аутентификация автора:** **Ed25519** (Edwards-curve Digital Signature Algorithm).
- **Симметричное аутентифицированное шифрование (AEAD):** **AES-256-GCM** (или **ChaCha20-Poly1305**).
- **Хеширование и генерация идентификаторов:** **SHA-256**.
- **Криптографический генератор случайных чисел (CSPRNG):** Web Crypto API `crypto.getRandomValues()`.

---

## 2. Структура открытого пакета локации (LocationUpdate)

Перед шифрованием формируется нормализованный объект полезной нагрузки:

```typescript
export interface LocationUpdate {
  version: 1;
  messageId: string;      // UUIDv4 или SHA256(senderId + sequence + timestamp)
  senderId: string;       // Публичный идентификатор отправителя
  groupId: string;        // Идентификатор целевой группы
  timestamp: number;      // Unix timestamp в миллисекундах
  sequence: number;       // Монотонно возрастающий счетчик (0, 1, 2, ...)
  latitude: number;       // Широта (WGS84)
  longitude: number;      // Долгота (WGS84)
  altitude?: number;      // Высота над уровнем моря (метры)
  accuracy: number;       // Радиус погрешности (метры)
  battery: number;        // Уровень заряда (0–100%)
  status: 'MOVING' | 'STATIONARY' | 'SOS';
}
```

---

## 3. Схема зашифрованного пакета (EncryptedPacket)

```typescript
export interface EncryptedPacket {
  version: 1;
  senderId: string;             // Открытый ID для поиска публичного ключа подписи
  recipientGroupId: string;     // ID группы для выбора ключа дешифрования
  nonce: string;                // Уникальный 12-байтовый вектор инициализации (hex)
  ciphertext: string;           // Зашифрованные данные LocationUpdate (hex/base64)
  authenticationTag: string;    // 16-байтовый тег аутентификации AEAD
  signature: string;            // Подпись Ed25519 от (nonce + ciphertext + authTag)
}
```

---

## 4. Алгоритм проверки на стороне получателя

```
                     Входящий EncryptedPacket
                                │
                                ▼
               1. Проверка окна времени (Freshness)
                  |timestamp_now - packet_time| < 10m?
                                │
                       ДА ──────┴────── НЕТ ───> [ОТКЛОНИТЬ: Expired]
                                │
                                ▼
               2. Проверка защиты от повторов
                  sequence > last_seen_sequence?
                                │
                       ДА ──────┴────── НЕТ ───> [ОТКЛОНИТЬ: Replay Attack]
                                │
                                ▼
               3. Верификация подписи Ed25519
                  Verify(senderPublicKey, data, signature)
                                │
                       ДА ──────┴────── НЕТ ───> [ОТКЛОНИТЬ: Invalid Signature]
                                │
                                ▼
               4. Дешифрование AES-256-GCM + authTag
                  Decrypt(GroupKey, nonce, ciphertext, authTag)
                                │
                       ДА ──────┴────── НЕТ ───> [ОТКЛОНИТЬ: Tampered Packet]
                                │
                                ▼
                  [УСПЕХ: Отобразить точку на карте]
```

---

## 5. Практическая реализация и безопасность API

1. **Сквозное E2EE-шифрование в групповом чате (`src/views/group-chat.tsx`):**
   - Все отправляемые сообщения шифруются на клиенте алгоритмом AES-256-GCM с использованием симметричного ключа группы (`IdentityManager.getOrCreateGroupKey`).
   - Объект полезной нагрузки содержит зашифрованный `ciphertext`, случайный вектор `iv` и тег целостности `authTag`.
   - В UI выводится криптографический статус шифрования (пиктограмма замка) и отпечаток ключа группы.

2. **Отказоустойчивое декодирование ключей и пакетов (`src/core/security/crypto-service.ts`):**
   - Метод `base64ToBuffer` очищает входные данные от пробельных символов и переносов строк `\r\n`, преобразует URL-safe символы (`-`, `_` ➔ `+`, `/`) и восстанавливает паддинг `=`.

3. **Сетевая защита API и HTTP-заголовки (`api-security.ts` & `next.config.ts`):**
   - Внедрен скользящий Rate Limiter по IP-адресам (защита от перебора и DoS).
   - Все эндпоинты (`/api/locations`, `/api/emergency`, `/api/groups`, `/api/profile`, `/api/routes`, `/api/search-areas`) валидируются строгими схемами Zod.
   - В `next.config.ts` активирован комплекс заголовков: Strict HSTS, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy и Permissions-Policy.
