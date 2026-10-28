import { describe, it, expect } from 'vitest';
import {
  calculateToblerSpeed,
  calculateDin33466DurationMinutes,
  calculateMinettiCalories,
  classifySacDifficulty,
  calculateIbpIndex,
  evaluateSegmentSlope,
  analyzeRouteTerrainPhysics,
  calculateDistanceMeters,
} from '../lib/terrain-physics';
import {
  computeSlopeDistribution,
  identifyTerrainHazards,
  generateDetailedTerrainAnalytics,
} from '../lib/route-analytics';
import { synthesizeTerrainAwarePath } from '../lib/terrain-grid-router';

describe('Terrain Physics & Topographic Routing Engine', () => {
  describe('Tobler Hiking Function (calculateToblerSpeed)', () => {
    it('returns ~5.0 km/h on flat terrain (slope = 0°)', () => {
      const speed = calculateToblerSpeed(0);
      expect(speed).toBeGreaterThan(4.9);
      expect(speed).toBeLessThan(5.1);
    });

    it('peaks at gentle descent (-3° slope)', () => {
      const flatSpeed = calculateToblerSpeed(0);
      const gentleDownhillSpeed = calculateToblerSpeed(-3);
      expect(gentleDownhillSpeed).toBeGreaterThan(flatSpeed);
      expect(gentleDownhillSpeed).toBeGreaterThan(5.5);
      expect(gentleDownhillSpeed).toBeLessThanOrEqual(5.8);
    });

    it('substantially decreases on steep climbs (+14° slope)', () => {
      const speed = calculateToblerSpeed(14);
      expect(speed).toBeLessThan(2.5);
      expect(speed).toBeGreaterThan(0.6);
    });

    it('slows down on steep downhill due to braking (-25° slope)', () => {
      const gentleDownhillSpeed = calculateToblerSpeed(-3);
      const steepDownhillSpeed = calculateToblerSpeed(-25);
      expect(steepDownhillSpeed).toBeLessThan(gentleDownhillSpeed);
    });

    it('respects minimum hiking speed bound (0.6 km/h) on extreme vertical walls (70°)', () => {
      const speed = calculateToblerSpeed(70);
      expect(speed).toBe(0.6);
    });
  });

  describe('DIN 33466 Standard Duration & Rest Calculation', () => {
    it('computes flat terrain time with resting intervals', () => {
      // 4 km flat -> 60 min moving time, 1 rest stop (10 min) -> total 70 min
      const res = calculateDin33466DurationMinutes(4.0, 0, 0);
      expect(res.movingMinutes).toBe(60);
      expect(res.restStops).toBe(1);
      expect(res.totalMinutes).toBe(70);
    });

    it('accurately balances vertical and horizontal time using DIN 33466 formula', () => {
      // 4 km with 400m ascent (350m/h vertical standard):
      // Th = 60 min, Ta = 400/350 * 60 = 68.6 min
      // max(68.6, 60) + 0.5 * 60 = 98.6 -> 99 min
      const res = calculateDin33466DurationMinutes(4.0, 400, 0);
      expect(res.movingMinutes).toBe(99);
      expect(res.restStops).toBe(1);
      expect(res.totalMinutes).toBe(109);
    });

    it('calculates multiple rest stops for full-day expeditions', () => {
      // 16 km with 1200m ascent
      const res = calculateDin33466DurationMinutes(16.0, 1200, 400);
      expect(res.movingMinutes).toBeGreaterThan(300);
      expect(res.restStops).toBeGreaterThanOrEqual(6);
      expect(res.totalMinutes).toBe(res.movingMinutes + res.restStops * 10);
    });
  });

  describe('Minetti Metabolic Energy & Hydration', () => {
    it('calculates baseline calories for a moderate trek', () => {
      // 8 km, 5° slope
      const calories = calculateMinettiCalories(8.0, 5, 75, 12);
      expect(calories).toBeGreaterThan(400);
      expect(calories).toBeLessThan(1200);
    });

    it('scales energy with pack weight', () => {
      const lightPack = calculateMinettiCalories(10.0, 10, 75, 5);
      const heavyPack = calculateMinettiCalories(10.0, 10, 75, 25);
      expect(heavyPack).toBeGreaterThan(lightPack);
    });
  });

  describe('SAC Alpine Scale Difficulty Classification', () => {
    it('classifies low slope routes as T1', () => {
      expect(classifySacDifficulty(8, 4, 100)).toBe('T1');
    });

    it('classifies moderate mountain routes as T2', () => {
      expect(classifySacDifficulty(18, 8, 400)).toBe('T2');
    });

    it('classifies steep alpine trails as T3', () => {
      expect(classifySacDifficulty(28, 14, 850)).toBe('T3');
    });

    it('classifies high-risk exposed slopes (>32°) as T4', () => {
      expect(classifySacDifficulty(35, 18, 1300)).toBe('T4');
    });
  });

  describe('IBP Hiking Effort Index', () => {
    it('computes IBP score proportional to distance and vertical gain', () => {
      const easyIbp = calculateIbpIndex(5.0, 100, 10);
      const hardIbp = calculateIbpIndex(20.0, 1500, 32);
      expect(hardIbp).toBeGreaterThan(easyIbp);
      expect(easyIbp).toBeLessThan(35);
      expect(hardIbp).toBeGreaterThan(80);
    });
  });

  describe('Full Route Physics & Slope Distribution Analytics', () => {
    // Coords with 3D elevation tuples [lat, lng, elevM]
    const testCoordsWithElev: [number, number, number][] = [
      [43.250, 42.500, 1500],
      [43.255, 42.505, 1520],
      [43.260, 42.510, 1850],
      [43.265, 42.515, 2400],
      [43.270, 42.520, 2200],
    ];

    it('evaluates segment slope degrees and direction', () => {
      const seg = evaluateSegmentSlope(
        [43.250, 42.500, 1500],
        [43.255, 42.505, 1520]
      );
      expect(seg.distanceM).toBeGreaterThan(500);
      expect(seg.elevDiffM).toBe(20);
      expect(seg.slopeDeg).toBeGreaterThan(0);
      expect(seg.slopeDeg).toBeLessThan(10);
      expect(seg.hazard).toBe('SAFE');
    });

    it('analyzes entire route terrain physics accurately', () => {
      const physics = analyzeRouteTerrainPhysics(testCoordsWithElev);
      expect(physics.summary.totalDistanceKm).toBeGreaterThan(0);
      expect(physics.summary.totalAscentM).toBe(900); // 20 + 330 + 550 = 900
      expect(physics.summary.totalDescentM).toBe(200); // 2400 - 2200 = 200
      expect(physics.summary.maxSlopeDeg).toBeGreaterThan(15);
      expect(physics.summary.totalEnergyKcal).toBeGreaterThan(200);
      expect(physics.summary.totalDurationMinutes).toBeGreaterThan(physics.summary.movingDurationMinutes);
    });

    it('produces valid 5-band slope distribution summing to 100%', () => {
      const physics = analyzeRouteTerrainPhysics(testCoordsWithElev);
      const slopeDist = computeSlopeDistribution(physics.segments, physics.summary.totalDistanceKm);

      expect(slopeDist.flat).toBeDefined();
      expect(slopeDist.moderate).toBeDefined();
      expect(slopeDist.steep).toBeDefined();
      expect(slopeDist.avalancheZone).toBeDefined();
      expect(slopeDist.cliff).toBeDefined();

      const sumPercentages =
        slopeDist.flat.percentage +
        slopeDist.moderate.percentage +
        slopeDist.steep.percentage +
        slopeDist.avalancheZone.percentage +
        slopeDist.cliff.percentage;

      expect(Math.round(sumPercentages)).toBe(100);
    });

    it('identifies hazards including steep avalanche zones and high altitudes', () => {
      const highAltCoords: [number, number, number][] = [
        [43.250, 42.500, 2600],
        [43.255, 42.505, 2750],
        [43.260, 42.510, 2950],
        [43.265, 42.515, 3100],
        [43.270, 42.520, 3050],
      ];
      const physics = analyzeRouteTerrainPhysics(highAltCoords);
      const hazards = identifyTerrainHazards(highAltCoords, physics.segments);

      // High altitude hazards should be flagged for points >= 2800m
      const highAltHazards = hazards.filter((h) => h.type === 'HIGH_ALTITUDE');
      expect(highAltHazards.length).toBeGreaterThan(0);
      expect(highAltHazards[0].elevationM).toBeGreaterThanOrEqual(2800);
    });

    it('generates detailed terrain analytics with highest and lowest points', () => {
      const analytics = generateDetailedTerrainAnalytics(testCoordsWithElev);
      expect(analytics.elevationGainM).toBe(900);
      expect(analytics.highestPoint.elevation).toBe(2400);
      expect(analytics.lowestPoint.elevation).toBe(1500);
    });
  });

  describe('Topographic A* Grid Synthesizer (synthesizeTerrainAwarePath)', () => {
    it('synthesizes non-linear path contouring around obstacles to destination', async () => {
      const start: [number, number] = [43.250, 42.500];
      const finish: [number, number] = [43.270, 42.520];

      const synthesized = await synthesizeTerrainAwarePath([start, finish]);

      expect(synthesized.length).toBeGreaterThan(5);
      // Start matches
      expect(synthesized[0][0]).toBeCloseTo(start[0], 2);
      expect(synthesized[0][1]).toBeCloseTo(start[1], 2);
      // Finish matches
      const endPoint = synthesized[synthesized.length - 1];
      expect(endPoint[0]).toBeCloseTo(finish[0], 2);
      expect(endPoint[1]).toBeCloseTo(finish[1], 2);

      // Total distance is realistic and greater than or equal to straight line
      const directDistM = calculateDistanceMeters(start[0], start[1], finish[0], finish[1]);
      let totalPathM = 0;
      for (let i = 1; i < synthesized.length; i++) {
        totalPathM += calculateDistanceMeters(
          synthesized[i - 1][0],
          synthesized[i - 1][1],
          synthesized[i][0],
          synthesized[i][1]
        );
      }
      expect(totalPathM).toBeGreaterThanOrEqual(directDistM);
    });
  });
});
