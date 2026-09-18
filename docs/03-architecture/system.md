# Системная архитектура Treeline Tracker (System Architecture)

**Статус документа:** `COMPLETED`  
**Категория:** Архитектурная спецификация (`03-architecture`)

---

## 1. Архитектурная модель C4: Контекст системы (System Context)

```mermaid
graph TD
    User([Пользователь / Турист])
    Leader([Руководитель группы])
    SAR([Спасатель / Базовый лагерь])

    subgraph Treeline [Система Treeline Tracker]
        App[Мобильный / Веб-клиент Next.js]
        Engine[Core Domain & Security Engine]
    end

    Cloud[(Облачный бэкенд / Firebase)]
    MeshNode[(Симулированный узел MeshCore LoRa)]
    MockGateway[Симулированный шлюз спасателей 112]
    GenkitAI[Genkit / Gemini AI Service]

    User <-->|Интерактивный UI| App
    Leader <-->|Управление группой| App
    App <--> Engine

    Engine <-->|HTTPS / WSS| Cloud
    Engine <-->|LoRa радиоэфир (симуляция)| MeshNode
    Engine -->|SOS оповещение (симуляция)| MockGateway
    Engine <-->|Поддержка поиска пропавших| GenkitAI
    SAR <--> MockGateway
```

---

## 2. Многоуровневое разделение ответственности (Layered Architecture)

Архитектура Treeline Tracker строго разделена на независимые слои с направлением зависимостей **сверху вниз** (от UI к Domain и Infrastructure):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. Presentation Layer (UI)                      │
│   - React 18 Components & Views (Map, Chat, Routes, Lost Hiker, SOS)  │
│   - ViewModels, UI State, Theme & Responsive Layout                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Calls
┌───────────────────────────────────▼────────────────────────────────────┐
│                    2. Application & Coordination Layer                 │
│   - Expedition Manager, Safety Controller, Simulation Orchestrator     │
│   - Observability & Logging Service                                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Uses
┌───────────────────────────────────▼────────────────────────────────────┐
│                         3. Pure Domain Layer                           │
│   - Entities: LocationUpdate, Group, Member, Route, EmergencyEvent     │
│   - Value Objects: GeoCoordinate, BatteryLevel, SequenceNumber         │
│   - Business Rules: Geofence checking, Pace analysis, Retention policy │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Encrypts / Signs
┌───────────────────────────────────▼────────────────────────────────────┐
│                          4. Security Layer                             │
│   - Key Pair Generation & Identity (Ed25519)                           │
│   - Authenticated Encryption (AES-GCM / ChaCha20-Poly1305)             │
│   - Replay Protection & Sequence Validation                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Delivers
┌───────────────────────────────────▼────────────────────────────────────┐
│                        5. Transport Abstraction                        │
│   - ITransport Interface: sendLocation(), sendEmergency(), sendMessage()│
│   - Transport Manager & Failover Controller                            │
│   - Drivers: InternetTransport, MockMeshCoreTransport, MockTransport │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Persists / Buffers
┌───────────────────────────────────▼────────────────────────────────────┐
│                       6. Infrastructure & Storage                      │
│   - Repositories: IGroupRepository, IRouteRepository, IOfflineQueue    │
│   - Drivers: LocalStorage, IndexedDB, Firebase Firestore (Adapter)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Принцип слабой связности (Decoupling)

- **UI ничего не знает о криптографии:** Компонент карты вызывает метод `applicationService.sendLocation(coords)`. Он не видит `nonce`, `authTag` или деталей шифрования.
- **Доменный слой не знает о транспорте:** `LocationUpdate` формируется независимо от того, будет ли он отправлен по 4G, Mesh-сети или записан в оффлайн-буфер.
- **Транспорт взаимозаменяем:** `MockMeshCoreTransport` реализует тот же контракт `ITransport`, что и `InternetTransport`, что позволяет тестировать отказы на уровне юнит-тестов.
