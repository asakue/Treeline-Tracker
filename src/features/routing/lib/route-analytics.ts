/**
 * @fileoverview Route Terrain Analytics & Event Tracking Engine
 * Conforms to /analytics and /analytics-architecture skills:
 * Structured slope distribution histograms, safety hazard detection,
 * physiological effort indicators, and product telemetry events.
 */

import {
  TerrainSegmentAnalysis,
  TerrainPhysicsSummary,
  analyzeRouteTerrainPhysics,
} from './terrain-physics';

export interface SlopeCategoryShare {
  category: 'flat' | 'moderate' | 'steep' | 'avalancheZone' | 'cliff';
  label: string;
  rangeDegrees: string;
  distanceKm: number;
  percentage: number;
  colorCss: string;
}

export interface SlopeDistribution {
  flat: SlopeCategoryShare;        // 0° - 8°
  moderate: SlopeCategoryShare;    // 8° - 18°
  steep: SlopeCategoryShare;       // 18° - 27°
  avalancheZone: SlopeCategoryShare; // 28° - 45°
  cliff: SlopeCategoryShare;       // > 45°
}

export interface RouteHazardZone {
  id: string;
  type: 'AVALANCHE_SLOPE' | 'EXTREME_CLIFF' | 'HIGH_ALTITUDE' | 'SUSTAINED_CLIMB';
  severity: 'WARNING' | 'DANGER';
  title: string;
  description: string;
  recommendation: string;
  location: [number, number]; // [lat, lng]
  elevationM: number;
  slopeDegrees: number;
  distanceMeters: number;
}

export interface DetailedTerrainAnalytics {
  summary: TerrainPhysicsSummary;
  slopeDistribution: SlopeDistribution;
  hazards: RouteHazardZone[];
  elevationGainM: number;
  highestPoint: { lat: number; lng: number; elevation: number };
  lowestPoint: { lat: number; lng: number; elevation: number };
  highAltitudeKm: number; // Km above 2500m (AMS risk threshold)
}

/**
 * Computes slope distribution histogram across the standard hiking gradient bands
 */
export function computeSlopeDistribution(
  segments: TerrainSegmentAnalysis[],
  totalDistanceKm: number
): SlopeDistribution {
  let flatDistM = 0;
  let modDistM = 0;
  let steepDistM = 0;
  let avalancheDistM = 0;
  let cliffDistM = 0;

  for (const seg of segments) {
    const absSlope = Math.abs(seg.slopeDegrees);
    if (absSlope > 45) {
      cliffDistM += seg.distanceMeters;
    } else if (absSlope >= 28) {
      avalancheDistM += seg.distanceMeters;
    } else if (absSlope >= 18) {
      steepDistM += seg.distanceMeters;
    } else if (absSlope >= 8) {
      modDistM += seg.distanceMeters;
    } else {
      flatDistM += seg.distanceMeters;
    }
  }

  const totalM = segments.reduce((sum, s) => sum + s.distanceMeters, 0) || 1;

  const toShare = (
    category: SlopeCategoryShare['category'],
    label: string,
    rangeDegrees: string,
    distM: number,
    colorCss: string
  ): SlopeCategoryShare => {
    const km = Number((distM / 1000).toFixed(2));
    const percentage = Number(((distM / totalM) * 100).toFixed(1));
    return { category, label, rangeDegrees, distanceKm: km, percentage, colorCss };
  };

  return {
    flat: toShare('flat', 'Пологий / Равнина', '0° – 8°', flatDistM, 'bg-emerald-500'),
    moderate: toShare('moderate', 'Умеренный подъем', '8° – 18°', modDistM, 'bg-blue-500'),
    steep: toShare('steep', 'Крутой склон', '18° – 27°', steepDistM, 'bg-amber-500'),
    avalancheZone: toShare('avalancheZone', 'Лавиноопасный уклон', '28° – 45°', avalancheDistM, 'bg-rose-500'),
    cliff: toShare('cliff', 'Скальный сброс / Обрыв', '> 45°', cliffDistM, 'bg-purple-600'),
  };
}

/**
 * Identifies terrain hazards along the route (avalanche risk, sheer cliffs, high altitude, sustained climbs)
 */
