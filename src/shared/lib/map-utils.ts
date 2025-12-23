import L from 'leaflet';
import type { Route } from '@/entities/route';
import type { Hiker, Group } from '@/entities/group';
import type { View } from '@/entities/app';

// Default Leaflet icon setup
export const DefaultIcon = L.icon({
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

export const HikerIcon = L.icon({
  iconUrl: '/hiker-icon.svg',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

// Helper to create the content for a route's starting point popup
export const createStartPopupContent = (
  route: Route,
  setView: (view: View, props?: any) => void
) => {
  const container = L.DomUtil.create('div', 'space-y-1');
  const title = L.DomUtil.create('div', 'font-bold text-base', container);
  title.innerText = `${route.name} (старт)`;

  L.DomUtil.create('div', 'text-sm', container).innerText = `Сложность: ${route.difficulty}`;
  L.DomUtil.create('div', 'text-sm', container).innerText = `Расстояние: ${route.distance}`;
  L.DomUtil.create('div', 'text-sm', container).innerText = `Время: ${route.time}`;
  L.DomUtil.create('div', 'text-sm', container).innerText = `Высота: ${route.altitude}`;
  
  return container;
};

// Helper to create the content for a route's ending point popup
export const createEndPopupContent = (route: Route, mapRef: React.MutableRefObject<L.Map | null>) => {
  const container = L.DomUtil.create('div');
  L.DomUtil.create('div', 'font-bold text-base', container).innerText = `${route.name} (финиш)`;
  
  const button = L.DomUtil.create('button', 'text-blue-600 hover:underline cursor-pointer mt-2 text-left', container);
  button.innerText = "К началу маршрута";
  L.DomEvent.on(button, 'click', () => {
    if (mapRef.current && route.path.length > 0) {
        mapRef.current.setView(route.path[0], 13);
    }
  });

  return container;
};

export const createHikerPopupContent = (
  hiker: Hiker,
  group: Group,
  setView: (view: View, props?: any) => void
) => {
  const container = L.DomUtil.create('div', 'space-y-1');
  const title = L.DomUtil.create('div', 'font-bold text-base', container);
  title.innerText = hiker.name;
  
  L.DomUtil.create('div', 'text-sm', container).innerText = `Статус: ${hiker.status}`;
  L.DomUtil.create('div', 'text-sm', container).innerText = `Батарея: ${hiker.battery}%`;
  L.DomUtil.create('div', 'text-xs text-gray-500', container).innerText = `Обновлено: ${hiker.lastUpdate}`;
  
  const btn = L.DomUtil.create('button', 'text-blue-600 hover:underline cursor-pointer mt-2 text-left', container);
  btn.innerText = 'Перейти в чат группы';
  L.DomEvent.on(btn, 'click', () => {
    setView('chat', { groupId: group.id });
  });

  return container;
};


// Helper to create the 'remove overlay' button control
export const createRemoveOverlayControl = (id: string, removeMapOverlay: (id: string) => void) => {
  const CustomControl = L.Control.extend({
    onAdd: function(map: L.Map) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      container.style.backgroundColor = 'white';
      container.style.width = '30px';
      container.style.height = '30px';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
      
      L.DomEvent.on(container, 'click', (e) => {
        L.DomEvent.stop(e);
        removeMapOverlay(id);
      });
      
      return container;
    },
    onRemove: function(map: L.Map) {}
  });
  return new CustomControl({ position: 'topright' });
};
