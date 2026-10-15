/**
 * @fileoverview Location Filter Engine (Deadband, Throttle, Geofence Safe Radius)
 * Conforms to FR-002, FR-006, NFR-007, NFR-008, and UC-02
 */

import { encodeGeohash } from './geohash';
import { AuditLogger } from '../transport/audit-logger';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  batteryLevel?: number;
  timestamp?: number;
}

export interface GeofenceEvaluation {
  status: 'INSIDE' | 'WARNING' | 'BREACH';
  distanceMeters: number;
  safeRadiusMeters: number;
  deviationMeters: number; // positive if breached
  message: string;
}

export interface LocationFilterConfig {
  deadbandMeters?: number; // Minimum movement distance required to transmit (default: 5m)
  minIntervalMs?: number;   // Minimum time elapsed required to transmit (default: 5000ms)
  adaptiveBatterySavings?: boolean; // Increases interval if battery is low
}

/**
 * Calculates Great-Circle distance between two coordinates in meters (Haversine formula)
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class LocationFilter {
  private lastTransmittedLocation: LocationCoordinates | null = null;
  private lastTransmittedTimestamp = 0;
  private deadbandMeters: number;
  private minIntervalMs: number;
  private adaptiveBattery: boolean;

  constructor(config: LocationFilterConfig = {}) {
    this.deadbandMeters = config.deadbandMeters ?? 5; // 5 meters default deadband
    this.minIntervalMs = config.minIntervalMs ?? 5000; // 5 seconds default throttle
    this.adaptiveBattery = config.adaptiveBatterySavings ?? true;
  }

  /**
   * Evaluates if a raw location sample should be transmitted or filtered out (Deadband + Throttle)
   */
  public evaluateTransmission(
    incoming: LocationCoordinates,
    isEmergency = false
  ): { shouldTransmit: boolean; reason: 'OK' | 'DEADBAND_FILTERED' | 'THROTTLED'; distanceMoved: number } {
    const now = incoming.timestamp ?? Date.now();

    // Emergency / SOS signals ALWAYS bypass all filters
    if (isEmergency) {
      this.lastTransmittedLocation = incoming;
      this.lastTransmittedTimestamp = now;
      return { shouldTransmit: true, reason: 'OK', distanceMoved: 0 };
    }

    if (!this.lastTransmittedLocation) {
      this.lastTransmittedLocation = incoming;
      this.lastTransmittedTimestamp = now;
      return { shouldTransmit: true, reason: 'OK', distanceMoved: 0 };
    }

    const distanceMoved = calculateHaversineDistanceMeters(
      this.lastTransmittedLocation.latitude,
      this.lastTransmittedLocation.longitude,
      incoming.latitude,
      incoming.longitude
    );

    // 1. Deadband check: has user moved enough?
    if (distanceMoved < this.deadbandMeters) {
      return { shouldTransmit: false, reason: 'DEADBAND_FILTERED', distanceMoved };
    }

    // 2. Throttle check: has enough time elapsed?
    let dynamicMinInterval = this.minIntervalMs;
    if (this.adaptiveBattery && incoming.batteryLevel !== undefined) {
      if (incoming.batteryLevel <= 15) {
        dynamicMinInterval = Math.max(dynamicMinInterval, 30000); // 30s in critical battery mode
      } else if (incoming.batteryLevel <= 30) {
        dynamicMinInterval = Math.max(dynamicMinInterval, 15000); // 15s in low battery mode
      }
    }

    const elapsed = now - this.lastTransmittedTimestamp;
    if (elapsed < dynamicMinInterval) {
      return { shouldTransmit: false, reason: 'THROTTLED', distanceMoved };
    }

    // Passed both filters
    this.lastTransmittedLocation = incoming;
    this.lastTransmittedTimestamp = now;
    return { shouldTransmit: true, reason: 'OK', distanceMoved };
  }

  /**
   * Resets filter internal state
   */
  public reset() {
    this.lastTransmittedLocation = null;
    this.lastTransmittedTimestamp = 0;
  }

  /**
   * Evaluates participant distance against a safe geofence radius (UC-02)
   */
  public static evaluateGeofence(
    hikerLocation: { latitude: number; longitude: number; name?: string },
    anchorLocation: { latitude: number; longitude: number },
    safeRadiusMeters = 500
  ): GeofenceEvaluation {
    const distanceMeters = calculateHaversineDistanceMeters(
      hikerLocation.latitude,
      hikerLocation.longitude,
      anchorLocation.latitude,
      anchorLocation.longitude
    );

    const deviationMeters = distanceMeters - safeRadiusMeters;

    if (deviationMeters > 0) {
      const message = `Внимание: участник ${hikerLocation.name || 'Турист'} покинул безопасную зону на ${Math.round(deviationMeters)} м (дистанция: ${Math.round(distanceMeters)} м, лимит: ${safeRadiusMeters} м)`;
      AuditLogger.log('SECURITY', `[ГЕОЗОНА] ВЫХОД ИЗ БЕЗОПАСНОГО РАДИУСА: ${message}`);
      return {
        status: 'BREACH',
        distanceMeters,
        safeRadiusMeters,
        deviationMeters,
        message,
      };
    }

    if (distanceMeters > safeRadiusMeters * 0.85) {
      const message = `Предупреждение: участник ${hikerLocation.name || 'Турист'} приближается к границе зоны (${Math.round(distanceMeters)} м / ${safeRadiusMeters} м)`;
      return {
        status: 'WARNING',
        distanceMeters,
        safeRadiusMeters,
        deviationMeters: 0,
        message,
      };
    }

    return {
      status: 'INSIDE',
      distanceMeters,
      safeRadiusMeters,
      deviationMeters: 0,
      message: `В пределах безопасного радиуса (${Math.round(distanceMeters)} м)`,
    };
  }

  /**
   * Generates geohash spatial token for location
   */
  public static getGeohash(latitude: number, longitude: number, precision = 9): string {
    return encodeGeohash(latitude, longitude, precision);
  }
}
