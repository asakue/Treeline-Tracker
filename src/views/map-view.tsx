'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useAppContext } from '@/entities/app';
import { 
  createStartPopupContent, 
  createEndPopupContent, 
  createRemoveOverlayControl,
  createHikerPopupContent,
  DefaultIcon,
  HikerIcon,
} from '@/shared/lib/map-utils';
import { useRoutes } from '@/entities/route';
import type { Group } from '@/entities/group';

export default function MapView({ centerOn }: { centerOn?: [number, number] }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlaysRef = useRef<Map<string, L.Layer>>(new Map());
  const drawnRoutesRef = useRef<Map<string, L.Layer>>(new Map());
  const drawnHikersRef = useRef<Map<string, L.Layer>>(new Map());

  const { setView, mapOverlays, removeMapOverlay, activeGroupId, groupsHook } = useAppContext();
  const { routes } = useRoutes();
  const { groups } = groupsHook;
  const activeGroup = groups.find(g => g.id === activeGroupId);

  // Initialize map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
        const center: [number, number] = [43.5, 42]; // Centered around the Caucasus
        
        const mapInstance = L.map(mapContainerRef.current!, { attributionControl: false }).setView(center, 8);
        mapRef.current = mapInstance;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle drawing routes on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routes) return;
    
    const currentRouteIds = new Set(routes.map(r => r.id));

    drawnRoutesRef.current.forEach((layer, id) => {
      if (!currentRouteIds.has(id)) {
        map.removeLayer(layer);
        drawnRoutesRef.current.delete(id);
      }
    });

    routes.forEach((route) => {
       const isRouteInActiveGroup = activeGroup?.routeId === route.id;
       const routeOptions = {
         color: isRouteInActiveGroup ? 'hsl(var(--accent))' : 'hsl(var(--primary))',
         weight: isRouteInActiveGroup ? 5 : 3,
         opacity: isRouteInActiveGroup ? 0.9 : 0.6,
       };

       // If route exists, just update its style if its active status changed
       if (drawnRoutesRef.current.has(route.id)) {
         const layer = drawnRoutesRef.current.get(route.id);
         if (layer instanceof L.Polyline) {
            layer.setStyle(routeOptions);
         } else if (layer instanceof L.LayerGroup) {
            layer.eachLayer(l => {
              if (l instanceof L.Polyline) {
                l.setStyle(routeOptions);
              }
            })
         }
       } else { // Otherwise, create the new route layer
          if (route.path && route.path.length > 0) {
            const routeLayers = L.layerGroup();
            
            const polyline = L.polyline(route.path, routeOptions);
            routeLayers.addLayer(polyline);

            const startPopupContent = createStartPopupContent(route, setView);
            const startMarker = L.marker(route.path[0], { icon: DefaultIcon }).bindPopup(startPopupContent);
            routeLayers.addLayer(startMarker);
              
            if (route.path.length > 1) {
              const endPopupContent = createEndPopupContent(route, mapRef);
              const endMarker = L.marker(route.path[route.path.length - 1], { icon: DefaultIcon }).bindPopup(endPopupContent);
              routeLayers.addLayer(endMarker);
            }
            
            routeLayers.addTo(map);
            drawnRoutesRef.current.set(route.id, routeLayers);
          }
       }
    });

  }, [routes, setView, activeGroup]);

  // Handle drawing hikers on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    const activeHikers = activeGroup?.hikers || [];
    const activeHikerIds = new Set(activeHikers.map(h => h.id));

    // Remove markers for hikers no longer in the active group
    drawnHikersRef.current.forEach((layer, id) => {
        if (!activeHikerIds.has(id)) {
            map.removeLayer(layer);
            drawnHikersRef.current.delete(id);
        }
    });

    // Add/update markers for hikers in the active group
    activeHikers.forEach(hiker => {
        const coordsStr = hiker.coords;
        const parts = coordsStr.replace(/° с\.ш\.,?|° в\.д\./g, '').split(/,?\s+/);
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);

          if (!isNaN(lat) && !isNaN(lon)) {
            const position: [number, number] = [lat, lon];
            const popupContent = createHikerPopupContent(hiker, activeGroup as Group, setView);

            if (drawnHikersRef.current.has(hiker.id)) {
                // Update existing marker
                const marker = drawnHikersRef.current.get(hiker.id) as L.Marker;
                marker.setLatLng(position);
                marker.setPopupContent(popupContent);
            } else {
                // Create new marker
                const marker = L.marker(position, { icon: HikerIcon })
                    .bindPopup(popupContent)
                    .addTo(map);
                drawnHikersRef.current.set(hiker.id, marker);
            }
          }
        }
    });
  }, [activeGroup, setView]);


  // Handle centering the map on a specific point
  useEffect(() => {
    if (mapRef.current && centerOn) {
        mapRef.current.setView(centerOn, 13);
    }
  }, [centerOn]);

  // Handle adding/removing overlays like search areas
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentOverlayIds = new Set(mapOverlays.map(o => o.id));

    // Remove overlays that are no longer in the context
    overlaysRef.current.forEach((layer, id) => {
      if (!currentOverlayIds.has(id)) {
        map.removeLayer(layer);
        overlaysRef.current.delete(id);
      }
    });

    // Add new overlays from the context
    mapOverlays.forEach(overlay => {
      if (!overlaysRef.current.has(overlay.id)) {
        if (overlay.type === 'searchArea' && overlay.polygon.length > 0) {
          const polygon = L.polygon(overlay.polygon, {
            color: 'hsl(var(--accent))',
            fillColor: 'hsl(var(--accent))',
            fillOpacity: 0.2,
          });
          
          const bounds = polygon.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
          }

          const removeControl = createRemoveOverlayControl(overlay.id, removeMapOverlay);
          
          const group = L.layerGroup([polygon, removeControl]).addTo(map);
          overlaysRef.current.set(overlay.id, group);
        }
      }
    });

  }, [mapOverlays, removeMapOverlay, setView]);

  return <div ref={mapContainerRef} className="h-full w-full" />;
}
