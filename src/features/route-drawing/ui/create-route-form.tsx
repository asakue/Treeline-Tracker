'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/shared/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import type { Route, RouteDifficulty } from '@/entities/route';
import { Textarea } from '@/shared/ui/textarea';
import { calculateRouteStats } from '@/entities/route';
import {
  detectRouteRegion,
  autoDetectRouteType,
  autoDetectDifficulty,
} from '@/features/routing/lib/auto-classification-service';
import { MapPin, Mountain, Activity, Sparkles, Clock, Compass } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, 'Название должно содержать не менее 2 символов.'),
  location: z.string().min(2, 'Регион определен автоматически или укажите вручную.'),
  difficulty: z.enum(['Легко', 'Средне', 'Сложно', 'Очень сложно']),
  type: z.string().min(2),
  coordinates: z.string().min(10, 'Укажите координаты маршрута.'),
});

export interface InitialRouteStats {
  distanceKm?: number;
  ascentM?: number;
  descentM?: number;
  durationMinutes?: number;
  sacDifficulty?: 'T1' | 'T2' | 'T3' | 'T4';
  maxSlopeDeg?: number;
  maxElevationM?: number;
}

type CreateRouteFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRouteSubmit: (route: Omit<Route, 'id'>, id?: string) => void;
  routeToEdit?: Route;
  initialCoordinates?: string;
  initialStats?: InitialRouteStats;
};

const parsePath = (coordsStr: string): [number, number][] => {
  return coordsStr
    .split('\n')
    .map((line) => {
      const parts = line.replace(/,/g, ' ').trim().split(/\s+/);
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon)) {
          return [lat, lon];
        }
      }
      return null;
    })
    .filter((p): p is [number, number] => p !== null);
};

