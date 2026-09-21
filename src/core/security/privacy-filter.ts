/**
 * @fileoverview Privacy Filter for Geodata Obfuscation
 * Conforms to ADR-003 and docs/04-security/privacy.md
 */

import { LocationUpdate, PrivacyMode } from '../domain/types';

export class PrivacyFilter {
  // 0.002 degrees latitude is approx 220 meters at mid-latitudes
  private static readonly GRID_STEP_DEGREES = 0.002;

  /**
   * Applies privacy filtering transformations to a location update
   */
  static apply(location: LocationUpdate, mode: PrivacyMode = location.privacyMode): LocationUpdate | null {
    switch (mode) {
      case 'NORMAL':
        return {
          ...location,
          privacyMode: 'NORMAL',
        };

      case 'REDUCED': {
        // Discretize lat and lon to privacy grid
        const obfuscatedLat =
          Math.round(location.latitude / this.GRID_STEP_DEGREES) * this.GRID_STEP_DEGREES;
        const obfuscatedLon =
          Math.round(location.longitude / this.GRID_STEP_DEGREES) * this.GRID_STEP_DEGREES;

        return {
          ...location,
          latitude: Number(obfuscatedLat.toFixed(4)),
          longitude: Number(obfuscatedLon.toFixed(4)),
          accuracy: Math.max(location.accuracy ?? 0, 200),
          altitude: undefined, // Strip altitude to prevent elevation fingerprinting
          speed: undefined,    // Strip micro-movement speeds
          heading: undefined,  // Strip bearing/orientation
          privacyMode: 'REDUCED',
        };
      }

      case 'STEALTH':
        // In stealth mode, location is withheld from peer broadcasts
        return null;

      default:
        return location;
    }
  }

  /**
   * Checks if an update is allowed to be transmitted over public/mesh transport
   */
  static isBroadcastAllowed(mode: PrivacyMode): boolean {
    return mode !== 'STEALTH';
  }
}
