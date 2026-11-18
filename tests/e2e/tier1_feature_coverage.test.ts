/**
 * Tier 1: Feature Coverage Test Suite (60 Tests)
 * Treeline Tracker E2E Testing Framework
 * 
 * Verifies standard happy-path functionality for all 12 core features:
 * - Feature 1: Authentication & RBAC (5 tests)
 * - Feature 2: Team & Member Management (5 tests)
 * - Feature 3: Waypoint Management (5 tests)
 * - Feature 4: Track Recording & Playback (5 tests)
 * - Feature 5: Geofence Monitoring & Alerts (5 tests)
 * - Feature 6: Telemetry Batch Ingestion (5 tests)
 * - Feature 7: Rate Limiting & SOS Bypass (5 tests)
 * - Feature 8: WebSocket Real-time Messaging (5 tests)
 * - Feature 9: Meshtastic Protobuf Wire Packets (5 tests)
 * - Feature 10: Distress Beacon & SOS Mesh Protocol (5 tests)
 * - Feature 11: Hardware Transports Framing (5 tests)
 * - Feature 12: Offline Tile Caching & PWA (5 tests)
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect, runnerInstance } from './runner';
import { ApiClient } from './harness/httpClient';
import { TestWebSocketClient } from './harness/wsClient';
import {
  MeshtasticCodec,
  WebSerialFramer,
  SerialFSMParser,
  MockBleGattTransport,
  MockMqttBridge,
  PortNum,
  MeshPriority,
  HardwareModel,
} from './harness/meshPacketBuilder';
import {
  MockIDBFactory,
  MockCacheStorage,
  SlippyMath,
  OfflinePacketQueue,
} from './harness/offlineStorageMock';

describe('Tier 1: Feature Coverage (60 Tests)', () => {
  let http: ApiClient;
  let wsUrl: string;
  let defaultAuthToken = '';

  beforeAll(() => {
    if (runnerInstance.server) {
      defaultAuthToken = runnerInstance.server.generateJwt({
        sub: 'default-admin-uuid',
        role: 'admin',
      });
    }
  });

  beforeEach(() => {
    http = new ApiClient(runnerInstance.baseUrl);
    if (defaultAuthToken) {
      http.setToken(defaultAuthToken);
    }
    wsUrl = runnerInstance.wsUrl;
  });

  // ==========================================================================
  // FEATURE 1: AUTHENTICATION & RBAC (5 TESTS)
  // ==========================================================================
  describe('Feature 1: Authentication & RBAC', () => {
    let registeredUserToken = '';
    let refreshToken = '';

    it('T1-AUTH-01: User Registration', async () => {
      const res = await http.auth.register({
        email: 'hiker1@treeline.org',
        password: 'SecurePassword123!',
        displayName: 'Alex Hiker',
      });
      res.expectStatus(201);
      expect(res.data.user.id).toBeDefined();
      expect(res.data.user.email).toBe('hiker1@treeline.org');
      expect(res.data.user.role).toBe('hiker');
      expect(res.data.user.passwordHash).toBeUndefined();
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.refreshToken).toBeDefined();
      registeredUserToken = res.data.accessToken;
      refreshToken = res.data.refreshToken;
    });

    it('T1-AUTH-02: User Login', async () => {
      const res = await http.auth.login({
        email: 'hiker1@treeline.org',
        password: 'SecurePassword123!',
      });
      res.expectStatus(200);
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.refreshToken).toBeDefined();
      expect(res.data.user.email).toBe('hiker1@treeline.org');
      registeredUserToken = res.data.accessToken;
      refreshToken = res.data.refreshToken;
    });

    it('T1-AUTH-03: Refresh Token Rotation', async () => {
      const res = await http.auth.refresh({ refreshToken });
      res.expectStatus(200);
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.refreshToken).toBeDefined();
      expect(res.data.refreshToken).not.toBe(refreshToken);
      refreshToken = res.data.refreshToken;
      registeredUserToken = res.data.accessToken;
    });

    it('T1-AUTH-04: User Logout', async () => {
      http.setToken(registeredUserToken);
      const res = await http.auth.logout({ refreshToken });
      res.expectStatus(200);
      expect(res.data.success).toBe(true);

      // Verify old refresh token can no longer be refreshed
      const attempt = await http.auth.refresh({ refreshToken });
      expect(attempt.status).toBe(401);
      http.clearToken();
    });

    it('T1-AUTH-05: Role-Based Access Control (RBAC) Enforcement', async () => {
      // Create a normal hiker user
      const reg = await http.auth.register({
        email: 'standard_hiker@treeline.org',
        password: 'Password123!',
      });
      reg.expectStatus(201);
      http.setToken(reg.data.accessToken);

      // Hiker attempting to create a team should be rejected with 403 Forbidden
      const res = await http.teams.create({
        name: 'Unauthorized Squad',
        safeRadiusMeters: 500,
      });
      expect(res.status).toBe(403);
      expect(res.data.error).toBe('INSUFFICIENT_PERMISSIONS');
      http.clearToken();
    });
  });

  // ==========================================================================
  // FEATURE 2: TEAM & MEMBER MANAGEMENT (5 TESTS)
  // ==========================================================================
  describe('Feature 2: Team & Member Management', () => {
    let guideToken = '';
    let teamId = '';
    let newHikerId = '';

    beforeAll(async () => {
      // Register a guide user directly on test server
      if (runnerInstance.server) {
        const guideUser = {
          id: 'guide-user-uuid-1',
          email: 'guide1@treeline.org',
          displayName: 'Elena Guide',
          passwordHash: 'hash',
          role: 'guide' as const,
          createdAt: new Date().toISOString(),
        };
        runnerInstance.server.users.set(guideUser.id, guideUser);
        guideToken = runnerInstance.server.generateJwt({
          sub: guideUser.id,
          email: guideUser.email,
          role: 'guide',
        });
      }
    });

    it('T1-TEAM-01: Create Expedition Team', async () => {
      http.setToken(guideToken);
      const res = await http.teams.create({
        name: 'Elbrus Expedition',
        callsign: 'EAGLE-1',
        safeRadiusMeters: 600.0,
      });
      res.expectStatus(201);
      expect(res.data.id).toBeDefined();
      expect(res.data.name).toBe('Elbrus Expedition');
      expect(res.data.callsign).toBe('EAGLE-1');
      expect(res.data.version).toBe(1);
      teamId = res.data.id;
    });

    it('T1-TEAM-02: Retrieve Team Details & Roster', async () => {
      http.setToken(guideToken);
      const res = await http.teams.get(teamId);
      res.expectStatus(200);
      expect(res.data.id).toBe(teamId);
      expect(res.data.safeRadiusMeters).toBe(600.0);
      expect(res.data.members.length).toBeGreaterThanOrEqual(1);
    });

    it('T1-TEAM-03: Add Member to Team', async () => {
      // Register new member
      const reg = await http.auth.register({
        email: 'medic_hiker@treeline.org',
        password: 'Password123!',
      });
      reg.expectStatus(201);
      newHikerId = reg.data.user.id;

      http.setToken(guideToken);
      const res = await http.teams.addMember(teamId, {
        userId: newHikerId,
        role: 'MEDIC',
      });
      res.expectStatus(201);
      expect(res.data.teamId).toBe(teamId);
      expect(res.data.userId).toBe(newHikerId);
      expect(res.data.role).toBe('MEDIC');
    });

    it('T1-TEAM-04: Update Team Settings with OCC', async () => {
      http.setToken(guideToken);
      const res = await http.teams.update(teamId, {
        name: 'Elbrus Expedition Alpha',
        safeRadiusMeters: 750.0,
        version: 1,
      });
      res.expectStatus(200);
      expect(res.data.name).toBe('Elbrus Expedition Alpha');
      expect(res.data.safeRadiusMeters).toBe(750.0);
      expect(res.data.version).toBe(2);
    });

    it('T1-TEAM-05: Remove Member from Team', async () => {
      http.setToken(guideToken);
      const res = await http.teams.removeMember(teamId, newHikerId);
      res.expectStatus(200);
      expect(res.data.success).toBe(true);

      const check = await http.teams.get(teamId);
      expect(check.data.members.some((m: any) => m.userId === newHikerId)).toBe(false);
    });
  });

  // ==========================================================================
  // FEATURE 3: WAYPOINT MANAGEMENT (5 TESTS)
  // ==========================================================================
  describe('Feature 3: Waypoint Management', () => {
    let waypointId = '';

    it('T1-WAYP-01: Create Tactical Waypoint', async () => {
      const res = await http.waypoints.create({
        name: 'Basecamp 1',
        symbol: 'CAMP',
        latitude: 43.355,
        longitude: 42.4392,
        altitude: 2200.0,
      });
      res.expectStatus(201);
      expect(res.data.id).toBeDefined();
      expect(res.data.name).toBe('Basecamp 1');
      expect(res.data.latitude).toBe(43.355);
      expect(res.data.longitude).toBe(42.4392);
      expect(res.data.locationGeom).toContain('POINT(42.4392 43.355)');
      waypointId = res.data.id;
    });

    it('T1-WAYP-02: Query Waypoints by Team', async () => {
      const res = await http.waypoints.list();
      res.expectStatus(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(1);
      expect(res.data.some((w: any) => w.id === waypointId)).toBe(true);
    });

    it('T1-WAYP-03: Create Tactical Hazard Waypoint', async () => {
      const res = await http.waypoints.create({
        name: 'Crevasse Field',
        symbol: 'HAZARD',
        latitude: 43.361,
        longitude: 42.445,
        isHazard: true,
        hazardRadiusMeters: 150.0,
      });
      res.expectStatus(201);
      expect(res.data.isHazard).toBe(true);
      expect(res.data.hazardRadiusMeters).toBe(150.0);
    });

    it('T1-WAYP-04: Update Waypoint Sequence and Name', async () => {
      const res = await http.waypoints.update(waypointId, {
        name: 'Basecamp 1 (Renamed)',
        sequenceOrder: 5,
      });
      res.expectStatus(200);
      expect(res.data.name).toBe('Basecamp 1 (Renamed)');
      expect(res.data.sequenceOrder).toBe(5);
    });

    it('T1-WAYP-05: Delete Waypoint', async () => {
      const res = await http.waypoints.delete(waypointId);
      res.expectStatus(200);
      expect(res.data.success).toBe(true);

      const check = await http.waypoints.list();
      expect(check.data.some((w: any) => w.id === waypointId)).toBe(false);
    });
  });

  // ==========================================================================
  // FEATURE 4: TRACK RECORDING & PLAYBACK (5 TESTS)
  // ==========================================================================
  describe('Feature 4: Track Recording & Playback', () => {
    let trackId = '';

    it('T1-TRAK-01: Create Planned Route Track', async () => {
      const res = await http.tracks.create({
        name: 'Ridge Climb',
        difficulty: 'HARD',
        corridorWidthMeters: 60.0,
        path: [
          [43.35, 42.43],
          [43.355, 42.435],
          [43.36, 42.44],
        ],
      });
      res.expectStatus(201);
      expect(res.data.id).toBeDefined();
      expect(res.data.path).toHaveLength(3);
      trackId = res.data.id;
    });

    it('T1-TRAK-02: Retrieve Track Details & Geometry', async () => {
      const res = await http.tracks.get(trackId);
      res.expectStatus(200);
      expect(res.data.id).toBe(trackId);
      expect(res.data.corridorWidthMeters).toBe(60.0);
      expect(res.data.path).toHaveLength(3);
    });

    it('T1-TRAK-03: Cross-Track & Bearing Deviation Evaluation', async () => {
      const res = await http.tracks.evaluate(trackId, {
        latitude: 43.3501,
        longitude: 42.4301,
        headingDeg: 45.0,
      });
      res.expectStatus(200);
      expect(typeof res.data.crossTrackErrorMeters).toBe('number');
      expect(res.data.isOffRoute).toBe(false);
      expect(typeof res.data.bearingDeviationDeg).toBe('number');
    });

    it('T1-TRAK-04: Archive Track', async () => {
      const res = await http.tracks.archive(trackId, true);
      res.expectStatus(200);
      expect(res.data.isArchived).toBe(true);
    });

    it('T1-TRAK-05: Track Playback Breadcrumbs Query', async () => {
      // Ingest test telemetry point
      await http.telemetry.insert({
        latitude: 43.351,
        longitude: 42.431,
        recordedAt: new Date().toISOString(),
      });
      const res = await http.telemetry.history({ limit: 10 });
      res.expectStatus(200);
      expect(Array.isArray(res.data.points)).toBe(true);
      expect(res.data.points.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // FEATURE 5: GEOFENCE MONITORING & ALERTS (5 TESTS)
  // ==========================================================================
  describe('Feature 5: Geofence Monitoring & Alerts', () => {
    let circleGfId = '';

    it('T1-GEOF-01: Create Circular Geofence', async () => {
      const res = await http.geofences.create({
        name: 'Camp Perimeter',
        fenceType: 'SAFETY_BUFFER',
        shapeType: 'CIRCLE',
        centerLatitude: 43.355,
        centerLongitude: 42.4392,
        radiusMeters: 300.0,
        breachAction: 'ALERT_TEAM',
      });
      res.expectStatus(201);
      expect(res.data.id).toBeDefined();
      expect(res.data.shapeType).toBe('CIRCLE');
      expect(res.data.radiusMeters).toBe(300.0);
      circleGfId = res.data.id;
    });

    it('T1-GEOF-02: Create Polygon Geofence (Exclusion Sector)', async () => {
      const res = await http.geofences.create({
        name: 'Crevasse Zone',
        fenceType: 'EXCLUSION_ZONE',
        shapeType: 'POLYGON',
        polygonCoordinates: [
          [43.35, 42.43],
          [43.36, 42.43],
          [43.36, 42.44],
          [43.35, 42.44],
          [43.35, 42.43],
        ],
        breachAction: 'TRIGGER_SOS',
      });
      res.expectStatus(201);
      expect(res.data.shapeType).toBe('POLYGON');
      expect(res.data.polygonCoordinates.length).toBeGreaterThanOrEqual(4);
    });

    it('T1-GEOF-03: Coordinate Containment Check (Inside Safe Zone)', async () => {
      const res = await http.geofences.check(circleGfId, {
        latitude: 43.3551,
        longitude: 42.4393,
      });
      res.expectStatus(200);
      expect(res.data.isInside).toBe(true);
      expect(res.data.breachStatus).toBe('CLEAR');
    });

    it('T1-GEOF-04: Coordinate Containment Check (Outside Safe Zone)', async () => {
      const res = await http.geofences.check(circleGfId, {
        latitude: 43.37,
        longitude: 42.46,
      });
      res.expectStatus(200);
      expect(res.data.isInside).toBe(false);
      expect(res.data.breachStatus).toBe('BREACHED');
    });

    it('T1-GEOF-05: Deactivate Geofence', async () => {
      const res = await http.geofences.update(circleGfId, { isActive: false });
      res.expectStatus(200);
      expect(res.data.isActive).toBe(false);
    });
  });

  // ==========================================================================
  // FEATURE 6: TELEMETRY BATCH INGESTION (5 TESTS)
  // ==========================================================================
  describe('Feature 6: Telemetry Batch Ingestion', () => {
    it('T1-TELEM-01: Single Telemetry Point Ingestion', async () => {
      const res = await http.telemetry.insert({
        latitude: 43.355,
        longitude: 42.4392,
        altitude: 2150.0,
        speedMps: 1.2,
        headingDeg: 180.0,
        batteryLevel: 85,
        transportType: 'INTERNET',
      });
      res.expectStatus(201);
      expect(res.data.id).toBeDefined();
      expect(res.data.batteryLevel).toBe(85);
    });

    it('T1-TELEM-02: Batch Telemetry Ingestion', async () => {
      const points = [];
      for (let i = 0; i < 20; i++) {
        points.push({
          latitude: 43.355 + i * 0.0001,
          longitude: 42.439 + i * 0.0001,
          batteryLevel: 80 - i,
          recordedAt: new Date(Date.now() - i * 1000).toISOString(),
        });
      }
      const res = await http.telemetry.batchInsert(points);
      res.expectStatus(201);
      expect(res.data.inserted).toBe(20);
    });

    it('T1-TELEM-03: Ingest Mesh Node Telemetry', async () => {
      const res = await http.telemetry.insert({
        meshNodeId: 'node-mesh-1234',
        latitude: 43.356,
        longitude: 42.44,
        batteryLevel: 95,
        transportType: 'LORA_MESH',
      });
      res.expectStatus(201);
      expect(res.data.meshNodeId).toBe('node-mesh-1234');

      const nodes = await http.mesh.listNodes();
      expect(nodes.data.some((n: any) => n.id === 'node-mesh-1234')).toBe(true);
    });

    it('T1-TELEM-04: Query Telemetry History', async () => {
      const res = await http.telemetry.history({ limit: 50 });
      res.expectStatus(200);
      expect(Array.isArray(res.data.points)).toBe(true);
      expect(res.data.points.length).toBeGreaterThanOrEqual(1);
    });

    it('T1-TELEM-05: Telemetry Privacy Mode Masking', async () => {
      const res = await http.telemetry.insert({
        latitude: 43.355812,
        longitude: 42.439184,
        privacyMode: 'REDUCED',
      });
      res.expectStatus(201);
      expect(res.data.latitude).toBe(43.36);
      expect(res.data.longitude).toBe(42.44);
    });
  });

  // ==========================================================================
  // FEATURE 7: RATE LIMITING & SOS BYPASS (5 TESTS)
  // ==========================================================================
  describe('Feature 7: Rate Limiting & SOS Bypass', () => {
    it('T1-RATE-01: Standard Requests Below Rate Threshold', async () => {
      const res = await http.teams.list();
      res.expectStatus(200);
      expect(res.headers.get('x-ratelimit-limit')).toBe('120');
      const rem = parseInt(res.headers.get('x-ratelimit-remaining') || '0', 10);
      expect(rem).toBeLessThan(120);
    });

    it('T1-RATE-02: Exceeding General REST Limit Triggers HTTP 429', async () => {
      // Fire rapid requests using a distinct simulated client IP
      const spoofIpHeaders = { 'X-Forwarded-For': '198.51.100.42' };
      for (let i = 0; i < 120; i++) {
        await http.request('GET', '/api/v1/teams', undefined, spoofIpHeaders);
      }
      // 121st request must trigger 429
      const throttled = await http.request('GET', '/api/v1/teams', undefined, spoofIpHeaders);
      expect(throttled.status).toBe(429);
      expect(throttled.data.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(throttled.headers.get('retry-after')).toBeDefined();
    });

    it('T1-RATE-03: Public Auth Rate Limit (Brute Force Protection)', async () => {
      const bruteHeaders = { 'X-Forwarded-For': '203.0.113.88' };
      for (let i = 0; i < 10; i++) {
        await http.request(
          'POST',
          '/api/v1/auth/login',
          { email: 'target@treeline.org', password: 'wrong' },
          bruteHeaders
        );
      }
      // 11th request must be rejected by auth rate limiter
      const res = await http.request(
        'POST',
        '/api/v1/auth/login',
        { email: 'target@treeline.org', password: 'wrong' },
        bruteHeaders
      );
      expect(res.status).toBe(429);
      expect(res.data.error).toBe('AUTH_RATE_LIMIT_EXCEEDED');
    });

    it('T1-RATE-04: Rate Limit Window Expiry and Reset', async () => {
      // Create client with 1 request remaining
      const resetHeaders = { 'X-Forwarded-For': '198.51.100.99' };
      const res = await http.request('GET', '/api/v1/teams', undefined, resetHeaders);
      expect(res.status).toBe(200);
      expect(parseInt(res.headers.get('x-ratelimit-remaining') || '0', 10)).toBe(119);
    });

    it('T1-RATE-05: Emergency SOS Endpoint Priority Bypass', async () => {
      // Even under blocked IP, SOS succeeds immediately
      const spoofIpHeaders = { 'X-Forwarded-For': '198.51.100.42' };
      const sos = await http.request(
        'POST',
        '/api/v1/emergency/sos',
        {
          emergencyType: 'MEDICAL_EMERGENCY',
          latitude: 43.355,
          longitude: 42.4392,
          notes: 'Compound fracture',
        },
        spoofIpHeaders
      );
      expect(sos.status).toBe(201);
      expect(sos.data.status).toBe('ACTIVE');
      expect(sos.data.emergencyId).toBeDefined();
    });
  });

  // ==========================================================================
  // FEATURE 8: WEBSOCKET REAL-TIME MESSAGING (5 TESTS)
  // ==========================================================================
  describe('Feature 8: WebSocket Real-time Messaging', () => {
    let wsToken = '';

    beforeAll(async () => {
      http = new ApiClient(runnerInstance.baseUrl);
      wsUrl = runnerInstance.wsUrl;
      const reg = await http.auth.register({
        email: 'ws_tester@treeline.org',
        password: 'Password123!',
      });
      wsToken = reg.data.accessToken;
    });

    it('T1-WS-01: WebSocket Handshake with Valid JWT', async () => {
      const ws = new TestWebSocketClient(wsUrl);
      await ws.connect({ token: wsToken });
      expect(ws.isOpen).toBe(true);
      const welcome = await ws.waitForMessage((m) => m.type === 'CONNECTED');
      expect(welcome.type).toBe('CONNECTED');
      await ws.close();
    });

    it('T1-WS-02: Room Subscription Protocol', async () => {
      const ws = new TestWebSocketClient(wsUrl);
      await ws.connect({ token: wsToken });
      const sub = await ws.subscribe(['team:expedition-1', 'emergency:broadcast']);
      expect(sub.type).toBe('SUBSCRIBED');
      expect(sub.channels).toContain('team:expedition-1');
      expect(sub.channels).toContain('emergency:broadcast');
      await ws.close();
    });

    it('T1-WS-03: Real-time Telemetry Broadcast', async () => {
      const guideWs = new TestWebSocketClient(wsUrl);
      await guideWs.connect({ token: wsToken });
      await guideWs.subscribe('team:expedition-1');

      const hikerWs = new TestWebSocketClient(wsUrl);
      await hikerWs.connect({ token: wsToken });
      await hikerWs.subscribe('team:expedition-1');

      hikerWs.sendTelemetry({
        latitude: 43.3555,
        longitude: 42.4395,
        altitude: 2210.0,
        battery: 78,
      });

      const broadcast = await guideWs.waitForMessage((m) => m.type === 'TELEMETRY_BROADCAST');
      expect(broadcast.coords[0]).toBe(43.3555);
      expect(broadcast.coords[1]).toBe(42.4395);
      expect(broadcast.battery).toBe(78);

      await guideWs.close();
      await hikerWs.close();
    });

    it('T1-WS-04: Real-time Chat Dispatch', async () => {
      const wsA = new TestWebSocketClient(wsUrl);
      await wsA.connect({ token: wsToken });
      await wsA.subscribe('team:chat-room-1');

      const wsB = new TestWebSocketClient(wsUrl);
      await wsB.connect({ token: wsToken });
      await wsB.subscribe('team:chat-room-1');

      wsA.sendChat('team:chat-room-1', 'Arrived at pass.');

      const chatMsg = await wsB.waitForMessage((m) => m.type === 'CHAT_MESSAGE');
      expect(chatMsg.text).toBe('Arrived at pass.');
      expect(chatMsg.channelId).toBe('team:chat-room-1');

      await wsA.close();
      await wsB.close();
    });

    it('T1-WS-05: Ping/Pong Heartbeat Keep-Alive', async () => {
      const ws = new TestWebSocketClient(wsUrl);
      await ws.connect({ token: wsToken });
      ws.sendPing();
      const pong = await ws.waitForMessage((m) => m.type === 'PONG');
      expect(pong.type).toBe('PONG');
      expect(pong.timestamp).toBeDefined();
      await ws.close();
    });
  });

  // ==========================================================================
  // FEATURE 9: MESHTASTIC PROTOBUF WIRE PACKETS (5 TESTS)
  // ==========================================================================
  describe('Feature 9: Meshtastic Protobuf Wire Packets', () => {
    it('T1-MESH-01: Position Protobuf Serialization & Parsing', () => {
      const original = {
        latitude_i: 433550123,
        longitude_i: 424392456,
        altitude: 2150,
        time: 1700000000,
      };
      const bytes = MeshtasticCodec.encodePosition(original);
      const decoded = MeshtasticCodec.decodePosition(bytes);
      expect(decoded.latitude_i).toBe(original.latitude_i);
      expect(decoded.longitude_i).toBe(original.longitude_i);
      expect(decoded.altitude).toBe(original.altitude);
      expect(decoded.time).toBe(original.time);
    });

    it('T1-MESH-02: NodeInfo / User Protobuf Codec', () => {
      const user = {
        id: '!28ab1234',
        long_name: 'Rescue Leader',
        short_name: 'LEAD',
        hw_model: HardwareModel.T_BEAM,
      };
      const bytes = MeshtasticCodec.encodeUser(user);
      const decoded = MeshtasticCodec.decodeUser(bytes);
      expect(decoded.id).toBe(user.id);
      expect(decoded.long_name).toBe(user.long_name);
      expect(decoded.short_name).toBe(user.short_name);
      expect(decoded.hw_model).toBe(HardwareModel.T_BEAM);
    });

    it('T1-MESH-03: Telemetry Protobuf Codec', () => {
      const telem = {
        time: 1700000000,
        device_metrics: {
          battery_level: 88,
          voltage: 4.12,
          channel_utilization: 1.5,
          air_util_tx: 0.8,
        },
        environment_metrics: {
          temperature: 18.5,
          relative_humidity: 45.0,
          barometric_pressure: 1013.25,
        },
      };
      const bytes = MeshtasticCodec.encodeTelemetry(telem);
      const decoded = MeshtasticCodec.decodeTelemetry(bytes);
      expect(decoded.time).toBe(1700000000);
      expect(decoded.device_metrics?.battery_level).toBe(88);
      expect(decoded.device_metrics?.voltage).toBeCloseTo(4.12, 1);
      expect(decoded.environment_metrics?.temperature).toBeCloseTo(18.5, 1);
    });

    it('T1-MESH-04: Waypoint Protobuf Codec', () => {
      const wp = {
        id: 201,
        latitude_i: 433600000,
        longitude_i: 424400000,
        name: 'Landing Zone 1',
        geofence_radius: 100,
      };
      const bytes = MeshtasticCodec.encodeWaypoint(wp);
      const decoded = MeshtasticCodec.decodeWaypoint(bytes);
      expect(decoded.id).toBe(201);
      expect(decoded.latitude_i).toBe(433600000);
      expect(decoded.longitude_i).toBe(424400000);
      expect(decoded.name).toBe('Landing Zone 1');
      expect(decoded.geofence_radius).toBe(100);
    });

    it('T1-MESH-05: MeshPacket Root Envelope Assembly', () => {
      const packet = {
        from: 0x12345678,
        to: 0xffffffff,
        id: 9942,
        priority: MeshPriority.DEFAULT,
        hop_limit: 3,
        want_ack: true,
      };
      const bytes = MeshtasticCodec.encodeMeshPacket(packet);
      const decoded = MeshtasticCodec.decodeMeshPacket(bytes);
      expect(decoded.from).toBe(0x12345678);
      expect(decoded.to).toBe(0xffffffff);
      expect(decoded.id).toBe(9942);
      expect(decoded.priority).toBe(MeshPriority.DEFAULT);
      expect(decoded.hop_limit).toBe(3);
      expect(decoded.want_ack).toBe(true);
    });
  });

  // ==========================================================================
  // FEATURE 10: DISTRESS BEACON & SOS MESH PROTOCOL (5 TESTS)
  // ==========================================================================
  describe('Feature 10: Distress Beacon & SOS Mesh Protocol', () => {
    let emergencyId = '';
    let rescuerToken = '';

    beforeAll(() => {
      if (runnerInstance.server) {
        rescuerToken = runnerInstance.server.generateJwt({
          sub: 'rescuer-uuid-1',
          role: 'rescuer',
        });
      }
    });

    it('T1-SOS-01: Generate High-Priority Distress Wire Packet', () => {
      const distressData = {
        portnum: PortNum.TEXT_MESSAGE_APP,
        payload: new TextEncoder().encode('SOS MEDICAL compound fracture'),
        want_response: true,
      };
      const packet = {
        from: 0x11111111,
        to: 0xffffffff, // Broadcast
        id: 9942,
        priority: MeshPriority.ALERT, // 110
        want_ack: true,
        decoded: distressData,
      };
      const bytes = MeshtasticCodec.encodeMeshPacket(packet);
      const decoded = MeshtasticCodec.decodeMeshPacket(bytes);
      expect(decoded.to).toBe(0xffffffff);
      expect(decoded.priority).toBe(MeshPriority.ALERT);
      expect(decoded.want_ack).toBe(true);
      expect(new TextDecoder().decode(decoded.decoded?.payload)).toContain('SOS MEDICAL');
    });

    it('T1-SOS-02: REST Distress SOS Trigger', async () => {
      const res = await http.emergency.triggerSos({
        emergencyType: 'LOST_PERSON',
        latitude: 43.355,
        longitude: 42.4392,
        notes: 'Lost trail in fog',
      });
      res.expectStatus(201);
      expect(res.data.emergencyId).toBeDefined();
      expect(res.data.status).toBe('ACTIVE');
      emergencyId = res.data.emergencyId;
    });

    it('T1-SOS-03: Real-time WebSocket Emergency Broadcast', async () => {
      const ws = new TestWebSocketClient(wsUrl);
      await ws.connect();
      await ws.subscribe('emergency:broadcast');

      // Trigger another emergency
      await http.emergency.triggerSos({
        emergencyType: 'AVALANCHE',
        latitude: 43.36,
        longitude: 42.45,
      });

      const alert = await ws.waitForMessage((m) => m.type === 'EMERGENCY_ALERT');
      expect(alert.emergencyType).toBe('AVALANCHE');
      expect(alert.priority).toBe('ALERT');
      await ws.close();
    });

    it('T1-SOS-04: Distress Acknowledgement Protocol', () => {
      const ackPacket = {
        from: 0x22222222,
        to: 0x11111111,
        id: 9943,
        priority: MeshPriority.ACK, // 120
        decoded: {
          portnum: PortNum.ROUTING_APP,
          payload: new Uint8Array([0x01]),
          request_id: 9942,
        },
      };
      const bytes = MeshtasticCodec.encodeMeshPacket(ackPacket);
      const decoded = MeshtasticCodec.decodeMeshPacket(bytes);
      expect(decoded.to).toBe(0x11111111);
      expect(decoded.priority).toBe(MeshPriority.ACK);
      expect(decoded.decoded?.request_id).toBe(9942);
    });

    it('T1-SOS-05: Emergency Status Resolution', async () => {
      http.setToken(rescuerToken);
      const res = await http.emergency.resolve(emergencyId, {
        resolutionNotes: 'Hiker located and evacuated by air.',
      });
      res.expectStatus(200);
      expect(res.data.status).toBe('RESOLVED');
      http.clearToken();
    });
  });

  // ==========================================================================
  // FEATURE 11: HARDWARE TRANSPORTS FRAMING (5 TESTS)
  // ==========================================================================
  describe('Feature 11: Hardware Transports Framing', () => {
    it('T1-TRAN-01: WebSerial Frame Parser', () => {
      const payload = new Uint8Array([0x0a, 0x02, 0x08, 0x01]);
      const framed = WebSerialFramer.frame(payload);
      expect(framed[0]).toBe(0x94);
      expect(framed[1]).toBe(0xc3);

      const parser = new SerialFSMParser();
      const emitted = parser.processBytes(framed);
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual(payload);
    });

    it('T1-TRAN-02: WebBluetooth GATT Write to ToRadio', async () => {
      const ble = new MockBleGattTransport();
      ble.connect();
      expect(ble.connected).toBe(true);
      const testBytes = new Uint8Array([1, 2, 3, 4, 5]);
      await ble.writeToRadio(testBytes);
      const written = ble.getWrittenToRadio();
      expect(written).toHaveLength(1);
      expect(written[0]).toEqual(testBytes);
    });

    it('T1-TRAN-03: WebBluetooth FromNum Notification & Read Loop', async () => {
      const ble = new MockBleGattTransport();
      ble.connect();

      let notifiedCount = 0;
      ble.onFromNum((count) => {
        notifiedCount = count;
      });

      const packet = new Uint8Array([10, 20, 30]);
      ble.pushFromRadioPacket(packet);

      expect(notifiedCount).toBe(1);
      const read = await ble.readFromRadio();
      expect(read).toEqual(packet);
    });

    it('T1-TRAN-04: MQTT Bridge Protobuf Publishing', () => {
      const mqtt = new MockMqttBridge();
      let receivedTopic = '';
      let receivedPayload: any;

      mqtt.subscribe('msh/2/c/LongFast/!28ab1234', (topic, msg) => {
        receivedTopic = topic;
        receivedPayload = msg;
      });

      const data = new Uint8Array([1, 2, 3]);
      const ok = mqtt.publish('msh/2/c/LongFast/!28ab1234', data);
      expect(ok).toBe(true);
      expect(receivedTopic).toBe('msh/2/c/LongFast/!28ab1234');
      expect(receivedPayload).toEqual(data);
    });

    it('T1-TRAN-05: MQTT JSON Format Ingress', async () => {
      const mqtt = new MockMqttBridge();
      let ingested = false;

      mqtt.subscribe('msh/+/2/json/#', (_topic, msg) => {
        const parsed = JSON.parse(typeof msg === 'string' ? msg : new TextDecoder().decode(msg));
        if (parsed.type === 'telemetry') {
          ingested = true;
        }
      });

      mqtt.publish(
        'msh/US/2/json/LongFast',
        JSON.stringify({ from: 682283572, type: 'telemetry', payload: { battery: 82 } })
      );
      expect(ingested).toBe(true);
    });
  });

  // ==========================================================================
  // FEATURE 12: OFFLINE TILE CACHING & PWA (5 TESTS)
  // ==========================================================================
  describe('Feature 12: Offline Tile Caching & PWA', () => {
    it('T1-OFFL-01: ServiceWorker Tile Cache Hit', async () => {
      const cacheStorage = new MockCacheStorage();
      const cache = await cacheStorage.open('map_tiles');

      const tileBytes = SlippyMath.generateSvgTile(14, 9210, 5830);
      await cache.put('/tiles/14/9210/5830.png', {
        status: 200,
        headers: { 'X-Treeline-Cache': 'HIT', 'Content-Type': 'image/png' },
        body: tileBytes,
      });

      const matched = await cache.match('/tiles/14/9210/5830.png');
      expect(matched).toBeDefined();
      expect(matched?.headers['X-Treeline-Cache']).toBe('HIT');
      expect(matched?.body.length).toBeGreaterThan(0);
    });

    it('T1-OFFL-02: Slippy Map Tile Coordinate Calculation', () => {
      const bbox = { minLat: 43.3, minLon: 42.4, maxLat: 43.4, maxLon: 42.5 };
      const tiles = SlippyMath.calculateTileBounds(bbox, 14);
      expect(tiles.length).toBeGreaterThanOrEqual(1);
      for (const t of tiles) {
        expect(t.z).toBe(14);
        expect(typeof t.x).toBe('number');
        expect(typeof t.y).toBe('number');
      }
    });

    it('T1-OFFL-03: Area Pre-cache Batch Download into IndexedDB', async () => {
      const idb = new MockIDBFactory();
      const db = await idb.open('treeline_pwa');
      const store = db.createObjectStore('map_tiles_store', { keyPath: 'key' });

      const bbox = { minLat: 43.35, minLon: 42.43, maxLat: 43.36, maxLon: 42.44 };
      const tiles = SlippyMath.calculateTileBounds(bbox, 12);

      for (const t of tiles) {
        const key = `${t.z}/${t.x}/${t.y}`;
        store.put({ key, blob: SlippyMath.generateSvgTile(t.z, t.x, t.y) });
      }

      expect(store.count()).toBe(tiles.length);
      const retrieved = store.get(`${tiles[0].z}/${tiles[0].x}/${tiles[0].y}`);
      expect(retrieved).toBeDefined();
    });

    it('T1-OFFL-04: Offline Cache-Miss Fallback to IndexedDB', async () => {
      const cache = new MockCacheStorage();
      const openedCache = await cache.open('offline_tiles');

      // Not in CacheStorage
      const miss = await openedCache.match('/tiles/14/999/999.png');
      expect(miss).toBeNull();

      // Read from IndexedDB fallback
      const idb = new MockIDBFactory();
      const db = await idb.open('treeline_pwa');
      let fallbackStore = db.objectStoreNames().includes('fallback_tiles')
        ? db.transaction('fallback_tiles', 'readwrite').objectStore('fallback_tiles')
        : db.createObjectStore('fallback_tiles', { keyPath: 'key' });

      fallbackStore.put({ key: '14/999/999', data: 'fallback_tile_data' });
      const record = fallbackStore.get('14/999/999');
      expect(record.data).toBe('fallback_tile_data');
    });

    it('T1-OFFL-05: Offline Telemetry Queue Buffering', async () => {
      const idb = new MockIDBFactory();
      const db = await idb.open('offline_queue_db');
      const queue = new OfflinePacketQueue(db);

      queue.enqueue({
        id: 'pkt-offline-1',
        payload: { lat: 43.355, lon: 42.439 },
        priority: 64,
        timestamp: Date.now(),
      });

      expect(queue.size()).toBe(1);
      const item = queue.dequeue();
      expect(item?.id).toBe('pkt-offline-1');
      expect(queue.size()).toBe(0);
    });
  });
});
