# Changelog

All notable changes to the **Treeline Tracker** project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.3] - 2026-10-20

### Added
- **RBAC Permissions Matrix & Declarative Components**:
  - Defined granular atomic permissions (`Permission`) and role matrix (`ROLE_PERMISSIONS`) in `src/shared/config/permissions.ts`.
  - Implemented `<Can>` declarative guard component and `usePermissions` hook in `src/shared/lib/permissions/`.
  - Edge Middleware in `src/middleware.ts` for workspace route protection and role verification.
  - Server Action `updateUserRoleAction` with Optimistic Concurrency Control (`version: number`) and Custom Claims synchronization.
  - Firestore Security Rules strictly preventing client-side role modifications.
- **Dedicated Role Workspaces (`src/app/(workspace)/`)**:
  - **Hiker Workspace (`/hiker`)**: Fullscreen outdoor map, 3-second hold SOS button with circular SVG progress & vibration feedback, floating status bar (battery, GPS accuracy, E2EE stealth, IndexedDB queue), distance & azimuth arrow to guide.
  - **Guide Workspace (`/guide`)**: Route map with GPX trail & participant clusters, Roster Drawer with live telemetry and `safeRadiusMeters` setting, breach warning banner, Recharts elevation profile with pace & ETA, and E2EE key distribution modal with dynamic QR code.
  - **Rescuer SAR Workspace (`/rescuer`)**: Tactical dark command monitor with radio coverage overlays, emergency SOS feed with 2-hour breadcrumbs track, AI SAR polygon calculation powered by Gemini 2.5 Flash, and LoRa Mesh 868MHz radio gateway monitor.
  - **Admin Workspace (`/admin`)**: Operations dashboard, user management table with OCC edit modal, real-time audit log with JSON export, Chaos failure simulator, and sub-routes `/admin/users` and `/admin/audit`.

## [0.5.2] - 2026-10-20

### Added
- **Interactive Marker Clustering on Map (`leaflet.markercluster`)**:
  - Integrated `leaflet.markercluster` into `MapView` with custom themed cluster icons (`.hiker-marker-cluster`).
  - Added marker clustering CSS stylesheets to global CSS styles (`globals.css`).
  - Auto-spiderfy and smooth zoom-out cluster aggregation for large hiking expeditions.
- **OCC Auto-Retry Engine (`withOccRetry`)**:
  - Implemented `withOccRetry` helper in `src/core/domain/occ.ts` with exponential backoff and configurable retry limits.
  - Added comprehensive integration tests in `src/test/resilience-and-rbac.test.ts`.
- **Zod Schema Validation for SAR AI (`SearchAreaInputSchema`, `SearchAreaOutputSchema`)**:
  - Added runtime Zod validation for search-areas API route payload and AI polygon response.
  - Added `src/ai/dev.ts` developer UI entrypoint for Genkit CLI (`npm run genkit:dev`).
  - Synchronized AI model standard to `gemini-2.5-flash`.
- **Pre-commit Automation**:
  - Added `"hooks:install"` script to `package.json` for seamless pre-commit hook initialization.

### Changed
- **Team Roster Synchronization**:
  - Updated project documentation and application views (`AboutUs`, `AboutApp`) to represent the core team of 3 developers (Daniil, Alexander, Kirill) from group VIS31 (09.03.02 "Information Systems and Technologies").
  - Removed outdated references to Dmitry and Ilya from team rosters and architectural documents.

## [0.5.1] - 2026-10-15

### Added
- **Geofencing & Safe Radius Monitoring (`safeRadiusMeters`) (FR-002, UC-02)**:
  - Added configurable `safeRadiusMeters` field (50m to 10,000m, default 500m) to group domain models and schemas (`types.ts`, `schemas.ts`).
  - Added interactive radius input and slider to `CreateGroupForm` (`create-group-form.tsx`).
  - Rendered dynamic dashed Leaflet circle on `MapView` centered on the group leader.
  - Implemented real-time Haversine proximity evaluation tracking statuses: `INSIDE` (within radius), `WARNING` (approaching 85% limit), and `BREACH` (exceeded radius).
  - Added visual breach warning banner and structured audit entries in `AuditLogger`.
