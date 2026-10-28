/**
 * @fileoverview Real Offline Map Tile Caching via CacheStorage API
 * Downloads and caches actual raster map tiles for designated hiking zones.
 */

export const TILE_CACHE_NAME = 'treeline-offline-tiles-v1';
const OFFLINE_META_KEY = 'treeline_offline_map_meta';

export interface OfflineMapMeta {
  center: [number, number];
  zoomLevels: number[];
  tileCount: number;
  downloadedAt: number;
  sizeBytesEstimate: number;
}

export interface DownloadProgress {
  current: number;
  total: number;
  percent: number;
}

function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number): number {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

/**
 * Registers the Service Worker to intercept tile requests offline
 */
export function registerOfflineServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('Offline tile ServiceWorker registration failed:', err);
      });
  }
}

/**
 * Checks if offline map tiles have already been cached
 */
export function getOfflineMapMetadata(): OfflineMapMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OFFLINE_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Downloads actual map tiles around the given coordinate and saves to CacheStorage
 */
export async function downloadAreaMapTiles(
  centerLat: number,
  centerLon: number,
  onProgress?: (progress: DownloadProgress) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { success: false, count: 0, error: 'CacheStorage API is not supported in this environment' };
  }

  // Register service worker so offline requests will hit the cache
  registerOfflineServiceWorker();

  const zoomLevels = [12, 13, 14];
  const delta = 0.04; // ~4.5km bounding box around center

  const tileUrls: string[] = [];
  const subdomains = ['a', 'b', 'c'];
  let subIndex = 0;

  for (const z of zoomLevels) {
    const minX = lon2tile(centerLon - delta, z);
    const maxX = lon2tile(centerLon + delta, z);
    const minY = lat2tile(centerLat + delta, z);
    const maxY = lat2tile(centerLat - delta, z);

    for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
      for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
        const sub = subdomains[subIndex % subdomains.length];
        subIndex++;
        // Standard OSM tile URL
        tileUrls.push(`https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }

  const total = tileUrls.length;
  let successful = 0;

  try {
    const cache = await caches.open(TILE_CACHE_NAME);

    // Download in chunks of 4 parallel requests to respect network and rate limits
    const chunkSize = 4;
    for (let i = 0; i < tileUrls.length; i += chunkSize) {
      const chunk = tileUrls.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (url) => {
          try {
            // Check if already in cache
            const matched = await cache.match(url);
            if (!matched) {
              const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
              if (res.ok) {
                await cache.put(url, res);
              }
            }
            successful++;
          } catch (e) {
            console.warn('Failed to pre-cache tile:', url, e);
          }
        })
      );

      if (onProgress) {
        onProgress({
          current: Math.min(successful, total),
          total,
          percent: Math.round((Math.min(successful, total) / total) * 100),
        });
      }
    }

    const meta: OfflineMapMeta = {
      center: [centerLat, centerLon],
      zoomLevels,
      tileCount: successful,
      downloadedAt: Date.now(),
      sizeBytesEstimate: successful * 15000, // Average 15KB per raster tile
    };

    localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(meta));
    return { success: true, count: successful };
  } catch (err) {
    console.error('Error caching map tiles:', err);
    return { success: false, count: successful, error: String(err) };
  }
}
