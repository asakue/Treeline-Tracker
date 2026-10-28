export { useRoutes } from './hooks/use-routes';
export { savedRoutes } from './model/routes-data';
export type { Route, RouteDifficulty } from './model/types';
export {
  calculateRouteStats,
  calculateBearing,
  calculateCrossTrackDistance,
  evaluateMovementDirection,
  analyzeRouteNavigation,
  haversineDistance,
} from './lib/route-calculations';