- **GNSS Location Filtering & Battery-Aware Throttling (`LocationFilter`) (FR-006, NFR-008)**:
  - Created `LocationFilter` class implementing Deadband (<5m static jitter elimination) and Throttle filtering (5s standard interval).
  - Implemented adaptive power-saving throttle (30s interval) when battery level drops to $\le 15\%$.
  - Added instant emergency bypass ensuring critical SOS signals are transmitted immediately without filtering delays.
  - Implemented standard base32 Geohash spatial hashing utility (`src/core/location/geohash.ts`) conforming to `geofire-common` specification.
  - Integrated `LocationFilter` into `ExpeditionStatusBar` position watcher.
- **Browser-Native IndexedDB Offline Queue Storage (`IndexedDBQueueStorage`) (FR-013, FR-014)**:
  - Created `IndexedDBQueueStorage` operating on browser-native database `treeline_tracker_db`.
  - Configured object stores `offline_packets` (indexed by `timestamp` and `priority`) and `dedup_ids`.
  - Added priority sorting guaranteeing `EMERGENCY_SOS` packets are flushed first.
  - Implemented seamless fallback to `localStorage` for private browser windows and incognito mode.
- **Firestore Multi-Tab Persistent Cache**:
  - Configured `initializeFirestore` with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` in `src/firebase/index.ts`.
- **Expanded Test Suite (`location-and-offline.test.ts`)**:
  - Added 16 unit and integration tests covering Deadband, Throttle, battery adaptation, SOS bypass, Geohash spatial bounds, Haversine distance, safe radius breach, IndexedDB offline queuing, priority ordering, and fallback.
  - Total automated test suite expanded to **57 tests across 6 test suites (100% pass rate)**.

## [0.5.0] - 2026-10-15

### Added
- **Expedition Status Bar & Field Operations Dashboard (`ExpeditionStatusBar`)**:
  - Sticky top bar with real-time connectivity status (`Cellular` / `MeshCore LoRa` / `Offline Queue`).
  - GPS satellite fix accuracy indicator (`±3m` - `±5m`).
  - WebCrypto E2EE session indicator (`Ed25519` + `AES-256-GCM`).
  - Real-time battery status with charging indicator and low-battery alerts.
  - Interactive RBAC Role Switcher modal (`hiker`, `guide`, `rescuer`, `admin`) with 6-digit TOTP MFA verification for privileged roles.
- **Resilient Multi-Channel Transport Architecture (`TransportManager`)**:
  - Transparent failover orchestrator: primary internet (Cloud Firestore / HTTPS) ➔ LoRa 868MHz Mesh simulation (`MockMeshCoreTransport` with RSSI metrics) ➔ persistent `OfflineQueue` store-and-forward buffer.
  - Concurrent `flushQueue()` deduplication lock preventing race conditions during background sync.
  - Anti-Replay packet deduplication cache (`DEDUP_CACHE_KEY`).
- **Chaos Testing Simulator Engine (`ChaosSimulator` & `ChaosControlModal`)**:
  - Developer & testing dock (FR-024) to simulate severe mountain blackout conditions: сотовая глушилка, экранирование радиоэфира, слайдер потери пакетов (0%–75%), сетевая задержка и симуляция критического разряда батареи (8%).
- **Real-Time Audit Event Logger (`AuditLogger` & `AuditLogModal`)**:
  - Transparent structured audit log stream (FR-025) tracking categories `[GPS]`, `[SECURITY]`, `[TRANSPORT]`, `[OCC]`, `[AUTH]`, `[SOS]`.
  - Filter by event category, real-time subscriber streaming, search, and one-click JSON export.
- **Optimistic Concurrency Control (OCC) Engine (`validateAndIncrementVersion`)**:
  - Version-based concurrency locking for routes and group manifests to prevent accidental data overwrites during simultaneous edits by multiple guides.
  - Custom `ConcurrencyConflictError` exception class.
- **Expanded Automated Verification Suite (`Vitest`)**:
  - Created `resilience-and-rbac.test.ts` integration test suite testing OCC version increments, RBAC permissions, MFA challenge, transport channel failovers, offline store-and-forward flushing, Chaos simulator drops, and audit stream subscriptions.
  - Total automated test count expanded to **41 passed tests / 5 test suites** (100% pass rate).
- **Mobile Navigation & Ergonomics Enhancements**:
  - 5-item mobile bottom navigation bar (`Карта`, `Трекер`, `Маршруты`, `SOS`, `Меню`) with touch hit targets ≥ 44×44px.
  - Improved padding, scrolling, and layout responsiveness across `EmergencyChat`, `EmergencyServices`, `LocationTracker`, and `RoutePlanner`.
- **BRouter Hiking Routing & DEM Elevation Statistics**:
  - Integrated BRouter foot trail routing between waypoints A and B with elevation gain/loss profiling and multi-path suggestion cards.

### Fixed
- Fixed RadioGroup uncontrolled-to-controlled state warning in `ProfilePage`.
- Fixed Lucide icon `RadioOff` missing export in `ChaosControlModal` and `ExpeditionStatusBar`.
- Fixed race condition in `TransportManager.flushQueue()` when triggered simultaneously by network change events and user actions.
- Fixed non-scrollable overflow on mobile screens in `EmergencyServices`.

---

## [0.4.1] - 2026-09-25

### Fixed
- **Dependency & Build Configuration Sync**:
  - Corrected `vitest` dependency version range in `package.json` to stable 4.x (`^4.1.9`).
  - Synchronized `eslint-config-next` to `15.3.8` and `eslint` to `^9.20.0` to match Next.js 15.3.8.
  - Removed `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` suppression masks from `next.config.ts` (`ignoreBuildErrors: false`, `ignoreDuringBuilds: false`).
  - Resolved all underlying TypeScript type errors across `crypto-service.ts` (BufferSource typing), `map-route-drawer.tsx` (Leaflet MapOptions & events), `location-tracker.tsx` (async group submission), `use-routes.ts`, and domain entity models (`Group`, `Member`, `Route`, `AppUserProfile`).
- **AI Stack Clarification & Dependency Hygiene**:
  - Removed unused legacy `@google/generative-ai` SDK dependency from `package.json`.
  - Clarified and documented **Google Genkit** (`genkit` + `@genkit-ai/google-genai`) as the unified AI framework powering SAR search area flows.
- **Repository Cleanliness & Documentation**:
  - Ensured `.idx/` and `.modified` are untracked and excluded in `.gitignore`.
  - Recreated standard non-sensitive `.env.example` template.
  - Expanded `README.md` available scripts documentation with detailed explanations for `test`, `test:watch`, `analyze`, `security:scan`, `typecheck`, and `lint`.

---

## [0.4.0] - 2026-09-24

### Added
- **Team Expansion in About Us**: Added Alexander and Kirill as core developers to the team roster and application documentation.
- **Zero-Knowledge Cryptographic Layer (E2EE)**:
  - W3C Web Crypto API implementation: Ed25519 digital signatures (`crypto-service.ts`) and AES-256-GCM AEAD authenticated encryption.
  - Decentralized identity manager (`identity-manager.ts`): local keypair generation, hex fingerprinting, and key rotation.
  - Anti-Replay Protection (`replay-protection.ts`): monotonic sequence enforcement, messageId deduplication cache, and 10-minute time freshness window.
  - Geodata Privacy Filter (`privacy-filter.ts`): `NORMAL` (exact GNSS), `REDUCED` (200m grid obfuscation + altitude stripping), and `STEALTH` (local logging only, zero RF transmission).
- **Profile & Security Management (`ProfilePage`)**:
  - Dual-tab architecture (`profile` / `security`) for seamless switching between personal data and cryptographic credentials.
  - Reactive profile completion meter (0% to 100%) dynamically calculated based on avatar, name, email, phone, and biography.
  - Profile edit modal dialog with instant persistence through repository layer.
  - Dedicated Security tab displaying Ed25519 public key, formatted fingerprint (`A1B2:C3D4`), one-click key rotation (`rotateLocalIdentity`), geodata privacy mode selector, and security protocols overview.
- **Automated Test Infrastructure & Comprehensive Suites**:
  - Configured Vitest 5.0, React Testing Library, and JSDOM with 100% pass rate across 4 suites (24 tests / 39 security assertions).
  - `src/views/__tests__/profile-page.test.tsx`: 16 comprehensive unit tests covering user data rendering, empty fallbacks, edit modal flows, completion percent calculations, tab navigation, Ed25519 credentials, key rotation, and privacy mode switching.
  - `src/core/security/__tests__/security-phase2.test.ts`: 39 end-to-end security checks verifying ciphertexts, signature rejection on tampering, anti-replay filters, and privacy pipelines.
  - `src/core/utils/__tests__/gpx-exporter.test.ts`: Automated validation of route GPX XML generation.
- **GPX Exporter Utility**: Created `src/core/utils/gpx-exporter.ts` to export route waypoints and elevation profiles to standard GPX XML format.
- **Multi-Role RBAC Model**: Implemented granular role-based access control with four distinct roles:
  - `hiker` (Турист): Access to own telemetry, own group route, emergency SOS button.
  - `guide` (Лидер группы): Full CRUD on group routes, member management, checkpoint verification.
  - `rescuer` (Оператор спасательной службы / МЧС): Sector-wide visibility, emergency dispatch, AI SAR generation.
  - `admin` (Администратор): Full governance, claims management, audit logs.
- **Firestore Security Rules**: Production `firestore.rules` template enforcing role checking, group membership validation, and rate limiting.
- **Real-time Spatial Queries**: Geo-indexed lookups using `geofire-common` (precision 7–8 geohashes) and Firestore `onSnapshot` listeners.
- **Adaptive Telemetry Throttling**: GPS coordinate updates throttled to 5–10 seconds with deadband filtering (< 3m movement) to preserve hiker battery.
- **Search & Rescue (SAR) AI Guardrails**:
  - Prompt injection protection and input sanitization.
  - Strict output schema validation using Zod (`SarZoneSchema`).
  - Prohibition of direct DB write from LLM; operator confirmation required.
  - Structured audit trail logging for all AI inferences.
- **Environment & Secret Management**:
  - Added `.env.example` template with clear client vs server secret isolation.
  - Hardened `.gitignore` to strictly exclude `.env`, `.env.local`, and key files.
  - Guidelines for Google Secret Manager and Firebase App Hosting secrets.
  - Pre-commit scanning guidelines (`trufflehog`, `git-secrets`).
- **Offline-First Capabilities**:
  - Firestore `persistentLocalCache` configuration.
  - IndexedDB offline telemetry queue with automatic batched sync on reconnect.
  - Binary packet serialization for off-grid LoRa / BLE mesh transmission.
- **Optimistic Concurrency Control (OCC)**: Version-based conflict resolution for simultaneous route editing by group leaders.
- **Performance Optimizations**:
  - Leaflet marker clustering (`leaflet.markercluster`).
  - Cached weather forecasts with TTL.
  - Dynamic imports for Leaflet and Recharts with `@next/bundle-analyzer` audit.


### Changed
- **Feature-Sliced Design (FSD) Refactoring**:
  - Relocated AI flows out of `shared/api` into dedicated domain features (`features/sar-ai`).
  - Transferred domain calculations (`map-utils`, route calculations) into `entities/route` and `entities/hiker`.
  - Formalized clean separation between `views/` (pages) and `widgets/` (composite components).
- **Single Source of Truth**: Removed duplicate local states; transitioned to authoritative Firestore real-time listener synchronization.

### Fixed
- Fixed unauthenticated access vulnerability to emergency broadcast and location telemetry.
- Fixed map re-rendering flicker by memoizing GeoJSON layers and marker collections.
- Prevented potential secret leakage in version control.

---

## [0.3.0] - 2026-08-15

### Added
- **Interactive Route Drawing**: Multi-point elevation profile calculation and trail distance estimation.
- **Live Group Telemetry**: Real-time marker updates on Leaflet map with battery and altitude indicators.
- **Weather Integration**: Elevation-adjusted temperature and precipitation forecasts for active mountain trails.

### Changed
- Migrated UI components to `shadcn/ui` with Radix primitives and Tailwind CSS.
- Upgraded Next.js App Router structure.

---

## [0.2.0] - 2026-07-01

### Added
- Proof-of-concept map rendering using Leaflet and OpenStreetMap tiles.
- Basic group creation and member listing.
- Mock telemetry data generator for offline simulation.

---

## [0.1.0] - 2026-05-20

### Added
- Initial project scaffolding with Next.js and TypeScript.
- Project concept, architecture blueprint, and domain modeling.
