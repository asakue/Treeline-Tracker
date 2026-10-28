/**
 * @fileoverview Mountain Terrain Physics & Movement Mechanics Engine
 * Implements Tobler's Hiking Function, DIN 33466 Time Estimation,
 * Minetti Metabolic Energy Model (2002), and SAC Trail Difficulty Classification.
 */

export interface TerrainSegmentAnalysis {
  distanceMeters: number;
  elevationDiffMeters: number;
  slopeDegrees: number;
  slopePercent: number;
  hazardLevel: 'SAFE' | 'MODERATE' | 'AVALANCHE_RISK' | 'EXTREME_CLIFF';
  toblerSpeedKmh: number;
  durationSeconds: number;
  energyCalories: number;
}

export interface TerrainPhysicsSummary {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  movingDurationMinutes: number;
  restStopsCount: number;
  totalAscentM: number;
  totalDescentM: number;
  maxSlopeDeg: number;
  avgSlopeDeg: number;
  totalEnergyKcal: number;
  recommendedWaterLiters: number;
  sacDifficulty: 'T1' | 'T2' | 'T3' | 'T4';
  ibpIndex: number;
  avalancheHazardDistanceM: number;
  cliffHazardDistanceM: number;
}

/**
 * Calculates Great-Circle distance between two points in meters (Haversine formula)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Evaluates slope parameters for a single segment
 */
export function evaluateSegmentSlope(
  p1: [number, number, number?],
  p2: [number, number, number?]
): {
  distanceM: number;
  elevDiffM: number;
  slopeDeg: number;
  slopePercent: number;
  hazard: 'SAFE' | 'MODERATE' | 'AVALANCHE_RISK' | 'EXTREME_CLIFF';
} {
  const distM = calculateDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
  const elev1 = p1[2] ?? 0;
  const elev2 = p2[2] ?? 0;
  const elevDiffM = elev2 - elev1;

  if (distM < 0.5) {
    return {
      distanceM: distM,
      elevDiffM: 0,
      slopeDeg: 0,
      slopePercent: 0,
      hazard: 'SAFE',
    };
  }

  const gradient = elevDiffM / distM;
  const slopeRad = Math.atan(gradient);
  const slopeDeg = (slopeRad * 180) / Math.PI;
  const absSlopeDeg = Math.abs(slopeDeg);

  let hazard: 'SAFE' | 'MODERATE' | 'AVALANCHE_RISK' | 'EXTREME_CLIFF' = 'SAFE';
  if (absSlopeDeg > 45) {
    hazard = 'EXTREME_CLIFF';
  } else if (absSlopeDeg >= 28 && absSlopeDeg <= 45) {
    hazard = 'AVALANCHE_RISK';
  } else if (absSlopeDeg >= 15) {
    hazard = 'MODERATE';
  }

  return {
    distanceM: Number(distM.toFixed(1)),
    elevDiffM: Number(elevDiffM.toFixed(1)),
    slopeDeg: Number(slopeDeg.toFixed(1)),
    slopePercent: Number((gradient * 100).toFixed(1)),
    hazard,
  };
}

/**
 * Tobler's Hiking Function: calculates walking speed based on slope gradient
 * V(s) = 6 * exp(-3.5 * |tan(theta) + 0.05|) in km/h
 * Enhanced with steep descent deceleration to model hiking pole braking & balance.
 */
export function calculateToblerSpeed(slopeDegrees: number): number {
  const slopeRad = (slopeDegrees * Math.PI) / 180;
  const tanTheta = Math.tan(slopeRad);

  // Standard Tobler formulation
  let speedKmh = 6.0 * Math.exp(-3.5 * Math.abs(tanTheta + 0.05));

  // Deceleration penalty for steep descents (< -15 deg)
  if (slopeDegrees < -15) {
    const excessSteepness = Math.abs(slopeDegrees) - 15;
    const descentBrakingFactor = Math.max(0.35, 1 - excessSteepness * 0.035);
    speedKmh *= descentBrakingFactor;
  }

  // Realistic bounds for mountain movement: between 0.6 km/h and 5.8 km/h
  return Number(Math.max(0.6, Math.min(5.8, speedKmh)).toFixed(2));
}

/**
 * Official DIN 33466 Mountain Route Travel Time (Standard in Alps and Russian Federation Mountaineering)
 * Th = Dist / 4 km/h
 * Ta = Ascent / 350 m/h
 * Td = Descent / 700 m/h
 * T_moving = max(Th, Ta + Td) + 0.5 * min(Th, Ta + Td)
 * With expedition pacing: 10 min break per 50 min hiking
 */
