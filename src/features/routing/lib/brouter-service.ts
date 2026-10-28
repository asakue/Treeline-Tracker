/**
 * @fileoverview Hiking Routing Service (OSM Routed-Foot, BRouter, Topographic A* Grid & Terrain Physics)
 * 
 * Multi-layer routing engine:
 * 1. OpenStreetMap Foot Router (routing.openstreetmap.de/routed-foot) — real hiking trails, paths, sac_scale.
 * 2. OSRM Pedestrian Router (router.project-osrm.org/route/v1/foot) — global OSM walking fallback.
 * 3. BRouter Hiking Engine (brouter.de) — energy-slope aware mountain routing.
 * 4. Topographic A* Grid Synthesizer — contour-following obstacle avoidance for wild mountain areas.
 * 5. DEM Elevation Enrichment & Mountain Physics (Tobler, DIN 33466, Minetti, SAC difficulty).
 */

import L from 'leaflet';
import {
  getElevationForCoordinates,
  calculateElevationStats,
} from '@/features/elevation/lib/elevation-service';
import {
  generateDetailedTerrainAnalytics,
  trackRouteAnalyticsEvent,
  type DetailedTerrainAnalytics,
} from './route-analytics';
import { synthesizeTerrainAwarePath } from './terrain-grid-router';
import { calculateDistanceMeters } from './terrain-physics';

export interface RouteSuggestion {
  id: string;
  name: string;
  description: string;
  tag: string;
  iconType: 'mountain' | 'trail' | 'direct';
  geojson: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  coordinates: [number, number][]; // [lat, lng]
  elevationProfile: { distanceKm: number; elevation: number }[];
  stats: {
    distanceKm: number;
    durationMinutes: number;
    ascentM: number;
    descentM: number;
    minElevationM: number;
    maxElevationM: number;
    movingDurationMinutes?: number;
    restStops?: number;
    avgSlopeDeg?: number;
    maxSlopeDeg?: number;
    energyKcal?: number;
    waterLiters?: number;
    sacDifficulty?: 'T1' | 'T2' | 'T3' | 'T4';
    ibpIndex?: number;
    avalancheHazardM?: number;
  };
  terrainAnalytics?: DetailedTerrainAnalytics;
}

export interface HikingRouteResult {
  primaryRoute: RouteSuggestion;
  alternatives: RouteSuggestion[];
}

export type HikingProfile = 'hiking-mountain' | 'trekking' | 'hiking-wet';

export const HIKING_PROFILES_CONFIG = {
  'hiking-mountain': {
    name: 'Горный поход (Hiking Mountain)',
    description: 'Учитывает горные тропы (sac_scale), перепады высот, штрафует опасные крутые подъемы',
    brouterProfile: 'hiking-mountain',
  },
  'trekking': {
    name: 'Треккинг по тропам и грунтовкам',
    description: 'Оптимизирован для комфортных грунтовых дорог и маркированных пешеходных маршрутов',
    brouterProfile: 'trekking',
  },
  'hiking-wet': {
    name: 'Облегченный / Безопасный обход крутых склонов',
    description: 'Максимально пологие тропы, обход глубоких бродов и крутых спусков',
    brouterProfile: 'hiking-wet',
  },
};

/**
 * Расчет расстояния по формуле гаверсинусов (км)
 */
export function calculateDistanceKm(points: [number, number][]): number {
  let totalM = 0;
  for (let i = 1; i < points.length; i++) {
    totalM += calculateDistanceMeters(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return Number((totalM / 1000).toFixed(2));
}

/**
 * Формирование массива высотного профиля относительно пройденного километража
 */
export function buildElevationProfile(
  points: [number, number][],
  elevations: number[]
): { distanceKm: number; elevation: number }[] {
  const profile: { distanceKm: number; elevation: number }[] = [];
  let accumulatedKm = 0;

  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      accumulatedKm += calculateDistanceKm([points[i - 1], points[i]]);
    }
    profile.push({
      distanceKm: Number(accumulatedKm.toFixed(2)),
      elevation: Math.round(elevations[i] || 0),
    });
  }

  return profile;
}

/**
 * 1. Запрос к OSM Routed-Foot API
 */
