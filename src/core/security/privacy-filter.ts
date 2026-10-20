/**
 * @fileoverview Privacy Filter for Geodata Obfuscation
 * Conforms to ADR-003 and docs/04-security/privacy.md
 */

import { LocationUpdate, PrivacyMode } from '../domain/types';

export class PrivacyFilter {
  // 0.002 degrees latitude is approx 220 meters at mid-latitudes
  private static readonly GRID_STEP_DEGREES = 0.002;

  /**
   * Applies privacy filtering transformations to a location update.
   * In EMERGENCY mode (or when location.isEmergency is true), stealth/reduced modes
   * are overridden to broadcast full GNSS accuracy for Search & Rescue.
   */
  static apply(location: LocationUpdate, mode: PrivacyMode = location.privacyMode): LocationUpdate | null {
    // Emergency / SOS safety override per docs/04-security/privacy.md
    if (mode === 'EMERGENCY' || location.isEmergency) {
      return {
        ...location,
        privacyMode: 'EMERGENCY',
        isEmergency: true,
      };
    }

    switch (mode) {
      case 'NORMAL':
        return {
          ...location,
          privacyMode: 'NORMAL',
        };

      case 'REDUCED': {
        // Discretize lat and lon to privacy grid (~200m)
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
        // In stealth mode without emergency, location is withheld from peer broadcasts
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
