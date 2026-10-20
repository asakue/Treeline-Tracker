# Матрица прослеживаемости (Traceability Matrix)

**Статус документа:** `COMPLETED & FULLY VERIFIED`  
**Категория:** Управление проектом (`09-project-management`)  
**Актуализация:** Октябрь 2026 г. (Версия: 0.5.0)

---

## Связка: Требование ➔ Архитектура ➔ Реализация ➔ Тесты ➔ Документация ➔ Статус

| Требование | Архитектурный модуль | Реализация в коде | Тесты | Документация | Статус |
|---|---|---|---|---|---|
| **FR-001** (Identity & Profile) | Security & UI Layer | `src/core/security/identity-manager.ts`, `src/views/profile-page.tsx` | `security-phase2.test.ts`, `profile-page.test.tsx` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-001a** (Multi-Auth Providers) | Auth & Security Layer | `src/components/auth-rbac-modal.tsx`, `src/core/security/rbac-service.ts` | `resilience-and-rbac.test.ts` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-001b** (Account Linking) | Auth & Domain Layer | `src/core/security/rbac-service.ts`, `src/core/repositories` | `resilience-and-rbac.test.ts` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-001c** (RBAC Custom Claims) | Security & Infrastructure | `src/core/security/rbac-service.ts`, `firestore.rules` | `resilience-and-rbac.test.ts` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-001d** (MFA 2FA) | Security Layer | `src/components/auth-rbac-modal.tsx`, `src/core/security/rbac-service.ts` | `resilience-and-rbac.test.ts` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-001e** (Session Management) | Auth & Security Layer | `src/core/security/rbac-service.ts`, `src/features/expedition/ui/expedition-status-bar.tsx` | `resilience-and-rbac.test.ts` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-002** (Groups & Safe Radius) | Domain, Geofence & UI | `src/core/domain/schemas.ts`, `src/core/location/location-filter.ts`, `src/views/map-view.tsx` | `location-and-offline.test.ts` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-003** (Join Group & Keys) | Security & Repository | `src/core/security/crypto-service.ts`, `src/core/security/identity-manager.ts`, `src/features/group-management` | `security-phase2.test.ts`, `backend-security-e2ee.test.ts` | `04-security/key-management.md` | `IMPLEMENTED` |
| **FR-004** (Routes & GPX) | Domain, Utils & UI | `src/core/repositories/local-storage-route-repository.ts`, `src/core/utils/gpx-exporter.ts` | `gpx-exporter.test.ts`, `profile-page.test.tsx` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-005** (Elevation & DEM) | Domain & Lib | `src/lib/elevation-service.ts`, `src/views/route-planner.tsx` | `profile-page.test.tsx` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-006** (Location, Deadband, Throttle) | Location & Spatial Index | `src/core/location/location-filter.ts`, `src/core/location/geohash.ts` | `location-and-offline.test.ts` | `03-architecture/data-flow.md` | `IMPLEMENTED` |
| **FR-007** (Encryption AEAD) | Security Layer | `src/core/security/crypto-service.ts` (AES-256-GCM), `src/views/group-chat.tsx` | `security-phase2.test.ts`, `backend-security-e2ee.test.ts` | `04-security/encryption.md` | `IMPLEMENTED` |
| **FR-008** (Signatures Ed25519) | Security Layer | `src/core/security/crypto-service.ts`, `secure-packet-service.ts` | `security-phase2.test.ts` | `04-security/encryption.md` | `IMPLEMENTED` |
| **FR-009** (Anti-Replay) | Security Layer | `src/core/security/replay-protection.ts` | `security-phase2.test.ts` | `04-security/threat-model.md` | `IMPLEMENTED` |
| **FR-010** (Transport Manager) | Transport Layer | `src/core/transport/transport-manager.ts` | `resilience-and-rbac.test.ts` | `03-architecture/communication.md` | `IMPLEMENTED` |
| **FR-011** (Internet Transport) | Transport Layer | `src/core/transport/internet-transport.ts`, `src/firebase` | `resilience-and-rbac.test.ts` | `03-architecture/communication.md` | `IMPLEMENTED` |
| **FR-012** (MockMeshCore LoRa) | Transport Layer | `src/core/transport/meshcore-transport.ts` | `resilience-and-rbac.test.ts` | `05-mesh/meshcore-research.md` | `SIMULATED` |
| **FR-013** (Offline Queue IndexedDB) | Transport & Persistence | `src/core/transport/offline-queue.ts`, `src/core/transport/indexeddb-queue-storage.ts` | `location-and-offline.test.ts` | `03-architecture/backend.md` | `IMPLEMENTED` |
| **FR-014** (Auto-Flush & Dedup) | Transport Layer | `src/core/transport/transport-manager.ts`, `src/core/transport/offline-queue.ts` | `location-and-offline.test.ts`, `resilience-and-rbac.test.ts` | `03-architecture/communication.md` | `IMPLEMENTED` |
| **FR-015** (SOS Trigger 3s) | Application, Security & UI | `src/views/emergency-services.tsx`, `src/core/security/privacy-filter.ts` | `location-and-offline.test.ts`, `backend-security-e2ee.test.ts` | `01-product/use-cases.md`, `04-security/privacy.md` | `IMPLEMENTED` |
| **FR-016** (SOS Telemetry Packet) | Domain, Security & Transport | `src/core/transport/interfaces.ts`, `src/core/security/privacy-filter.ts`, `src/views/emergency-services.tsx` | `location-and-offline.test.ts`, `backend-security-e2ee.test.ts` | `01-product/scope.md`, `04-security/privacy.md` | `IMPLEMENTED` |
| **FR-017** (Mock Emergency Gateway) | Infrastructure | `src/views/emergency-services.tsx` | `location-and-offline.test.ts` | `01-product/scope.md` | `SIMULATED` |
| **FR-018** (AI Lost Hiker Polygons) | AI Layer (Genkit / Gemini 2.5 Flash) | `src/app/api/search-areas/route.ts`, `src/features/hiker-search` | `profile-page.test.tsx` | `03-architecture/adr/ADR-008-ai-as-decision-support.md` | `IMPLEMENTED` |
| **FR-019** (AI Confidence & Terrain) | AI Layer | `src/app/api/search-areas/route.ts` | API verification | `01-product/scope.md` | `IMPLEMENTED` |
| **FR-020** (Group Chat E2EE) | Communication & Security UI | `src/views/group-chat.tsx`, `src/core/security/identity-manager.ts` | `backend-security-e2ee.test.ts` | `01-product/use-cases.md`, `04-security/encryption.md` | `IMPLEMENTED` |
| **FR-021** (Weather Forecast) | Services Layer | `src/views/weather-forecast.tsx` | UI verification | `01-product/use-cases.md` | `SIMULATED` |
| **FR-022** (Privacy Modes & Emergency Bypass) | Domain, Security & UI | `src/core/security/privacy-filter.ts`, `src/views/profile-page.tsx` | `profile-page.test.tsx`, `security-phase2.test.ts`, `backend-security-e2ee.test.ts` | `04-security/privacy.md` | `IMPLEMENTED` |
| **FR-023** (Expedition Status Bar) | Core Dashboard UI | `src/features/expedition/ui/expedition-status-bar.tsx` | `resilience-and-rbac.test.ts` | `03-architecture/system.md` | `IMPLEMENTED` |
| **FR-024** (Chaos Simulator) | Transport & Resiliency | `src/core/transport/chaos-simulator.ts`, `src/components/chaos-control-modal.tsx` | `resilience-and-rbac.test.ts` | `03-architecture/adr/ADR-009-simulation-architecture.md` | `IMPLEMENTED` |
| **FR-025** (Audit Logger) | Core Logging | `src/core/transport/audit-logger.ts`, `src/components/audit-log-modal.tsx` | `resilience-and-rbac.test.ts` | `04-security/threat-model.md` | `IMPLEMENTED` |
| **FR-026** (API Rate Limiter & Validation) | Server & Security Layer | `src/core/security/api-security.ts`, `src/app/api/*` | `backend-security-e2ee.test.ts` | `04-security/threat-model.md`, `03-architecture/backend.md` | `IMPLEMENTED` |
| **FR-027** (OWASP Security Headers & CSP) | Infrastructure & Config | `next.config.ts` | Build & Header verification | `04-security/threat-model.md` | `IMPLEMENTED` |
| **NFR-OCC** (Concurrency Control) | Domain Layer | `src/core/domain/occ.ts` (`validateAndIncrementVersion`) | `resilience-and-rbac.test.ts` | `03-architecture/backend.md` | `IMPLEMENTED` |
| **NFR-Cache** (Firestore Persistence) | Infrastructure Layer | `src/firebase/index.ts` (`persistentLocalCache`) | Integration verification | `03-architecture/backend.md` | `IMPLEMENTED` |
