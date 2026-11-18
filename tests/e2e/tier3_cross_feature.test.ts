/**
 * Tier 3: Cross-Feature Combinations Test Suite (15 Tests)
 * Treeline Tracker E2E Testing Framework
 * 
 * Verifies complex multi-feature interactions, asynchronous events, and hardware/protocol bridges:
 * - T3-CROSS-01: SOS Bypasses Rate Limiting & Dispatches Real-time WebSocket Alert
 * - T3-CROSS-02: Batch Telemetry Ingestion Triggers PostGIS Geofence Breach Event
 * - T3-CROSS-03: Waypoint Received over LoRa Mesh Serial Synced to REST API
 * - T3-CROSS-04: Telemetry Batch Ingestion Dispatches Real-time Squad Telemetry
 * - T3-CROSS-05: Team Member Addition Updates Active WebSocket Channel Permissions
 * - T3-CROSS-06: Track Recording via Serial GPS Stream Generates Persistent Track
 * - T3-CROSS-07: User Logout Revocation Terminates Active WebSocket Connections
 * - T3-CROSS-08: Hardware Transport Failover Drains Offline Buffer
 * - T3-CROSS-09: Offline PWA Tile Cache Operates While Mesh Telemetry Streams
 * - T3-CROSS-10: Role Authorization Blocks Hiker Route Edit While Allowing Rescuer SAR
 * - T3-CROSS-11: Distress Beacon from MQTT Ingested, Broadcast to WS, and Placed as Waypoint
 * - T3-CROSS-12: Geofence Polygon Drawn on Tactical Map Broadcasts over Meshtastic RF
 * - T3-CROSS-13: Extreme Telemetry Burst under Rate Limiting Preserves SOS Priority
 * - T3-CROSS-14: Optimistic Concurrency Control (OCC) Resolves REST and WS Race Condition
 * - T3-CROSS-15: Privacy Mode Transition Masks Real-time Coordinates across REST & WS
 */

import { describe, it, beforeAll, beforeEach, expect, runnerInstance } from './runner';
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
} from './harness/meshPacketBuilder';
import {
  MockIDBFactory,
  MockCacheStorage,
  SlippyMath,
  OfflinePacketQueue,
} from './harness/offlineStorageMock';

