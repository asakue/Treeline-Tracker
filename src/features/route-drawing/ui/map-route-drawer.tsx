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
  ChevronDown,
  ChevronUp,
  Info,
  Plus,
  Minus,
  Maximize2,
} from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useSidebar } from '@/shared/ui/sidebar';
import { cn } from '@/shared/lib/utils';
import { type Route } from '@/entities/route';
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

// Кастомные стилизованные маркеры точек А (Старт), Б (Финиш) и промежуточных
const createStartIcon = () =>
  L.divIcon({
    className: 'custom-route-marker-a',
    html: `<div style="background-color:#10b981;color:#ffffff;font-weight:900;width:30px;height:30px;border-radius:9999px;border:3px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 10px rgba(0,0,0,0.35);cursor:grab;">A</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const createFinishIcon = () =>
  L.divIcon({
    className: 'custom-route-marker-b',
    html: `<div style="background-color:#ef4444;color:#ffffff;font-weight:900;width:30px;height:30px;border-radius:9999px;border:3px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 10px rgba(0,0,0,0.35);cursor:grab;">B</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const createWaypointIcon = (idx: number) =>
  L.divIcon({
    className: 'custom-route-marker-wp',
    html: `<div style="background-color:#0284c7;color:#ffffff;font-weight:700;width:22px;height:22px;border-radius:9999px;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:grab;">${idx}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

export default function MapRouteDrawer() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const drawnPolylineRef = useRef<L.Polyline | null>(null);
  const alternativePolylinesRef = useRef<L.Polyline[]>([]);
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
  const isMobile = useIsMobile();
  const sidebar = useSidebar();
  const isSidebarOpen = !isMobile && (sidebar?.open ?? false);

  const [currentLayerId, setCurrentLayerId] = useState<string>('opentopomap');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [isRoutingLoading, setIsRoutingLoading] = useState<boolean>(false);

  // Список предложенных маршрутов от точки А до точки Б
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string>('primary-foot-trail');
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState<boolean>(false);
  const [isSuggestionsMinimized, setIsSuggestionsMinimized] = useState<boolean>(false);
  const [showDetailedSuggestions, setShowDetailedSuggestions] = useState<boolean>(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState<boolean>(false);
  const [showDesktopPresetsMenu, setShowDesktopPresetsMenu] = useState<boolean>(false);

  const [elevationStats, setElevationStats] = useState<ElevationStats | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [coordsForForm, setCoordsForForm] = useState('');

  // Короткое лаконичное название для десктопных кнопок-табов
  const getShortVariantName = (variant: RouteSuggestion) => {
    if (variant.id === 'primary-foot-trail' || variant.id.includes('primary')) return 'По тропам';
    if (variant.id === 'alt-scenic' || variant.id.includes('pano') || variant.id.includes('scenic')) return 'Панорама';
    if (variant.id === 'direct-azimuth' || variant.id.includes('direct')) return 'Прямой';
    return variant.tag || 'Трек';
  };

  // 1. Инициализация карты
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const mapInstance = L.map(mapContainerRef.current, {
        attributionControl: true,
        zoomControl: false,
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

  // Автоматическая подстройка Leaflet карты при изменении размеров экрана или сворачивании/разворачивании меню
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [isSidebarOpen]);

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

  // 2. Расчёт и генерация вариантов маршрута от точки А до точки Б
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
        setIsSuggestionsMinimized(false);

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

        // Подгоняем масштаб карты под построенный трек с правильными отступами (чтобы не перекрывать нижние карточки)
        if (mapRef.current && result.primaryRoute.coordinates.length > 0) {
          const bounds = L.latLngBounds(result.primaryRoute.coordinates);
          mapRef.current.fitBounds(bounds, {
            paddingTopLeft: isMobile ? [15, 60] : [50, 70],
            paddingBottomRight: isMobile ? [15, 140] : [50, 240],
            maxZoom: 14,
          });
        }

        toast({
          title: 'Маршруты по тропам построены',
          description: `Найдено ${allVariants.length} варианта от точки А до точки Б. Выберите подходящий в панели внизу.`,
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
    [isMobile, setDrawingRoutePoints, toast]
  );

  // 3. Выбор предложенного варианта маршрута
  const handleSelectSuggestion = useCallback(
    (variant: RouteSuggestion) => {
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
        mapRef.current.fitBounds(bounds, {
          paddingTopLeft: isMobile ? [15, 60] : [50, 70],
          paddingBottomRight: isMobile ? [15, 140] : [50, 80],
          maxZoom: 14,
        });
      }
    },
    [isMobile, setDrawingRoutePoints]
  );

  // 4. Обработка клика по карте для добавления точек + ПКМ для отмены
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const newPoint: [number, number] = [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))];
      const nextPoints = [...drawingRoutePoints, newPoint];
      addDrawingRoutePoint(newPoint);

      // При установке 2-й точки (Старт + Финиш) на ПК сразу автоматически прокладываем тропы!
      if (nextPoints.length === 2) {
        requestRouteSuggestions(nextPoints);
      } else if (nextPoints.length > 2) {
        // При добавлении 3-й и более точек перестраиваем через путевые точки
        requestRouteSuggestions(nextPoints);
      }
    };

    const handleContextMenu = (e: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(e);
      if (drawingRoutePoints.length > 0) {
        const nextPoints = drawingRoutePoints.slice(0, -1);
        setDrawingRoutePoints(nextPoints);
        if (nextPoints.length >= 2) {
          requestRouteSuggestions(nextPoints);
        } else {
          setSuggestions([]);
          setShowSuggestionsPanel(false);
          setElevationStats(null);
        }
        toast({
          title: 'Точка отменена',
          description: 'Удалена последняя точка маршрута.',
        });
      }
    };

    map.on('click', handleMapClick);
    map.on('contextmenu', handleContextMenu);

    if (mapContainerRef.current) {
      mapContainerRef.current.style.setProperty('cursor', 'crosshair');
    }

    return () => {
      map.off('click', handleMapClick);
      map.off('contextmenu', handleContextMenu);
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = '';
      }
    };
  }, [addDrawingRoutePoint, drawingRoutePoints, requestRouteSuggestions, setDrawingRoutePoints, toast]);

  // 5. Отрисовка активного пути, альтернативных путей и интерактивных маркеров
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Очищаем предыдущую основную линию
    if (drawnPolylineRef.current && map.hasLayer(drawnPolylineRef.current)) {
      map.removeLayer(drawnPolylineRef.current);
      drawnPolylineRef.current = null;
    }

    // Очищаем альтернативные линии
    alternativePolylinesRef.current.forEach((pl) => {
      if (map.hasLayer(pl)) map.removeLayer(pl);
    });
    alternativePolylinesRef.current = [];

    // Очищаем маркеры
    drawnMarkersRef.current.forEach((marker) => {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    drawnMarkersRef.current = [];

    if (drawingRoutePoints.length > 0) {
      // 1. Отрисовка альтернативных вариантов на карте (если есть)
      if (suggestions.length > 1) {
        suggestions.forEach((variant) => {
          if (variant.id !== activeSuggestionId && variant.coordinates.length > 0) {
            const altLine = L.polyline(variant.coordinates, {
              color: '#38bdf8',
              weight: 4,
              dashArray: '6, 8',
              opacity: 0.65,
              interactive: true,
            });
            altLine.bindTooltip(
              `<b>Альтернатива: ${variant.name}</b><br/>${variant.stats.distanceKm} км • Кликните для выбора`,
              { sticky: true }
            );
            altLine.on('click', (ev) => {
              L.DomEvent.stopPropagation(ev);
              handleSelectSuggestion(variant);
            });
            altLine.on('mouseover', () => {
              altLine.setStyle({ weight: 6, opacity: 0.95 });
            });
            altLine.on('mouseout', () => {
              altLine.setStyle({ weight: 4, opacity: 0.65 });
            });
            altLine.addTo(map);
            alternativePolylinesRef.current.push(altLine);
          }
        });
      }

      // 2. Отрисовка активной линии (Solid Accent)
      const primaryPolyline = L.polyline(drawingRoutePoints, {
        color: '#10b981',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });
      primaryPolyline.addTo(map);
      drawnPolylineRef.current = primaryPolyline;

      // 3. Маркер Старта (А) - интерактивный, перетаскиваемый (draggable)
      const startPoint = drawingRoutePoints[0];
      const startMarker = L.marker(startPoint, {
        icon: createStartIcon(),
        draggable: true,
      }).addTo(map);

      startMarker.bindPopup(
        `🟢 <b>Точка А (Старт)</b><br/>${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}<br/><span style="font-size:11px;color:#64748b;">(Перетащите для изменения)</span>`
      );

      startMarker.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        const updatedPoints: [number, number][] = [
          [Number(newLatLng.lat.toFixed(6)), Number(newLatLng.lng.toFixed(6))],
          ...drawingRoutePoints.slice(1),
        ];
        setDrawingRoutePoints(updatedPoints);
        requestRouteSuggestions(updatedPoints);
      });

      drawnMarkersRef.current.push(startMarker);

      // 4. Маркер Финиша (Б) - перетаскиваемый (draggable)
      if (drawingRoutePoints.length > 1) {
        const endPoint = drawingRoutePoints[drawingRoutePoints.length - 1];
        const endMarker = L.marker(endPoint, {
          icon: createFinishIcon(),
          draggable: true,
        }).addTo(map);

        endMarker.bindPopup(
          `🏁 <b>Точка Б (Финиш)</b><br/>${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}<br/><span style="font-size:11px;color:#64748b;">(Перетащите для изменения)</span>`
        );

        endMarker.on('dragend', (e) => {
          const newLatLng = e.target.getLatLng();
          const updatedPoints: [number, number][] = [
            ...drawingRoutePoints.slice(0, -1),
            [Number(newLatLng.lat.toFixed(6)), Number(newLatLng.lng.toFixed(6))],
          ];
          setDrawingRoutePoints(updatedPoints);
          requestRouteSuggestions(updatedPoints);
        });

        drawnMarkersRef.current.push(endMarker);
      }

      // 5. Промежуточные путевые точки (если есть)
      if (drawingRoutePoints.length > 2 && suggestions.length === 0) {
        for (let i = 1; i < drawingRoutePoints.length - 1; i++) {
          const wp = drawingRoutePoints[i];
          const wpMarker = L.marker(wp, {
            icon: createWaypointIcon(i),
            draggable: true,
          }).addTo(map);

          wpMarker.on('dragend', (e) => {
            const newLatLng = e.target.getLatLng();
            const updatedPoints = [...drawingRoutePoints];
            updatedPoints[i] = [Number(newLatLng.lat.toFixed(6)), Number(newLatLng.lng.toFixed(6))];
            setDrawingRoutePoints(updatedPoints);
            requestRouteSuggestions(updatedPoints);
          });

          drawnMarkersRef.current.push(wpMarker);
        }
      }

      // Расчет высот если еще не заданы
      if (!elevationStats && drawingRoutePoints.length >= 2) {
        getElevationForCoordinates(drawingRoutePoints)
          .then((demPoints) => {
            const stats = calculateElevationStats(demPoints.map((p) => p.elevation));
            setElevationStats(stats);
          })
          .catch((err) => console.error('Failed to compute elevation stats:', err));
      }
    } else {
      setElevationStats(null);
    }
  }, [
    drawingRoutePoints,
    elevationStats,
    suggestions,
    activeSuggestionId,
    handleSelectSuggestion,
    requestRouteSuggestions,
    setDrawingRoutePoints,
  ]);

  // 6. Отрисовка существующих маршрутов из каталога
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

  // Запуск пресета
  const handleApplyPreset = (preset: (typeof DEMO_PRESETS)[0]) => {
    setDrawingRoutePoints(preset.points);
    setShowPresetsMenu(false);
    setShowDesktopPresetsMenu(false);
    if (mapRef.current) {
      const bounds = L.latLngBounds(preset.points);
      mapRef.current.fitBounds(bounds, {
        paddingTopLeft: isMobile ? [15, 60] : [50, 70],
        paddingBottomRight: isMobile ? [15, 140] : [50, 80],
      });
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
    setIsSuggestionsMinimized(false);
    setShowDetailedSuggestions(false);
    setShowPresetsMenu(false);
    setShowDesktopPresetsMenu(false);
    setElevationStats(null);
    toast({
      title: 'Конструктор очищен',
      description: 'Поставьте новую точку А (Старт) на карте.',
    });
  };

  const handleUndo = () => {
    if (drawingRoutePoints.length <= 1) {
      handleReset();
      return;
    }
    const nextPoints = drawingRoutePoints.slice(0, -1);
    setDrawingRoutePoints(nextPoints);
    if (nextPoints.length >= 2) {
      requestRouteSuggestions(nextPoints);
    } else {
      setSuggestions([]);
      setShowSuggestionsPanel(false);
      setElevationStats(null);
    }
  };

  const handleSave = () => {
    if (drawingRoutePoints.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Недостаточно точек',
        description: 'Маршрут должен содержать как минимум 2 точки (Старт и Финиш).',
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

  const activeSuggestion = suggestions.find((s) => s.id === activeSuggestionId) || suggestions[0];

  return (
    <div className="h-full w-full relative overflow-hidden isolate z-0">
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Переключатель слоёв карты (топографический, спутник, OSM) */}
      <div className="absolute top-3 right-3 sm:top-3 sm:right-4 z-[1000] flex flex-col items-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="shadow-md bg-card/90 backdrop-blur-sm border border-border gap-1.5 sm:gap-2 text-xs h-8 sm:h-9 px-2 sm:px-3"
          title="Слой карты OpenStreetMap"
        >
          <Layers className="size-3.5 sm:size-4 text-primary" />
          <span className="hidden sm:inline font-medium">
            {MAP_LAYERS[currentLayerId]?.name.split(' ')[0] || 'Слои'}
          </span>
          <Badge variant="outline" className="px-1 py-0 text-[9px] sm:text-[10px] bg-primary/10 text-primary border-primary/20">
            DEM
          </Badge>
        </Button>

        {/* Кнопки зума карты (+, -, сброс масштаба) в правом верхнем блоке */}
        {!showLayerMenu && (
          <div className="flex flex-col bg-card/95 backdrop-blur-md rounded-xl shadow-lg border border-border overflow-hidden animate-in fade-in duration-150">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => mapRef.current?.zoomIn()}
              className="size-8 rounded-none hover:bg-primary/15 text-foreground transition-colors cursor-pointer"
              title="Приблизить карту (+)"
            >
              <Plus className="size-4" />
            </Button>
            <div className="h-px w-full bg-border/80" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => mapRef.current?.zoomOut()}
              className="size-8 rounded-none hover:bg-primary/15 text-foreground transition-colors cursor-pointer"
              title="Отдалить карту (-)"
            >
              <Minus className="size-4" />
            </Button>
            {drawingRoutePoints.length > 0 && (
              <>
                <div className="h-px w-full bg-border/80" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (mapRef.current && drawingRoutePoints.length > 0) {
                      const bounds = L.latLngBounds(drawingRoutePoints.map((p) => L.latLng(p[0], p[1])));
                      mapRef.current.fitBounds(bounds, { padding: [60, 60] });
                    }
                  }}
                  className="size-8 rounded-none hover:bg-primary/15 text-primary transition-colors cursor-pointer"
                  title="Показать весь маршрут"
                >
                  <Maximize2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        )}

        {showLayerMenu && (
          <div className="w-[calc(100vw-24px)] max-w-xs sm:w-72 p-2.5 sm:p-3 rounded-lg shadow-xl bg-card/95 backdrop-blur-md border border-border space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 right-0">
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
          {/* ========================================================
              МОБИЛЬНАЯ ВЕРСИЯ (ОТЛИЧНАЯ, СОХРАНЕНА БЕЗ ИЗМЕНЕНИЙ)
             ======================================================== */}
          {/* Мобильная шапка */}
          <div className="sm:hidden absolute top-3 left-3 right-20 z-[1000]">
            <div className="bg-background/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg shadow-md border border-border flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <Mountain className="size-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold truncate">
                  Точек: {drawingRoutePoints.length}
                </span>
                {elevationStats && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                    +{elevationStats.ascent}м
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                className="h-6 px-1.5 text-[10px] gap-1 shrink-0 font-medium"
              >
                <span>Регионы</span>
                <ChevronDown className={`size-3 transition-transform ${showPresetsMenu ? 'rotate-180' : ''}`} />
              </Button>
            </div>

            {showPresetsMenu && (
              <div className="mt-1.5 bg-card/95 backdrop-blur-md p-2 rounded-lg border border-border shadow-xl space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                <p className="text-[10px] text-muted-foreground px-1 pb-1 border-b border-border/50">
                  Быстрый выбор региона:
                </p>
                {DEMO_PRESETS.map((preset, idx) => (
                  <button
                    key={`drawer-preset-mob-${preset.name}-${idx}`}
                    onClick={() => handleApplyPreset(preset)}
                    className="w-full text-left p-1.5 rounded bg-muted/50 hover:bg-primary/20 text-foreground text-xs flex items-center justify-between"
                  >
                    <span className="font-medium flex items-center gap-1">
                      <MapPin className="size-3 text-primary" />
                      {preset.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{preset.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Варианты маршрутов на мобильном: горизонтальная лента над кнопками */}
          {showSuggestionsPanel && suggestions.length > 0 && (
            <div className="sm:hidden">
              {!isSuggestionsMinimized ? (
                <div className="absolute bottom-32 left-2 right-2 z-[1000] bg-card/95 backdrop-blur-md rounded-xl shadow-xl border border-border p-2 space-y-1.5 animate-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between pb-1 border-b border-border/50 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <RouteIcon className="size-3.5 text-primary" />
                      <span>Варианты троп (А ➔ Б)</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSuggestionsMinimized(true)}
                      className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-0.5"
                    >
                      Свернуть <ChevronDown className="size-3" />
                    </Button>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
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
                          key={`drawer-sug-mob-${variant.id}-${idx}`}
                          onClick={() => handleSelectSuggestion(variant)}
                          className={`shrink-0 w-44 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                            isSelected
                              ? 'bg-primary/15 border-primary shadow-sm ring-1 ring-primary/40'
                              : 'bg-muted/40 hover:bg-muted/70 border-border/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <IconComp className="size-3 text-primary shrink-0" />
                              <span className="font-semibold truncate text-[11px]">{variant.name}</span>
                            </div>
                            {isSelected && <Check className="size-3 text-primary shrink-0" />}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                            <span className="font-semibold text-foreground">{variant.stats.distanceKm} км</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{variant.stats.ascentM}м</span>
                            <span>~{Math.round(variant.stats.durationMinutes / 60)}ч</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[1000]">
                  <Button
                    onClick={() => setIsSuggestionsMinimized(false)}
                    size="sm"
                    variant="secondary"
                    className="rounded-full shadow-lg bg-card/95 backdrop-blur-md border border-primary/40 text-xs gap-1.5 h-8 px-3"
                  >
                    <RouteIcon className="size-3.5 text-primary" />
                    <span>Варианты ({suggestions.length})</span>
                    <ChevronUp className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Мобильная нижняя панель действий */}
          <div className="sm:hidden absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000] flex items-center justify-center gap-1.5 max-w-full px-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => requestRouteSuggestions(drawingRoutePoints)}
              disabled={drawingRoutePoints.length < 2 || isRoutingLoading}
              className="shadow-lg gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs h-8 px-2.5"
            >
              {isRoutingLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>Тропы А➔Б</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={drawingRoutePoints.length < 2}
              className="shadow-md gap-1 text-xs h-8 px-2.5"
            >
              <Save className="size-3.5" />
              <span>Сохранить</span>
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="size-8 bg-card/80 backdrop-blur-sm"
              onClick={handleUndo}
              disabled={drawingRoutePoints.length === 0}
              title="Отменить последнюю точку"
            >
              <Undo className="size-3.5" />
            </Button>

            <Button
              variant="destructive"
              size="icon"
              className="size-8 shadow-md"
              onClick={handleReset}
              disabled={drawingRoutePoints.length === 0}
              title="Очистить все точки"
            >
              <Trash2 className="size-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 bg-card/80 backdrop-blur-sm"
              onClick={handleCancel}
              title="Выйти в список маршрутов"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {/* ========================================================
              ДЕСКТОПНАЯ ВЕРСИЯ (ДЛЯ ПК: ЭРГОНОМИЧНЫЙ И СТИЛЬНЫЙ ИНТЕРФЕЙС)
             ======================================================== */}
          {/* ДЕСКТОПНАЯ ВЕРХНЯЯ ШАПКА: компактная строка управления с подсказками и пресетами */}
          <div className="hidden sm:flex absolute top-3 left-4 z-[1000] items-center gap-2.5 bg-card/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-border max-w-[calc(100vw-180px)] overflow-visible">
            <div className="flex items-center gap-1.5 shrink-0">
              <Mountain className="size-4 text-primary shrink-0" />
              <span className="font-bold text-xs sm:text-sm text-foreground whitespace-nowrap">
                Конструктор
              </span>
            </div>

            <div className="h-4 w-px bg-border/80 shrink-0" />

            {/* Пошаговая индикация с защитой от переноса строк и наслоений */}
            <div className="shrink-0 flex items-center">
              {drawingRoutePoints.length === 0 && (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium text-xs whitespace-nowrap py-0.5 px-2">
                  Шаг 1: Старт (А)
                </Badge>
              )}
              {drawingRoutePoints.length === 1 && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium text-xs whitespace-nowrap py-0.5 px-2 animate-pulse">
                  Шаг 2: Финиш (Б)
                </Badge>
              )}
              {drawingRoutePoints.length >= 2 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-medium text-xs whitespace-nowrap py-0.5 px-2">
                  Точек: {drawingRoutePoints.length}
                </Badge>
              )}
            </div>

            <div className="h-4 w-px bg-border/80 shrink-0" />

            {/* Быстрые пресеты регионов через компактное меню */}
            <div className="relative shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDesktopPresetsMenu(!showDesktopPresetsMenu)}
                className="h-7 px-2.5 text-xs gap-1 border-border/80 hover:bg-primary/15 hover:border-primary/40 font-medium whitespace-nowrap"
              >
                <MapPin className="size-3 text-primary shrink-0" />
                <span>Регионы</span>
                <ChevronDown className={`size-3 transition-transform ${showDesktopPresetsMenu ? 'rotate-180' : ''}`} />
              </Button>

              {showDesktopPresetsMenu && (
                <div className="absolute top-full left-0 mt-1.5 w-64 p-1.5 rounded-lg bg-card/98 backdrop-blur-md border border-border shadow-xl space-y-1 z-[1100] animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                    Примеры готовых треков:
                  </div>
                  {DEMO_PRESETS.map((preset, idx) => (
                    <button
                      key={`desk-preset-item-${preset.name}-${idx}`}
                      onClick={() => handleApplyPreset(preset)}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-primary/15 text-foreground text-xs flex flex-col transition-colors group"
                    >
                      <span className="font-semibold text-foreground group-hover:text-primary flex items-center gap-1.5">
                        <MapPin className="size-3 text-primary shrink-0" />
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground pl-4.5">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Кнопка закрытия */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground shrink-0"
              onClick={handleCancel}
              title="Закрыть конструктор"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Индикатор загрузки маршрутизации по тропам */}
          {isRoutingLoading && (
            <div className="hidden sm:flex absolute top-16 left-1/2 -translate-x-1/2 z-[1000] items-center gap-2.5 bg-card/95 backdrop-blur-md px-4 py-2 rounded-full shadow-xl border border-primary/30 text-xs font-semibold text-primary animate-in fade-in zoom-in-95 duration-150">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Пешеходный роутер OSM прокладывает тропы и рассчитывает высоты...</span>
            </div>
          )}

          {/* ДЕСКТОПНАЯ ПАНЕЛЬ ВЫБОРА МАРШРУТА И ДЕЙСТВИЙ (КОМПАКТНЫЙ НЕЗАГОРАЖИВАЮЩИЙ ДОК) */}
          <div className="hidden sm:block">
            {/* Вариант А: Есть построенные варианты маршрутов */}
            {showSuggestionsPanel && suggestions.length > 0 ? (
              !isSuggestionsMinimized ? (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 max-w-[calc(100%-24px)] animate-in fade-in slide-in-from-bottom-2 duration-150">
                  {/* Опциональный блок подробностей (раскрывается только по клику на Инфо) */}
                  {showDetailedSuggestions && (
                    <div className="w-full max-w-2xl grid grid-cols-3 gap-2 bg-card/95 backdrop-blur-md p-2.5 rounded-xl border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                      {suggestions.map((variant) => {
                        const isSelected = activeSuggestionId === variant.id;
                        return (
                          <div
                            key={`detail-${variant.id}`}
                            onClick={() => handleSelectSuggestion(variant)}
                            className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                                : 'bg-muted/40 hover:bg-muted/80 border-border/70'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-bold truncate text-foreground">{variant.name}</span>
                                <Badge variant={isSelected ? 'default' : 'outline'} className="text-[9px] py-0 px-1 font-medium shrink-0">
                                  {variant.tag}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                                {variant.description}
                              </p>
                            </div>
                            <div className="mt-1.5 pt-1 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                              <span className="font-bold text-foreground">{variant.stats.distanceKm} км</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{variant.stats.ascentM}м</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Главный ультра-компактный док: адаптируется под размер карты и состояние меню */}
                  <div className="flex items-center gap-1 sm:gap-1.5 bg-card/95 backdrop-blur-md px-2 py-1.5 rounded-xl shadow-2xl border border-border max-w-full overflow-x-auto">
                    {/* Список вариантов: при открытом меню неактивные варианты сжимаются до иконки + км, освобождая место */}
                    <div className="flex items-center gap-1 shrink-0">
                      {suggestions.map((variant) => {
                        const isSelected = activeSuggestionId === variant.id;
                        const shortName = getShortVariantName(variant);
                        const IconComp =
                          variant.iconType === 'mountain'
                            ? Mountain
                            : variant.iconType === 'trail'
                            ? Footprints
                            : Compass;

                        return (
                          <button
                            key={`desk-chip-${variant.id}`}
                            onClick={() => handleSelectSuggestion(variant)}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all whitespace-nowrap cursor-pointer select-none",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                                : "bg-muted/40 hover:bg-muted/80 text-foreground border-border/70 hover:border-primary/40"
                            )}
                            title={`${variant.name} (${variant.stats.distanceKm} км, +${variant.stats.ascentM}м)`}
                          >
                            <IconComp className={cn("size-3.5 shrink-0", isSelected ? "text-primary-foreground" : "text-primary")} />
                            
                            {/* Название трека: отображается всегда на выбранном, а на невыбранных скрывается при открытом боковом меню */}
                            <span className={cn(
                              "leading-none",
                              isSelected ? "inline" : (isSidebarOpen ? "hidden 2xl:inline" : "inline")
                            )}>
                              {shortName}
                            </span>

                            {/* Бейдж расстояния с фиксированным отступом gap-1 — цифры и км никогда не налезают друг на друга */}
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded leading-none whitespace-nowrap shrink-0",
                                isSelected
                                  ? "bg-primary-foreground/25 text-primary-foreground font-semibold"
                                  : "bg-background/90 text-muted-foreground border border-border/40"
                              )}
                            >
                              <span>{variant.stats.distanceKm}</span>
                              <span className="text-[10px] opacity-90">км</span>
                            </span>

                            {/* Набор высоты на выбранном треке */}
                            {isSelected && (
                              <span className={cn(
                                "text-[10px] font-mono text-emerald-300 dark:text-emerald-200 shrink-0 font-semibold whitespace-nowrap",
                                isSidebarOpen ? "hidden 2xl:inline" : "hidden xl:inline"
                              )}>
                                +{variant.stats.ascentM}м
                              </span>
                            )}

                            {isSelected && <Check className="size-3 stroke-[2.5] ml-0.5 shrink-0 text-primary-foreground" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="h-5 w-px bg-border/80 shrink-0 mx-0.5" />

                    {/* Основное действие: Сохранить */}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={drawingRoutePoints.length < 2}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs h-7 px-2.5 gap-1.5 shadow-sm shrink-0 whitespace-nowrap"
                    >
                      <Save className="size-3.5" />
                      <span>Сохранить</span>
                    </Button>

                    {/* Кнопка подробностей (раскрывает описание только по клику) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowDetailedSuggestions(!showDetailedSuggestions)}
                      className="size-7 text-muted-foreground hover:text-foreground shrink-0"
                      title={showDetailedSuggestions ? 'Скрыть карточки описания' : 'Показать карточки с описанием'}
                    >
                      <Info className="size-3.5 text-primary" />
                    </Button>

                    {/* Кнопка перестроения */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => requestRouteSuggestions(drawingRoutePoints)}
                      disabled={isRoutingLoading}
                      className="size-7 text-muted-foreground hover:text-foreground shrink-0"
                      title="Перестроить тропы"
                    >
                      {isRoutingLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5 text-primary" />
                      )}
                    </Button>

                    {/* Отменить последнюю точку */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleUndo}
                      disabled={drawingRoutePoints.length === 0}
                      className="size-7 text-muted-foreground hover:text-foreground shrink-0"
                      title="Отменить последнюю точку (ПКМ на карте)"
                    >
                      <Undo className="size-3.5" />
                    </Button>

                    {/* Очистить */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleReset}
                      disabled={drawingRoutePoints.length === 0}
                      className="size-7 text-destructive hover:text-destructive shrink-0"
                      title="Очистить все точки"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>

                    {/* Свернуть панель вниз */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSuggestionsMinimized(true)}
                      className="size-7 text-muted-foreground hover:text-foreground shrink-0"
                      title="Свернуть в мини-плашку"
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                /* Свернутая ультра-компактная плашка */
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 sm:gap-2 bg-card/95 backdrop-blur-md rounded-xl shadow-2xl border border-border px-2.5 sm:px-3 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150 max-w-[calc(100%-24px)]">
                  <div className="flex items-center gap-1 text-xs shrink min-w-0">
                    <RouteIcon className="size-3.5 text-primary shrink-0" />
                    <span className="font-semibold text-foreground truncate">
                      {activeSuggestion ? getShortVariantName(activeSuggestion) : 'Трек'}: {activeSuggestion?.stats.distanceKm} км
                    </span>
                  </div>

                  <div className="h-4 w-px bg-border/80 shrink-0" />

                  <Button
                    onClick={() => setIsSuggestionsMinimized(false)}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 px-2 border-border/80 hover:bg-primary/10 shrink-0"
                  >
                    <span>Варианты ({suggestions.length})</span>
                    <ChevronUp className="size-3.5" />
                  </Button>

                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 text-xs gap-1 px-2.5 font-semibold shrink-0"
                  >
                    <Save className="size-3.5" />
                    <span>Сохранить</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    className="size-7 text-destructive hover:text-destructive shrink-0"
                    title="Очистить"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )
            ) : (
              /* Вариант Б: Точки еще расставляются (0 или 1 точка) */
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2.5 bg-card/95 backdrop-blur-md rounded-xl shadow-xl border border-border px-3.5 py-2 text-xs max-w-[calc(100%-24px)] truncate">
                {drawingRoutePoints.length === 0 && (
                  <span className="text-muted-foreground flex items-center gap-2 truncate">
                    <MapPin className="size-4 text-emerald-500 shrink-0" />
                    Кликните в любом месте карты, чтобы установить точку старта (А)
                  </span>
                )}
                {drawingRoutePoints.length === 1 && (
                  <span className="text-foreground font-medium flex items-center gap-2 truncate">
                    <MapPin className="size-4 text-rose-500 shrink-0" />
                    Точка А установлена! Кликните точку финиша (Б)
                  </span>
                )}

                {drawingRoutePoints.length > 0 && (
                  <>
                    <div className="h-4 w-px bg-border mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUndo}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      <Undo className="size-3" />
                      <span>Отменить</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                      <span>Очистить</span>
                    </Button>
                  </>
                )}

                <div className="h-4 w-px bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-7 px-2 text-xs"
                >
                  Выйти
                </Button>
              </div>
            )}
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
