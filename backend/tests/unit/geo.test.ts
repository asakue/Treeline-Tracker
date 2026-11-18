/**
 * @fileoverview Unit Tests for Geodesic and Spatial Math
 */

import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  calculateBearing,
  evaluateCrossTrack,
  isPointInPolygon,
} from '../../src/utils/geo.js';

describe('Geospatial Math Unit Tests', () => {
  it('accurately calculates Haversine distance between two coordinates', () => {
    // Distance between Moscow and St. Petersburg (~634 km)
    const moscow = { latitude: 55.7558, longitude: 37.6173 };
    const spb = { latitude: 59.9343, longitude: 30.3351 };

    const distMeters = haversineDistance(moscow, spb);
    const distKm = distMeters / 1000;

    expect(distKm).toBeGreaterThan(620);
    expect(distKm).toBeLessThan(645);
  });

  it('calculates forward bearing between points', () => {
    const origin = { latitude: 43.0, longitude: 42.0 };
    const north = { latitude: 44.0, longitude: 42.0 };
    const east = { latitude: 43.0, longitude: 43.0 };

    const bearingNorth = calculateBearing(origin, north);
    expect(Math.round(bearingNorth)).toBe(0);

    const bearingEast = calculateBearing(origin, east);
    expect(Math.round(bearingEast)).toBe(90);
  });

  it('evaluates cross-track error for point along a path', () => {
    const path: [number, number, number?][] = [
      [43.0, 42.0],
      [43.0, 42.1],
      [43.0, 42.2],
    ];

    // Point exactly on the path
    const onTrack = evaluateCrossTrack({ latitude: 43.0, longitude: 42.05 }, path);
    expect(onTrack.crossTrackDistanceMeters).toBeLessThan(10);
    expect(onTrack.progressMeters).toBeGreaterThan(0);

    // Point offset by ~1.1 km north
    const offTrack = evaluateCrossTrack({ latitude: 43.01, longitude: 42.05 }, path);
    expect(offTrack.crossTrackDistanceMeters).toBeGreaterThan(1000);
    expect(offTrack.crossTrackDistanceMeters).toBeLessThan(1200);
  });

  it('tests point in polygon via ray casting', () => {
    const square: [number, number][] = [
      [10, 10],
      [10, 20],
      [20, 20],
      [20, 10],
    ];

    expect(isPointInPolygon([15, 15], square)).toBe(true);
    expect(isPointInPolygon([5, 15], square)).toBe(false);
    expect(isPointInPolygon([25, 25], square)).toBe(false);
  });
});