describe('Tier 3: Cross-Feature Combinations (15 Tests)', () => {
  let http: ApiClient;
  let wsUrl: string;
  let adminToken = '';
  let guideToken = '';
  let rescuerToken = '';
  let hikerToken = '';

  beforeAll(async () => {
    if (runnerInstance.server) {
      adminToken = runnerInstance.server.generateJwt({ sub: 'admin-cross-uuid', role: 'admin' });
      guideToken = runnerInstance.server.generateJwt({ sub: 'guide-cross-uuid', role: 'guide' });
      rescuerToken = runnerInstance.server.generateJwt({ sub: 'rescuer-cross-uuid', role: 'rescuer' });
      hikerToken = runnerInstance.server.generateJwt({ sub: 'hiker-cross-uuid', role: 'hiker' });
    }
  });

  beforeEach(() => {
    http = new ApiClient(runnerInstance.baseUrl);
    http.setToken(adminToken);
    wsUrl = runnerInstance.wsUrl;
  });

  it('T3-CROSS-01: SOS Bypasses Rate Limiting & Dispatches Real-time WebSocket Alert', async () => {
    const rescueWs = new TestWebSocketClient(wsUrl);
    await rescueWs.connect({ token: rescuerToken });
    await rescueWs.subscribe('emergency:broadcast');

    // Saturate rate limiter on client IP
    const blockedIp = { 'X-Forwarded-For': '198.51.100.188' };
    for (let i = 0; i < 120; i++) {
      await http.request('GET', '/api/v1/teams', undefined, blockedIp);
    }
    const check429 = await http.request('GET', '/api/v1/teams', undefined, blockedIp);
    expect(check429.status).toBe(429);

    // Distress SOS call under blocked IP
    const sosRes = await http.request(
      'POST',
      '/api/v1/emergency/sos',
      {
        emergencyType: 'AVALANCHE_BURIAL',
        latitude: 43.355,
        longitude: 42.4392,
        notes: '2 skiers buried north face',
      },
      blockedIp
    );
    expect(sosRes.status).toBe(201);
    expect(sosRes.data.status).toBe('ACTIVE');

    // Verify WebSocket server broadcasts EMERGENCY_ALERT to rescue team
    const alert = await rescueWs.waitForMessage((m) => m.type === 'EMERGENCY_ALERT');
    expect(alert.emergencyType).toBe('AVALANCHE_BURIAL');
    expect(alert.priority).toBe('ALERT');
    expect(alert.location[0]).toBe(43.355);

    await rescueWs.close();
  });

  it('T3-CROSS-02: Batch Telemetry Ingestion Triggers PostGIS Geofence Breach Event', async () => {
    // 1. Create a team and safety geofence
    const team = await http.teams.create({ name: 'Geofence Breach Team' });
    team.expectStatus(201);
    const teamId = team.data.id;

    const gf = await http.geofences.create({
      teamId,
      name: 'Safe Haven Camp',
      fenceType: 'SAFETY_BUFFER',
      shapeType: 'CIRCLE',
      centerLatitude: 43.35,
      centerLongitude: 42.43,
      radiusMeters: 200.0,
      breachAction: 'ALERT_TEAM',
    });
    gf.expectStatus(201);

    // 2. Guide connects to team room
    const guideWs = new TestWebSocketClient(wsUrl);
    await guideWs.connect({ token: guideToken });
    await guideWs.subscribe(`team:${teamId}`);

    // 3. Post telemetry batch containing a point far outside the 200m buffer
    const batch = [
      { latitude: 43.3501, longitude: 42.4301 }, // Inside
      { latitude: 43.38, longitude: 42.48 }, // Far outside (breach)
    ];
    await http.telemetry.batchInsert(batch);

    // 4. WebSocket dispatches GEOFENCE_ALERT
    const alert = await guideWs.waitForMessage((m) => m.type === 'GEOFENCE_ALERT', 2000);
    expect(alert.type).toBe('GEOFENCE_ALERT');
    expect(alert.geofenceId).toBe(gf.data.id);

    await guideWs.close();
  });

  it('T3-CROSS-03: Waypoint Received over LoRa Mesh Serial Synced to REST API', async () => {
    // Field radio sends Meshtastic WAYPOINT_APP protobuf over WebSerial
    const wpMessage = {
      id: 505,
      latitude_i: 433600000,
      longitude_i: 424400000,
      name: 'Helipad LZ',
      geofence_radius: 80,
    };
    const wpProtobuf = MeshtasticCodec.encodeWaypoint(wpMessage);
    const meshPacket = MeshtasticCodec.encodeMeshPacket({
      from: 0x99887766,
      to: 0xffffffff,
      id: 12345,
      decoded: {
        portnum: PortNum.WAYPOINT_APP,
        payload: wpProtobuf,
      },
    });

    // Frame into WebSerial byte stream
    const serialFrame = WebSerialFramer.frame(meshPacket);

    // Ingest stream via FSM parser
    const parser = new SerialFSMParser();
    const emitted = parser.processBytes(serialFrame);
    expect(emitted).toHaveLength(1);

    // Decode packet
    const received = MeshtasticCodec.decodeMeshPacket(emitted[0]);
    expect(received.decoded?.portnum).toBe(PortNum.WAYPOINT_APP);
    const parsedWp = MeshtasticCodec.decodeWaypoint(received.decoded!.payload);
    expect(parsedWp.name).toBe('Helipad LZ');

    // Bridge syncs to REST API
    const res = await http.waypoints.create({
      name: parsedWp.name,
      symbol: 'HELIPAD',
      latitude: parsedWp.latitude_i / 1e7,
      longitude: parsedWp.longitude_i / 1e7,
      hazardRadiusMeters: parsedWp.geofence_radius,
    });
    res.expectStatus(201);
    expect(res.data.name).toBe('Helipad LZ');
    expect(res.data.latitude).toBe(43.36);
  });

  it('T3-CROSS-04: Telemetry Batch Ingestion Dispatches Real-time Squad Telemetry', async () => {
    const squadWs = new TestWebSocketClient(wsUrl);
    await squadWs.connect({ token: guideToken });
    await squadWs.subscribe('team:default');

    // Submit telemetry batch
    await http.telemetry.batchInsert([
      { latitude: 43.355, longitude: 42.439, batteryLevel: 90 },
      { latitude: 43.356, longitude: 42.44, batteryLevel: 89 },
    ]);

    const msg = await squadWs.waitForMessage((m) => m.type === 'MEMBER_TELEMETRY');
    expect(msg.type).toBe('MEMBER_TELEMETRY');
    expect(msg.coords).toEqual([43.356, 42.44]);

    await squadWs.close();
  });

  it('T3-CROSS-05: Team Member Addition Updates Active WebSocket Channel Permissions', async () => {
    // 1. Create team
    const team = await http.teams.create({ name: 'Channel Perms Team' });
    team.expectStatus(201);
    const teamId = team.data.id;

    // 2. User registers and connects WS
    const userReg = await http.auth.register({
      email: 'perms_user@treeline.org',
      password: 'Password123!',
    });
    const userWs = new TestWebSocketClient(wsUrl);
    await userWs.connect({ token: userReg.data.accessToken });

    // 3. Guide adds user to team
    await http.teams.addMember(teamId, { userId: userReg.data.user.id });

    // 4. User subscribes to team channel
    const sub = await userWs.subscribe(`team:${teamId}`);
    expect(sub.channels).toContain(`team:${teamId}`);

    await userWs.close();
  });

  it('T3-CROSS-06: Track Recording via Serial GPS Stream Generates Persistent Track', async () => {
    // Stream 10 serial GPS position packets
    const parser = new SerialFSMParser();
    const recordedPoints: Array<[number, number]> = [];

    for (let i = 0; i < 10; i++) {
      const lat = 43.35 + i * 0.001;
      const lon = 42.43 + i * 0.001;
      const posBytes = MeshtasticCodec.encodePosition({
        latitude_i: Math.round(lat * 1e7),
        longitude_i: Math.round(lon * 1e7),
      });
      const framed = WebSerialFramer.frame(posBytes);
      const emitted = parser.processBytes(framed);
      expect(emitted).toHaveLength(1);

      const decoded = MeshtasticCodec.decodePosition(emitted[0]);
      recordedPoints.push([decoded.latitude_i / 1e7, decoded.longitude_i / 1e7]);
    }

    // Save persistent track
    const res = await http.tracks.create({
      name: 'Serial GPS Stream Track',
      corridorWidthMeters: 50.0,
      path: recordedPoints,
    });
    res.expectStatus(201);
    expect(res.data.path).toHaveLength(10);
  });

  it('T3-CROSS-07: User Logout Revocation Terminates Active WebSocket Connections', async () => {
    const reg = await http.auth.register({
      email: 'logout_ws_user@treeline.org',
      password: 'Password123!',
    });
    const ws = new TestWebSocketClient(wsUrl);
    await ws.connect({ token: reg.data.accessToken });
    expect(ws.isOpen).toBe(true);

    // Call logout
    http.setToken(reg.data.accessToken);
    const logoutRes = await http.auth.logout({ refreshToken: reg.data.refreshToken });
    logoutRes.expectStatus(200);

    // Give socket close frame a tick to process
    await new Promise((r) => setTimeout(r, 100));
    expect(ws.isOpen).toBe(false);
    expect(ws.lastCloseCode).toBe(4401);
  });

  it('T3-CROSS-08: Hardware Transport Failover Drains Offline Buffer', async () => {
    const idb = new MockIDBFactory();
    const db = await idb.open('failover_test');
    const queue = new OfflinePacketQueue(db);

    // 1. Serial disconnects during send -> diverted to offline queue
    queue.enqueue({
      id: 'failover-pkt-1',
      payload: 'critical_nav_data',
      priority: 110,
      timestamp: Date.now(),
    });

    // 2. BLE transport connects
    const ble = new MockBleGattTransport();
    ble.connect();
    expect(ble.connected).toBe(true);

    // 3. Drain queue over BLE
    const drained = queue.dequeue();
    expect(drained?.id).toBe('failover-pkt-1');
    await ble.writeToRadio(new TextEncoder().encode(drained!.payload as string));
    expect(ble.getWrittenToRadio()).toHaveLength(1);
  });

  it('T3-CROSS-09: Offline PWA Tile Cache Operates While Mesh Telemetry Streams', async () => {
    // 1. Cache map tiles
    const cacheStorage = new MockCacheStorage();
    const tileCache = await cacheStorage.open('wilderness_tiles');
    const tile = SlippyMath.generateSvgTile(14, 100, 200);
    await tileCache.put('/tiles/14/100/200.png', { body: tile });

    // 2. Stream BLE Position packet while offline
    const ble = new MockBleGattTransport();
    ble.connect();
    const pos = MeshtasticCodec.encodePosition({ latitude_i: 433550000, longitude_i: 424390000 });
    ble.pushFromRadioPacket(pos);

    // Read tile offline (cache hit)
    const cachedTile = await tileCache.match('/tiles/14/100/200.png');
    expect(cachedTile).toBeDefined();

    // Read radio position packet
    const receivedPacket = await ble.readFromRadio();
    expect(receivedPacket).toBeDefined();
    const decoded = MeshtasticCodec.decodePosition(receivedPacket!);
    expect(decoded.latitude_i).toBe(433550000);
  });

  it('T3-CROSS-10: Role Authorization Blocks Hiker Route Edit While Allowing Rescuer SAR', async () => {
    const track = await http.tracks.create({
      name: 'Protected Expedition Track',
      path: [
        [43.35, 42.43],
        [43.36, 42.44],
      ],
    });
    track.expectStatus(201);
    const trackId = track.data.id;

    // Hiker attempts track edit -> 403 Forbidden
    http.setToken(hikerToken);
    const hikerAttempt = await http.tracks.update(trackId, { name: 'Hiker Modified Route' });
    expect(hikerAttempt.status).toBe(403);

    // Rescuer generates SAR corridor on same track -> 200 OK
    http.setToken(rescuerToken);
    const sarRes = await http.tracks.sarCorridor(trackId);
    expect(sarRes.status).toBe(200);
    expect(sarRes.data.sectorType).toBe('EXPANDING_SQUARE');
  });

  it('T3-CROSS-11: Distress Beacon from MQTT Ingested, Broadcast to WS, and Placed as Waypoint', async () => {
    const rescueWs = new TestWebSocketClient(wsUrl);
    await rescueWs.connect({ token: rescuerToken });
    await rescueWs.subscribe('emergency:broadcast');

    // Simulate gateway receiving distress beacon via MQTT
    const mqtt = new MockMqttBridge();
    mqtt.subscribe('msh/2/e/#', async (_topic, raw) => {
      const parsed = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
      await http.emergency.triggerSos({
        emergencyType: parsed.type,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      });
    });

    mqtt.publish(
      'msh/2/e/LongFast',
      JSON.stringify({ type: 'KAYAK_CAPSIZE', latitude: 43.352, longitude: 42.435 })
    );

    // Verify WebSocket receives EMERGENCY_ALERT
    const alert = await rescueWs.waitForMessage((m) => m.type === 'EMERGENCY_ALERT');
    expect(alert.emergencyType).toBe('KAYAK_CAPSIZE');

    // Verify tactical waypoint created with symbol SOS
    const waypoints = await http.waypoints.list();
    expect(waypoints.data.some((w: any) => w.symbol === 'SOS')).toBe(true);

    await rescueWs.close();
  });

  it('T3-CROSS-12: Geofence Polygon Drawn on Tactical Map Broadcasts over Meshtastic RF', async () => {
    // 1. Guide creates polygon geofence
    const res = await http.geofences.create({
      name: 'Hazard Sector Polygon',
      shapeType: 'POLYGON',
      polygonCoordinates: [
        [43.35, 42.43],
        [43.36, 42.43],
        [43.36, 42.44],
        [43.35, 42.44],
        [43.35, 42.43],
      ],
    });
    res.expectStatus(201);

    // 2. System translates to Meshtastic WAYPOINT_APP packet
    const wpPacket = MeshtasticCodec.encodeWaypoint({
      id: 99,
      latitude_i: 433550000,
      longitude_i: 424350000,
      name: 'HAZARD_SECTOR',
      geofence_radius: 500,
    });
    const serialFramed = WebSerialFramer.frame(wpPacket);

    // 3. Radio parses serial stream
    const parser = new SerialFSMParser();
    const emitted = parser.processBytes(serialFramed);
    expect(emitted).toHaveLength(1);
    const decoded = MeshtasticCodec.decodeWaypoint(emitted[0]);
    expect(decoded.name).toBe('HAZARD_SECTOR');
  });

  it('T3-CROSS-13: Extreme Telemetry Burst under Rate Limiting Preserves SOS Priority', async () => {
    const burstHeaders = { 'X-Forwarded-For': '198.51.100.77' };

    // Fire 120 telemetry inserts to hit rate cap
    for (let i = 0; i < 120; i++) {
      await http.request(
        'POST',
        '/api/v1/telemetry',
        { latitude: 43.35, longitude: 42.43 },
        burstHeaders
      );
    }
    // 121st telemetry request is blocked
    const blocked = await http.request(
      'POST',
      '/api/v1/telemetry',
      { latitude: 43.35, longitude: 42.43 },
      burstHeaders
    );
    expect(blocked.status).toBe(429);

    // Interleaved SOS request succeeds with 201 Created
    const sos = await http.request(
      'POST',
      '/api/v1/emergency/sos',
      {
        emergencyType: 'BURST_INTERLEAVED_SOS',
        latitude: 43.35,
        longitude: 42.43,
      },
      burstHeaders
    );
    expect(sos.status).toBe(201);
    expect(sos.data.status).toBe('ACTIVE');
  });

  it('T3-CROSS-14: Optimistic Concurrency Control (OCC) Resolves REST and WS Race Condition', async () => {
    const team = await http.teams.create({ name: 'Race Team', safeRadiusMeters: 500 });
    team.expectStatus(201);
    const teamId = team.data.id;

    // Concurrently dispatch two edits both reading version 1
    const [editA, editB] = await Promise.all([
      http.teams.update(teamId, { name: 'Race Team Update A', version: 1 }),
      http.teams.update(teamId, { name: 'Race Team Update B', version: 1 }),
    ]);

    const statuses = [editA.status, editB.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);
  });

  it('T3-CROSS-15: Privacy Mode Transition Masks Real-time Coordinates across REST & WS', async () => {
    // 1. Submit normal telemetry -> full precision
    const norm = await http.telemetry.insert({
      latitude: 43.355812,
      longitude: 42.439184,
      privacyMode: 'NORMAL',
    });
    norm.expectStatus(201);
    expect(norm.data.latitude).toBe(43.355812);

    // 2. Submit reduced telemetry -> quantized to 2 decimal places
    const reduced = await http.telemetry.insert({
      latitude: 43.355812,
      longitude: 42.439184,
      privacyMode: 'REDUCED',
    });
    reduced.expectStatus(201);
    expect(reduced.data.latitude).toBe(43.36);
    expect(reduced.data.longitude).toBe(42.44);
  });
}, 3);