async function fetchOsmFootRoute(
  points: [number, number][]
): Promise<{ coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } | null> {
  try {
    const coordsStr = points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
    const osmUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    
    const res = await fetch(osmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawCoords = route.geometry.coordinates;
        const latLngs: [number, number][] = rawCoords.map((c: number[]) => [c[1], c[0]]);
        return {
          coordinates: latLngs,
          distanceMeters: route.distance || 0,
          durationSeconds: route.duration || 0,
        };
      }
    }
  } catch (err) {
    console.warn('OSM Routed-Foot notice, attempting fallback router:', err);
  }

  // Запасной пешеходный роутер OSRM
  try {
    const coordsStr = points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${coordsStr}?overview=full&geometries=geojson`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawCoords = route.geometry.coordinates;
        const latLngs: [number, number][] = rawCoords.map((c: number[]) => [c[1], c[0]]);
        return {
          coordinates: latLngs,
          distanceMeters: route.distance || 0,
          durationSeconds: route.duration || 0,
        };
      }
    }
  } catch (err) {
    console.warn('OSRM Foot notice:', err);
  }

  return null;
}

/**
 * 2. Запрос к BRouter
 */
async function fetchBRouter(
  points: [number, number][],
  profile: HikingProfile = 'hiking-mountain'
): Promise<{ coordinates: [number, number][]; elevations: number[]; distanceMeters: number } | null> {
  try {
    const lonLatString = points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join('|');
    const brouterUrl = `https://brouter.de/brouter?lonlats=${lonLatString}&profile=${profile}&alternativeidx=0&format=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(brouterUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json, application/geo+json' },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const geojson = await response.json();
      const feature = geojson.features?.[0];
      if (feature && feature.geometry && feature.geometry.coordinates) {
        const rawCoords: number[][] = feature.geometry.coordinates;
        const pathLatLngs: [number, number][] = rawCoords.map((c) => [c[1], c[0]]);
        const elevations = rawCoords.map((c) => (c.length >= 3 ? c[2] : 0));
        const distanceMeters = Number(feature.properties?.['track-length'] || 0);

        return {
          coordinates: pathLatLngs,
          elevations,
          distanceMeters,
        };
      }
    }
  } catch (e) {
    console.warn('BRouter unavailable or timed out:', e);
  }
  return null;
}

/**
 * Генерация геометрии GeoJSON из массива координат и высот
 */
function createRouteGeoJson(
  coordinates: [number, number][],
  elevations: number[],
  distanceKm: number,
  ascentM: number
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates.map(([lat, lng], idx) => [
            lng,
            lat,
            elevations[idx] || 0,
          ]),
        },
        properties: {
          'track-length': distanceKm * 1000,
          'filtered ascend': ascentM,
        },
      },
    ],
  };
}

/**
 * Главная функция построения и предложения маршрутов:
 * Принимает координаты старта, финиша и промежуточных точек.
 * Обогащает треки DEM-высотами, рассчитывает физическую модель Тоблера/DIN 33466,
 * формирует детальную топографическую аналитику и возвращает основной трек + альтернативы.
 */
