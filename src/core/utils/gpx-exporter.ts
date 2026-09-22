/**
 * @fileoverview GPX (GPS Exchange Format 1.1) Exporter Utility
 * Complies with TopoGrafix GPX 1.1 Specification.
 */

import type { Route } from '../domain/types';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts an array of Route domain objects into standard GPX 1.1 XML string.
 */
export function generateGpxString(
  routes: Route[],
  options?: {
    appName?: string;
    title?: string;
    author?: string;
  }
): string {
  const appName = options?.appName || 'TreeLine Mountain Safety App';
  const title = options?.title || 'Экспорт маршрутов TreeLine';
  const timeStr = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${escapeXml(appName)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(title)}</name>
    <desc>Экспорт исторических маршрутов и треков</desc>
    <time>${timeStr}</time>
  </metadata>
`;

  for (const route of routes) {
    if (!route.path || route.path.length === 0) continue;

    const altMatch = route.altitude ? route.altitude.match(/\d+/) : null;
    const defaultElevation = altMatch ? altMatch[0] : null;
    const desc = [
      route.location ? `Локация: ${route.location}` : '',
      route.difficulty ? `Сложность: ${route.difficulty}` : '',
      route.distance ? `Дистанция: ${route.distance}` : '',
      route.time ? `Время в пути: ${route.time}` : '',
      route.isArchived ? '(В архиве)' : '',
    ]
      .filter(Boolean)
      .join(' | ');

    xml += `  <trk>
    <name>${escapeXml(route.name || 'Маршрут')}</name>
    <desc>${escapeXml(desc)}</desc>
    <type>${escapeXml(route.type || 'Hiking')}</type>
    <trkseg>
`;

    for (const point of route.path) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const [lat, lon] = point;
      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) continue;

      xml += `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">`;
      if (defaultElevation) {
        xml += `<ele>${defaultElevation}</ele>`;
      }
      xml += `</trkpt>\n`;
    }

    xml += `    </trkseg>
  </trk>
`;
  }

  xml += `</gpx>`;
  return xml;
}

/**
 * Triggers a client-side file download of GPX data in browser environment.
 */
export function downloadGpx(
  gpxContent: string,
  filename = `treeline-routes-${new Date().toISOString().slice(0, 10)}.gpx`
): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * High-level helper to generate and instantly download GPX file for given routes.
 */
export function exportRoutesAsGpx(routes: Route[], filename?: string): void {
  const gpx = generateGpxString(routes);
  downloadGpx(gpx, filename);
}
