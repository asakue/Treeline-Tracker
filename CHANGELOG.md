# Changelog

All notable changes to the **Treeline Tracker** project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
