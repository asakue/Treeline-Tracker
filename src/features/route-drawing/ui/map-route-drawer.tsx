'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useAppContext } from '@/entities/app';
import { Button } from '@/shared/ui/button';
import { Save, Trash2, Undo, X } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { useRoutes, type Route } from '@/entities/route';
import { DefaultIcon } from '@/shared/lib/map-utils';
import CreateRouteForm from './create-route-form';

export default function MapRouteDrawer() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnPolylineRef = useRef<L.Polyline | null>(null);
  const drawnMarkersRef = useRef<L.Marker[]>([]);

  const {
    setView,
    drawingRoutePoints,
    addDrawingRoutePoint,
    setDrawingRoutePoints,
    clearDrawingRoutePoints,
  } = useAppContext();

  const { routes, addRoute } = useRoutes();
  const { toast } = useToast();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [coordsForForm, setCoordsForForm] = useState('');

  // 1. Initialize map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const mapInstance = L.map(mapContainerRef.current, {
        attributionControl: false,
        cursor: true,
      }).setView([43.5, 42], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
      mapRef.current = mapInstance;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      clearDrawingRoutePoints();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Add map click handler for drawing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      addDrawingRoutePoint([e.latlng.lat, e.latlng.lng]);
    };

    map.on('click', handleMapClick);
    if(mapContainerRef.current) {
        mapContainerRef.current.style.setProperty('cursor', 'crosshair');
    }


    return () => {
      map.off('click', handleMapClick);
      if (mapContainerRef.current) {
         mapContainerRef.current.style.cursor = '';
      }
    };
  }, [addDrawingRoutePoint]);

  // 3. Update polyline and markers when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing drawing layers
    if (drawnPolylineRef.current) {
      map.removeLayer(drawnPolylineRef.current);
    }
    drawnMarkersRef.current.forEach(marker => map.removeLayer(marker));
    drawnMarkersRef.current = [];

    if (drawingRoutePoints.length > 0) {
      // Draw new polyline
      const polyline = L.polyline(drawingRoutePoints, { color: 'hsl(var(--accent))', weight: 4, dashArray: '5, 10' });
      polyline.addTo(map);
      drawnPolylineRef.current = polyline;

      // Add markers
      drawingRoutePoints.forEach((point, index) => {
        const marker = L.marker(point, { icon: DefaultIcon, opacity: 0.7 }).addTo(map);
        marker.bindPopup(`Точка ${index + 1}`);
        drawnMarkersRef.current.push(marker);
      });
    }
  }, [drawingRoutePoints]);

  // 4. Display existing routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routes) return;
    
    routes.forEach(route => {
        if (route.path && route.path.length > 0) {
            const polyline = L.polyline(route.path, { color: 'hsl(var(--primary))', weight: 3, opacity: 0.5 });
            polyline.addTo(map);
        }
    });
  }, [routes]);
  
  const handleCancel = () => {
    clearDrawingRoutePoints();
    setView('routes');
  };

  const handleReset = () => {
    clearDrawingRoutePoints();
    toast({ title: 'Маршрут сброшен', description: 'Вы можете начать рисовать заново.' });
  };
  
  const handleUndo = () => {
    setDrawingRoutePoints(points => points.slice(0, -1));
  };

  const handleSave = () => {
    if (drawingRoutePoints.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Недостаточно точек',
        description: 'Нарисуйте маршрут, состоящий хотя бы из двух точек.',
      });
      return;
    }
    const coordsString = drawingRoutePoints.map(p => `${p[0].toFixed(6)} ${p[1].toFixed(6)}`).join('\n');
    setCoordsForForm(coordsString);
    setIsFormOpen(true);
  };
  
  const handleRouteSubmit = (newRouteData: Omit<Route, 'id'>) => {
    addRoute(newRouteData);
    setIsFormOpen(false);
    clearDrawingRoutePoints();
    // Use a short delay to ensure state updates before view transition
    setTimeout(() => {
      setView('routes');
    }, 100);
  };


  return (
    <div className="h-full w-full relative">
      <div ref={mapContainerRef} className="h-full w-full" />
      
      {!isFormOpen && (
        <>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-background/80 backdrop-blur-sm p-2 rounded-lg shadow-lg border">
                <p className="text-sm text-foreground text-center">Режим конструктора маршрутов</p>
                <p className="text-xs text-muted-foreground text-center">Кликайте по карте, чтобы добавить точки</p>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-2">
                <Button variant="secondary" onClick={handleSave} disabled={drawingRoutePoints.length < 2}>
                    <Save className="mr-2"/>
                    Сохранить
                </Button>
                <Button variant="destructive" size="icon" onClick={handleReset} disabled={drawingRoutePoints.length === 0} title="Сбросить">
                    <Trash2 />
                </Button>
                <Button variant="outline" size="icon" onClick={handleUndo} disabled={drawingRoutePoints.length === 0} title="Отменить">
                    <Undo />
                </Button>
                <Button variant="secondary" size="icon" onClick={handleCancel} title="Выйти">
                    <X />
                </Button>
            </div>
        </>
      )}

      <CreateRouteForm
        key={coordsForForm} // Re-mount with new initial data
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onRouteSubmit={handleRouteSubmit}
        initialCoordinates={coordsForForm}
      />
    </div>
  );
}
