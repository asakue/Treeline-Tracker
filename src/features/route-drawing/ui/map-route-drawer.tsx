'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { useAppContext } from '@/entities/app';
import { Button } from '@/shared/ui/button';
import {
  Save,
  Trash2,
  Undo,
  X,
  Layers,
  Mountain,
  Sparkles,
  Loader2,
  TrendingUp,
  TrendingDown,
  Footprints,
  Compass,
  Check,
  MapPin,
  Route as RouteIcon,
  HelpCircle,
} from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { type Route } from '@/entities/route';
import { DefaultIcon } from '@/shared/lib/map-utils';
import { MAP_LAYERS, createTileLayer } from '@/shared/lib/map-layers';
import {
  calculateHikingRouteSuggestions,
  type RouteSuggestion,
  type HikingRouteResult,
} from '@/features/routing/lib/brouter-service';
import {
  getElevationForCoordinates,
  calculateElevationStats,
  type ElevationStats,
} from '@/features/elevation/lib/elevation-service';
import { Badge } from '@/shared/ui/badge';
import CreateRouteForm from './create-route-form';

// Быстрые пресеты для тестирования конструктора
const DEMO_PRESETS = [
  {
    name: 'Приэльбрусье',
    desc: 'Терскол ➔ Поляна Азау',
    points: [
      [43.256, 42.511],
      [43.267, 42.482],
      [43.285, 42.455],
    ] as [number, number][],
  },
  {
    name: 'Красная Поляна',
    desc: 'Роза Хутор ➔ Хребет Аибга',
    points: [
      [43.672, 40.298],
      [43.655, 40.312],
      [43.638, 40.325],
    ] as [number, number][],
  },
  {
    name: 'Байкал (ББТ)',
    desc: 'Листвянка ➔ Б. Коты',
    points: [
      [51.865, 104.872],
      [51.884, 104.945],
      [51.906, 105.068],
    ] as [number, number][],
  },
];