export function calculateDin33466DurationMinutes(
  distKm: number,
  ascentM: number,
  descentM: number,
  includeBreaks = true
): { movingMinutes: number; totalMinutes: number; restStops: number } {
  if (distKm <= 0) {
    return { movingMinutes: 0, totalMinutes: 0, restStops: 0 };
  }

  const hoursHorizontal = distKm / 4.0;
  const hoursVertical = ascentM / 350.0 + descentM / 700.0;

  const maxH = Math.max(hoursHorizontal, hoursVertical);
  const minH = Math.min(hoursHorizontal, hoursVertical);
  const movingHours = maxH + 0.5 * minH;

  const movingMinutes = Math.round(movingHours * 60);

  // Expeditions take a 10-minute break every 50 minutes of movement
  const restStops = Math.floor(movingMinutes / 50);
  const breakMinutes = restStops * 10;
  const totalMinutes = includeBreaks ? movingMinutes + breakMinutes : movingMinutes;

  return {
    movingMinutes: Math.max(1, movingMinutes),
    totalMinutes: Math.max(1, totalMinutes),
    restStops,
  };
}

/**
 * Alberto E. Minetti (2002) Energy Cost of Walking on Gradients
 * Cw = 280.5 * i^5 - 58.7 * i^4 - 289.8 * i^3 + 33.3 * i^2 + 42.8 * i + 155.4 (J / kg / km)
 */
export function calculateMinettiCalories(
  distKm: number,
  slopeDeg: number,
  hikerWeightKg = 75,
  backpackWeightKg = 12
): number {
  if (distKm <= 0) return 0;

  const totalMassKg = hikerWeightKg + backpackWeightKg;
  const slopeRad = (slopeDeg * Math.PI) / 180;
  // Clamp gradient to [-0.45, 0.45] to avoid polynomial tail anomalies
  const i = Math.max(-0.45, Math.min(0.45, Math.tan(slopeRad)));

  // Minetti polynomial yields ml O2 / (kg * km)
  const cwMlO2PerKgKm =
    280.5 * Math.pow(i, 5) -
    58.7 * Math.pow(i, 4) -
    289.8 * Math.pow(i, 3) +
    33.3 * Math.pow(i, 2) +
    42.8 * i +
    155.4;

  // 1 ml O2 ~ 20.9 Joules in human aerobic metabolism
  const JOULES_PER_ML_O2 = 20.9;
  const cwJoulesPerKgKm = Math.max(2000, cwMlO2PerKgKm * JOULES_PER_ML_O2);

  const totalJoules = cwJoulesPerKgKm * totalMassKg * distKm;
  const mechanicalKcal = totalJoules / 4184;

  // Add basal metabolic rate allowance (~75 kcal/hour)
  const estimatedHours = distKm / calculateToblerSpeed(slopeDeg);
  const basalKcal = estimatedHours * 75;

  return Math.round(mechanicalKcal + basalKcal);
}

/**
 * Swiss Alpine Club (SAC) Trail Difficulty Classification
 * T1: Hiking (Easy, flat to gentle, up to 12°)
 * T2: Mountain Hiking (Steep trails, up to 22°, good footwork required)
 * T3: Demanding Mountain Hiking (Exposed sections, scree, up to 32°)
 * T4: Alpine Trail (Exposed rocky terrain, >32°, scrambling, danger of falling)
 */
export function classifySacDifficulty(
  maxSlopeDeg: number,
  avgSlopeDeg: number,
  ascentM: number
): 'T1' | 'T2' | 'T3' | 'T4' {
  if (maxSlopeDeg >= 32 || (maxSlopeDeg >= 26 && ascentM > 1200)) {
    return 'T4';
  }
  if (maxSlopeDeg >= 22 || avgSlopeDeg >= 12 || ascentM >= 800) {
    return 'T3';
  }
  if (maxSlopeDeg >= 12 || avgSlopeDeg >= 6 || ascentM >= 300) {
    return 'T2';
  }
  return 'T1';
}

/**
 * IBP Index (International Index of Route Difficulty)
 * Normalized 0-150+ scale used in sports GPS tracking.
 */
export function calculateIbpIndex(
  distKm: number,
  ascentM: number,
  maxSlopeDeg: number
): number {
  if (distKm <= 0) return 0;

  const baseScore = distKm * 1.6;
  const climbScore = (ascentM / 1000) * 45;
  const steepFactor = maxSlopeDeg > 20 ? (maxSlopeDeg - 20) * 1.5 : 0;

  return Math.round(baseScore + climbScore + steepFactor);
}

/**
 * Comprehensive analysis of an entire route's 3D coordinates
 */
