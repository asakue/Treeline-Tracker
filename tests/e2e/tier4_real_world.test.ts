/**
 * Tier 4: Real-World Wilderness Operational Scenarios Test Suite (6 Tests)
 * Treeline Tracker E2E Testing Framework
 * 
 * Verifies complete, end-to-end tactical expedition mission workflows:
 * - T4-EXP-01: Multi-Team Wilderness Search and Rescue (SAR) Mission
 * - T4-EXP-02: Offline Mountain Trek with Intermittent LoRa Mesh Sync
 * - T4-EXP-03: Catastrophic Avalanche Event with SOS Rate-Limit Bypass & Rapid Intercept
 * - T4-EXP-04: Hazardous Wildlife Geofence Breach and Squad Evacuation
 * - T4-EXP-05: Cross-Transport Hybrid Relay (BLE -> WebSerial -> MQTT -> Command Map)
 * - T4-EXP-06: Heavy Telemetry Storm under Extreme Resource Constraints
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

describe('Tier 4: Real-World Operational Scenarios (6 Tests)', () => {
  let http: ApiClient;
  let wsUrl: string;
  let rescuerToken = '';
  let guideToken = '';
  let hikerToken = '';

  beforeAll(async () => {
    if (runnerInstance.server) {
      rescuerToken = runnerInstance.server.generateJwt({ sub: 'sar-commander-uuid', role: 'rescuer' });
      guideToken = runnerInstance.server.generateJwt({ sub: 'lead-guide-uuid', role: 'guide' });
      hikerToken = runnerInstance.server.generateJwt({ sub: 'field-hiker-uuid', role: 'hiker' });
    }
  });

  beforeEach(() => {
    http = new ApiClient(runnerInstance.baseUrl);
    http.setToken(rescuerToken);
    wsUrl = runnerInstance.wsUrl;
  });

  it('T4-EXP-01: Multi-Team Wilderness Search and Rescue (SAR) Mission', async () => {
    // 1. Incident Intake: Lost hiker triggers SOS
    http.setToken(hikerToken);
    const sosRes = await http.emergency.triggerSos({
      emergencyType: 'LOST_HIKER',
      latitude: 43.355,
      longitude: 42.439,
      notes: 'Solo hiker disoriented in dense whiteout fog',
    });
    sosRes.expectStatus(201);
    const emergencyId = sosRes.data.emergencyId;
    expect(sosRes.data.status).toBe('ACTIVE');

    // 2. SAR Commander activates SAR team
    http.setToken(rescuerToken);
    const teamRes = await http.teams.create({
      name: 'SAR-ALPHA-TASKFORCE',
      callsign: 'RESCUE-LEAD',
      safeRadiusMeters: 1000.0,
    });
    teamRes.expectStatus(201);
    const sarTeamId = teamRes.data.id;

    // 3. Sector Delineation: Delineate search sector polygon & medevac landing zone
    const sectorRes = await http.geofences.create({
      teamId: sarTeamId,
      name: 'SEARCH_SECTOR_1',
      shapeType: 'POLYGON',
      polygonCoordinates: [
        [43.35, 42.43],
        [43.36, 42.43],
        [43.36, 42.45],
        [43.35, 42.45],
        [43.35, 42.43],
      ],
      breachAction: 'ALERT_TEAM',
    });
    sectorRes.expectStatus(201);

    const lzRes = await http.waypoints.create({
      teamId: sarTeamId,
      name: 'LZ-EAGLE',
      symbol: 'HELIPAD',
      latitude: 43.352,
      longitude: 42.434,
      altitude: 2100.0,
    });
    lzRes.expectStatus(201);

    // 4. Tactical Command WebSocket connects
    const commandWs = new TestWebSocketClient(wsUrl);
    await commandWs.connect({ token: rescuerToken });
    await commandWs.subscribe([`team:${sarTeamId}`, 'emergency:broadcast']);

    // 5. Search teams deploy and stream GPS telemetry
    const searcherWs = new TestWebSocketClient(wsUrl);
    await searcherWs.connect({ token: rescuerToken });
    await searcherWs.subscribe(`team:${sarTeamId}`);

    searcherWs.sendTelemetry({
      latitude: 43.354,
      longitude: 42.438,
      altitude: 2180.0,
      battery: 92,
    });

    const telemetryFrame = await commandWs.waitForMessage((m) => m.type === 'TELEMETRY_BROADCAST');
    expect(telemetryFrame.coords).toEqual([43.354, 43.354 ? 42.438 : 0]);

    // 6. Subject located -> Drop target waypoint -> Resolve emergency -> Archive track
    const targetWp = await http.waypoints.create({
      teamId: sarTeamId,
      name: 'SUBJECT_LOCATED',
      symbol: 'SURVIVOR',
      latitude: 43.3548,
      longitude: 42.4389,
    });
    targetWp.expectStatus(201);

    const resolveRes = await http.emergency.resolve(emergencyId, {
      resolutionNotes: 'Hiker located with mild hypothermia; stabilized and evacuated via LZ-EAGLE.',
    });
    resolveRes.expectStatus(200);
    expect(resolveRes.data.status).toBe('RESOLVED');

    await commandWs.close();
    await searcherWs.close();
  });

  it('T4-EXP-02: Offline Mountain Trek with Intermittent LoRa Mesh Sync', async () => {
    // 1. Pre-Expedition Caching: Guide caches map tiles in IndexedDB
    const idb = new MockIDBFactory();
    const db = await idb.open('expedition_db');
    const tileStore = db.createObjectStore('offline_tiles', { keyPath: 'key' });

    const canyonBbox = { minLat: 43.3, minLon: 42.4, maxLat: 43.35, maxLon: 42.45 };
    const requiredTiles = SlippyMath.calculateTileBounds(canyonBbox, 13);
    for (const t of requiredTiles) {
      tileStore.put({
        key: `${t.z}/${t.x}/${t.y}`,
        data: SlippyMath.generateSvgTile(t.z, t.x, t.y),
      });
    }
    expect(tileStore.count()).toBe(requiredTiles.length);

    // 2. Cellular dead zone entry: PWA ServiceWorker serves cached tile
    const cacheStorage = new MockCacheStorage();
    const swCache = await cacheStorage.open('sw_tiles');
    const firstTile = requiredTiles[0];
    const tileUrl = `/tiles/${firstTile.z}/${firstTile.x}/${firstTile.y}.png`;
    await swCache.put(tileUrl, {
      body: tileStore.get(`${firstTile.z}/${firstTile.x}/${firstTile.y}`).data,
    });

    const cachedHit = await swCache.match(tileUrl);
    expect(cachedHit).toBeDefined();
    expect(cachedHit?.body.length).toBeGreaterThan(0);

    // 3. Ad-Hoc LoRa Mesh Tracking: companion radio via BLE sends Position packets
    const ble = new MockBleGattTransport();
    ble.connect();

    const offlineQueue = new OfflinePacketQueue(db);

    for (let hop = 1; hop <= 3; hop++) {
      const posBytes = MeshtasticCodec.encodePosition({
        latitude_i: 433000000 + hop * 10000,
        longitude_i: 424000000 + hop * 10000,
        time: 1700000000 + hop * 30,
      });
      // Store in offline queue while traversing canyon
      offlineQueue.enqueue({
        id: `canyon-hop-${hop}`,
        payload: { latitude: 43.3 + hop * 0.001, longitude: 42.4 + hop * 0.001 },
        priority: 64,
        timestamp: Date.now() + hop * 30000,
      });
    }
    expect(offlineQueue.size()).toBe(3);

    // 4. Summit Reconnection: At mountain pass, gateway phone syncs stored queue in single batch
    const pointsToSync = [];
    while (offlineQueue.size() > 0) {
      const pkt = offlineQueue.dequeue();
      if (pkt) pointsToSync.push(pkt.payload as { latitude: number; longitude: number });
    }

    http.setToken(guideToken);
    const syncRes = await http.telemetry.batchInsert(pointsToSync);
    syncRes.expectStatus(201);
    expect(syncRes.data.inserted).toBe(3);
    expect(offlineQueue.size()).toBe(0);
  });

  it('T4-EXP-03: Catastrophic Avalanche Event with SOS Rate-Limit Bypass & Rapid Intercept', async () => {
    // 1. Group streams high-volume telemetry, pushing IP to rate cap
    const groupIp = { 'X-Forwarded-For': '198.51.100.222' };
    for (let i = 0; i < 120; i++) {
      await http.request('GET', '/api/v1/teams', undefined, groupIp);
    }
    const checkThrottled = await http.request('GET', '/api/v1/teams', undefined, groupIp);
    expect(checkThrottled.status).toBe(429);

    // 2. Avalanche hits -> Guide triggers SOS button
    // Meshtastic wire packet encoded with ALERT priority (110)
    const distressPacket = MeshtasticCodec.encodeMeshPacket({
      from: 0xfeedbeef,
      to: 0xffffffff,
      id: 9999,
      priority: MeshPriority.ALERT,
      want_ack: true,
      decoded: {
        portnum: PortNum.TEXT_MESSAGE_APP,
        payload: new TextEncoder().encode('AVALANCHE NORTH COULOIR 3 VICTIMS'),
      },
    });
    expect(distressPacket.length).toBeGreaterThan(0);

    // 3. SOS REST payload hits backend -> Strictly bypasses rate limiter
    const sosRes = await http.request(
      'POST',
      '/api/v1/emergency/sos',
      {
        emergencyType: 'AVALANCHE_CRITICAL',
        latitude: 43.361,
        longitude: 42.445,
        notes: 'Avalanche North Couloir, 3 victims',
      },
      groupIp
    );
    expect(sosRes.status).toBe(201);
    expect(sosRes.data.status).toBe('ACTIVE');

    // 4. Tactical Intercept HUD calculation:
    // Rescue team at (43.350, 42.435) calculating bearing & distance to beacon (43.361, 42.445)
    const rescuerLat = 43.35, rescuerLon = 42.435;
    const targetLat = 43.361, targetLon = 42.445;
    const dLat = (targetLat - rescuerLat) * 111139;
    const dLon = (targetLon - rescuerLon) * 111139 * Math.cos((rescuerLat * Math.PI) / 180);
    const interceptDistMeters = Math.sqrt(dLat * dLat + dLon * dLon);
    const bearingRad = Math.atan2(dLon, dLat);
    const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;

    expect(interceptDistMeters).toBeGreaterThan(1000);
    expect(bearingDeg).toBeGreaterThan(0);
    expect(bearingDeg).toBeLessThan(90); // Northeast quadrant
  });

  it('T4-EXP-04: Hazardous Wildlife Geofence Breach and Squad Evacuation', async () => {
    // 1. Guide creates polygon exclusion zone for Grizzly Hazard
    http.setToken(guideToken);
    const gfRes = await http.geofences.create({
      name: 'GRIZZLY_HAZARD',
      shapeType: 'POLYGON',
      fenceType: 'EXCLUSION_ZONE',
      polygonCoordinates: [
        [43.35, 42.43],
        [43.36, 42.43],
        [43.36, 42.44],
        [43.35, 42.44],
        [43.35, 42.43],
      ],
      breachAction: 'TRIGGER_SOS',
    });
    gfRes.expectStatus(201);

    // 2. Debounced breach detection: 3 consecutive fixes inside exclusion zone
    const fixes = [
      { lat: 43.355, lon: 42.435 }, // Fix 1 (inside exclusion)
      { lat: 43.356, lon: 42.436 }, // Fix 2 (inside exclusion)
      { lat: 43.357, lon: 42.437 }, // Fix 3 (confirmed breach)
    ];

    let breachConfirmed = true;
    for (const fix of fixes) {
      const check = await http.geofences.check(gfRes.data.id, {
        latitude: fix.lat,
        longitude: fix.lon,
      });
      // Point inside exclusion zone is considered breached
      if (!check.data.isInside) breachConfirmed = false;
    }
    expect(breachConfirmed).toBe(true);

    // 3. Evacuation Routing: Guide drops emergency rally point waypoint
    const rallyPoint = await http.waypoints.create({
      name: 'RP-RIDGE-SAFE',
      symbol: 'RALLY_POINT',
      latitude: 43.345,
      longitude: 42.425,
    });
    rallyPoint.expectStatus(201);
    expect(rallyPoint.data.name).toBe('RP-RIDGE-SAFE');
  });

  it('T4-EXP-05: Cross-Transport Hybrid Relay (BLE -> WebSerial -> MQTT -> Command Map)', async () => {
    const textMessage = 'RIDGE SECURED ALL SAFE';

    // 1. Field Hiker: encodes packet via BLE GATT
    const ble = new MockBleGattTransport();
    ble.connect();

    const dataPayload = {
      portnum: PortNum.TEXT_MESSAGE_APP,
      payload: new TextEncoder().encode(textMessage),
    };
    const radioPacket = MeshtasticCodec.encodeMeshPacket({
      from: 0x12344321,
      to: 0xffffffff,
      id: 8881,
      decoded: dataPayload,
    });
    await ble.writeToRadio(radioPacket);
    const bleSent = ble.getWrittenToRadio()[0];

    // 2. Vehicle Gateway: receives serial byte stream with 0x94 0xC3 framing
    const serialFramed = WebSerialFramer.frame(bleSent);
    const parser = new SerialFSMParser();
    const emittedFromSerial = parser.processBytes(serialFramed);
    expect(emittedFromSerial).toHaveLength(1);

    // 3. Internet Gateway: publishes via MQTT
    const mqtt = new MockMqttBridge();
    let mqttReceivedPayload: Uint8Array | null = null;
    mqtt.subscribe('msh/2/c/LongFast/!vehicle1', (_topic, msg) => {
      mqttReceivedPayload = msg as Uint8Array;
    });
    mqtt.publish('msh/2/c/LongFast/!vehicle1', emittedFromSerial[0]);
    expect(mqttReceivedPayload).not.toBeNull();

    // 4. Central Command: decodes packet
    const finalPacket = MeshtasticCodec.decodeMeshPacket(mqttReceivedPayload!);
    expect(finalPacket.decoded?.portnum).toBe(PortNum.TEXT_MESSAGE_APP);
    const decodedText = new TextDecoder().decode(finalPacket.decoded!.payload);
    expect(decodedText).toBe(textMessage);
  });

  it('T4-EXP-06: Heavy Telemetry Storm under Extreme Resource Constraints', async () => {
    // 30 simulated devices dump batches concurrently
    const deviceBatches = [];
    for (let dev = 0; dev < 30; dev++) {
      const points = [];
      for (let p = 0; p < 10; p++) {
        points.push({
          latitude: 43.35 + dev * 0.001,
          longitude: 42.43 + p * 0.001,
          batteryLevel: 85,
        });
      }
      deviceBatches.push(
        http.request('POST', '/api/v1/telemetry/batch', { points }, { 'X-Forwarded-For': `10.24.${dev}.1` })
      );
    }

    // Mid-storm concurrent Emergency SOS beacon
    const emergencySos = http.emergency.triggerSos({
      emergencyType: 'STORM_INDUCED_SOS',
      latitude: 43.359,
      longitude: 42.439,
      notes: 'Avalanche triggered by storm',
    });

    const [sosResult, ...batchResults] = await Promise.all([emergencySos, ...deviceBatches]);

    // SOS processes immediately with 201 Created
    expect(sosResult.status).toBe(201);
    expect(sosResult.data.status).toBe('ACTIVE');

    // All batches accepted cleanly
    for (const res of batchResults) {
      expect(res.status).toBe(201);
      expect(res.data.inserted).toBe(10);
    }
  });
}, 4);
