# Changelog

All notable changes to the **Treeline Tracker** project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] - 2026-09-24

### Added
- **Team Expansion in About Us**: Added Alexander and Kirill as core developers to the team roster and application documentation.
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
- **Testing & Quality Assurance**:
  - Vitest and React Testing Library setup for `shared/lib`, `entities`, and `features`.
  - GitHub Actions workflow (`.github/workflows/ci.yml`) covering security audit, linting, typechecking, testing, and automated build verification.
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
