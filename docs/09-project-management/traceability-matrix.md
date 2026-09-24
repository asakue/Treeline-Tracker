# Матрица прослеживаемости (Traceability Matrix)

**Статус документа:** `COMPLETED`  
**Категория:** Управление проектом (`09-project-management`)

---

## Связка: Требование ➔ Архитектура ➔ Реализация ➔ Тесты ➔ Документация ➔ Статус

| Требование | Архитектурный модуль | Реализация в коде | Тесты | Документация | Статус |
|---|---|---|---|---|---|
| **FR-001** (Identity & Profile) | Security & UI Layer | `src/core/security/identity-manager.ts`, `src/views/profile-page.tsx` | `security-phase2.test.ts`, `profile-page.test.tsx` | `04-security/identity.md` | `IMPLEMENTED` |
| **FR-002** (Groups) | Domain & Repository | `src/core/repositories/local-storage-group-repository.ts` | `security-phase2.test.ts` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-003** (Join Group) | Security & Repository | `src/core/security/crypto-service.ts` | `security-phase2.test.ts` | `04-security/key-management.md` | `IMPLEMENTED` |
| **FR-004** (Routes & GPX) | Domain, Utils & UI | `src/core/repositories/local-storage-route-repository.ts`, `src/core/utils/gpx-exporter.ts` | `gpx-exporter.test.ts`, `profile-page.test.tsx` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-005** (Elevation & DEM) | Domain & Lib | `src/lib/elevation-service.ts` | `profile-page.test.tsx` | `01-product/use-cases.md` | `IMPLEMENTED` |
| **FR-006** (Location) | Domain Layer | `src/core/domain/types.ts` | `security-phase2.test.ts` | `03-architecture/data-flow.md` | `IMPLEMENTED` |
| **FR-007** (Encryption AEAD) | Security Layer | `src/core/security/crypto-service.ts` | `security-phase2.test.ts` | `04-security/encryption.md` | `IMPLEMENTED` |
| **FR-008** (Signatures Ed25519) | Security Layer | `src/core/security/crypto-service.ts`, `secure-packet-service.ts` | `security-phase2.test.ts`, `profile-page.test.tsx` | `04-security/encryption.md` | `IMPLEMENTED` |
| **FR-009** (Anti-Replay) | Security Layer | `src/core/security/replay-protection.ts` | `security-phase2.test.ts` | `04-security/threat-model.md` | `IMPLEMENTED` |
| **FR-010** (Transport Mgr) | Transport Layer | `src/core/transport/transport-manager.ts` | `transport.test.ts` | `03-architecture/communication.md` | `PLANNED` |
| **FR-011** (Internet) | Transport Layer | `src/core/transport/internet.transport.ts` | `transport.test.ts` | `03-architecture/communication.md` | `IMPLEMENTED` |
| **FR-012** (MeshCore) | Transport Layer | `src/core/transport/meshcore.transport.ts` | `mesh.test.ts` | `05-mesh/meshcore-research.md` | `SIMULATED` |
| **FR-013** (Offline Queue) | Offline Layer | `src/core/offline/offline-queue.ts` | `offline.test.ts` | `03-architecture/backend.md` | `PLANNED` |
| **FR-015** (SOS Trigger) | Application & UI | `src/features/emergency-services/` | `emergency.test.ts` | `01-product/use-cases.md` | `SIMULATED` |
| **FR-017** (Mock Gateway) | Infrastructure | `src/core/infrastructure/mock-gateway.ts` | `emergency.test.ts` | `01-product/scope.md` | `SIMULATED` |
| **FR-018** (AI Lost Hiker) | AI Layer (Genkit) | `src/ai/flows/suggest-search-areas...` | `ai.test.ts` | `03-architecture/adr/ADR-008...` | `PROTOTYPE` |
| **FR-022** (Privacy Modes UI) | Domain, Security & UI | `src/core/security/privacy-filter.ts`, `src/views/profile-page.tsx` | `security-phase2.test.ts`, `profile-page.test.tsx` | `04-security/privacy.md` | `IMPLEMENTED` |
| **FR-024** (Simulation) | Simulation Layer | `src/core/simulation/simulation-engine.ts` | `simulation.test.ts` | `03-architecture/adr/ADR-009...` | `PLANNED` |