export default function CreateRouteForm({
  open,
  onOpenChange,
  onRouteSubmit,
  routeToEdit,
  initialCoordinates = '',
  initialStats,
}: CreateRouteFormProps) {
  const { toast } = useToast();
  const isEditing = !!routeToEdit;

  const getCoordsString = (path: [number, number][]) => {
    return path.map((p) => `${p[0].toFixed(6)} ${p[1].toFixed(6)}`).join('\n');
  };

  // Autonomous parameter evaluation based on coordinates & DEM metrics
  const autoClassification = useMemo(() => {
    const rawCoords = routeToEdit ? getCoordsString(routeToEdit.path) : initialCoordinates;
    const path = parsePath(rawCoords);

    if (path.length === 0) {
      return {
        location: 'Центральный Кавказ',
        type: 'Горный',
        difficulty: 'Средне' as RouteDifficulty,
        distanceKm: 0,
      };
    }

    const location = detectRouteRegion(path);
    const metrics = {
      distanceKm: initialStats?.distanceKm,
      ascentM: initialStats?.ascentM,
      descentM: initialStats?.descentM,
      maxSlopeDeg: initialStats?.maxSlopeDeg,
      maxElevationM: initialStats?.maxElevationM,
      sacDifficulty: initialStats?.sacDifficulty,
    };

    const type = autoDetectRouteType(metrics);
    const difficulty = autoDetectDifficulty(metrics);

    return {
      location,
      type,
      difficulty,
      distanceKm: initialStats?.distanceKm || 0,
    };
  }, [routeToEdit, initialCoordinates, initialStats]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      location: autoClassification.location,
      difficulty: autoClassification.difficulty,
      type: autoClassification.type,
      coordinates: initialCoordinates,
    },
  });

  useEffect(() => {
    if (routeToEdit) {
      form.reset({
        name: routeToEdit.name,
        location: routeToEdit.location,
        difficulty: routeToEdit.difficulty,
        type: routeToEdit.type,
        coordinates: getCoordsString(routeToEdit.path),
      });
    } else if (open) {
      form.reset({
        name: '',
        location: autoClassification.location,
        difficulty: autoClassification.difficulty,
        type: autoClassification.type,
        coordinates: initialCoordinates,
      });
    }
  }, [routeToEdit, initialCoordinates, autoClassification, open, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const path = parsePath(values.coordinates);

    if (path.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Ошибка в координатах',
        description: 'Пожалуйста, укажите как минимум 2 точки маршрута.',
      });
      return;
    }

    const { distance, time, altitude } = calculateRouteStats(path);
    const startCoords = `${path[0][0].toFixed(4)}° с.ш., ${path[0][1].toFixed(4)}° в.д.`;

    const routeData = {
      name: values.name.trim(),
      location: values.location.trim(),
      difficulty: values.difficulty,
      type: values.type,
      coordinates: startCoords,
      path,
      distance: initialStats?.distanceKm ? `${initialStats.distanceKm} км` : distance,
      time: initialStats?.durationMinutes
        ? `${Math.floor(initialStats.durationMinutes / 60)}ч ${initialStats.durationMinutes % 60}мин`
        : time,
      altitude: initialStats?.ascentM ? `+${initialStats.ascentM}м` : altitude,
    };

    onRouteSubmit(routeData, routeToEdit?.id);

    toast({
      title: isEditing ? 'Маршрут обновлен!' : 'Маршрут создан!',
      description: `"${values.name}" сохранён в регионе ${values.location}.`,
    });
    onOpenChange(false);
  };

  const currentLocation = form.watch('location') || autoClassification.location;
  const currentType = form.watch('type') || autoClassification.type;
  const currentDifficulty = form.watch('difficulty') || autoClassification.difficulty;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold">
            <Mountain className="size-5" />
            <DialogTitle className="text-lg">
              {isEditing ? 'Редактировать маршрут' : 'Сохранение маршрута'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Регион, вид маршрута и уровень сложности определены автоматически по координатам и рельефу.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            {/* 1. Название маршрута */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Название маршрута</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="например, Перевал Терсколак ➔ Обсерватория Пик Терскол"
                      className="text-sm font-medium"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* 2. Блок автоматически определенных параметров */}
            <div className="rounded-xl bg-muted/40 border border-border/80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  Автоопределение по местности
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Геопривязка активна
                </span>
              </div>

              {/* Карточки параметров */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {/* Регион */}
                <div className="p-2 rounded-lg bg-background/80 border border-border/60 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3 text-emerald-500" />
                    Регион
                  </span>
                  <span className="font-semibold text-foreground text-xs mt-1 truncate" title={currentLocation}>
                    {currentLocation}
                  </span>
                </div>

                {/* Вид маршрута */}
                <div className="p-2 rounded-lg bg-background/80 border border-border/60 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Mountain className="size-3 text-cyan-500" />
                    Вид маршрута
                  </span>
                  <span className="font-semibold text-foreground text-xs mt-1">
                    {currentType}
                  </span>
                </div>

                {/* Сложность */}
                <div className="p-2 rounded-lg bg-background/80 border border-border/60 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Activity className="size-3 text-amber-500" />
                    Сложность
                  </span>
                  <Badge
                    variant="outline"
                    className="w-fit text-[11px] mt-1 font-semibold px-1.5 py-0 bg-primary/10 text-primary border-primary/20"
                  >
                    {currentDifficulty}
                  </Badge>
                </div>
              </div>

              {initialStats && (
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>Дистанция: <strong className="text-foreground">{initialStats.distanceKm ?? 0} км</strong></span>
                  <span>Набор: <strong className="text-emerald-500">+{initialStats.ascentM ?? 0}м</strong></span>
                  <span>Время: <strong className="text-foreground">~{Math.round((initialStats.durationMinutes ?? 60) / 60)}ч</strong></span>
                </div>
              )}
            </div>

            {/* Скрытые поля для обеспечения строгой валидации Zod */}
            <input type="hidden" {...form.register('location')} />
            <input type="hidden" {...form.register('difficulty')} />
            <input type="hidden" {...form.register('type')} />
            <input type="hidden" {...form.register('coordinates')} />

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm" className="text-xs">
                  Отмена
                </Button>
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4"
              >
                {isEditing ? 'Сохранить изменения' : 'Сохранить маршрут'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}