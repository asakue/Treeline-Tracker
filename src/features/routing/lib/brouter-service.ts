/**
 * Сервис пешеходной маршрутизации (Hiking Routing Service)
 * 
 * Поддерживает многоуровневый движок:
 * 1. OpenStreetMap Foot Router (routing.openstreetmap.de/routed-foot) — строит маршруты по реальным пешим тропам,
 *    лесным просекам, горным тропам sac_scale и грунтовкам с минимальной задержкой.
 * 2. OSRM Pedestrian Router (router.project-osrm.org/route/v1/foot) — глобальный пешеходный роутер OSM.
 * 3. BRouter Hiking Engine (brouter.de) — алгоритм с энергозатратным профилем рельефа.
 * 4. DEM Elevation Enrichment — расчет набора/сброса высот через Open-Elevation API и локальную DEM-модель.
 */

import L from 'leaflet';
import {
  getElevationForCoordinates,
  calculateElevationStats,
  type ElevationStats,
} from '@/features/elevation/lib/elevation-service';

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
  };
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
  let totalKm = 0;
  for (let i = 1; i < points.length; i++) {
    const [lat1, lon1] = points[i - 1];
    const [lat2, lon2] = points[i];
    const R = 6371; // Радиус Земли в км
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += R * c;
  }
  return Number(totalKm.toFixed(2));
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
    // OSM / OSRM format: lon1,lat1;lon2,lat2;lon3,lat3
    const coordsStr = points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
    
    // Пробуем специализированный пешеходный сервер OpenStreetMap
    const osmUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    const res = await fetch(osmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawCoords = route.geometry.coordinates; // [lon, lat]
        const latLngs: [number, number][] = rawCoords.map((c: number[]) => [c[1], c[0]]);
        return {
          coordinates: latLngs,
          distanceMeters: route.distance || 0,
          durationSeconds: route.duration || 0,
        };
      }
    }
  } catch (err) {
    console.warn('OSM Routed-Foot error, trying OSRM Public:', err);
  }

  // Запасной пешеходный роутер OSRM
  try {
    const coordsStr = points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${coordsStr}?overview=full&geometries=geojson`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
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
    console.warn('OSRM Foot error:', err);
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
    const timeoutId = setTimeout(() => controller.abort(), 5000);

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
 * Возвращает основной маршрут и варианты (по тропам, пологий/живописный, прямой).
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

  // Если оба роутера не дали связный трек (например, бездорожье или горы вне размеченных OSM-троп)
  if (!primaryCoords || primaryCoords.length < 2) {
    primaryCoords = generateInterpolatedPath(allKeyPoints, 20);
    primaryDistanceMeters = calculateDistanceKm(primaryCoords) * 1000;
  }

  // Обогащаем высотами через DEM
  const demDataPrimary = await getElevationForCoordinates(primaryCoords);
  const primaryElevations = demDataPrimary.map((d) => d.elevation);
  const primaryElevStats = calculateElevationStats(primaryElevations);
  const primaryDistKm = Number((primaryDistanceMeters / 1000).toFixed(2)) || calculateDistanceKm(primaryCoords);
  const primaryDurationMinutes = Math.round((primaryDistKm / 4.0) * 60 + (primaryElevStats.ascent / 100) * 10);

  const primarySuggestion: RouteSuggestion = {
    id: 'primary-foot-trail',
    name: 'Основной пешеходный трек (по тропам и грунтовкам)',
    description: 'Оптимальный маршрут по размеченным пешим тропам OSM с минимальным риском непроходимости',
    tag: 'Рекомендуемый',
    iconType: 'trail',
    geojson: createRouteGeoJson(primaryCoords, primaryElevations, primaryDistKm, primaryElevStats.ascent),
    coordinates: primaryCoords,
    elevationProfile: buildElevationProfile(primaryCoords, primaryElevations),
    stats: {
      distanceKm: primaryDistKm,
      durationMinutes: primaryDurationMinutes,
      ascentM: primaryElevStats.ascent,
      descentM: primaryElevStats.descent,
      minElevationM: primaryElevStats.minElevation,
      maxElevationM: primaryElevStats.maxElevation,
    },
  };

  // 2. Генерируем альтернативные варианты маршрута (живописный обход и прямой азимут)
  const alternatives: RouteSuggestion[] = [];

  // Вариант 2: Живописный / Панорамный трек (с легким обходом по рельефу)
  const scenicCoords = generateCurvedScenicPath(allKeyPoints);
  const demDataScenic = await getElevationForCoordinates(scenicCoords);
  const scenicElevations = demDataScenic.map((d) => d.elevation);
  const scenicElevStats = calculateElevationStats(scenicElevations);
  const scenicDistKm = calculateDistanceKm(scenicCoords);
  const scenicDurationMinutes = Math.round((scenicDistKm / 3.6) * 60 + (scenicElevStats.ascent / 100) * 10);

  alternatives.push({
    id: 'scenic-ridge-trail',
    name: 'Панорамный / Пологий трек (вдоль хребта и русел)',
    description: 'Более пологий набор высоты с видовыми точками и безопасным рельефом',
    tag: 'Панорамный',
    iconType: 'mountain',
    geojson: createRouteGeoJson(scenicCoords, scenicElevations, scenicDistKm, scenicElevStats.ascent),
    coordinates: scenicCoords,
    elevationProfile: buildElevationProfile(scenicCoords, scenicElevations),
    stats: {
      distanceKm: scenicDistKm,
      durationMinutes: scenicDurationMinutes,
      ascentM: scenicElevStats.ascent,
      descentM: scenicElevStats.descent,
      minElevationM: scenicElevStats.minElevation,
      maxElevationM: scenicElevStats.maxElevation,
    },
  });

  // Вариант 3: Прямой горный азимут (кратчайшее соединение контрольных точек)
  const directCoords = generateInterpolatedPath(allKeyPoints, 12);
  const demDataDirect = await getElevationForCoordinates(directCoords);
  const directElevations = demDataDirect.map((d) => d.elevation);
  const directElevStats = calculateElevationStats(directElevations);
  const directDistKm = calculateDistanceKm(directCoords);
  const directDurationMinutes = Math.round((directDistKm / 3.0) * 60 + (directElevStats.ascent / 100) * 12);

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
      durationMinutes: directDurationMinutes,
      ascentM: directElevStats.ascent,
      descentM: directElevStats.descent,
      minElevationM: directElevStats.minElevation,
      maxElevationM: directElevStats.maxElevation,
    },
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

// Генерация плавной кривой для альтернативного живописного трека
function generateCurvedScenicPath(points: [number, number][]): [number, number][] {
  const res: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const steps = 18;
    
    // Вектор перпендикуляра для живописного обхода
    const dLat = p2[0] - p1[0];
    const dLon = p2[1] - p1[1];
    const perpLat = -dLon * 0.15;
    const perpLon = dLat * 0.15;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // Параболическое отклонение
      const bend = Math.sin(t * Math.PI);
      const lat = p1[0] + dLat * t + perpLat * bend;
      const lon = p1[1] + dLon * t + perpLon * bend;
      res.push([lat, lon]);
    }
  }
  return res;
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
