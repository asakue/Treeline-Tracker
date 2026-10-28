/**
 * @fileoverview Auto-Classification Service for Route Regions & Route Types
 * Conforms to /backend-architect and /backend-security-coder standards:
 * - Deterministic, offline-first geographic spatial classifier
 * - Mathematical terrain categorization (Slope, Elevation, SAC standard)
 * - Zero external SSRF risk, strict input validation, defensive bounds
 */

import { RouteDifficulty } from '@/core/domain/types';
import { HikingProfile } from './brouter-service';

export interface GeographicRegionDef {
  id: string;
  name: string;
  mountainRange: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  center: [number, number]; // [lat, lng]
}

/**
 * Spatial boundaries of major mountain systems and outdoor trekking regions
 */
export const KNOWN_MOUNTAIN_REGIONS: GeographicRegionDef[] = [
  // 1. Приэльбрусье / Центральный Кавказ
  {
    id: 'elbrus-baksan',
    name: 'Приэльбрусье (Баксанское ущелье)',
    mountainRange: 'Центральный Кавказ',
    bounds: { minLat: 43.15, maxLat: 43.45, minLng: 42.35, maxLng: 42.75 },
    center: [43.26, 42.51],
  },
  // 2. Красная Поляна / Аибга / Фишт (Западный Кавказ)
  {
    id: 'krasnaya-polyana',
    name: 'Красная Поляна (Хребет Аибга, Сочи)',
    mountainRange: 'Западный Кавказ',
    bounds: { minLat: 43.55, maxLat: 43.85, minLng: 39.95, maxLng: 40.55 },
    center: [43.67, 40.30],
  },
  // 3. Архыз / Софийские озёра
  {
    id: 'arkhyz',
    name: 'Архыз (Софийский хребет)',
    mountainRange: 'Западный Кавказ',
    bounds: { minLat: 43.40, maxLat: 43.65, minLng: 41.15, maxLng: 41.45 },
    center: [43.55, 41.28],
  },
  // 4. Домбай / Теберда
  {
    id: 'dombay',
    name: 'Домбай (Тебердинский нацпарк)',
    mountainRange: 'Западный Кавказ',
    bounds: { minLat: 43.20, maxLat: 43.35, minLng: 41.55, maxLng: 41.75 },
    center: [43.29, 41.63],
  },
  // 5. Безенги (Кабардино-Балкария)
  {
    id: 'bezengi',
    name: 'Безенги (Северный массив)',
    mountainRange: 'Центральный Кавказ',
    bounds: { minLat: 42.95, maxLat: 43.20, minLng: 42.95, maxLng: 43.30 },
    center: [43.12, 43.15],
  },
  // 6. Северная Осетия / Казбек / Цей
  {
    id: 'kazbek-tsey',
    name: 'Цейское ущелье / Казбек',
    mountainRange: 'Восточный Кавказ',
    bounds: { minLat: 42.60, maxLat: 42.95, minLng: 43.80, maxLng: 44.60 },
    center: [42.75, 44.25],
  },
  // 7. Дагестан (Сулак / Гуниб)
  {
    id: 'dagestan',
    name: 'Горный Дагестан (Гуниб, Сулакский каньон)',
    mountainRange: 'Восточный Кавказ',
    bounds: { minLat: 41.50, maxLat: 43.10, minLng: 46.50, maxLng: 47.90 },
    center: [42.40, 47.00],
  },
  // 8. Алтай (Белуха, Катунский хребет, Курай)
  {
    id: 'altai-belukha',
    name: 'Горный Алтай (Катунский хребет, Белуха)',
    mountainRange: 'Алтайские горы',
    bounds: { minLat: 49.60, maxLat: 51.50, minLng: 85.50, maxLng: 88.50 },
    center: [49.80, 86.58],
  },
  // 9. Байкал / ББТ / Листвянка / Ольхон
  {
    id: 'baikal-bbt',
    name: 'Прибайкалье (ББТ, Листвянка, Ольхон)',
    mountainRange: 'Байкальский регион',
    bounds: { minLat: 51.50, maxLat: 53.50, minLng: 104.20, maxLng: 107.50 },
    center: [51.88, 104.95],
  },
  // 10. Саяны / Ергаки
  {
    id: 'ergaki-sayany',
    name: 'Природный парк Ергаки (Западный Саян)',
    mountainRange: 'Саяны',
    bounds: { minLat: 52.60, maxLat: 53.10, minLng: 93.10, maxLng: 93.80 },
    center: [52.83, 93.45],
  },
  // 11. Хибины и Ловозерские тундры (Кольский п-ов)
  {
    id: 'khibiny',
    name: 'Хибины (Кировск, Вудъявр)',
    mountainRange: 'Кольский полуостров',
    bounds: { minLat: 67.50, maxLat: 67.85, minLng: 33.20, maxLng: 34.20 },
    center: [67.65, 33.68],
  },
  // 12. Южный Урал (Таганай, Иремель)
  {
    id: 'taganay-ural',
    name: 'Южный Урал (Нацпарк Таганай, Иремель)',
    mountainRange: 'Уральские горы',
    bounds: { minLat: 54.40, maxLat: 55.40, minLng: 58.70, maxLng: 60.10 },
    center: [55.22, 59.73],
  },
  // 13. Приполярный Урал (Манарага, Народная)
  {
    id: 'manaraga-ural',
    name: 'Приполярный Урал (г. Манарага, Народная)',
    mountainRange: 'Уральские горы',
    bounds: { minLat: 64.80, maxLat: 65.50, minLng: 59.50, maxLng: 60.80 },
    center: [65.05, 60.10],
  },
  // 14. Камчатка (Вулканы Авачинский, Мутновский, Ключевской)
  {
    id: 'kamchatka-volcanoes',
    name: 'Вулканы Камчатки',
    mountainRange: 'Камчатка',
    bounds: { minLat: 52.50, maxLat: 56.50, minLng: 157.50, maxLng: 161.50 },
    center: [53.25, 158.80],
  },
  // 15. Крымские горы (Ай-Петри, Демерджи, Чатыр-Даг)
  {
    id: 'crimean-mountains',
    name: 'Горный Крым (Ай-Петри, Демерджи)',
    mountainRange: 'Крымские горы',
    bounds: { minLat: 44.35, maxLat: 45.00, minLng: 33.70, maxLng: 35.30 },
    center: [44.45, 44.05],
  },
  // 16. Альпы (Монблан, Церматт, Доломиты)
  {
    id: 'european-alps',
    name: 'Альпы (Монблан / Церматт)',
    mountainRange: 'Альпы',
    bounds: { minLat: 45.40, maxLat: 47.50, minLng: 6.50, maxLng: 12.50 },
    center: [45.83, 6.86],
  },
];

