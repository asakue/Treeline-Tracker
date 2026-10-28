'use client';

import { Sliders } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { Slider } from '@/shared/ui/slider';
import { useToast } from '@/shared/hooks/use-toast';
import { ChaosSimulator, type ChaosConfig } from '@/core/transport/chaos-simulator';

interface ChaosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chaosConfig: ChaosConfig;
}

export function ChaosDialog({ open, onOpenChange, chaosConfig }: ChaosDialogProps) {
  const { toast } = useToast();

  const handleReset = () => {
    ChaosSimulator.updateConfig({
      forceOfflineInternet: false,
      forceOfflineMesh: false,
      packetDropRate: 0,
      batteryOverride: null,
    });
    toast({
      title: 'Параметры сброшены',
      description: 'Все каналы связи и параметры батареи восстановлены в штатный режим.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Sliders className="size-5" />
            <span>Хаос-тестирование устойчивости (FR-024)</span>
          </DialogTitle>
          <DialogDescription>
            Симуляция суровых условий горного похода: обрыв интернета, экранирование радиоканала и потеря пакетов.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Force Offline Internet */}
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
            <div className="space-y-0.5">
              <Label className="font-semibold text-foreground text-xs">
                Отключить Интернет-канал
              </Label>
              <p className="text-muted-foreground text-[11px]">
                Имитация глубокого ущелья и отсутствия сотовой связи (LTE / GSM)
              </p>
            </div>
            <Switch
              checked={chaosConfig.forceOfflineInternet}
              onCheckedChange={(checked) =>
                ChaosSimulator.updateConfig({ forceOfflineInternet: checked })
              }
            />
          </div>

          {/* Force Offline Mesh */}
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
            <div className="space-y-0.5">
              <Label className="font-semibold text-foreground text-xs">
                Отключить MeshCore радиоканал
              </Label>
              <p className="text-muted-foreground text-[11px]">
                Имитация скального экранирования и сильных радиопомех
              </p>
            </div>
            <Switch
              checked={chaosConfig.forceOfflineMesh}
              onCheckedChange={(checked) =>
                ChaosSimulator.updateConfig({ forceOfflineMesh: checked })
              }
            />
          </div>

          {/* Packet Drop Rate */}
          <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-2">
            <div className="flex justify-between items-center">
              <Label className="font-semibold text-foreground text-xs">
                Искусственная потеря пакетов
              </Label>
              <span className="font-mono font-bold text-primary">
                {Math.round(chaosConfig.packetDropRate * 100)}%
              </span>
            </div>
            <Slider
              value={[chaosConfig.packetDropRate * 100]}
              min={0}
              max={75}
              step={5}
              onValueChange={([val]) =>
                ChaosSimulator.updateConfig({ packetDropRate: val / 100 })
              }
            />
            <p className="text-[10px] text-muted-foreground">
              Случайный сброс пакетов телеметрии для проверки дедупликации и очереди
            </p>
          </div>

          {/* Battery Override */}
          <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-2">
            <div className="flex justify-between items-center">
              <Label className="font-semibold text-foreground text-xs">
                Имитация разряда батареи
              </Label>
              <span className="font-mono font-bold text-foreground">
                {chaosConfig.batteryOverride !== null
                  ? `${chaosConfig.batteryOverride}%`
                  : 'Реальная'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={chaosConfig.batteryOverride === 8 ? 'destructive' : 'outline'}
                className="flex-1 text-xs h-7"
                onClick={() => ChaosSimulator.updateConfig({ batteryOverride: 8 })}
              >
                Критический 8%
              </Button>
              <Button
                size="sm"
                variant={chaosConfig.batteryOverride === 25 ? 'secondary' : 'outline'}
                className="flex-1 text-xs h-7"
                onClick={() => ChaosSimulator.updateConfig({ batteryOverride: 25 })}
              >
                Низкий 25%
              </Button>
              <Button
                size="sm"
                variant={chaosConfig.batteryOverride === null ? 'default' : 'outline'}
                className="flex-1 text-xs h-7"
                onClick={() => ChaosSimulator.updateConfig({ batteryOverride: null })}
              >
                Сброс
              </Button>
            </div>
          </div>

          {/* Quick reset */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleReset}
          >
            Восстановить нормальную связь
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Готово</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
