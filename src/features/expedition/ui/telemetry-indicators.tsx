'use client';

import {
  Wifi,
  Radio,
  CloudOff,
  Battery,
  BatteryCharging,
  Navigation,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { TransportStatus } from '@/core/transport/interfaces';

interface TelemetryIndicatorsProps {
  transportStatus: TransportStatus;
  gpsAccuracy: number | null;
  gpsCoords: { lat: number; lng: number } | null;
  batteryLevel: number;
  isCharging: boolean;
}

export function TelemetryIndicators({
  transportStatus,
  gpsAccuracy,
  gpsCoords,
  batteryLevel,
  isCharging,
}: TelemetryIndicatorsProps) {
  const getChannelBadge = () => {
    switch (transportStatus.activeChannel) {
      case 'INTERNET':
        return (
          <Badge
            variant="outline"
            className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs py-0.5 px-2"
          >
            <Wifi className="size-3 text-emerald-500 shrink-0" />
            <span className="font-semibold">ИНТЕРНЕТ</span>
          </Badge>
        );
      case 'MESH_CORE':
        return (
          <Badge
            variant="outline"
            className="gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs py-0.5 px-2"
          >
            <Radio className="size-3 text-blue-500 shrink-0" />
            <span className="font-semibold">MESH-CORE</span>
            {transportStatus.meshSignalDbm && (
              <span className="text-[10px] opacity-80 font-mono">
                {transportStatus.meshSignalDbm} dBm
              </span>
            )}
          </Badge>
        );
      case 'OFFLINE_QUEUE':
      default:
        return (
          <Badge
            variant="outline"
            className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs py-0.5 px-2"
          >
            <CloudOff className="size-3 text-amber-500 shrink-0" />
            <span className="font-semibold">ОФЛАЙН</span>
            {transportStatus.queuedCount > 0 && (
              <span className="text-[10px] font-bold">
                ({transportStatus.queuedCount})
              </span>
            )}
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground shrink-0">
      {/* Active Channel Badge */}
      <div className="flex items-center gap-1.5" title="Текущий активный канал связи Treeline">
        {getChannelBadge()}
      </div>

      {/* GPS satellite lock */}
      <div
        className="flex items-center gap-1 font-mono text-[11px] sm:text-xs"
        title={
          gpsCoords
            ? `Координаты: ${gpsCoords.lat}, ${gpsCoords.lng} (погрешность ±${gpsAccuracy ?? 5}м)`
            : 'Определение GPS...'
        }
      >
        <Navigation className="size-3 sm:size-3.5 text-primary shrink-0" />
        <span className="hidden sm:inline">GPS:</span>
        <span className="text-foreground font-semibold">
          ±{gpsAccuracy ?? 5}м
        </span>
      </div>

      {/* Battery status */}
      <div
        className="flex items-center gap-1 font-mono text-[11px] sm:text-xs"
        title={`Заряд батареи: ${batteryLevel}% ${isCharging ? '(Зарядка)' : ''}`}
      >
        {isCharging ? (
          <BatteryCharging className="size-3.5 text-emerald-500" />
        ) : (
          <Battery
            className={cn(
              'size-3.5',
              batteryLevel > 40
                ? 'text-emerald-500'
                : batteryLevel > 15
                ? 'text-amber-500'
                : 'text-destructive'
            )}
          />
        )}
        <span
          className={cn(
            'font-semibold',
            batteryLevel <= 15 ? 'text-destructive font-bold' : 'text-foreground'
          )}
        >
          {batteryLevel}%
        </span>
      </div>
    </div>
  );
}
