import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBearing,
  calculateCrossTrackDistance,
  evaluateMovementDirection,
  analyzeRouteNavigation,
} from '@/entities/route';
import {
  GeofenceDebouncer,
  LocationFilter,
} from '@/core/location';
import { POST as evaluateNavPost } from '@/app/api/navigation/evaluate/route';
import { NextRequest } from 'next/server';

describe('Navigation Algorithms: XTD & Direction Evaluation', () => {
  // Тестовый маршрут: линия с юга на север
  // [43.0, 42.0] -> [43.1, 42.0] -> [43.2, 42.0]
  const northTrack: [number, number][] = [
    [43.0, 42.0],
    [43.1, 42.0],
    [43.2, 42.0],
  ];

  describe('calculateBearing', () => {
    it('calculates cardinal bearings correctly', () => {
      // North
      const north = calculateBearing([43.0, 42.0], [43.1, 42.0]);
      expect(north).toBeCloseTo(0, 0);

      // East
      const east = calculateBearing([43.0, 42.0], [43.0, 42.1]);
      expect(east).toBeCloseTo(90, 0);

      // South
      const south = calculateBearing([43.1, 42.0], [43.0, 42.0]);
      expect(south).toBeCloseTo(180, 0);

      // West
      const west = calculateBearing([43.0, 42.1], [43.0, 42.0]);
      expect(west).toBeCloseTo(270, 0);
    });
  });

  describe('calculateCrossTrackDistance (XTD)', () => {
    it('detects point directly on track line (XTD ~ 0m, ON_TRACK)', () => {
      const pointOnTrack: [number, number] = [43.05, 42.0];
      const res = calculateCrossTrackDistance(pointOnTrack, northTrack, 50);

      expect(res.crossTrackDistanceMeters).toBeLessThan(1.0);
      expect(res.side).toBe('ON_TRACK');
      expect(res.isOffTrack).toBe(false);
      expect(res.segmentIndex).toBe(0);
      expect(res.progressPercentage).toBeGreaterThan(20);
      expect(res.progressPercentage).toBeLessThan(30);
    });

    it('detects point to the LEFT of track within safety corridor', () => {
      // Маршрут идет на север (от 43.0 до 43.1).
      // Западнее (lon 41.9997) — это слева (LEFT)
      const pointLeft: [number, number] = [43.05, 41.9997];
      const res = calculateCrossTrackDistance(pointLeft, northTrack, 50);

      expect(res.side).toBe('LEFT');
      expect(res.crossTrackDistanceMeters).toBeGreaterThan(15);
      expect(res.crossTrackDistanceMeters).toBeLessThan(35);
      expect(res.isOffTrack).toBe(false); // 24м < 50м
    });

    it('detects point to the RIGHT of track exceeding safety corridor (isOffTrack = true)', () => {
      // Восточнее (lon 42.001) — это справа (RIGHT)
      const pointRightOffTrack: [number, number] = [43.05, 42.001];
      const res = calculateCrossTrackDistance(pointRightOffTrack, northTrack, 50);

      expect(res.side).toBe('RIGHT');
      expect(res.crossTrackDistanceMeters).toBeGreaterThan(70);
      expect(res.isOffTrack).toBe(true); // 81м > 50м
    });

    it('clamps correctly when hiker is beyond start or finish of track', () => {
      // Южнее старта
      const beforeStart: [number, number] = [42.99, 42.0];
      const resStart = calculateCrossTrackDistance(beforeStart, northTrack, 50);
      expect(resStart.nearestPoint[0]).toBeCloseTo(43.0, 3);
      expect(resStart.nearestPoint[1]).toBeCloseTo(42.0, 3);
      expect(resStart.progressPercentage).toBe(0);

      // Севернее финиша
      const afterFinish: [number, number] = [43.25, 42.0];
      const resFinish = calculateCrossTrackDistance(afterFinish, northTrack, 50);
      expect(resFinish.nearestPoint[0]).toBeCloseTo(43.2, 3);
      expect(resFinish.progressPercentage).toBe(100);
      expect(resFinish.remainingMeters).toBe(0);
    });
  });

  describe('evaluateMovementDirection (Reverse Movement)', () => {
    const routeBearingNorth = 0; // Трек строго на север

    it('identifies ALIGNED movement when moving with the trail', () => {
      const res = evaluateMovementDirection(10, routeBearingNorth, 1.2);
      expect(res.directionStatus).toBe('ALIGNED');
      expect(res.bearingDeltaDeg).toBe(10);
      expect(res.isMovingBackwards).toBe(false);
      expect(res.confidence).toBe(1);
    });

    it('identifies PERPENDICULAR movement across the trail', () => {
      const res = evaluateMovementDirection(90, routeBearingNorth, 1.0);
      expect(res.directionStatus).toBe('PERPENDICULAR');
      expect(res.bearingDeltaDeg).toBe(90);
      expect(res.isMovingBackwards).toBe(false);
    });

    it('identifies REVERSE movement when heading backwards', () => {
      // Идет на юг (180°) по маршруту, идущему на север (0°)
      const res = evaluateMovementDirection(180, routeBearingNorth, 1.2);
      expect(res.directionStatus).toBe('REVERSE');
      expect(res.bearingDeltaDeg).toBe(180);
      expect(res.isMovingBackwards).toBe(true);
      expect(res.confidence).toBe(1);
    });

    it('handles angle wrap-around over North correctly', () => {
      // 355° vs 5° -> дельта должна быть 10°, а не 350°
      const res = evaluateMovementDirection(355, 5, 1.0);
      expect(res.bearingDeltaDeg).toBe(10);
      expect(res.directionStatus).toBe('ALIGNED');
      expect(res.isMovingBackwards).toBe(false);
    });

    it('ignores direction when stationary (speed < 0.3 m/s)', () => {
      const res = evaluateMovementDirection(180, routeBearingNorth, 0.1);
      expect(res.directionStatus).toBe('ALIGNED');
      expect(res.isMovingBackwards).toBe(false);
      expect(res.confidence).toBe(0);
    });
  });

  describe('analyzeRouteNavigation', () => {
    it('produces comprehensive navigation report and off-track alert', () => {
      const hiker = {
        latitude: 43.05,
        longitude: 42.0012, // ~98м восточнее
        heading: 180,        // Развернулся назад
        speed: 1.1,
      };

      const analysis = analyzeRouteNavigation(hiker, northTrack, { corridorWidthMeters: 50 });

      expect(analysis.crossTrack.isOffTrack).toBe(true);
      expect(analysis.direction.isMovingBackwards).toBe(true);
      expect(analysis.alerts.length).toBeGreaterThanOrEqual(2);
      expect(analysis.alerts[0]).toContain('Сход с нитки трека');
      expect(analysis.alerts[1]).toContain('движение вспять');
      expect(analysis.estimatedRemainingMinutes).toBeGreaterThan(0);
    });
  });
});

