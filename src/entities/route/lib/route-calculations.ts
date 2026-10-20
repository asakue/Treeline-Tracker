import type {
  CrossTrackEvaluation,
  DirectionEvaluation,
  RouteNavigationAnalysis,
} from '@/core/domain/types';

/**
 * Расчет расстояния по формуле гаверсинусов (Haversine formula)
 * @returns расстояние в километрах
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Вычисление истинного азимута (Forward Azimuth / Bearing) между двумя координатами
 * @returns азимут в градусах [0..360)
 */
export function calculateBearing(
  p1: [number, number],
  p2: [number, number]
): number {
  const [lat1, lon1] = p1;
  const [lat2, lon2] = p2;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  const bearingDeg = ((theta * 180) / Math.PI + 360) % 360;
  return Number(bearingDeg.toFixed(1));
}

/**
 * Вычисление кратчайшего перпендикулярного расстояния от туриста до полилинии маршрута (Cross-Track Distance / XTD)
 * Проецирует точку на каждый сегмент нитки трека, находит глобальный минимум,
 * определяет сторону отклонения (LEFT / RIGHT / ON_TRACK) через векторное произведение,
 * а также рассчитывает пройденный прогресс вдоль трека.
 */
export function calculateCrossTrackDistance(
  point: [number, number],
  path: [number, number][],
  corridorWidthMeters = 50
): CrossTrackEvaluation {
  if (!path || path.length === 0) {
    return {
      crossTrackDistanceMeters: 0,
      nearestPoint: point,
      segmentIndex: 0,
      side: 'ON_TRACK',
      isOffTrack: false,
      progressMeters: 0,
      progressPercentage: 0,
      remainingMeters: 0,
    };
  }

  if (path.length === 1) {
    const distM = haversineDistance(point[0], point[1], path[0][0], path[0][1]) * 1000;
    return {
      crossTrackDistanceMeters: Number(distM.toFixed(1)),
      nearestPoint: path[0],
      segmentIndex: 0,
      side: distM <= 1.0 ? 'ON_TRACK' : 'RIGHT',
      isOffTrack: distM > corridorWidthMeters,
      progressMeters: 0,
      progressPercentage: 0,
      remainingMeters: 0,
    };
  }

  const R = 6371000; // Радиус Земли в метрах
  const [pLat, pLon] = point;

  let minDistanceM = Infinity;
  let nearestSegmentIndex = 0;
  let bestNearestPoint: [number, number] = path[0];
  let bestSide: 'LEFT' | 'RIGHT' | 'ON_TRACK' = 'ON_TRACK';
  let bestProgressAlongTrack = 0;

  // Рассчитываем суммарную длину трека
  const segmentLengthsM: number[] = [];
  let totalTrackLengthM = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const lenM = haversineDistance(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]) * 1000;
    segmentLengthsM.push(lenM);
    totalTrackLengthM += lenM;
  }

  let accumulatedDistM = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const [aLat, aLon] = path[i];
    const [bLat, bLon] = path[i + 1];
    const segLenM = segmentLengthsM[i];

    // Локальная метрическая проекция относительно точки A
    const midLat = ((aLat + bLat) / 2) * (Math.PI / 180);
    const cosMid = Math.cos(midLat);

    const dxB = ((bLon - aLon) * (Math.PI / 180)) * R * cosMid;
    const dyB = ((bLat - aLat) * (Math.PI / 180)) * R;

    const dxP = ((pLon - aLon) * (Math.PI / 180)) * R * cosMid;
    const dyP = ((pLat - aLat) * (Math.PI / 180)) * R;

    const lenSq = dxB * dxB + dyB * dyB;

    let t = 0;
    let projX = 0;
    let projY = 0;

    if (lenSq > 1e-6) {
      t = (dxP * dxB + dyP * dyB) / lenSq;
      t = Math.max(0, Math.min(1, t));
      projX = t * dxB;
      projY = t * dyB;
    }

    const distM = Math.sqrt((dxP - projX) * (dxP - projX) + (dyP - projY) * (dyP - projY));

    if (distM < minDistanceM) {
      minDistanceM = distM;
      nearestSegmentIndex = i;

      // Обратная проекция точки на сегменте в [lat, lng]
      const nLat = aLat + (projY / R) * (180 / Math.PI);
      const nLon = aLon + (projX / (R * cosMid)) * (180 / Math.PI);
      bestNearestPoint = [Number(nLat.toFixed(6)), Number(nLon.toFixed(6))];

      // Определение стороны отклонения через 2D векторное произведение (cross product)
      const cross = dxB * dyP - dyB * dxP;
      if (distM <= 1.0) {
        bestSide = 'ON_TRACK';
      } else if (cross > 0) {
        bestSide = 'LEFT';
      } else {
        bestSide = 'RIGHT';
      }

      bestProgressAlongTrack = accumulatedDistM + t * segLenM;
    }

    accumulatedDistM += segLenM;
  }

  const roundedDistance = Number(minDistanceM.toFixed(1));
  const roundedProgress = Number(bestProgressAlongTrack.toFixed(1));
  const progressPercentage = totalTrackLengthM > 0
    ? Number(Math.min(100, Math.max(0, (bestProgressAlongTrack / totalTrackLengthM) * 100)).toFixed(1))
    : 0;
  const remainingMeters = Number(Math.max(0, totalTrackLengthM - bestProgressAlongTrack).toFixed(1));

  return {
    crossTrackDistanceMeters: roundedDistance,
    nearestPoint: bestNearestPoint,
    segmentIndex: nearestSegmentIndex,
    side: bestSide,
    isOffTrack: roundedDistance > corridorWidthMeters,
    progressMeters: roundedProgress,
    progressPercentage,
    remainingMeters,
  };
}

