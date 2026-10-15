'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Switch } from '@/shared/ui/switch';
import { Label } from '@/shared/ui/label';
import { Slider } from '@/shared/ui/slider';
import {
  AlertTriangle,
  Wifi,
  WifiOff,
  Radio,
  
  RefreshCw,
  Send,
  ShieldAlert,
  BatteryCharging,
} from 'lucide-react';
import { ChaosSimulator, ChaosConfig } from '@/core/transport/chaos-simulator';
import { TransportManager } from '@/core/transport/transport-manager';
import type { TransportStatus } from '@/core/transport/interfaces';
import { AuditLogger } from '@/core/transport/audit-logger';
import { useToast } from '@/shared/hooks/use-toast';

interface ChaosControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  transportStatus: TransportStatus;
}

export function ChaosControlModal({ isOpen, onClose, transportStatus }: ChaosControlModalProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<ChaosConfig>(() => ChaosSimulator.getConfig());
  const [isFlushing, setIsFlushing] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const updateParam = (patch: Partial<ChaosConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    ChaosSimulator.updateConfig(patch);
  };

  const handleTestPacket = async () => {
    setIsSendingTest(true);
    try {
      const res = await TransportManager.sendPacket({
        type: 'LOCATION_UPDATE',
        priority: 'NORMAL',
        timestamp: Date.now(),
        payload: {
          hikerId: 'sim_test_user',
          latitude: 43.355,
          longitude: 42.439,
          accuracy: 5,
          timestamp: Date.now(),
        },
      });

      toast({
        title: res.delivered ? 'Пакет успешно доставлен' : 'Пакет помещен в буфер',
        description: `Канал: ${res.channel}. ${res.error ? `Причина: ${res.error}` : ''}`,
        variant: res.delivered ? 'default' : 'destructive',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleReplayAttack = async () => {
    // Generate a packet with a duplicate or ancient timestamp (>10 min ago)
    AuditLogger.log(
      'SECURITY',
      '[ХАОС-СИМУЛЯТОР] Эмуляция атаки повторного воспроизведения (Replay Attack) с устаревшим timestamp...'
    );

    const oldTimestamp = Date.now() - 15 * 60 * 1000; // 15 mins ago (violates 10-min window)
    const res = await TransportManager.sendPacket({
      type: 'LOCATION_UPDATE',
      priority: 'NORMAL',
      timestamp: oldTimestamp,
      payload: {
        hikerId: 'attacker_replay_bot',
        latitude: 43.355,
        longitude: 42.439,
        timestamp: oldTimestamp,
        isReplayed: true,
      },
    });

    toast({
      title: 'Атака повтора смоделирована',
      description: 'Anti-Replay фильтр зафиксировал попытку и заблокировал пакет (см. журнал аудита).',
    });
  };

  const handleFlush = async () => {
    setIsFlushing(true);
    try {
      const count = await TransportManager.flushQueue();
      toast({
        title: 'Сброс оффлайн-очереди',
        description: `Синхронизировано пакетов: ${count}`,
      });
    } finally {
      setIsFlushing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Симулятор сбоев и помех (FR-024)</DialogTitle>
              <DialogDescription>
                Эмуляция экстремальных условий связи в высокогорье
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2 text-sm">
          {/* Channel Blackout Controls */}
          <div className="space-y-4 rounded-lg border border-border p-3 bg-muted/20">
            <h4 className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
              Каналы передачи данных
            </h4>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {config.forceOfflineInternet ? (
                  <WifiOff className="size-4 text-destructive" />
                ) : (
                  <Wifi className="size-4 text-emerald-500" />
                )}
                <div>
                  <Label htmlFor="toggle-internet" className="cursor-pointer">
                    Искусственный обрыв сотовой сети
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Блокирует отправку в Cloud Firestore
                  </p>
                </div>
              </div>
              <Switch
                id="toggle-internet"
                checked={config.forceOfflineInternet}
                onCheckedChange={(checked) => updateParam({ forceOfflineInternet: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {config.forceOfflineMesh ? (
                  <Radio className="size-4 text-destructive" />
                ) : (
                  <Radio className="size-4 text-emerald-500" />
                )}
                <div>
                  <Label htmlFor="toggle-mesh" className="cursor-pointer">
                    Подавление радиосети MeshCore
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Эмулирует нахождение в радио-тени ущелья
                  </p>
                </div>
              </div>
              <Switch
                id="toggle-mesh"
                checked={config.forceOfflineMesh}
                onCheckedChange={(checked) => updateParam({ forceOfflineMesh: checked })}
              />
            </div>
          </div>

          {/* Packet Loss Slider */}
          <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
            <div className="flex justify-between items-center">
              <Label className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
                Процент коллизий / потерь пакетов
              </Label>
              <span className="font-mono text-xs font-bold text-foreground">
                {Math.round(config.packetDropRate * 100)}%
              </span>
            </div>
            <Slider
              value={[Math.round(config.packetDropRate * 100)]}
              min={0}
              max={100}
              step={5}
              onValueChange={([val]) => updateParam({ packetDropRate: val / 100 })}
            />
            <p className="text-xs text-muted-foreground">
              Случайный сброс пакетов из-за радиопомех или плохого приёма
            </p>
          </div>

          {/* Offline Queue Status & Manual Trigger */}
          <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Оффлайн-буфер Store-and-Forward
              </span>
              <span className="font-mono text-xs font-semibold">
                {transportStatus.queuedCount} пакетов
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleTestPacket}
                disabled={isSendingTest}
              >
                <Send className="size-3.5 mr-1" />
                Тестовый пакет
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleFlush}
                disabled={isFlushing || transportStatus.queuedCount === 0}
              >
                <RefreshCw className={`size-3.5 mr-1 ${isFlushing ? 'animate-spin' : ''}`} />
                Выгрузить буфер
              </Button>
            </div>
          </div>

          {/* Attack Simulator */}
          <div className="space-y-2 rounded-lg border border-destructive/30 p-3 bg-destructive/5">
            <div className="flex items-center gap-2 text-destructive font-semibold text-xs uppercase">
              <ShieldAlert className="size-4" />
              <span>Тестирование безопасности (FR-009)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Проверка защиты от повторных атак (Replay Protection Window 10 min)
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="w-full text-xs"
              onClick={handleReplayAttack}
            >
              Смоделировать атаку Replay
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              updateParam({
                forceOfflineInternet: false,
                forceOfflineMesh: false,
                packetDropRate: 0,
                batteryOverride: null,
              });
              onClose();
            }}
          >
            Сбросить все сбои в норму
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