/**
 * Auto-detects the geographic region from route points.
 * Falls back to regional cardinal zones and coordinate labels if outside known parks.
 */
export function detectRouteRegion(points: [number, number][]): string {
  if (!points || points.length === 0) {
    return 'Не определено';
  }

  // Calculate center of mass of the route coordinates
  let sumLat = 0;
  let sumLng = 0;
  let validCount = 0;

  for (const [lat, lng] of points) {
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      sumLat += lat;
      sumLng += lng;
      validCount++;
    }
  }

  if (validCount === 0) return 'Не определено';

  const centerLat = sumLat / validCount;
  const centerLng = sumLng / validCount;

  // 1. Direct bounding-box lookup
  for (const region of KNOWN_MOUNTAIN_REGIONS) {
    const { minLat, maxLat, minLng, maxLng } = region.bounds;
    if (centerLat >= minLat && centerLat <= maxLat && centerLng >= minLng && centerLng <= maxLng) {
      return `${region.name}, ${region.mountainRange}`;
    }
  }

  // 2. Proximity lookup (within ~50 km of region center)
  let closestRegion: GeographicRegionDef | null = null;
  let minDistanceM = Infinity;

  for (const region of KNOWN_MOUNTAIN_REGIONS) {
    const dLat = (centerLat - region.center[0]) * 111000;
    const dLng = (centerLng - region.center[1]) * 111000 * Math.cos((centerLat * Math.PI) / 180);
    const distM = Math.sqrt(dLat * dLat + dLng * dLng);

    if (distM < 60000 && distM < minDistanceM) {
      minDistanceM = distM;
      closestRegion = region;
    }
  }

  if (closestRegion) {
    return `${closestRegion.name} (${closestRegion.mountainRange})`;
  }

  // 3. Fallback based on broader geographical coordinates
  if (centerLat >= 41 && centerLat <= 45 && centerLng >= 38 && centerLng <= 49) {
    return 'Кавказский регион';
  }
  if (centerLat >= 48 && centerLat <= 53 && centerLng >= 82 && centerLng <= 92) {
    return 'Алтайско-Саянский регион';
  }
  if (centerLat >= 51 && centerLat <= 56 && centerLng >= 100 && centerLng <= 112) {
    return 'Байкальский регион';
  }
  if (centerLat >= 53 && centerLat <= 68 && centerLng >= 56 && centerLng <= 64) {
    return 'Уральский хребет';
  }
  if (centerLat >= 66 && centerLat <= 70 && centerLng >= 30 && centerLng <= 41) {
    return 'Кольский полуостров';
  }
  if (centerLat >= 50 && centerLat <= 61 && centerLng >= 155 && centerLng <= 165) {
    return 'Полуостров Камчатка';
  }

  return `${centerLat.toFixed(2)}° с.ш., ${centerLng.toFixed(2)}° в.д.`;
}