export function analyzeRouteTerrainPhysics(
  coordinatesWithElevation: [number, number, number?][]
): {
  segments: TerrainSegmentAnalysis[];
  summary: TerrainPhysicsSummary;
} {
  if (!coordinatesWithElevation || coordinatesWithElevation.length < 2) {
    return {
      segments: [],
      summary: {
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
        movingDurationMinutes: 0,
        restStopsCount: 0,
        totalAscentM: 0,
        totalDescentM: 0,
        maxSlopeDeg: 0,
        avgSlopeDeg: 0,
        totalEnergyKcal: 0,
        recommendedWaterLiters: 1.0,
        sacDifficulty: 'T1',
        ibpIndex: 0,
        avalancheHazardDistanceM: 0,
        cliffHazardDistanceM: 0,
      },
    };
  }

  const segments: TerrainSegmentAnalysis[] = [];
  let totalDistanceM = 0;
  let totalAscentM = 0;
  let totalDescentM = 0;
  let maxSlopeDeg = 0;
  let slopeSum = 0;
  let totalEnergyKcal = 0;
  let avalancheHazardDistM = 0;
  let cliffHazardDistM = 0;

  for (let i = 1; i < coordinatesWithElevation.length; i++) {
    const p1 = coordinatesWithElevation[i - 1];
    const p2 = coordinatesWithElevation[i];
    const slopeInfo = evaluateSegmentSlope(p1, p2);

    const toblerSpeed = calculateToblerSpeed(slopeInfo.slopeDeg);
    const segDistKm = slopeInfo.distanceM / 1000;
    const durationSeconds = Math.round((segDistKm / toblerSpeed) * 3600);
    const calories = calculateMinettiCalories(segDistKm, slopeInfo.slopeDeg);

    totalDistanceM += slopeInfo.distanceM;
    if (slopeInfo.elevDiffM > 0) totalAscentM += slopeInfo.elevDiffM;
    if (slopeInfo.elevDiffM < 0) totalDescentM += Math.abs(slopeInfo.elevDiffM);

    const absSlope = Math.abs(slopeInfo.slopeDeg);
    if (absSlope > maxSlopeDeg) maxSlopeDeg = absSlope;
    slopeSum += absSlope;
    totalEnergyKcal += calories;

    if (slopeInfo.hazard === 'AVALANCHE_RISK') {
      avalancheHazardDistM += slopeInfo.distanceM;
    } else if (slopeInfo.hazard === 'EXTREME_CLIFF') {
      cliffHazardDistM += slopeInfo.distanceM;
    }

    segments.push({
      distanceMeters: slopeInfo.distanceM,
      elevationDiffMeters: slopeInfo.elevDiffM,
      slopeDegrees: slopeInfo.slopeDeg,
      slopePercent: slopeInfo.slopePercent,
      hazardLevel: slopeInfo.hazard,
      toblerSpeedKmh: toblerSpeed,
      durationSeconds,
      energyCalories: calories,
    });
  }

  const totalDistanceKm = Number((totalDistanceM / 1000).toFixed(2));
  const avgSlopeDeg = Number((slopeSum / segments.length).toFixed(1));

  const dinTime = calculateDin33466DurationMinutes(
    totalDistanceKm,
    Math.round(totalAscentM),
    Math.round(totalDescentM),
    true
  );

  const sacDifficulty = classifySacDifficulty(maxSlopeDeg, avgSlopeDeg, Math.round(totalAscentM));
  const ibpIndex = calculateIbpIndex(totalDistanceKm, Math.round(totalAscentM), maxSlopeDeg);

  // Water recommendation: ~0.5L per 5km base + 0.35L per 300m ascent + baseline 0.5L
  const recommendedWaterLiters = Number(
    (0.5 + (totalDistanceKm / 5) * 0.5 + (totalAscentM / 300) * 0.35).toFixed(1)
  );

  return {
    segments,
    summary: {
      totalDistanceKm,
      totalDurationMinutes: dinTime.totalMinutes,
      movingDurationMinutes: dinTime.movingMinutes,
      restStopsCount: dinTime.restStops,
      totalAscentM: Math.round(totalAscentM),
      totalDescentM: Math.round(totalDescentM),
      maxSlopeDeg: Number(maxSlopeDeg.toFixed(1)),
      avgSlopeDeg,
      totalEnergyKcal,
      recommendedWaterLiters: Math.max(1.0, recommendedWaterLiters),
      sacDifficulty,
      ibpIndex,
      avalancheHazardDistanceM: Math.round(avalancheHazardDistM),
      cliffHazardDistanceM: Math.round(cliffHazardDistM),
    },
  };
}