describe('GeofenceDebouncer: Anti-Flapping & Anomaly Filtering', () => {
  let debouncer: GeofenceDebouncer;
  const anchor = { latitude: 43.0, longitude: 42.0 };
  const safeRadius = 500; // 500 метров

  beforeEach(() => {
    debouncer = new GeofenceDebouncer({
      windowSize: 3,
      hysteresisMeters: 15,
      maxSpeedMps: 15,
    });
  });

  it('does NOT confirm breach on a single transient GPS spike (Debounce Window)', () => {
    // Точка 1: 300м внутри зоны
    const p1 = debouncer.evaluate('hiker-1', { latitude: 43.002, longitude: 42.0 }, anchor, safeRadius);
    expect(p1.status).toBe('INSIDE');
    expect(p1.isConfirmed).toBe(true);

    // Точка 2: Одиночный скачок на 520м (за пределы 500м)
    const p2 = debouncer.evaluate('hiker-1', { latitude: 43.0047, longitude: 42.0 }, anchor, safeRadius);
    expect(p2.status).toBe('WARNING'); // Еще не подтверждено!
    expect(p2.isConfirmed).toBe(false);
    expect(p2.consecutiveBreachCount).toBe(1);

    // Точка 3: Вернулся обратно (300м)
    const p3 = debouncer.evaluate('hiker-1', { latitude: 43.002, longitude: 42.0 }, anchor, safeRadius);
    expect(p3.status).toBe('INSIDE');
    expect(p3.isConfirmed).toBe(true);
    expect(p3.consecutiveBreachCount).toBe(0);
  });

  it('confirms BREACH after 3 consecutive samples outside safe radius', () => {
    // 3 последовательные точки за пределами 500м (lat 43.005 ~ 556м)
    const p1 = debouncer.evaluate('hiker-2', { latitude: 43.005, longitude: 42.0 }, anchor, safeRadius);
    expect(p1.status).toBe('WARNING');
    expect(p1.isConfirmed).toBe(false);

    const p2 = debouncer.evaluate('hiker-2', { latitude: 43.0051, longitude: 42.0 }, anchor, safeRadius);
    expect(p2.status).toBe('WARNING');
    expect(p2.isConfirmed).toBe(false);

    const p3 = debouncer.evaluate('hiker-2', { latitude: 43.0052, longitude: 42.0 }, anchor, safeRadius);
    expect(p3.status).toBe('BREACH');
    expect(p3.isConfirmed).toBe(true);
    expect(p3.consecutiveBreachCount).toBe(3);
  });

  it('enforces hysteresis: stays in WARNING when within hysteresis buffer (safeRadius - 15m)', () => {
    const t0 = 1700000000000;
    // 1. Вводим в подтвержденный BREACH
    for (let i = 0; i < 3; i++) {
      debouncer.evaluate('hiker-3', { latitude: 43.005, longitude: 42.0, timestamp: t0 + i * 5000 }, anchor, safeRadius);
    }

    // 2. Турист приблизился к 495м (порог возврата: 500 - 15 = 485м)
    // lat 43.00445 ~ 495м
    const inBuffer = debouncer.evaluate('hiker-3', { latitude: 43.00445, longitude: 42.0, timestamp: t0 + 15000 }, anchor, safeRadius);
    expect(inBuffer.status).toBe('WARNING'); // Не переходит сразу в INSIDE из-за гистерезиса

    // 3. Турист зашел глубже (450м < 485м)
    // lat 43.0040 ~ 445м
    const returned = debouncer.evaluate('hiker-3', { latitude: 43.0040, longitude: 42.0, timestamp: t0 + 20000 }, anchor, safeRadius);
    expect(returned.status).toBe('INSIDE');
    expect(returned.isConfirmed).toBe(true);
  });

  it('detects and smooths impossible GPS teleportation jumps (>15 m/s)', () => {
    const t0 = 1700000000000;
    // Точка 1 в центре
    debouncer.evaluate('hiker-4', { latitude: 43.0, longitude: 42.0, timestamp: t0 }, anchor, safeRadius);

    // Точка 2 через 2 секунды переместилась на 200 метров (~100 м/с — явный глитч GPS)
    const glitched = debouncer.evaluate(
      'hiker-4',
      { latitude: 43.0018, longitude: 42.0, timestamp: t0 + 2000 },
      anchor,
      safeRadius
    );

    expect(glitched.flappingDetected).toBe(true);
    expect(glitched.smoothedDistanceMeters).toBeLessThan(glitched.distanceMeters);
  });

  it('bypasses debounce window immediately on SOS emergency (isEmergency = true)', () => {
    // Первая же точка с SOS сигналом мгновенно дает подтвержденный BREACH
    const sosBreach = debouncer.evaluate(
      'hiker-sos',
      { latitude: 43.006, longitude: 42.0 },
      anchor,
      safeRadius,
      true // isEmergency = true
    );

    expect(sosBreach.status).toBe('BREACH');
    expect(sosBreach.isConfirmed).toBe(true);
  });
});

describe('API Endpoint: /api/navigation/evaluate', () => {
  it('returns comprehensive evaluation for valid request', async () => {
    const req = new NextRequest('http://localhost:3000/api/navigation/evaluate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        hikerLocation: {
          latitude: 43.05,
          longitude: 42.001,
          speed: 1.2,
          heading: 180,
          name: 'Иван',
        },
        routePath: [
          [43.0, 42.0],
          [43.1, 42.0],
        ],
        anchorLocation: {
          latitude: 43.0,
          longitude: 42.0,
        },
        safeRadiusMeters: 500,
        corridorWidthMeters: 50,
      }),
    });

    const res = await evaluateNavPost(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.routeAnalysis).toBeDefined();
    expect(body.data.routeAnalysis.crossTrack.isOffTrack).toBe(true);
    expect(body.data.routeAnalysis.direction.isMovingBackwards).toBe(true);
    expect(body.data.geofenceAnalysis).toBeDefined();
  });

  it('rejects invalid coordinates with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/navigation/evaluate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        hikerLocation: {
          latitude: 195, // Невалидная широта (>90)
          longitude: 42.0,
        },
      }),
    });

    const res = await evaluateNavPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