export async function calculateHikingRouteSuggestions(
  start: [number, number],
  finish: [number, number],
  waypoints: [number, number][] = [],
  profile: HikingProfile = 'hiking-mountain'
): Promise<HikingRouteResult> {
  const allKeyPoints = [start, ...waypoints, finish];

  // 1. Попытка построить трек через OSM Foot Router
  let primaryCoords: [number, number][] | null = null;
  let primaryDistanceMeters = 0;

  const osmResult = await fetchOsmFootRoute(allKeyPoints);
  if (osmResult && osmResult.coordinates.length > 1) {
    primaryCoords = osmResult.coordinates;
    primaryDistanceMeters = osmResult.distanceMeters;
  } else {
    // Если OSM недоступен, пробуем BRouter
    const brouterRes = await fetchBRouter(allKeyPoints, profile);
    if (brouterRes && brouterRes.coordinates.length > 1) {
      primaryCoords = brouterRes.coordinates;
      primaryDistanceMeters = brouterRes.distanceMeters;
    }
  }

  // Если оба веб-роутера не вернули трек (бездорожье / дикая горная местность):
  // Запускаем топографический A* Grid Synthesizer с обходом крутых склонов
  if (!primaryCoords || primaryCoords.length < 2) {
    primaryCoords = await synthesizeTerrainAwarePath(allKeyPoints, {
      profile,
      corridorWidthMeters: 400,
    });
    primaryDistanceMeters = calculateDistanceKm(primaryCoords) * 1000;
  }

  // Обогащаем основной маршрут высотами DEM
  const demDataPrimary = await getElevationForCoordinates(primaryCoords);
  const primaryElevations = demDataPrimary.map((d) => d.elevation);
  const primaryElevStats = calculateElevationStats(primaryElevations);

  const primaryCoordsWithElev: [number, number, number][] = primaryCoords.map((c, i) => [
    c[0],
    c[1],
    primaryElevations[i] || 0,
  ]);

  // Комплексный анализ физики рельефа (Тоблер, DIN 33466, Минетти, лавинные зоны)
  const primaryAnalytics = generateDetailedTerrainAnalytics(primaryCoordsWithElev);
  const primaryDistKm = primaryAnalytics.summary.totalDistanceKm || calculateDistanceKm(primaryCoords);

  const primarySuggestion: RouteSuggestion = {
    id: 'primary-foot-trail',
    name: 'Основной пешеходный трек (по тропам и грунтовкам)',
    description: 'Оптимальный маршрут по размеченным пешим тропам с минимальным риском непроходимости',
    tag: 'Рекомендуемый',
    iconType: 'trail',
    geojson: createRouteGeoJson(primaryCoords, primaryElevations, primaryDistKm, primaryElevStats.ascent),
    coordinates: primaryCoords,
    elevationProfile: buildElevationProfile(primaryCoords, primaryElevations),
    stats: {
      distanceKm: primaryDistKm,
      durationMinutes: primaryAnalytics.summary.totalDurationMinutes,
      ascentM: primaryElevStats.ascent,
      descentM: primaryElevStats.descent,
      minElevationM: primaryElevStats.minElevation,
      maxElevationM: primaryElevStats.maxElevation,
      movingDurationMinutes: primaryAnalytics.summary.movingDurationMinutes,
      restStops: primaryAnalytics.summary.restStopsCount,
      avgSlopeDeg: primaryAnalytics.summary.avgSlopeDeg,
      maxSlopeDeg: primaryAnalytics.summary.maxSlopeDeg,
      energyKcal: primaryAnalytics.summary.totalEnergyKcal,
      waterLiters: primaryAnalytics.summary.recommendedWaterLiters,
      sacDifficulty: primaryAnalytics.summary.sacDifficulty,
      ibpIndex: primaryAnalytics.summary.ibpIndex,
      avalancheHazardM: primaryAnalytics.summary.avalancheHazardDistanceM,
    },
    terrainAnalytics: primaryAnalytics,
  };

  // 2. Генерируем альтернативные варианты маршрута
  const alternatives: RouteSuggestion[] = [];

  // Вариант 2: Безопасный / Пологий трек (минимизация уклона и обход крутяков)
  const safeCoords = await synthesizeTerrainAwarePath(allKeyPoints, {
    profile: 'hiking-wet',
    corridorWidthMeters: 650,
  });
  const demDataSafe = await getElevationForCoordinates(safeCoords);
  const safeElevations = demDataSafe.map((d) => d.elevation);
  const safeElevStats = calculateElevationStats(safeElevations);
  const safeCoordsWithElev: [number, number, number][] = safeCoords.map((c, i) => [
    c[0],
    c[1],
    safeElevations[i] || 0,
  ]);
  const safeAnalytics = generateDetailedTerrainAnalytics(safeCoordsWithElev);
  const safeDistKm = safeAnalytics.summary.totalDistanceKm || calculateDistanceKm(safeCoords);

  alternatives.push({
    id: 'safe-low-slope-trail',
    name: 'Безопасный пологий трек (обход крутых склонов)',
    description: 'Более пологий набор высоты с траверсами по рельефу и минимизацией риска срыва',
    tag: 'Безопасный',
    iconType: 'mountain',
    geojson: createRouteGeoJson(safeCoords, safeElevations, safeDistKm, safeElevStats.ascent),
    coordinates: safeCoords,
    elevationProfile: buildElevationProfile(safeCoords, safeElevations),
    stats: {
      distanceKm: safeDistKm,
      durationMinutes: safeAnalytics.summary.totalDurationMinutes,
      ascentM: safeElevStats.ascent,
      descentM: safeElevStats.descent,
      minElevationM: safeElevStats.minElevation,
      maxElevationM: safeElevStats.maxElevation,
      movingDurationMinutes: safeAnalytics.summary.movingDurationMinutes,
      restStops: safeAnalytics.summary.restStopsCount,
      avgSlopeDeg: safeAnalytics.summary.avgSlopeDeg,
      maxSlopeDeg: safeAnalytics.summary.maxSlopeDeg,
      energyKcal: safeAnalytics.summary.totalEnergyKcal,
      waterLiters: safeAnalytics.summary.recommendedWaterLiters,
      sacDifficulty: safeAnalytics.summary.sacDifficulty,
      ibpIndex: safeAnalytics.summary.ibpIndex,
      avalancheHazardM: safeAnalytics.summary.avalancheHazardDistanceM,
    },
    terrainAnalytics: safeAnalytics,
  });

  // Вариант 3: Прямой горный азимут (кратчайшее спортивное соединение точек)
  const directCoords = generateInterpolatedPath(allKeyPoints, 14);
  const demDataDirect = await getElevationForCoordinates(directCoords);
  const directElevations = demDataDirect.map((d) => d.elevation);
  const directElevStats = calculateElevationStats(directElevations);
  const directCoordsWithElev: [number, number, number][] = directCoords.map((c, i) => [
    c[0],
    c[1],
    directElevations[i] || 0,
  ]);
  const directAnalytics = generateDetailedTerrainAnalytics(directCoordsWithElev);
  const directDistKm = directAnalytics.summary.totalDistanceKm || calculateDistanceKm(directCoords);

  alternatives.push({
    id: 'direct-azimuth',
    name: 'Прямой горный азимут (напрямик)',
    description: 'Кратчайший путь по прямой с реальным высотным профилем рельефа',
    tag: 'Кратчайший',
    iconType: 'direct',
    geojson: createRouteGeoJson(directCoords, directElevations, directDistKm, directElevStats.ascent),
    coordinates: directCoords,
    elevationProfile: buildElevationProfile(directCoords, directElevations),
    stats: {
      distanceKm: directDistKm,
      durationMinutes: directAnalytics.summary.totalDurationMinutes,
      ascentM: directElevStats.ascent,
      descentM: directElevStats.descent,
      minElevationM: directElevStats.minElevation,
      maxElevationM: directElevStats.maxElevation,
      movingDurationMinutes: directAnalytics.summary.movingDurationMinutes,
      restStops: directAnalytics.summary.restStopsCount,
      avgSlopeDeg: directAnalytics.summary.avgSlopeDeg,
      maxSlopeDeg: directAnalytics.summary.maxSlopeDeg,
      energyKcal: directAnalytics.summary.totalEnergyKcal,
      waterLiters: directAnalytics.summary.recommendedWaterLiters,
      sacDifficulty: directAnalytics.summary.sacDifficulty,
      ibpIndex: directAnalytics.summary.ibpIndex,
      avalancheHazardM: directAnalytics.summary.avalancheHazardDistanceM,
    },
    terrainAnalytics: directAnalytics,
  });

  // Трекинг события генерации маршрута в аналитическую систему
  trackRouteAnalyticsEvent('route_created', {
    distanceKm: primaryDistKm,
    durationMinutes: primaryAnalytics.summary.totalDurationMinutes,
    ascentM: primaryElevStats.ascent,
    maxSlopeDeg: primaryAnalytics.summary.maxSlopeDeg,
    sacDifficulty: primaryAnalytics.summary.sacDifficulty,
    ibpIndex: primaryAnalytics.summary.ibpIndex,
    hasAvalancheZones: primaryAnalytics.summary.avalancheHazardDistanceM > 0,
    avalancheDistanceM: primaryAnalytics.summary.avalancheHazardDistanceM,
    profile,
  });

  return {
    primaryRoute: primarySuggestion,
    alternatives,
  };
}