export function identifyTerrainHazards(
  coordinatesWithElevation: [number, number, number?][],
  segments: TerrainSegmentAnalysis[]
): RouteHazardZone[] {
  const hazards: RouteHazardZone[] = [];
  let sustainedClimbMeters = 0;
  let sustainedClimbStartIdx = 0;

  segments.forEach((seg, idx) => {
    const coord = coordinatesWithElevation[idx + 1] || coordinatesWithElevation[idx];
    const lat = coord[0];
    const lng = coord[1];
    const elevation = coord[2] ?? 0;

    // 1. Avalanche risk check (28° - 45°)
    if (seg.hazardLevel === 'AVALANCHE_RISK' && seg.distanceMeters >= 40) {
      hazards.push({
        id: `hazard-avalanche-${idx}`,
        type: 'AVALANCHE_SLOPE',
        severity: 'DANGER',
        title: `Лавиноопасный склон (${seg.slopeDegrees}°)` ,
        description: `Участок протяженностью ${Math.round(seg.distanceMeters)} м с уклоном ${seg.slopeDegrees}°. Находится в критическом диапазоне схода снежных досок.`,
        recommendation: 'Оцените состояние снежного покрова и лавинный бюллетень. Соблюдайте дистанцию между участниками не менее 25 метров.',
        location: [lat, lng],
        elevationM: elevation,
        slopeDegrees: seg.slopeDegrees,
        distanceMeters: seg.distanceMeters,
      });
    }

    // 2. Sheer cliff check (> 45°)
    if (seg.hazardLevel === 'EXTREME_CLIFF') {
      hazards.push({
        id: `hazard-cliff-${idx}`,
        type: 'EXTREME_CLIFF',
        severity: 'DANGER',
        title: `Скальный обрыв / Экстремальный уклон (${seg.slopeDegrees}°)`,
        description: `Превышение порога безопасного пешего движения (${seg.slopeDegrees}°). Риск срыва.`,
        recommendation: 'Требуется организация перильной страховки или выбор альтернативного пологого траверса.',
        location: [lat, lng],
        elevationM: elevation,
        slopeDegrees: seg.slopeDegrees,
        distanceMeters: seg.distanceMeters,
      });
    }

    // 3. Sustained steep climb check (>15° for > 200 vertical meters)
    if (seg.slopeDegrees > 15) {
      sustainedClimbMeters += seg.elevationDiffMeters;
      if (sustainedClimbMeters >= 200 && idx - sustainedClimbStartIdx >= 3) {
        hazards.push({
          id: `hazard-climb-${idx}`,
          type: 'SUSTAINED_CLIMB',
          severity: 'WARNING',
          title: `Затяжной крутой подъем (+${Math.round(sustainedClimbMeters)}м)`,
          description: `Непрерывный крутой подъем на протяжении ${Math.round(sustainedClimbMeters)} метров набора высоты.`,
          recommendation: 'Запланируйте короткий привал для восстановления дыхания и контроля пульса группы.',
          location: [lat, lng],
          elevationM: elevation,
          slopeDegrees: seg.slopeDegrees,
          distanceMeters: seg.distanceMeters,
        });
        sustainedClimbMeters = 0;
        sustainedClimbStartIdx = idx;
      }
    } else {
      sustainedClimbMeters = 0;
      sustainedClimbStartIdx = idx;
    }

    // 4. High-altitude acclimatization alert (> 2800m)
    if (elevation >= 2800 && (idx === 0 || (coordinatesWithElevation[idx][2] ?? 0) < 2800)) {
      hazards.push({
        id: `hazard-altitude-${idx}`,
        type: 'HIGH_ALTITUDE',
        severity: 'WARNING',
        title: `Высокогорный участок (${elevation}м)`,
        description: `Маршрут преодолевает отметку 2800 м над уровнем моря (зона риска острой горной болезни).`,
        recommendation: 'Контролируйте самочувствие участников группы (головная боль, одышка, тошнота). Обеспечьте достаточную гидратацию.',
        location: [lat, lng],
        elevationM: elevation,
        slopeDegrees: seg.slopeDegrees,
        distanceMeters: seg.distanceMeters,
      });
    }
  });

  return hazards;
}

/**
 * Generates detailed terrain analytics for any path with elevations
 */
export function generateDetailedTerrainAnalytics(
  coordinatesWithElevation: [number, number, number?][]
): DetailedTerrainAnalytics {
  const { segments, summary } = analyzeRouteTerrainPhysics(coordinatesWithElevation);
  const slopeDistribution = computeSlopeDistribution(segments, summary.totalDistanceKm);
  const hazards = identifyTerrainHazards(coordinatesWithElevation, segments);

  let highest = { lat: 0, lng: 0, elevation: -Infinity };
  let lowest = { lat: 0, lng: 0, elevation: Infinity };
  let highAltitudeM = 0;

  coordinatesWithElevation.forEach(([lat, lng, elev = 0], i) => {
    if (elev > highest.elevation) highest = { lat, lng, elevation: elev };
    if (elev < lowest.elevation) lowest = { lat, lng, elevation: elev };
    if (elev >= 2500 && i > 0) {
      const prev = coordinatesWithElevation[i - 1];
      const dist = (segments[i - 1]?.distanceMeters || 0);
      highAltitudeM += dist;
    }
  });

  if (highest.elevation === -Infinity) highest = { lat: 0, lng: 0, elevation: 0 };
  if (lowest.elevation === Infinity) lowest = { lat: 0, lng: 0, elevation: 0 };

  return {
    summary,
    slopeDistribution,
    hazards,
    elevationGainM: Math.max(0, highest.elevation - lowest.elevation),
    highestPoint: highest,
    lowestPoint: lowest,
    highAltitudeKm: Number((highAltitudeM / 1000).toFixed(2)),
  };
}

// -------------------------------------------------------------
// Product Telemetry & Analytics Architecture Events
// -------------------------------------------------------------

export type RouteAnalyticsEventType =
  | 'route_created'
  | 'route_hazard_detected'
  | 'route_profile_switched'
  | 'route_details_opened';

export interface RouteAnalyticsEvent {
  event: RouteAnalyticsEventType;
  timestamp: number;
  properties: Record<string, unknown>;
}

const analyticsEventQueue: RouteAnalyticsEvent[] = [];

/**
 * Tracks a route analytics event adhering to product tracking standards
 */
export function trackRouteAnalyticsEvent(
  event: RouteAnalyticsEventType,
  properties: Record<string, unknown>
): void {
  const eventRecord: RouteAnalyticsEvent = {
    event,
    timestamp: Date.now(),
    properties,
  };

  analyticsEventQueue.push(eventRecord);
  if (analyticsEventQueue.length > 100) {
    analyticsEventQueue.shift(); // retain last 100 in-memory
  }

  if (process.env.NODE_ENV !== 'production') {
    // Structured observability output in dev mode
    console.debug(`[Analytics:${event}]`, properties);
  }
}

export function getRecentRouteAnalyticsEvents(): RouteAnalyticsEvent[] {
  return [...analyticsEventQueue];
}