/**
 * Оценка соответствия направления движения туриста нитке маршрута
 * Вычисляет разность азимутов с учетом перехода 0°/360° и скорости движения
 */
export function evaluateMovementDirection(
  hikerBearing: number,
  routeSegmentBearing: number,
  speedMps = 0
): DirectionEvaluation {
  const normHiker = ((hikerBearing % 360) + 360) % 360;
  const normRoute = ((routeSegmentBearing % 360) + 360) % 360;

  const rawDiff = Math.abs(normHiker - normRoute) % 360;
  const bearingDeltaDeg = Number((rawDiff > 180 ? 360 - rawDiff : rawDiff).toFixed(1));

  // Если турист стоит на месте или движется со скоростью ниже порога шума GNSS (<0.3 м/с)
  const isStationary = speedMps < 0.3;
  const confidence = isStationary ? 0 : Number(Math.min(1, speedMps / 1.2).toFixed(2));

  let directionStatus: 'ALIGNED' | 'PERPENDICULAR' | 'REVERSE';
  let isMovingBackwards = false;

  if (isStationary) {
    directionStatus = 'ALIGNED';
    isMovingBackwards = false;
  } else if (bearingDeltaDeg > 120) {
    directionStatus = 'REVERSE';
    isMovingBackwards = true;
  } else if (bearingDeltaDeg > 60) {
    directionStatus = 'PERPENDICULAR';
    isMovingBackwards = false;
  } else {
    directionStatus = 'ALIGNED';
    isMovingBackwards = false;
  }

  return {
    routeBearingDeg: Number(normRoute.toFixed(1)),
    hikerBearingDeg: Number(normHiker.toFixed(1)),
    bearingDeltaDeg,
    directionStatus,
    isMovingBackwards,
    confidence,
  };
}

/**
 * Комплексный анализ навигационного статуса туриста на маршруте
 */