/**
 * Совместимость со старым вызовом calculateHikingRoute
 */
export async function calculateHikingRoute(
  start: [number, number],
  finish: [number, number],
  waypoints: [number, number][] = [],
  profile: HikingProfile = 'hiking-mountain'
) {
  const res = await calculateHikingRouteSuggestions(start, finish, waypoints, profile);
  return res.primaryRoute;
}

/**
 * Функция передачи полученного GeoJSON в карту Leaflet для отрисовки
 */
export function addGeoJsonRouteToMap(
  map: L.Map,
  geojson: GeoJSON.FeatureCollection | GeoJSON.Feature,
  options?: {
    color?: string;
    weight?: number;
    opacity?: number;
    dashArray?: string;
    onEachFeature?: (feature: any, layer: L.Layer) => void;
  }
): L.GeoJSON {
  const routeLayer = L.geoJSON(geojson, {
    style: () => ({
      color: options?.color || 'hsl(var(--primary))',
      weight: options?.weight || 5,
      opacity: options?.opacity || 0.85,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: options?.dashArray,
    }),
    onEachFeature: options?.onEachFeature || ((feature, layer) => {
      const props = feature.properties || {};
      const distance = props['track-length'] ? `${(props['track-length'] / 1000).toFixed(2)} км` : '';
      const ascent = props['filtered ascend'] ? `Набор: +${props['filtered ascend']} м` : '';
      if (distance || ascent) {
        layer.bindPopup(`<b>Пешеходный маршрут</b><br/>${distance}<br/>${ascent}`);
      }
    }),
  });

  routeLayer.addTo(map);
  return routeLayer;
}

// Генерация интерполированных точек
function generateInterpolatedPath(points: [number, number][], stepsPerSegment = 15): [number, number][] {
  const res: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    for (let s = 0; s <= stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      const lat = p1[0] + (p2[0] - p1[0]) * t;
      const lon = p1[1] + (p2[1] - p1[1]) * t;
      res.push([lat, lon]);
    }
  }
  return res;
}
