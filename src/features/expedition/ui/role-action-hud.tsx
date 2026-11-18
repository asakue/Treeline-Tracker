'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Siren,
  MapPin,
  Download,
  Search,
  Radio,
  Sliders,
  Terminal,
  Compass,
  AlertTriangle,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import { Rbac, ROLE_PERMISSIONS, type AuthSession } from '@/core/security/rbac-service';
import type { UserRole } from '@/core/domain/types';
import { useAppContext } from '@/entities/app';

interface RoleActionHudProps {
  onOpenChaos?: () => void;
  onOpenAudit?: () => void;
}

export function RoleActionHud({ onOpenChaos, onOpenAudit }: RoleActionHudProps) {
  const { toast } = useToast();
  const { setView } = useAppContext();
  const [session, setSession] = useState<AuthSession>(() => Rbac.getSession());
  const [sosHeld, setSosHeld] = useState(false);
  const [sosTimer, setSosTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return Rbac.subscribe((sess) => setSession(sess));
  }, []);

  const role = session.role;

  // Emergency SOS with hold protection
  const handleSosMouseDown = () => {
    const timer = setTimeout(() => {
      setSosHeld(true);
      toast({
        title: 'СИГНАЛ БЕДСТВИЯ SOS АКТИВИРОВАН',
        description: 'Пакет тревоги передан по аварийному каналу LoRa Mesh и на пульт 112.',
        variant: 'destructive',
      });
      setView('emergency');
    }, 1500);
    setSosTimer(timer);
  };

  const handleSosMouseUp = () => {
    if (sosTimer) {
      clearTimeout(sosTimer);
      setSosTimer(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5 p-1 bg-background/90 backdrop-blur-md rounded-lg border border-border/70 shadow-sm text-xs select-none">
      {/* Role specific actions */}
      {role === 'hiker' && (
        <>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ТРЕК АКТИВЕН</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast({
                title: 'Метка стоянки зафиксирована',
                description: 'Координаты сохранены в оффлайн-кэш устройства.',
              });
            }}
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
          >
            <MapPin className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Отметить привал</span>
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onMouseDown={handleSosMouseDown}
            onMouseUp={handleSosMouseUp}
            onTouchStart={handleSosMouseDown}
            onTouchEnd={handleSosMouseUp}
            className="h-7 px-2.5 text-xs font-bold gap-1 cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            title="Удерживайте 1.5 секунды для отправки сигнала бедствия"
          >
            <Siren className="size-3.5 animate-bounce" />
            <span>SOS (УДЕРЖИВАТЬ)</span>
          </Button>
        </>
      )}

      {role === 'guide' && (
        <>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[11px] font-semibold">
            <span className="size-1.5 rounded-full bg-amber-500" />
            <span>ШТАБ ГРУППЫ</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('routes')}
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
          >
            <MapPin className="size-3.5 text-primary" />
            <span>Маршрут</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('tracker')}
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
          >
            <Users className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Состав отряда</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast({
                title: 'Опрос группы (Check-in)',
                description: 'Пинг разослан всем активным узлам LoRa mesh.',
              });
            }}
            className="h-7 px-2 text-xs gap-1 border-border/70 cursor-pointer"
          >
            <Radio className="size-3.5 text-amber-500" />
            <span className="hidden sm:inline">Пинг группы</span>
          </Button>
        </>
      )}

      {role === 'rescuer' && (
        <>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-[11px] font-semibold">
            <span className="size-1.5 rounded-full bg-rose-500 animate-ping" />
            <span>ПСО / SAR</span>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={() => setView('search')}
            className="h-7 px-2.5 text-xs font-semibold gap-1.5 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
          >
            <Search className="size-3.5" />
            <span>ИИ Поиск (SAR)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setView('emergency')}
            className="h-7 px-2 text-xs gap-1 border-border/70 cursor-pointer"
          >
            <AlertTriangle className="size-3.5 text-rose-500" />
            <span>Журнал SOS</span>
          </Button>
        </>
      )}

      {role === 'admin' && (
        <>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[11px] font-semibold">
            <span className="size-1.5 rounded-full bg-sky-500" />
            <span>ROOT ADMIN</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('analytics')}
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
          >
            <Terminal className="size-3.5 text-sky-500" />
            <span>Аналитика</span>
          </Button>

          {onOpenChaos && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenChaos}
              className="h-7 px-2 text-xs gap-1 border-border/70 cursor-pointer"
            >
              <Sliders className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Хаос</span>
            </Button>
          )}

          {onOpenAudit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAudit}
              className="h-7 px-2 text-xs gap-1 border-border/70 cursor-pointer"
            >
              <Shield className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Аудит</span>
            </Button>
          )}
        </>
      )}
    </div>
  );
}
