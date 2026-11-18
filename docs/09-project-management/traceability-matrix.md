# Матрица прослеживаемости (Traceability Matrix)

**Статус документа:** `COMPLETED & FULLY VERIFIED`  
**Категория:** Управление проектом (`09-project-management`)  
**Актуализация:** Ноябрь 2026 г. (Версия: 0.6.0)

---

## Связка: Требование ➔ Архитектурный модуль ➔ Реализация в коде ➔ Тесты ➔ Документация ➔ Статус

| Требование | Архитектурный модуль | Реализация в коде | Тесты | Документация | Статус |
|---|---|---|---|---|---|
| **FR-001** (Identity & Profile) | Security & UI Layer | `src/core/security/identity-manager.ts`, `src/views/profile-page.tsx` | `security-phase2.test.ts`, `profile-page.test.tsx` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-001a** (Multi-Auth JWT) | Auth & Security Layer | `backend/src/auth/jwt.ts`, `backend/src/api/routes/auth.routes.ts` | `backend/tests/unit/jwt.test.ts`, `T1-AUTH-01..04` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-001c** (RBAC Role Guards) | Security & Infrastructure | `backend/src/auth/rbac.ts`, `backend/src/middleware/auth.guard.ts` | `backend/tests/unit/rbac.test.ts`, `T1-AUTH-05` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-002** (Groups & Safe Radius) | Domain, PostGIS & UI | `backend/src/api/routes/teams.routes.ts`, `src/infrastructure/repositories/rest/rest-group-repository.ts` | `T1-TEAM-01..05`, `T2-TEAM-01..05` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-003** (Join Group & E2EE Keys) | Security & Repository | `src/core/security/crypto-service.ts`, `src/core/security/identity-manager.ts` | `security-phase2.test.ts`, `backend-security-e2ee.test.ts` | `04-security/key-management.md` | `IMPLEMENTED` |
| **FR-004** (Tracks & GPX) | Domain, Utils & PostGIS | `backend/src/api/routes/tracks.routes.ts`, `src/core/utils/gpx-exporter.ts` | `gpx-exporter.test.ts`, `T1-TRAK-01..05` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-005** (Elevation & DEM) | Domain & Lib | `src/lib/elevation-service.ts`, `src/features/elevation` | `terrain-physics.test.ts` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-006** (GNSS Deadband & Throttle) | Location & Spatial Index | `src/core/location/location-filter.ts`, `backend/src/utils/geo.ts` | `location-and-offline.test.ts`, `geo.test.ts` | `03-architecture/data-flow.md` | `IMPLEMENTED` |
| **FR-007** (Encryption AEAD) | Security Layer | `src/core/security/crypto-service.ts` (AES-256-GCM), `src/views/group-chat.tsx` | `security-phase2.test.ts`, `backend-security-e2ee.test.ts` | `04-security/encryption.md` | `IMPLEMENTED` |
| **FR-008** (Signatures Ed25519) | Security Layer | `src/core/security/crypto-service.ts`, `secure-packet-service.ts` | `security-phase2.test.ts` | `04-security/encryption.md` | `IMPLEMENTED` |
| **FR-009** (Anti-Replay Protection) | Security Layer | `src/core/security/replay-protection.ts` | `security-phase2.test.ts` | `04-security/threat-model.md` | `IMPLEMENTED` |
| **FR-010** (Transport Manager) | Transport Layer | `src/core/transport/transport-manager.ts` | `resilience-and-rbac.test.ts` | `03-architecture/communication.md` | `IMPLEMENTED` |
| **FR-011** (Internet Transport) | Transport Layer | `src/infrastructure/repositories/rest/`, `backend/src/app.ts` | `rest-repositories.test.ts` | `03-architecture/communication.md` | `IMPLEMENTED` |
| **FR-012** (LoRa Meshtastic Wire Protocol)| Mesh Layer | `packages/lora-mesh/src/`, `tests/e2e/harness/meshPacketBuilder.ts` | `packages/lora-mesh/__tests__/`, `T1-MESH-01..05` | `05-mesh/meshcore-research.md` | `IMPLEMENTED` |
| **FR-013** (Offline Queue IndexedDB) | Transport & Persistence | `src/core/transport/offline-queue.ts`, `src/core/transport/indexeddb-queue-storage.ts` | `location-and-offline.test.ts`, `T1-OFFL-05` | `03-architecture/backend.md` | `IMPLEMENTED` |
| **FR-014** (Auto-Flush & Dedup) | Transport & Routing | `packages/lora-mesh/src/routing/packet-deduplicator.ts`, `src/core/transport/` | `location-and-offline.test.ts`, `transports-and-routing.test.ts`| `03-architecture/communication.md` | `IMPLEMENTED` |
| **FR-015** (SOS Trigger 3s & Bypass) | Security & UI Layer | `src/views/emergency-services.tsx`, `backend/src/api/routes/emergency.routes.ts`| `location-and-offline.test.ts`, `T1-SOS-01..05` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-016** (SOS Telemetry Packet) | Domain & Transport | `backend/src/api/routes/emergency.routes.ts`, `packages/lora-mesh/src/codec/` | `T1-SOS-01..05`, `T2-SOS-01..05` | `04-security/privacy.md` | `IMPLEMENTED` |
| **FR-017** (Emergency Dispatch Engine) | Backend & WebSocket | `backend/src/websocket/server.ts`, `backend/src/api/routes/emergency.routes.ts` | `emergency-api.test.ts`, `T3-CROSS-01` | `01-product/scope.md` | `IMPLEMENTED` |
| **FR-018** (AI Lost Hiker Polygons) | AI Layer (Genkit / Gemini 2.5 Flash) | `src/app/api/search-areas/route.ts`, `src/features/hiker-search` | `profile-page.test.tsx` | `03-architecture/adr/ADR-008-ai-as-decision-support.md` | `IMPLEMENTED` |
| **FR-020** (Group Chat E2EE) | Communication & Security UI | `src/views/group-chat.tsx`, `packages/lora-mesh/src/codec/chat-codec.ts` | `backend-security-e2ee.test.ts`, `codecs.test.ts` | `04-security/encryption.md` | `IMPLEMENTED` |
| **FR-022** (Privacy Modes & Emergency Bypass) | Domain & Security | `src/core/security/privacy-filter.ts`, `backend/src/api/routes/telemetry.routes.ts`| `security-phase2.test.ts`, `T1-TELEM-05` | `04-security/privacy.md` | `IMPLEMENTED` |
| **FR-023** (Expedition Status Bar) | Core Dashboard UI | `src/features/expedition/ui/expedition-status-bar.tsx` | `resilience-and-rbac.test.ts` | `03-architecture/system.md` | `IMPLEMENTED` |
| **FR-024** (Chaos Simulator) | Transport & Resiliency | `src/core/transport/chaos-simulator.ts`, `src/components/chaos-control-modal.tsx` | `resilience-and-rbac.test.ts` | `03-architecture/adr/ADR-009-simulation-architecture.md` | `IMPLEMENTED` |
| **FR-025** (Audit Logger) | Core Logging | `src/core/transport/audit-logger.ts` | `resilience-and-rbac.test.ts` | `04-security/threat-model.md` | `IMPLEMENTED` |
| **FR-026** (API Rate Limiter & Validation) | Server & Middleware | `backend/src/middleware/rate-limiter.ts`, `backend/src/middleware/validation.ts`| `rate-limiter.test.ts`, `T1-RATE-01..05` | `03-architecture/backend.md` | `IMPLEMENTED` |
| **FR-027** (OWASP Security Headers) | Infrastructure & Config | `next.config.ts` | Build verification | `04-security/threat-model.md` | `IMPLEMENTED` |
| **FR-028** (Minetti Metabolic Cost) | Terrain Physics Layer | `src/features/routing/lib/terrain-physics.ts` | `terrain-physics.test.ts` (21 тест) | `03-architecture/architecture.md` | `IMPLEMENTED` |
| **FR-029** (Tobler Pace & SAC T1-T4) | Terrain Physics Layer | `src/features/routing/lib/terrain-physics.ts`, `sac-scale.ts` | `terrain-physics.test.ts` | `03-architecture/architecture.md` | `IMPLEMENTED` |
| **FR-030** (Zero-Select Classification) | Routing & API Layer | `src/features/routing/lib/auto-classification.ts`, `/api/routes/classify` | `auto-classification.test.ts` (24 теста), `route.test.ts` | `03-architecture/adr/ADR-010-autonomous-terrain-and-geographic-classification.md` | `IMPLEMENTED` |
| **FR-031** (Offline Map Tile Cache) | Offline Cache & PWA | `src/core/map/offline-map-cache.ts`, `public/sw.js` | `T1-OFFL-01..05`, `T2-OFFL-01..05` | `03-architecture/backend.md` | `IMPLEMENTED` |
| **FR-032** (PostgreSQL / PostGIS Backend)| Database & Storage Layer | `backend/schema.sql`, `backend/src/db/schema.ts`, `backend/src/repositories/` | `ddl.test.ts`, `teams-api.test.ts`, `tracks-api.test.ts` | `03-architecture/backend.md`, `ADR-012` | `IMPLEMENTED` |
| **FR-033** (WebSocket Real-Time Engine) | Real-Time Transport | `backend/src/websocket/server.ts`, `rooms.ts`, `handlers.ts` | `handlers-and-server.test.ts`, `T1-WS-01..05` | `03-architecture/backend.md` | `IMPLEMENTED` |
| **FR-034** (Hardware Transports: Serial/BLE/MQTT)| Radio Transports | `packages/lora-mesh/src/transports/` (WebSerial, BLE, MQTT) | `transports-and-routing.test.ts`, `T1-TRAN-01..05` | `05-mesh/meshcore-research.md` | `IMPLEMENTED` |
| **NFR-OCC** (Optimistic Concurrency Control)| Domain & SQL Layer | `src/core/domain/occ.ts`, `backend/src/repositories/drizzle.repositories.ts` | `resilience-and-rbac.test.ts`, `T1-TEAM-04` | `03-architecture/backend.md` | `IMPLEMENTED` |
| **NFR-Spatial** (PostGIS Spatial Queries) | Spatial Database Engine | `backend/src/api/routes/geofences.routes.ts` (`ST_Contains`, `ST_DWithin`) | `geofences-api.test.ts`, `T1-GEOF-01..05` | `03-architecture/backend.md` | `IMPLEMENTED` |
| **NFR-Tests** (431 Automated Tests) | Quality Assurance | Vitest Monorepo Runner (290) + Standalone E2E Runner (141) | 431 / 431 passed (100% success rate) | `README.md`, `architecture.md` | `VERIFIED` |
