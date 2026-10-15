/**
 * @fileoverview Geohashing Spatial Utility
 * Conforms to geofire-common standard 32-character base32 spatial indexing
 * Matching firebase-blueprint.json Telemetry.geohash schema
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const BITS = [16, 8, 4, 2, 1];

export interface GeohashBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Encodes latitude and longitude into a geohash string
 * @param latitude -90 to 90
 * @param longitude -180 to 180
 * @param precision Character length (1 to 12, default 9: ~4.8m x 4.8m)
 */
export function encodeGeohash(latitude: number, longitude: number, precision = 9): string {
  let isEven = true;
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let bit = 0;
  let ch = 0;
  let geohash = '';

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (longitude >= mid) {
        ch |= BITS[bit];
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        ch |= BITS[bit];
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Decodes a geohash string into bounding coordinates
 */
export function decodeGeohashBbox(geohash: string): GeohashBoundingBox {
  let isEven = true;
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  for (let i = 0; i < geohash.length; i++) {
    const c = geohash[i].toLowerCase();
    const cd = BASE32.indexOf(c);
    if (cd === -1) throw new Error(`Invalid geohash character: ${c}`);

    for (let j = 0; j < 5; j++) {
      const mask = BITS[j];
      if (isEven) {
        const mid = (lngMin + lngMax) / 2;
        if ((cd & mask) !== 0) {
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if ((cd & mask) !== 0) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      isEven = !isEven;
    }
  }

  return { minLat: latMin, maxLat: latMax, minLng: lngMin, maxLng: lngMax };
}

/**
 * Decodes geohash to center coordinate point
 */
export function decodeGeohashCenter(geohash: string): { latitude: number; longitude: number } {
  const bbox = decodeGeohashBbox(geohash);
  return {
    latitude: (bbox.minLat + bbox.maxLat) / 2,
    longitude: (bbox.minLng + bbox.maxLng) / 2,
  };
}
