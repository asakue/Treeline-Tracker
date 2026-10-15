# Treeline Tracker — End-to-End Field Operations & Resilience Architecture

Treeline Tracker delivers mission-critical mountain expedition coordination, end-to-end encrypted hiker telemetry, resilient offline store-and-forward communication, and AI-assisted search and rescue (SAR) decision support. This implementation plan outlines the architecture and execution steps to complete the remaining requirements (FR-001a through FR-025) while strictly honoring the project's technical specifications and safety invariants.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters have been confirmed based on requirements and clarification answers:

- **Full End-to-End Scope (FR-001a – FR-025)**: Completing the end-to-end functional requirements across authentication, groups, routes with GPX, cryptographic security, resilient transport, emergency SOS, AI search recommendations, offline queue, and expedition status bar.
- **RBAC Authentication & Testing Suite**: Firebase Authentication integration paired with an interactive Role Switcher (`hiker`, `guide`, `rescuer`, `admin`) to allow real-time validation of permission guards and role-specific interfaces without cumbersome credential juggling.
- **Optimistic Concurrency Control (OCC)**: Version-checked updates on shared entities (e.g., routes and group manifests) with automatic retry and non-destructive user notifications upon conflict.
- **Resilient Transport Matrix**: Failover pipeline spanning `InternetTransport` (HTTP/Firestore), `MockMeshCoreTransport` (LoRa/Mesh packet simulation), and `OfflineQueue` (IndexedDB / LocalStorage store-and-forward buffer) governed by a unified `TransportManager`.

---

## 1. Overview & Core Concept

Treeline Tracker is a web-based expedition safety platform built for outdoor leaders, hikers, and search-and-rescue teams operating in remote backcountry terrain. The application bridges the gap between high-connectivity base camps and zero-reception wilderness trails through a hybrid transport layer, client-side cryptography, and cloud synchronization.

### Target Personas & RBAC Tiers
1. **Hiker (`hiker`)**: Group member tracking their own location, receiving geofence alerts, sending SOS distress signals, and communicating over encrypted group chat.
2. **Expedition Guide (`guide`)**: Team leader planning trails, managing participant rosters, distributing group encryption keys, and monitoring member safety radii.
3. **Rescuer / SAR Operator (`rescuer`)**: Search-and-rescue personnel receiving emergency telemetry, running AI lost-hiker sector calculations, and coordinating dispatch efforts.
4. **Administrator (`admin`)**: System operator managing organization-wide configurations, audit logs, and infrastructure health.

---

## 2. User Experience & Visual Design

### Aesthetic Direction: Mountain Tactical Utilitarian
- **Mood**: High-contrast, utilitarian, field-ready topography dashboard. Purposeful visual hierarchy with zero decorative fluff or artificial AI badges.
- **Palette**:
  - Dominant Canvas: Deep slate `#0B0F17` (Dark) / Crisp high-contrast neutral `#F8FAFC` (Light)
  - Primary Accent: Mountain Pine `#10B981` (safe/active status, GPS lock)
  - Emergency / Alert: High-visibility Beacon Amber `#F59E0B` and SOS Crimson `#EF4444`
  - Structural Borders: Hairline 1px `#1E293B` (Dark) / `#E2E8F0` (Light)
- **Typography & Ergonomics**:
  - Clean sans-serif (`Inter`) with balanced headline measures
  - Monospace tabular numerals (`font-mono tabular-nums`) for GPS coordinates, elevation, speed, and timestamps
  - Minimum touch hitboxes of $44\times 44\text{px}$ across all mobile and tablet controls
  - Zero static pill boxes for metadata — clean typographic separators (`·` or `/`)
  - No decorative status dots — indicators reflect real hardware/telemetry state only

### Layout Hierarchy & Navigation
- **Expedition Status Bar (FR-023)**: Sticky top bar showing real-time connectivity status (`Cellular` / `Mesh` / `Offline Queue`), GPS satellite lock accuracy, WebCrypto E2EE session state, and device battery percentage.
- **Tactical Map Viewport**: Leaflet map supporting topographical layers, offline tile cache notice, hiker location markers with privacy blurring, group safety perimeter circle, and route polyline with elevation profile.
- **Field Simulation & Chaos Panel (FR-024)**: Developer & testing dock to toggle connectivity drops, packet loss, replay attacks, and battery degradation to observe app resilience.
- **Audit Event Log (FR-025)**: Expandable streaming log showing structured events (`[GPS]`, `[SECURITY]`, `[TRANSPORT]`, `[OCC]`).

---

## 3. Key Product Decisions & Trade-Offs

