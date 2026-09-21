import L from 'leaflet';

export interface MapLayerConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
  isTopographic?: boolean;
}

export const MAP_LAYERS: Record<string, MapLayerConfig> = {
  opentopomap: {
    id: 'opentopomap',
    name: 'OpenTopoMap (Рельеф и высоты)',
    description: 'Топографическая карта с изолиниями высот, отмывкой рельефа SRTM, вершинами и тропами',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Карта: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>), Данные: &copy; <a href="https://openstreetmap.org/copyright">OSM</a>, SRTM',
    maxZoom: 17,
    subdomains: ['a', 'b', 'c'],
    isTopographic: true,
  },
  cyclosm: {
    id: 'cyclosm',
    name: 'CyclOSM (Пешеходные тропы и грунтовки)',
    description: 'Выделенные тропы, классификация горных маршрутов (sac_scale), грунтовые дороги и укрытия',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.cyclosm.org">CyclOSM</a> | Данные: &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
    subdomains: ['a', 'b', 'c'],
    isTopographic: true,
  },
  osmStandard: {
    id: 'osmStandard',
    name: 'OpenStreetMap (Стандартная)',
    description: 'Базовая векторная карта OpenStreetMap общего назначения',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    isTopographic: false,
  },
};

export const createTileLayer = (layerId: keyof typeof MAP_LAYERS = 'opentopomap'): L.TileLayer => {
  const config = MAP_LAYERS[layerId] || MAP_LAYERS.opentopomap;
  return L.tileLayer(config.url, {
    attribution: config.attribution,
    maxZoom: config.maxZoom,
    subdomains: config.subdomains || ['a', 'b', 'c'],
  });
};
