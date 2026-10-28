'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Mountain,
  AlertTriangle,
  Flame,
  Droplets,
  Clock,
  Compass,
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
  CheckCircle2,
  AlertOctagon,
  Footprints,
  Maximize2,
} from 'lucide-react';
import { RouteSuggestion } from '@/features/routing/lib/brouter-service';
import { cn } from '@/shared/lib/utils';

interface RouteTerrainAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: RouteSuggestion | null;
}

export function RouteTerrainAnalyticsModal({
  open,
  onOpenChange,
  suggestion,
}: RouteTerrainAnalyticsModalProps) {
  if (!suggestion) return null;

  const { stats, terrainAnalytics } = suggestion;
  const slopeDist = terrainAnalytics?.slopeDistribution;
  const hazards = terrainAnalytics?.hazards || [];

  const formatHoursMinutes = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `${mins} мин`;
    return `${hours} ч ${mins > 0 ? `${mins} мин` : ''}`;
  };

  const getSacBadgeInfo = (sac?: 'T1' | 'T2' | 'T3' | 'T4') => {
    switch (sac) {
      case 'T4':
        return {
          label: 'T4: Альпийский треккинг',
          desc: 'Сложный рельеф, крутые осыпи, экспонированные скальные полки',
          color: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
        };
      case 'T3':
        return {
          label: 'T3: Сложный горный маршрут',
          desc: 'Крутые тропы, требуются треккинговые палки и уверенная поступь',
          color: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        };
      case 'T2':
        return {
          label: 'T2: Горный поход',
          desc: 'Умеренный горный рельеф, устойчивые тропы',
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
        };
      case 'T1':
      default:
        return {
          label: 'T1: Пешеходный маршрут',
          desc: 'Хорошо обустроенные тропы, минимальный уклон',
          color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        };
    }
  };

  const getIbpGrade = (ibp?: number) => {
    if (!ibp) return 'Легкий';
    if (ibp > 120) return 'Экстремально тяжелый (120+)';
    if (ibp > 80) return 'Тяжелый (80-120)';
    if (ibp > 50) return 'Средний (50-80)';
    if (ibp > 25) return 'Умеренный (25-50)';
    return 'Легкий (<25)';
  };

  const sacInfo = getSacBadgeInfo(stats.sacDifficulty);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950/95 border-slate-800 text-slate-100 backdrop-blur-xl p-5 sm:p-7 shadow-2xl">
        <DialogHeader className="space-y-2 border-b border-slate-800/80 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Mountain className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>{suggestion.name}</span>
                  <Badge variant="outline" className={cn('text-xs font-medium', sacInfo.color)}>
                    {stats.sacDifficulty || 'T1'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Физико-географический профиль рельефа и расчет по стандарту DIN 33466 / формуле Тоблера
                </DialogDescription>
              </div>
            </div>

            {stats.ibpIndex !== undefined && (
              <div className="text-right">
                <div className="text-xs text-slate-400">Индекс сложности IBP</div>
                <div className="text-lg font-bold font-mono text-cyan-400">
                  {stats.ibpIndex}{' '}
                  <span className="text-xs font-normal text-slate-400">({getIbpGrade(stats.ibpIndex)})</span>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* 1. Ключевые физические показатели */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Compass className="size-3.5 text-blue-400" />
              Дистанция
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {stats.distanceKm}{' '}
              <span className="text-xs font-normal text-slate-400">км</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Ср. уклон: {stats.avgSlopeDeg ?? 0}°
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Clock className="size-3.5 text-emerald-400" />
              Время (DIN 33466)
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {formatHoursMinutes(stats.durationMinutes)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Ходовое: {formatHoursMinutes(stats.movingDurationMinutes || stats.durationMinutes)} (привалы: {stats.restStops || 0})
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-teal-400" />
              Набор / Сброс
            </div>
            <div className="text-xl font-bold font-mono text-teal-300 mt-1">
              +{stats.ascentM}м
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Сброс: -{stats.descentM}м (макс: {stats.maxElevationM}м)
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Flame className="size-3.5 text-amber-400" />
              Энергия (Minetti)
            </div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {stats.energyKcal ?? 0}{' '}
              <span className="text-xs font-normal text-slate-400">ккал</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Вода: ~{stats.waterLiters ?? 1.5} л
            </div>
          </div>
        </div>

        {/* 2. Распределение уклонов (Slope Distribution Histogram) */}
        {slopeDist && (
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-slate-200">
                  Гистограмма уклонов рельефа
                </h4>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Макс. уклон: {stats.maxSlopeDeg ?? 0}°
              </span>
            </div>

            {/* Визуальная составная полоса распределения */}
            <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-800 p-0.5 border border-slate-700/50">
              {slopeDist.flat.percentage > 0 && (
                <div
                  style={{ width: `${slopeDist.flat.percentage}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Пологий (0°-8°): ${slopeDist.flat.percentage}%`}
                />
              )}
              {slopeDist.moderate.percentage > 0 && (
                <div
                  style={{ width: `${slopeDist.moderate.percentage}%` }}
                  className="bg-blue-500 h-full transition-all"
                  title={`Умеренный (8°-18°): ${slopeDist.moderate.percentage}%`}
                />
              )}
              {slopeDist.steep.percentage > 0 && (
                <div
                  style={{ width: `${slopeDist.steep.percentage}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`Крутой (18°-27°): ${slopeDist.steep.percentage}%`}
                />
              )}
              {slopeDist.avalancheZone.percentage > 0 && (
                <div
                  style={{ width: `${slopeDist.avalancheZone.percentage}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`Лавиноопасный (28°-45°): ${slopeDist.avalancheZone.percentage}%`}
                />
              )}
              {slopeDist.cliff.percentage > 0 && (
                <div
                  style={{ width: `${slopeDist.cliff.percentage}%` }}
                  className="bg-purple-600 h-full transition-all"
                  title={`Скальный обрыв (>45°): ${slopeDist.cliff.percentage}%`}
                />
              )}
            </div>

            {/* Легенда и детализация категорий уклонов */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
              <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  0° – 8°
                </div>
                <div className="text-[11px] text-slate-400 truncate">Пологий</div>
                <div className="font-mono text-slate-200 mt-1 font-semibold">
                  {slopeDist.flat.percentage}%{' '}
                  <span className="text-[10px] text-slate-500 font-normal">({slopeDist.flat.distanceKm}км)</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-2">
                <div className="flex items-center gap-1.5 text-blue-400 font-medium">
                  <span className="size-2 rounded-full bg-blue-500" />
                  8° – 18°
                </div>
                <div className="text-[11px] text-slate-400 truncate">Умеренный</div>
                <div className="font-mono text-slate-200 mt-1 font-semibold">
                  {slopeDist.moderate.percentage}%{' '}
                  <span className="text-[10px] text-slate-500 font-normal">({slopeDist.moderate.distanceKm}км)</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-2">
                <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                  <span className="size-2 rounded-full bg-amber-500" />
                  18° – 27°
                </div>
                <div className="text-[11px] text-slate-400 truncate">Крутой подъем</div>
                <div className="font-mono text-slate-200 mt-1 font-semibold">
                  {slopeDist.steep.percentage}%{' '}
                  <span className="text-[10px] text-slate-500 font-normal">({slopeDist.steep.distanceKm}км)</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/60 border border-rose-900/40 p-2">
                <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                  <span className="size-2 rounded-full bg-rose-500" />
                  28° – 45°
                </div>
                <div className="text-[11px] text-rose-300 truncate">Лавиноопасно</div>
                <div className="font-mono text-rose-200 mt-1 font-semibold">
                  {slopeDist.avalancheZone.percentage}%{' '}
                  <span className="text-[10px] text-rose-400 font-normal">({slopeDist.avalancheZone.distanceKm}км)</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/60 border border-purple-900/40 p-2">
                <div className="flex items-center gap-1.5 text-purple-400 font-medium">
                  <span className="size-2 rounded-full bg-purple-500" />
                  &gt; 45°
                </div>
                <div className="text-[11px] text-purple-300 truncate">Скалы / Обрывы</div>
                <div className="font-mono text-purple-200 mt-1 font-semibold">
                  {slopeDist.cliff.percentage}%{' '}
                  <span className="text-[10px] text-purple-400 font-normal">({slopeDist.cliff.distanceKm}км)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Физиологический отчет и рекомендации */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Activity className="size-4 text-cyan-400" />
              Шкала сложности SAC ({stats.sacDifficulty || 'T1'})
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {sacInfo.desc}
            </p>
            <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
              По стандарту Swiss Alpine Club (SAC): для маршрутов от T3 требуются высокие ботинки с жесткой подошвой и треккинговые палки.
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Droplets className="size-4 text-sky-400" />
              Гидратация и питание
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Рекомендуемый запас воды:{' '}
              <strong className="text-sky-300">{stats.waterLiters ?? 1.5} л</strong>. Расход энергии:{' '}
              <strong className="text-amber-300">{stats.energyKcal ?? 0} ккал</strong> (эквивалентно ~{Math.round((stats.energyKcal ?? 1200) / 250)} энергетическим батончикам).
            </p>
            <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
              Ритм движения по DIN 33466: привалы каждые 50 мин на 10 мин.
            </div>
          </div>
        </div>

        {/* 4. Оповещения об опасных зонах рельефа */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon className="size-4 text-amber-400" />
              <h4 className="text-sm font-semibold text-slate-200">
                Предупреждения о безопасности рельефа
              </h4>
            </div>
            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
              {hazards.length} зон риска
            </Badge>
          </div>

          {hazards.length > 0 ? (
            <div className="space-y-2">
              {hazards.map((hazard) => (
                <div
                  key={hazard.id}
                  className={cn(
                    'rounded-xl border p-3.5 space-y-1.5 transition-all',
                    hazard.severity === 'DANGER'
                      ? 'bg-rose-950/25 border-rose-900/60 text-rose-200'
                      : 'bg-amber-950/20 border-amber-900/50 text-amber-200'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {hazard.severity === 'DANGER' ? (
                        <AlertOctagon className="size-4 text-rose-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="size-4 text-amber-400 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-white tracking-wide">
                        {hazard.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span>{hazard.elevationM} м</span>
                      <span>•</span>
                      <span>уклон {hazard.slopeDegrees}°</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300">{hazard.description}</p>

                  <div className="text-[11px] text-slate-400 flex items-start gap-1.5 bg-slate-950/40 rounded-lg p-2 border border-slate-800/50">
                    <span className="font-semibold text-emerald-400 shrink-0">Рекомендация:</span>
                    <span>{hazard.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-950/20 border border-emerald-900/50 p-3.5 flex items-center gap-3 text-emerald-300">
              <ShieldCheck className="size-5 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-emerald-200">Безопасный рельеф:</span> Критических
                уклонов (&gt;28°), скалистых обрывов или кислородного дефицита на данном треке не зафиксировано.
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800/80">
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4"
          >
            Закрыть отчет
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default RouteTerrainAnalyticsModal;