### 1. Hybrid Transport & Offline Queue (FR-010 – FR-014)
- **Approach**: All telemetry updates, messages, and SOS signals pass through `TransportManager.sendPacket()`. If online, packets are transmitted via Cloud Firestore / API routes; if internet is unavailable, packets attempt local mesh simulation (`MockMeshCoreTransport`); if neither is connected, packets are queued into persistent `OfflineQueue`. Upon network recovery, queued packets are transmitted sequentially with deduplication.
- **Trade-off**: Requires client-side replay protection (`messageId`, incremental `sequence`, and 10-minute validity timestamp window) to ensure replayed or delayed offline packets do not corrupt state.

### 2. Optimistic Concurrency Control (OCC)
- **Approach**: Routes and Groups maintain an integer `version` field. On write, the client checks if `doc.version === localVersion`. If a conflict occurs, `TransportManager` fetches the latest remote version, attempts an automatic three-way merge for non-conflicting waypoint edits, and alerts the user if manual resolution is required.
- **Trade-off**: Slightly higher write complexity in exchange for 100% data integrity during multi-guide trail edits.

### 3. Client-Side E2EE Web Crypto (FR-007 – FR-009)
- **Approach**: Location updates and group messages are signed with the user's private Ed25519 key and encrypted with the expedition's shared AES-256-GCM symmetric key. The server never inspects plaintext telemetry of private groups.
- **Trade-off**: Requires symmetric key distribution among group members during group creation / invitation join (FR-003).

---

## 4. Technical Architecture & Data Strategy

### System Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Treeline Tracker Frontend                       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Expedition Status Bar (GPS | Transport | Crypto | Battery)     │  │
│  │   RBAC Role Switcher & Auth State (hiker | guide | rescuer | adm) │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                   │
│  ┌─────────────────────────────────┴────────────────────────────────┐  │
│  │                          Views & Tools                           │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │  │
│  │  │ Interactive  │ │ Route Drawer │ │   Lost Hiker │ │  SOS &   │ │  │
│  │  │   Map View   │ │   & GPX I/O  │ │    AI Tool   │ │ Emergen. │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                   │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │                  Core Domain & Security Engine                   │  │
│  │  ┌───────────────────┐  ┌──────────────────┐  ┌────────────────┐ │  │
│  │  │ Identity Manager  │  │ Secure Packet    │  │ Replay Guard   │ │  │
│  │  │ (Ed25519 Keys)    │  │ (AES-256-GCM)    │  │ (Sequence/TTL) │ │  │
│  │  └───────────────────┘  └──────────────────┘  └────────────────┘ │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                   │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │                 Resilient Transport Manager                      │  │
│  │                                                                  │  │
│  │       Internet Active? ──Yes──► Cloud Firestore / API Sync        │  │
│  │              │ No                                                │  │
│  │       Mesh Available? ──Yes──► MockMeshCoreTransport (LoRa)      │  │
│  │              │ No                                                │  │
│  │              └───────────────► OfflineQueue (IndexedDB/Storage)  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Entities & Schema Alignment
- **`User`**: `uid`, `email`, `displayName`, `role` (`hiker` | `guide` | `rescuer` | `admin`), `publicKey`, `privacyMode`, `activeGroupId`.
- **`Group`**: `id`, `name`, `guideId`, `memberIds`, `groupKey`, `safeRadiusMeters`, `status`, `version`, `updatedAt`.
- **`Route`**: `id`, `name`, `waypoints` (`[lat, lon, ele]`), `distanceKm`, `elevationGainM`, `version`, `isArchived`, `updatedAt`.
- **`TelemetryPacket`**: `hikerId`, `encryptedPayload`, `signature`, `sequence`, `timestamp`, `messageId`.
- **`Emergency`**: `id`, `groupId`, `reporterId`, `severity`, `coordinates`, `sarZone`, `status`, `timestamp`.

---

## 5. Execution Steps (Post-Approval)

1. **Step 1: Transport & Offline Infrastructure (FR-010 – FR-014)**
   - Implement `TransportManager` orchestrating failover across Internet, MeshCore simulator, and persistent `OfflineQueue`.
   - Add store-and-forward automatic flushing when connectivity returns with deduplication.

2. **Step 2: OCC & Versioning on Repositories (FR-002 – FR-005)**
   - Augment Route and Group repositories with optimistic version checking (`version: number`).
   - Implement automatic retry on conflict and visual conflict notice.

3. **Step 3: RBAC & Authentication UI (FR-001a – FR-001e)**
   - Connect Firebase Auth state with role claims and a development Role Switcher in the user profile and status bar.
   - Enforce view-level and action-level RBAC guards (e.g., guide-only group creation, rescuer-only SAR audit view).

4. **Step 4: Expedition Status Bar, Chaos Simulator & Event Log (FR-023 – FR-025)**
   - Implement unified top status bar with live telemetry metrics.
   - Add the Chaos Testing panel to toggle network outages, mesh degradation, and packet drops.
   - Embed real-time audit logging stream for debugging field actions.

5. **Step 5: Verification & Compilation**
   - Run typechecks and compilation to ensure clean build and error-free execution.