export default function MapRouteDrawer() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const drawnPolylineRef = useRef<L.Polyline | null>(null);
  const drawnMarkersRef = useRef<L.Marker[]>([]);

  const {
    setView,
    drawingRoutePoints,
    addDrawingRoutePoint,
    setDrawingRoutePoints,
    clearDrawingRoutePoints,
    routesHook,
  } = useAppContext();

  const routes = routesHook?.routes || [];
  const addRoute = routesHook?.addRoute;
  const existingRoutesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const { toast } = useToast();

  const [currentLayerId, setCurrentLayerId] = useState<string>('opentopomap');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [isRoutingLoading, setIsRoutingLoading] = useState<boolean>(false);

  // Список предложенных маршрутов от точки А до точки Б
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string>('primary-foot-trail');
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState<boolean>(false);

  const [elevationStats, setElevationStats] = useState<ElevationStats | null>(null);
  const [isCalculatingElevation, setIsCalculatingElevation] = useState<boolean>(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [coordsForForm, setCoordsForForm] = useState('');

  // 1. Инициализация карты
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const mapInstance = L.map(mapContainerRef.current, {
        attributionControl: true,
        zoomControl: true,
        cursor: true,
      }).setView([43.26, 42.5], 11);

      const initialLayer = createTileLayer('opentopomap');
      initialLayer.addTo(mapInstance);
      activeTileLayerRef.current = initialLayer;

      const routesGroup = L.layerGroup().addTo(mapInstance);
      existingRoutesLayerGroupRef.current = routesGroup;
      mapRef.current = mapInstance;
    }

    return () => {
      if (mapRef.current) {
        if (existingRoutesLayerGroupRef.current) {
          existingRoutesLayerGroupRef.current.clearLayers();
          existingRoutesLayerGroupRef.current = null;
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
      clearDrawingRoutePoints();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Переключение картографического слоя
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

  // 2. Обработка клика по карте для добавления точек
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      addDrawingRoutePoint([e.latlng.lat, e.latlng.lng]);
    };

    map.on('click', handleMapClick);
    if (mapContainerRef.current) {
      mapContainerRef.current.style.setProperty('cursor', 'crosshair');
    }

    return () => {
      map.off('click', handleMapClick);
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = '';
      }
    };
  }, [addDrawingRoutePoint]);

  // 3. Расчёт и генерация вариантов маршрута от точки А до точки Б
  const requestRouteSuggestions = useCallback(
    async (points: [number, number][]) => {
      if (points.length < 2) {
        setSuggestions([]);
        setShowSuggestionsPanel(false);
        return;
      }

      setIsRoutingLoading(true);
      try {
        const start = points[0];
        const finish = points[points.length - 1];
        const waypoints = points.slice(1, -1);

        const result: HikingRouteResult = await calculateHikingRouteSuggestions(start, finish, waypoints);

        const allVariants = [result.primaryRoute, ...result.alternatives];
        setSuggestions(allVariants);
        setActiveSuggestionId(result.primaryRoute.id);
        setShowSuggestionsPanel(true);

        // Обновляем текущие координаты линии на карте
        setDrawingRoutePoints(result.primaryRoute.coordinates);
        setElevationStats({
          ascent: result.primaryRoute.stats.ascentM,
          descent: result.primaryRoute.stats.descentM,
          minElevation: result.primaryRoute.stats.minElevationM,
          maxElevation: result.primaryRoute.stats.maxElevationM,
          elevationGain: Math.max(
            0,
            result.primaryRoute.stats.maxElevationM - result.primaryRoute.stats.minElevationM
          ),
        });

        // Подгоняем масштаб карты под построенный трек
        if (mapRef.current && result.primaryRoute.coordinates.length > 0) {
          const bounds = L.latLngBounds(result.primaryRoute.coordinates);
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        }

        toast({
          title: 'Маршруты построены',
          description: `Найдено ${allVariants.length} варианта трека от точки А до точки Б.`,
        });
      } catch (err) {
        console.error('Failed to compute route suggestions:', err);
        toast({
          variant: 'destructive',
          title: 'Ошибка маршрутизации',
          description: 'Не удалось автоматически связать точки по тропам.',
        });
      } finally {
        setIsRoutingLoading(false);
      }
    },
    [setDrawingRoutePoints, toast]
  );

  // 4. Отрисовка активного пути и маркеров
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Очищаем предыдущую линию и маркеры
    if (drawnPolylineRef.current && map.hasLayer(drawnPolylineRef.current)) {
      map.removeLayer(drawnPolylineRef.current);
    }
    drawnMarkersRef.current.forEach((marker) => {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    drawnMarkersRef.current = [];

    if (drawingRoutePoints.length > 0) {
      // Рисуем линию
      const polyline = L.polyline(drawingRoutePoints, {
        color: 'hsl(var(--accent))',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      });
      polyline.addTo(map);
      drawnPolylineRef.current = polyline;

      // Рисуем маркеры: Точка А (Старт), Финиш (Б), промежуточные
      const startPoint = drawingRoutePoints[0];
      const endPoint = drawingRoutePoints[drawingRoutePoints.length - 1];

      // Маркер Старта (А)
      const startMarker = L.marker(startPoint, { icon: DefaultIcon }).addTo(map);
      startMarker.bindPopup(`🟢 <b>Точка А (Старт маршрута)</b><br/>${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}`);
      drawnMarkersRef.current.push(startMarker);

      // Маркер Финиша (Б)
      if (drawingRoutePoints.length > 1) {
        const endMarker = L.marker(endPoint, { icon: DefaultIcon }).addTo(map);
        endMarker.bindPopup(`🏁 <b>Точка Б (Финиш маршрута)</b><br/>${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}`);
        drawnMarkersRef.current.push(endMarker);
      }

      // Расчет высот если еще не заданы
      if (!elevationStats && drawingRoutePoints.length >= 2) {
        setIsCalculatingElevation(true);
        getElevationForCoordinates(drawingRoutePoints)
          .then((demPoints) => {
            const stats = calculateElevationStats(demPoints.map((p) => p.elevation));
            setElevationStats(stats);
          })
          .catch((err) => console.error('Failed to compute elevation stats:', err))
          .finally(() => setIsCalculatingElevation(false));
      }
    } else {
      setElevationStats(null);
    }
  }, [drawingRoutePoints, elevationStats]);

  // 5. Отрисовка существующих активных маршрутов (для ориентира)
  useEffect(() => {
    const map = mapRef.current;
    const routesGroup = existingRoutesLayerGroupRef.current;
    if (!map || !routesGroup) return;

    routesGroup.clearLayers();
    const activeRoutes = (routes || []).filter((r) => !r.isArchived);

    activeRoutes.forEach((route) => {
      if (route.path && route.path.length > 0) {
        const polyline = L.polyline(route.path, {
          color: 'hsl(var(--primary))',
          weight: 3,
          opacity: 0.35,
        });
        routesGroup.addLayer(polyline);
      }
    });
  }, [routes]);

  // Выбор предложенного варианта маршрута
  const handleSelectSuggestion = (variant: RouteSuggestion) => {
    setActiveSuggestionId(variant.id);
    setDrawingRoutePoints(variant.coordinates);
    setElevationStats({
      ascent: variant.stats.ascentM,
      descent: variant.stats.descentM,
      minElevation: variant.stats.minElevationM,
      maxElevation: variant.stats.maxElevationM,
      elevationGain: Math.max(0, variant.stats.maxElevationM - variant.stats.minElevationM),
    });

    if (mapRef.current && variant.coordinates.length > 0) {
      const bounds = L.latLngBounds(variant.coordinates);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  // Запуск пресета
  const handleApplyPreset = (preset: (typeof DEMO_PRESETS)[0]) => {
    setDrawingRoutePoints(preset.points);
    if (mapRef.current) {
      const bounds = L.latLngBounds(preset.points);
      mapRef.current.fitBounds(bounds, { padding: [60, 60] });
    }
    requestRouteSuggestions(preset.points);
  };

  const handleCancel = () => {
    clearDrawingRoutePoints();
    setView('routes');
  };

  const handleReset = () => {
    clearDrawingRoutePoints();
    setSuggestions([]);
    setShowSuggestionsPanel(false);
    setElevationStats(null);
    toast({
      title: 'Конструктор очищен',
      description: 'Поставьте новые точки на карте для прокладки маршрута.',
    });
  };

  const handleUndo = () => {
    if (drawingRoutePoints.length <= 1) {
      handleReset();
      return;
    }
    const nextPoints = drawingRoutePoints.slice(0, -1);
    setDrawingRoutePoints(nextPoints);
  };

  const handleSave = () => {
    if (drawingRoutePoints.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Недостаточно точек',
        description: 'Укажите как минимум старт и финиш на карте.',
      });
      return;
    }
    const coordsString = drawingRoutePoints
      .map((p) => `${p[0].toFixed(6)} ${p[1].toFixed(6)}`)
      .join('\n');
    setCoordsForForm(coordsString);
    setIsFormOpen(true);
  };

  const handleRouteSubmit = (newRouteData: Omit<Route, 'id'>) => {
    if (addRoute) {
      addRoute(newRouteData);
    }
    setIsFormOpen(false);
    clearDrawingRoutePoints();
    toast({
      title: 'Маршрут успешно сохранён!',
      description: `"${newRouteData.name}" доступен во вкладке "Маршруты" и отображается на карте.`,
    });
    setTimeout(() => {
      setView('routes');
    }, 100);
  };

  return (
    <div className="h-full w-full relative overflow-hidden">
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Переключатель слоёв карты */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="shadow-md bg-card/90 backdrop-blur-sm border border-border gap-2 text-xs h-9"
          title="Слой карты OpenStreetMap"
        >
          <Layers className="size-4 text-primary" />
          <span className="hidden sm:inline font-medium">
            {MAP_LAYERS[currentLayerId]?.name.split(' ')[0] || 'Слои'}
          </span>
          <Badge variant="outline" className="px-1 py-0 text-[10px] bg-primary/10 text-primary border-primary/20">
            DEM
          </Badge>
        </Button>

        {showLayerMenu && (
          <div className="w-72 p-3 rounded-lg shadow-xl bg-card/95 backdrop-blur-md border border-border space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mountain className="size-3.5 text-primary" />
                Стиль топографической карты
              </span>
            </div>

            <div className="space-y-1.5">
              {Object.values(MAP_LAYERS).map((layer, idx) => {
                const isActive = currentLayerId === layer.id;
                return (
                  <button
                    key={`drawer-layer-${layer.id}-${idx}`}
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

      {!isFormOpen && (
        <>
          {/* Верхняя информационная панель с пресетами и статусом */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-background/95 backdrop-blur-md px-4 py-3 rounded-xl shadow-lg border border-border max-w-xl w-[94%] sm:w-auto text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Mountain className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Конструктор маршрутов (Точка А ➔ Точка Б)
              </p>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Кликайте по карте для установки точек или выберите тестовый регион:
            </p>

            {/* Быстрый выбор тестовых регионов */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap pt-0.5">
              {DEMO_PRESETS.map((preset, idx) => (
                <button
                  key={`drawer-preset-${preset.name}-${idx}`}
                  onClick={() => handleApplyPreset(preset)}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-muted hover:bg-primary/20 hover:text-primary border border-border text-foreground transition-all flex items-center gap-1 font-medium"
                >
                  <MapPin className="size-3 text-primary" />
                  {preset.name}
                </button>
              ))}
            </div>

            {/* Высотные индикаторы DEM */}
            {elevationStats && (
              <div className="flex items-center justify-center gap-3 pt-1.5 text-xs border-t border-border/60 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <TrendingUp className="size-3.5" />
                  Набор: +{elevationStats.ascent} м
                </span>
                <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
                  <TrendingDown className="size-3.5" />
                  Сброс: -{elevationStats.descent} м
                </span>
                <span className="text-muted-foreground font-mono">
                  Высота: {elevationStats.minElevation}..{elevationStats.maxElevation} м
                </span>
              </div>
            )}
          </div>

          {/* Боковая/нижняя панель с предложенными маршрутами от А до Б */}
          {showSuggestionsPanel && suggestions.length > 0 && (
            <div className="absolute top-24 left-4 z-[1000] max-w-sm w-[90%] sm:w-80 bg-card/95 backdrop-blur-md rounded-xl shadow-2xl border border-border p-3.5 space-y-2.5 animate-in fade-in slide-in-from-left-2 duration-200 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-1.5">
                  <RouteIcon className="size-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Варианты маршрута (А ➔ Б)
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                  {suggestions.length} найдено
                </Badge>
              </div>

              <div className="space-y-2">
                {suggestions.map((variant, idx) => {
                  const isSelected = activeSuggestionId === variant.id;
                  const IconComp =
                    variant.iconType === 'mountain'
                      ? Mountain
                      : variant.iconType === 'trail'
                      ? Footprints
                      : Compass;

                  return (
                    <div
                      key={`drawer-sug-${variant.id}-${idx}`}
                      onClick={() => handleSelectSuggestion(variant)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/40'
                          : 'bg-muted/40 hover:bg-muted/80 border-border/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <IconComp className="size-3.5 text-primary shrink-0" />
                          <span className="text-xs font-semibold text-foreground line-clamp-1">
                            {variant.name}
                          </span>
                        </div>
                        <Badge
                          variant={isSelected ? 'default' : 'outline'}
                          className="text-[9px] py-0 px-1 shrink-0"
                        >
                          {variant.tag}
                        </Badge>
                      </div>

                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                        {variant.description}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[11px]">
                        <span className="font-semibold text-foreground">
                          {variant.stats.distanceKm} км
                        </span>
                        <span className="text-muted-foreground">
                          ~{Math.round(variant.stats.durationMinutes / 60)} ч {variant.stats.durationMinutes % 60} м
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          +{variant.stats.ascentM} м
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Нижняя панель действий */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-wrap items-center justify-center gap-2 max-w-full px-2">
            {/* Кнопка автоматической прокладки по тропам */}
            <Button
              variant="default"
              size="sm"
              onClick={() => requestRouteSuggestions(drawingRoutePoints)}
              disabled={drawingRoutePoints.length < 2 || isRoutingLoading}
              className="shadow-lg gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium"
              title="Построить маршрут и предложить варианты прохода по тропам"
            >
              {isRoutingLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              <span>Построить по тропам (А ➔ Б)</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={drawingRoutePoints.length < 2}
              className="shadow-md gap-1.5"
            >
              <Save className="size-4" />
              Сохранить ({drawingRoutePoints.length})
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="size-8 bg-card/80 backdrop-blur-sm"
              onClick={handleUndo}
              disabled={drawingRoutePoints.length === 0}
              title="Отменить последнюю точку"
            >
              <Undo className="size-4" />
            </Button>

            <Button
              variant="destructive"
              size="icon"
              className="size-8 shadow-md"
              onClick={handleReset}
              disabled={drawingRoutePoints.length === 0}
              title="Очистить все точки"
            >
              <Trash2 className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 bg-card/80 backdrop-blur-sm"
              onClick={handleCancel}
              title="Выйти в список маршрутов"
            >
              <X className="size-4" />
            </Button>
          </div>
        </>
      )}

      <CreateRouteForm
        key={coordsForForm}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onRouteSubmit={handleRouteSubmit}
        initialCoordinates={coordsForForm}
      />
    </div>
  );
}
