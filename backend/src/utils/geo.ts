/**
 * @fileoverview Geodesic & Spatial Math Utilities
 * Implements Haversine distance, cross-track error, bearing, and point-in-polygon ray casting.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number | null;
}

const EARTH_RADIUS_METERS = 6371000;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates Great-Circle distance in meters using the Haversine formula.
 */
export function haversineDistance(p1: GeoPoint, p2: GeoPoint): number {
  const dLat = toRadians(p2.latitude - p1.latitude);
  const dLon = toRadians(p2.longitude - p1.longitude);
  const lat1 = toRadians(p1.latitude);
  const lat2 = toRadians(p2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates initial forward azimuth/bearing in degrees (0..360).
 */
export function calculateBearing(start: GeoPoint, end: GeoPoint): number {
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);
  const dLon = toRadians(end.longitude - start.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let brng = Math.atan2(y, x);
  brng = toDegrees(brng);
  return (brng + 360) % 360;
}

/**
 * Calculates cross-track distance (perpendicular distance) from a point to a path.
 */
export function evaluateCrossTrack(
  point: GeoPoint,
  path: [number, number, number?][]
): {
  crossTrackDistanceMeters: number;
  nearestPoint: [number, number];
  segmentIndex: number;
  progressMeters: number;
  remainingMeters: number;
  totalDistanceMeters: number;
} {
  if (path.length === 0) {
    return {
      crossTrackDistanceMeters: 0,
      nearestPoint: [point.latitude, point.longitude],
      segmentIndex: 0,
      progressMeters: 0,
      remainingMeters: 0,
      totalDistanceMeters: 0,
    };
  }

  if (path.length === 1) {
    const dist = haversineDistance(point, { latitude: path[0][0], longitude: path[0][1] });
    return {
      crossTrackDistanceMeters: dist,
      nearestPoint: [path[0][0], path[0][1]],
      segmentIndex: 0,
      progressMeters: 0,
      remainingMeters: 0,
      totalDistanceMeters: 0,
    };
  }

  // Calculate cumulative distance along path
  const cumulativeDistances: number[] = [0];
  for (let i = 0; i < path.length - 1; i++) {
    const d = haversineDistance(
      { latitude: path[i][0], longitude: path[i][1] },
      { latitude: path[i + 1][0], longitude: path[i + 1][1] }
    );
    cumulativeDistances.push(cumulativeDistances[i] + d);
  }
  const totalDistanceMeters = cumulativeDistances[cumulativeDistances.length - 1];

  let minDistance = Infinity;
  let nearestSegmentIndex = 0;
  let nearestPoint: [number, number] = [path[0][0], path[0][1]];
  let progressAlongNearestSegment = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const pA = { latitude: path[i][0], longitude: path[i][1] };
    const pB = { latitude: path[i + 1][0], longitude: path[i + 1][1] };

    // Planar projection approximation for close segment
    const segmentLen = haversineDistance(pA, pB);
    if (segmentLen === 0) continue;

    const distA = haversineDistance(point, pA);
    const distB = haversineDistance(point, pB);

    // Projection scalar t on line AB
    // t = ((P - A) . (B - A)) / |B - A|^2
    // Using spherical cosine triangle:
    const t = Math.max(0, Math.min(1, (distA * distA - distB * distB + segmentLen * segmentLen) / (2 * segmentLen * segmentLen)));

    const projLat = pA.latitude + t * (pB.latitude - pA.latitude);
    const projLon = pA.longitude + t * (pB.longitude - pA.longitude);
    const distToProj = haversineDistance(point, { latitude: projLat, longitude: projLon });

    if (distToProj < minDistance) {
      minDistance = distToProj;
      nearestSegmentIndex = i;
      nearestPoint = [projLat, projLon];
      progressAlongNearestSegment = t * segmentLen;
    }
  }

  const progressMeters = cumulativeDistances[nearestSegmentIndex] + progressAlongNearestSegment;
  const remainingMeters = Math.max(0, totalDistanceMeters - progressMeters);

  return {
    crossTrackDistanceMeters: Math.round(minDistance * 10) / 10,
    nearestPoint,
    segmentIndex: nearestSegmentIndex,
    progressMeters: Math.round(progressMeters),
    remainingMeters: Math.round(remainingMeters),
    totalDistanceMeters: Math.round(totalDistanceMeters),
  };
}

/**
 * Checks if a point is inside a polygon using ray casting (even-odd rule).
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (polygon.length < 3) return false;

  const lat = point[0];
  const lon = point[1];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = ((yi > lon) !== (yj > lon)) && (lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}
