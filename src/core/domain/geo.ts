/**
 * @fileoverview Pure Geodesic and Privacy Obfuscation Algorithms
 * Complies with Threat Model and Low-Power Edge Constraints
 */

import type { GeoPoint, LocationUpdate, PrivacyMode } from './types';

/**
 * Calculates great-circle distance between two points using the Haversine formula in meters.
 */
export function calculateDistanceHaversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
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
 * Calculates initial bearing from point 1 to point 2 in degrees (0..360).
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (theta * 180 / Math.PI + 360) % 360;
}

/**
 * Formats decimal degrees into standard Russian navigational format:
 * e.g., "43.3550° с.ш., 42.4392° в.д."
 */
export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'с.ш.' : 'ю.ш.';
  const lonDir = lon >= 0 ? 'в.д.' : 'з.д.';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

/**
 * Parses coordinate string back to [lat, lon] tuple or null if invalid.
 */
export function parseCoordinates(coordString: string): [number, number] | null {
  if (!coordString) return null;
  const numbers = coordString.match(/[-+]?\d*\.?\d+/g);
  if (!numbers || numbers.length < 2) return null;

  let lat = parseFloat(numbers[0]);
  let lon = parseFloat(numbers[1]);

  if (isNaN(lat) || isNaN(lon)) return null;

  if (coordString.includes('ю.ш.') || coordString.toLowerCase().includes('s')) {
    lat = -Math.abs(lat);
  }
  if (coordString.includes('з.д.') || coordString.toLowerCase().includes('w')) {
    lon = -Math.abs(lon);
  }

  return [lat, lon];
}

/**
 * Applies privacy obfuscation to coordinates according to privacy mode.
 * - NORMAL: Full GPS precision (~5 decimal places / ~1m).
 * - REDUCED: Precision truncated to 2 decimal places (~1.1 km grid) for regional awareness without tracking.
 * - STEALTH: Strips location completely or throws error on transmission.
 */
export function applyPrivacyMode(
  location: LocationUpdate,
  mode: PrivacyMode
): LocationUpdate | null {
  if (mode === 'STEALTH') {
    return null; // Suppress coordinate broadcasting
  }

  if (mode === 'REDUCED') {
    return {
      ...location,
      latitude: Math.round(location.latitude * 100) / 100,
      longitude: Math.round(location.longitude * 100) / 100,
      altitude: undefined,
      accuracy: 1000, // 1 km radius uncertainty
      speed: undefined,
      heading: undefined,
      privacyMode: 'REDUCED',
    };
  }

  return {
    ...location,
    privacyMode: 'NORMAL',
  };
}

/**
 * Calculates bounding box for a set of points [[lat, lon], ...]
 */
export function calculateBoundingBox(points: [number, number][]): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} | null {
  if (!points || points.length === 0) return null;

  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLon = points[0][1];
  let maxLon = points[0][1];

  for (let i = 1; i < points.length; i++) {
    const [lat, lon] = points[i];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  return { minLat, maxLat, minLon, maxLon };
}