export interface TerrainMetricsInput {
  maxSlopeDeg?: number;
  avgSlopeDeg?: number;
  ascentM?: number;
  descentM?: number;
  maxElevationM?: number;
  minElevationM?: number;
  distanceKm?: number;
  sacDifficulty?: 'T1' | 'T2' | 'T3' | 'T4';
}

/**
 * Automatically classifies the route type based on physical metrics or geographic coordinates
 */
export function autoDetectRouteType(
  input: TerrainMetricsInput | [number, number][],
  maxElevationM?: number
): 'Горный' | 'Равнинный' {
  if (Array.isArray(input)) {
    if (maxElevationM !== undefined && maxElevationM >= 900) {
      return 'Горный';
    }
    const region = detectRouteRegion(input);
    if (
      region.includes('Кавказ') ||
      region.includes('Алтай') ||
      region.includes('Саян') ||
      region.includes('Камчат') ||
      region.includes('Хибин') ||
      region.includes('Урал')
    ) {
      return 'Горный';
    }
    return (maxElevationM ?? 0) >= 900 ? 'Горный' : 'Равнинный';
  }

  const maxSlope = input.maxSlopeDeg ?? 0;
  const maxElev = input.maxElevationM ?? 0;
  const ascent = input.ascentM ?? 0;

  if (maxElev >= 900 || maxSlope >= 15 || ascent >= 250) {
    return 'Горный';
  }

  return 'Равнинный';
}

/**
 * Automatically selects the optimal BRouter/OSM routing profile
 * without requiring the user to manually select it.
 */
export function autoDetectRoutingProfile(
  points: [number, number][],
  metrics?: TerrainMetricsInput
): HikingProfile {
  const maxSlope = metrics?.maxSlopeDeg ?? 0;
  const maxElev = metrics?.maxElevationM ?? 0;

  // If already known steep alpine terrain or altitude > 1800m
  if (maxSlope >= 25 || maxElev >= 1800) {
    return 'hiking-mountain';
  }

  // Check if center point is in a known rugged mountain polygon
  const regionText = detectRouteRegion(points);
  if (
    regionText.includes('Кавказ') ||
    regionText.includes('Алтай') ||
    regionText.includes('Саян') ||
    regionText.includes('Камчат') ||
    regionText.includes('Хибин')
  ) {
    return 'hiking-mountain';
  }

  // Moderate rolling terrain: default to trekking
  return 'trekking';
}

/**
 * Automatically determines user-facing difficulty (Легко / Средне / Сложно / Очень сложно)
 * based on SAC scale and elevation gain.
 */
export function autoDetectDifficulty(metrics: TerrainMetricsInput): RouteDifficulty {
  const sac = metrics.sacDifficulty;
  const ascent = metrics.ascentM ?? 0;
  const distance = metrics.distanceKm ?? 0;
  const maxSlope = metrics.maxSlopeDeg ?? 0;

  if (sac === 'T4' || ascent >= 1400 || maxSlope >= 35 || distance >= 25) {
    return 'Очень сложно';
  }
  if (sac === 'T3' || ascent >= 700 || maxSlope >= 22 || distance >= 15) {
    return 'Сложно';
  }
  if (sac === 'T2' || ascent >= 250 || maxSlope >= 12 || distance >= 8) {
    return 'Средне';
  }

  return 'Легко';
}
