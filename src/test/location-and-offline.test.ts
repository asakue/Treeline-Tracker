import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocationFilter,
  calculateHaversineDistanceMeters,
  encodeGeohash,
  decodeGeohashBbox,
  decodeGeohashCenter,
} from '@/core/location';
import { GroupSchema } from '@/core/domain/schemas';
import { OfflineQueue } from '@/core/transport/offline-queue';
import { TransportPacket } from '@/core/transport/interfaces';

describe('Location Tracking, Deadband, Geofencing & Offline Queue Tests', () => {
  describe('1. Haversine Distance & Geohashing (geofire-common standard)', () => {
    it('calculates accurate distance between known geographic points', () => {
      // Elbrus West Peak (43.3499, 42.4367) to Elbrus East Peak (43.3550, 42.4533) ~1.4 km
      const distance = calculateHaversineDistanceMeters(43.3499, 42.4367, 43.3550, 42.4533);
      expect(distance).toBeGreaterThan(1300);
      expect(distance).toBeLessThan(1600);
    });

    it('returns 0 distance for identical coordinates', () => {
      const distance = calculateHaversineDistanceMeters(43.355, 42.439, 43.355, 42.439);
      expect(distance).toBe(0);
    });

    it('encodes and decodes coordinates with standard geohash precision', () => {
      const lat = 43.3550;
      const lng = 42.4392;
      const hash = encodeGeohash(lat, lng, 9);

      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(9);

      const center = decodeGeohashCenter(hash);
      expect(center.latitude).toBeCloseTo(lat, 2);
      expect(center.longitude).toBeCloseTo(lng, 2);

      const bbox = decodeGeohashBbox(hash);
      expect(lat).toBeGreaterThanOrEqual(bbox.minLat);
      expect(lat).toBeLessThanOrEqual(bbox.maxLat);
      expect(lng).toBeGreaterThanOrEqual(bbox.minLng);
      expect(lng).toBeLessThanOrEqual(bbox.maxLng);
    });
  });

  describe('2. Location Filter: Deadband & Throttle Engine (FR-006, NFR-007, NFR-008)', () => {
    let filter: LocationFilter;

    beforeEach(() => {
      filter = new LocationFilter({
        deadbandMeters: 5,
        minIntervalMs: 5000,
        adaptiveBatterySavings: true,
      });
    });

    it('allows initial coordinate transmission', () => {
      const result = filter.evaluateTransmission({
        latitude: 43.355,
        longitude: 42.439,
        timestamp: 10000,
      });
      expect(result.shouldTransmit).toBe(true);
      expect(result.reason).toBe('OK');
    });

    it('suppresses micro-jitter if movement is below deadband (5m)', () => {
      // First point
      filter.evaluateTransmission({
        latitude: 43.355000,
        longitude: 42.439000,
        timestamp: 10000,
      });

      // Shift by ~1 meter (0.00001 deg is ~1.11m)
      const jitterResult = filter.evaluateTransmission({
        latitude: 43.355010,
        longitude: 42.439005,
        timestamp: 20000, // Time passed, but movement too small
      });

      expect(jitterResult.shouldTransmit).toBe(false);
      expect(jitterResult.reason).toBe('DEADBAND_FILTERED');
      expect(jitterResult.distanceMoved).toBeLessThan(5);
    });

    it('throttles rapid transmissions within minIntervalMs (5000ms)', () => {
      // First point
      filter.evaluateTransmission({
        latitude: 43.355,
        longitude: 42.439,
        timestamp: 10000,
      });

      // Big movement (> 20m) but only 1000ms elapsed
      const throttledResult = filter.evaluateTransmission({
        latitude: 43.3555,
        longitude: 42.4395,
        timestamp: 11000, // Only 1 sec later
      });

      expect(throttledResult.shouldTransmit).toBe(false);
      expect(throttledResult.reason).toBe('THROTTLED');
    });

    it('allows transmission when both deadband (>5m) and throttle (>5s) are satisfied', () => {
      filter.evaluateTransmission({
        latitude: 43.355,
        longitude: 42.439,
        timestamp: 10000,
      });

      const validResult = filter.evaluateTransmission({
        latitude: 43.3555,
        longitude: 42.4395,
        timestamp: 16000, // 6 sec later
      });

      expect(validResult.shouldTransmit).toBe(true);
      expect(validResult.reason).toBe('OK');
    });

    it('adapts throttle interval to 30s when battery level is critical (<= 15%)', () => {
      filter.evaluateTransmission({
        latitude: 43.355,
        longitude: 42.439,
        batteryLevel: 12, // Critical battery
        timestamp: 10000,
      });

      // 10s passed with movement, but in critical battery mode minimum interval is 30s
      const lowBattThrottled = filter.evaluateTransmission({
        latitude: 43.356,
        longitude: 42.440,
        batteryLevel: 12,
        timestamp: 20000, // 10s elapsed
      });

      expect(lowBattThrottled.shouldTransmit).toBe(false);
      expect(lowBattThrottled.reason).toBe('THROTTLED');

      // 35s passed
      const lowBattPassed = filter.evaluateTransmission({
        latitude: 43.356,
        longitude: 42.440,
        batteryLevel: 12,
        timestamp: 45000, // 35s elapsed
      });

      expect(lowBattPassed.shouldTransmit).toBe(true);
    });

    it('always bypasses deadband and throttle for Emergency / SOS packets', () => {
      filter.evaluateTransmission({
        latitude: 43.355,
        longitude: 42.439,
        timestamp: 10000,
      });

      // Immediate 0-distance SOS signal
      const sosResult = filter.evaluateTransmission(
        {
          latitude: 43.355,
          longitude: 42.439,
          timestamp: 10100, // 100ms later
        },
        true // isEmergency = true
      );

      expect(sosResult.shouldTransmit).toBe(true);
      expect(sosResult.reason).toBe('OK');
    });
  });

  describe('3. Geofence Safe Radius Evaluation (FR-002, UC-02)', () => {
    const leaderPos = { latitude: 43.355, longitude: 42.439 };
    const safeRadiusMeters = 500;

    it('reports INSIDE when hiker is well within safe radius', () => {
      // 50m away
      const hikerPos = { latitude: 43.3553, longitude: 42.4393, name: 'Анна' };
      const evaluation = LocationFilter.evaluateGeofence(hikerPos, leaderPos, safeRadiusMeters);

      expect(evaluation.status).toBe('INSIDE');
      expect(evaluation.deviationMeters).toBe(0);
      expect(evaluation.distanceMeters).toBeLessThan(safeRadiusMeters * 0.85);
    });

    it('reports WARNING when hiker approaches 85% boundary', () => {
      // ~450m away
      const hikerPos = { latitude: 43.3585, longitude: 42.442, name: 'Михаил' };
      const evaluation = LocationFilter.evaluateGeofence(hikerPos, leaderPos, safeRadiusMeters);

      expect(evaluation.status).toBe('WARNING');
      expect(evaluation.distanceMeters).toBeGreaterThan(safeRadiusMeters * 0.85);
      expect(evaluation.distanceMeters).toBeLessThanOrEqual(safeRadiusMeters);
    });

    it('reports BREACH when hiker exceeds safe radius (> 500m)', () => {
      // ~1.2 km away
      const hikerPos = { latitude: 43.365, longitude: 42.449, name: 'Алексей' };
      const evaluation = LocationFilter.evaluateGeofence(hikerPos, leaderPos, safeRadiusMeters);

      expect(evaluation.status).toBe('BREACH');
      expect(evaluation.deviationMeters).toBeGreaterThan(0);
      expect(evaluation.message).toContain('покинул безопасную зону');
    });
  });

  describe('4. Group Domain Schema with safeRadiusMeters', () => {
    it('validates Group with safeRadiusMeters and defaults to 500 if not specified', () => {
      const validGroup = {
        id: 'group-caucasus',
        name: 'Эльбрус 2026',
        location: 'Приэльбрусье',
        distance: '18 км',
        difficulty: 'Сложно' as const,
        hikers: [],
      };

      const parsed = GroupSchema.parse(validGroup);
      expect(parsed.safeRadiusMeters).toBe(500);

      const customRadiusGroup = GroupSchema.parse({
        ...validGroup,
        safeRadiusMeters: 750,
      });
      expect(customRadiusGroup.safeRadiusMeters).toBe(750);
    });
  });

  describe('5. Offline Queue with Priority & Deduplication (FR-013, FR-014)', () => {
    let queue: OfflineQueue;

    beforeEach(() => {
      queue = new OfflineQueue();
      queue.clear();
    });

    it('enqueues and counts packets', () => {
      const packet: TransportPacket = {
        id: 'pkt-normal-1',
        type: 'LOCATION_UPDATE',
        timestamp: Date.now(),
        priority: 'NORMAL',
        payload: { lat: 43.35, lng: 42.43 },
        createdAt: Date.now(),
      };

      const enqueued = queue.enqueue(packet);
      expect(enqueued).toBe(true);
      expect(queue.count()).toBe(1);
    });

    it('places EMERGENCY_SOS packets at the head of the queue', () => {
      const normalPkt1: TransportPacket = {
        id: 'pkt-normal-1',
        type: 'LOCATION_UPDATE',
        timestamp: Date.now(),
        priority: 'NORMAL',
        payload: {},
        createdAt: Date.now(),
      };
      const normalPkt2: TransportPacket = {
        id: 'pkt-normal-2',
        type: 'LOCATION_UPDATE',
        timestamp: Date.now() + 10,
        priority: 'NORMAL',
        payload: {},
        createdAt: Date.now() + 10,
      };
      const sosPkt: TransportPacket = {
        id: 'pkt-sos-urgent',
        type: 'SOS_ALERT',
        timestamp: Date.now() + 20,
        priority: 'EMERGENCY_SOS',
        payload: { distress: true },
        createdAt: Date.now() + 20,
      };

      queue.enqueue(normalPkt1);
      queue.enqueue(normalPkt2);
      queue.enqueue(sosPkt);

      const pending = queue.getPendingPackets();
      expect(pending[0].id).toBe('pkt-sos-urgent');
      expect(pending[0].priority).toBe('EMERGENCY_SOS');
    });

    it('prevents duplicate packet enqueueing (Anti-Replay / Dedup)', () => {
      const packet: TransportPacket = {
        id: 'pkt-unique-123',
        type: 'LOCATION_UPDATE',
        timestamp: Date.now(),
        priority: 'NORMAL',
        payload: {},
        createdAt: Date.now(),
      };

      expect(queue.enqueue(packet)).toBe(true);
      expect(queue.enqueue(packet)).toBe(false); // Second attempt ignored
      expect(queue.count()).toBe(1);

      // Once delivered, re-enqueueing the same ID is rejected
      queue.markAsDelivered('pkt-unique-123');
      expect(queue.count()).toBe(0);
      expect(queue.enqueue(packet)).toBe(false);
    });
  });
});
