/**
 * Расчет характеристик маршрута и навигационный анализ
 * Реэкспорт из единого доменного источника @/entities/route
 */

export {
  calculateRouteStats,
  calculateBearing,
  calculateCrossTrackDistance,
  evaluateMovementDirection,
  analyzeRouteNavigation,
  haversineDistance,
} from '@/entities/route';
