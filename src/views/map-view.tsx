'use client';

import { useEffect, useRef, useState } from 'react';
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
import { MAP_LAYERS, createTileLayer } from '@/shared/lib/map-layers';
import { Layers, Mountain, Navigation, Map as MapIcon, ShieldCheck, Lock, Users } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import type { Group } from '@/entities/group';

export default function MapView({ centerOn }: { centerOn?: [number, number] }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const overlayControlsRef = useRef<Map<string, L.Control>>(new Map());
  const drawnRoutesRef = useRef<Map<string, L.Layer>>(new Map());
  const drawnHikersRef = useRef<Map<string, L.Layer>>(new Map());

  const [currentLayerId, setCurrentLayerId] = useState<string>('opentopomap');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);

  const { setView, mapOverlays, removeMapOverlay, activeGroupId, groupsHook, routesHook } = useAppContext();
  const routes = routesHook?.routes || [];
  const { groups } = groupsHook;
  const activeGroup = groups.find(g => g.id === activeGroupId);

  // Initialize map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
        const center: [number, number] = [43.5, 42]; // Centered around the Caucasus
        
        const mapInstance = L.map(mapContainerRef.current!, { 
          attributionControl: true,
          zoomControl: true,
        }).setView(center, 8);
        
        mapRef.current = mapInstance;

        // OpenTopoMap with elevation contours & DEM relief by default
        const initialLayer = createTileLayer('opentopomap');
        initialLayer.addTo(mapInstance);
        activeTileLayerRef.current = initialLayer;
    }

    return () => {
      if (mapRef.current) {
        drawnRoutesRef.current.forEach((layer) => {
          if (layer instanceof L.LayerGroup) {
            layer.clearLayers();
          }
        });
        drawnRoutesRef.current.clear();
        drawnHikersRef.current.clear();

        overlayLayersRef.current.forEach((polygon) => {
          if (mapRef.current && mapRef.current.hasLayer(polygon)) {
            mapRef.current.removeLayer(polygon);
          }
        });
        overlayLayersRef.current.clear();

        overlayControlsRef.current.forEach((control) => {
          control.remove();
        });
        overlayControlsRef.current.clear();

        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch base tile layer (OpenTopoMap / CyclOSM / OSM Standard)
  const handleLayerChange = (layerKey: string) => {
    if (!mapRef.current || currentLayerId === layerKey) return;
    
    if (activeTileLayerRef.current) {
      mapRef.current.removeLayer(activeTileLayerRef.current);
    }

    const newLayer = createTileLayer(layerKey as keyof typeof MAP_LAYERS);
    newLayer.addTo(mapRef.current);
    activeTileLayerRef.current = newLayer;
    setCurrentLayerId(layerKey);
    setShowLayerMenu(false);
  };

  // Handle drawing routes on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    const activeRoutes = (routes || []).filter(r => !r.isArchived);
    const currentRouteIds = new Set(activeRoutes.map(r => r.id));

    // Remove route layers that are no longer in active routes (deleted or archived)
    drawnRoutesRef.current.forEach((layer, id) => {
      if (!currentRouteIds.has(id)) {
        if (layer instanceof L.LayerGroup) {
          layer.clearLayers();
        }
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
        drawnRoutesRef.current.delete(id);
      }
    });

    activeRoutes.forEach((route) => {
       const isRouteInActiveGroup = activeGroup?.routeId === route.id;
       const routeOptions = {
         color: isRouteInActiveGroup ? 'hsl(var(--accent))' : 'hsl(var(--primary))',
         weight: isRouteInActiveGroup ? 5 : 3,
         opacity: isRouteInActiveGroup ? 0.9 : 0.6,
       };

       // If route exists, update its style and path
       if (drawnRoutesRef.current.has(route.id)) {
         const layer = drawnRoutesRef.current.get(route.id);
         if (layer instanceof L.Polyline) {
            layer.setStyle(routeOptions);
            if (route.path) layer.setLatLngs(route.path);
         } else if (layer instanceof L.LayerGroup) {
            layer.eachLayer(l => {
              if (l instanceof L.Polyline) {
                l.setStyle(routeOptions);
                if (route.path) l.setLatLngs(route.path);
              }
            });
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
            if (map.hasLayer(layer)) {
              map.removeLayer(layer);
            }
            drawnHikersRef.current.delete(id);
        }
    });

    // Add/update markers for hikers in the active group
    activeHikers.forEach(hiker => {
        const coordsStr = hiker.coords;
        const matches = coordsStr.match(/[-+]?\d*\.?\d+/g);
        if (matches && matches.length >= 2) {
          const lat = parseFloat(matches[0]);
          const lon = parseFloat(matches[1]);

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
    overlayLayersRef.current.forEach((polygon, id) => {
      if (!currentOverlayIds.has(id)) {
        if (map.hasLayer(polygon)) {
          map.removeLayer(polygon);
        }
        overlayLayersRef.current.delete(id);
      }
    });

    overlayControlsRef.current.forEach((control, id) => {
      if (!currentOverlayIds.has(id)) {
        control.remove();
        overlayControlsRef.current.delete(id);
      }
    });

    // Add new overlays from the context
    mapOverlays.forEach(overlay => {
      if (!overlayLayersRef.current.has(overlay.id)) {
        if (overlay.type === 'searchArea' && overlay.polygon.length > 0) {
          const polygon = L.polygon(overlay.polygon, {
            color: 'hsl(var(--accent))',
            fillColor: 'hsl(var(--accent))',
            fillOpacity: 0.25,
            weight: 2,
          });
          
          const bounds = polygon.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
          }

          // Interactive popup on the polygon
          const popupContainer = L.DomUtil.create('div', 'p-1 space-y-2');
          const title = L.DomUtil.create('div', 'font-bold text-sm text-foreground', popupContainer);
          title.innerText = 'Зона поиска пропавшего туриста';

          const desc = L.DomUtil.create('div', 'text-xs text-muted-foreground', popupContainer);
          desc.innerText = 'Сектор рассчитан на основе времени, скорости и рельефа.';

          const removeBtn = L.DomUtil.create('button', 'px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 cursor-pointer w-full mt-1', popupContainer);
          removeBtn.innerText = 'Удалить зону поиска';
          L.DomEvent.on(removeBtn, 'click', (e) => {
            L.DomEvent.stop(e);
            removeMapOverlay(overlay.id);
          });

          polygon.bindPopup(popupContainer);
          polygon.addTo(map);
          overlayLayersRef.current.set(overlay.id, polygon);

          // Add clean control button
          const removeControl = createRemoveOverlayControl(overlay.id, removeMapOverlay);
          removeControl.addTo(map);
          overlayControlsRef.current.set(overlay.id, removeControl);
        }
      }
    });

  }, [mapOverlays, removeMapOverlay, setView]);

  return (
    <div className="relative h-full w-full isolate z-0">
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Floating Active Group & Security Indicator */}
      {activeGroup && (
        <div className="absolute top-3 left-12 sm:top-4 sm:left-14 z-[1000] flex items-center gap-1.5 sm:gap-2 bg-card/90 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-border shadow-md max-w-[170px] sm:max-w-[240px]">
          <Users className="size-3.5 sm:size-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">{activeGroup.name}</span>
          <span className="text-muted-foreground hidden sm:inline">•</span>
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
            <ShieldCheck className="size-3 sm:size-3.5 text-emerald-500" />
            E2EE
          </span>
        </div>
      )}

      {/* Floating Map Layers Control */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[1000] flex flex-col items-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="shadow-md bg-card/90 backdrop-blur-sm border border-border gap-1.5 sm:gap-2 text-xs h-8 sm:h-9 px-2 sm:px-3"
          title="Выбрать стиль карты и рельеф"
        >
          <Layers className="size-3.5 sm:size-4 text-primary" />
          <span className="hidden sm:inline font-medium">
            {MAP_LAYERS[currentLayerId]?.name.split(' ')[0] || 'Слои карты'}
          </span>
          {MAP_LAYERS[currentLayerId]?.isTopographic && (
            <Badge variant="outline" className="px-1 py-0 text-[9px] sm:text-[10px] bg-primary/10 text-primary border-primary/20">
              DEM
            </Badge>
          )}
        </Button>

        {showLayerMenu && (
          <div className="w-[calc(100vw-24px)] max-w-xs sm:w-72 p-2.5 sm:p-3 rounded-lg shadow-xl bg-card/95 backdrop-blur-md border border-border space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 right-0">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mountain className="size-3.5 text-primary" />
                Слой карты OpenStreetMap
              </span>
              <span className="text-[10px] text-muted-foreground">Тропы & Рельеф</span>
            </div>

            <div className="space-y-1.5">
              {Object.values(MAP_LAYERS).map((layer, idx) => {
                const isActive = currentLayerId === layer.id;
                return (
                  <button
                    key={`map-layer-btn-${layer.id}-${idx}`}
                    onClick={() => handleLayerChange(layer.id)}
                    className={`w-full text-left p-2 rounded-md transition-all text-xs flex flex-col gap-0.5 border ${
                      isActive
                        ? 'bg-primary/15 border-primary/40 text-foreground font-medium'
                        : 'bg-muted/40 hover:bg-muted/80 border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-xs">{layer.name}</span>
                      {layer.isTopographic && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">
                          Топо
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {layer.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