export function analyzeRouteNavigation(
  hikerLocation: { latitude: number; longitude: number; heading?: number; speed?: number },
  routePath: [number, number][],
  options: { corridorWidthMeters?: number } = {}
): RouteNavigationAnalysis {
  const corridorWidthMeters = options.corridorWidthMeters ?? 50;
  const crossTrack = calculateCrossTrackDistance(
    [hikerLocation.latitude, hikerLocation.longitude],
    routePath,
    corridorWidthMeters
  );

  let routeSegmentBearing = 0;
  if (routePath.length >= 2) {
    const segIdx = Math.min(crossTrack.segmentIndex, routePath.length - 2);
    routeSegmentBearing = calculateBearing(routePath[segIdx], routePath[segIdx + 1]);
  }

  const hikerHeading = hikerLocation.heading ?? routeSegmentBearing;
  const direction = evaluateMovementDirection(
    hikerHeading,
    routeSegmentBearing,
    hikerLocation.speed ?? 0
  );

  // Расчет оставшегося ходового времени по темпу (средняя пешая скорость 4 км/ч = 1.11 м/с)
  const effectiveSpeedMps = (hikerLocation.speed && hikerLocation.speed > 0.5)
    ? hikerLocation.speed
    : 1.11; // 4.0 км/ч

  const estimatedRemainingMinutes = Math.round((crossTrack.remainingMeters / effectiveSpeedMps) / 60);
  const currentPaceKmH = Number(((hikerLocation.speed ?? 1.11) * 3.6).toFixed(1));

  const alerts: string[] = [];
  if (crossTrack.isOffTrack) {
    const sideRu = crossTrack.side === 'LEFT' ? 'влево' : crossTrack.side === 'RIGHT' ? 'вправо' : '';
    alerts.push(`Сход с нитки трека на ${Math.round(crossTrack.crossTrackDistanceMeters)} м ${sideRu}`.trim());
  }
  if (direction.isMovingBackwards && direction.confidence > 0.4) {
    alerts.push(`Внимание: движение вспять (разворот на ${Math.round(direction.bearingDeltaDeg)}° против трека)`);
  }

  return {
    crossTrack,
    direction,
    estimatedRemainingMinutes,
    currentPaceKmH,
    alerts,
  };
}

/**
 * Расчет базовых характеристик маршрута: дистанция, перепад высот и время прохождения (правило Найсмита)
 */
export function calculateRouteStats(
  path: [number, number][],
  knownAscent?: number
): { distance: string; time: string; altitude: string; distanceKm: number; ascentM: number } {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += haversineDistance(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
  }

  // Расчет высотного набора: если передан точный расчет DEM, используем его, иначе реалистичную топографическую оценку
  let ascentM = 0;
  if (typeof knownAscent === 'number' && knownAscent > 0) {
    ascentM = Math.round(knownAscent);
  } else {
    // Топографическая формула оценки для среднегорного рельефа
    ascentM = Math.round(totalDistance * 42 + path.length * 8);
  }

  // Правило Найсмита для горных походов: 4 км/ч по горизонтали + 1 час на каждые 350-400 м подъема
  const baseHours = totalDistance / 4.0;
  const ascentHours = ascentM / 380;
  const totalHours = baseHours + ascentHours;
  
  const hours = Math.floor(totalHours);
  const minutes = Math.floor((totalHours - hours) * 60);

  let timeString: string;
  if (totalHours > 24) {
    const days = Math.floor(totalHours / 7); // 7 часов активного ходового времени в день
    timeString = `${days}-${days + 1} дн`;
  } else if (hours > 0 && minutes > 15) {
    timeString = `${hours}-${hours + 1} ч`;
  } else if (hours > 0) {
    timeString = `~${hours} ч`;
  } else {
    timeString = `~${Math.max(10, minutes)} мин`;
  }

  return {
    distance: `${totalDistance.toFixed(1)} км`,
    time: timeString,
    altitude: `+${ascentM} м`,
    distanceKm: Number(totalDistance.toFixed(2)),
    ascentM,
  };
}

