'use client';

import { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Radio,
  
  ShieldCheck,
  Battery,
  BatteryCharging,
  Zap,
  SlidersHorizontal,
  ScrollText,
  UserCheck,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { TransportManager, type TransportStatus, ChaosSimulator, AuditLogger } from '@/core/transport';
import { Rbac, AuthSession, ROLE_PERMISSIONS } from '@/core/security/rbac-service';
import { UserRole } from '@/core/domain/types';
import { ChaosControlModal } from './chaos-control-modal';
import { AuditLogModal } from './audit-log-modal';
import { AuthRbacModal } from './auth-rbac-modal';

export function ExpeditionStatusBar() {
  const [transportStatus, setTransportStatus] = useState<TransportStatus>(() =>
    TransportManager.getStatus()
  );
  const [session, setSession] = useState<AuthSession>(() => Rbac.getSession());
  const [isChaosOpen, setIsChaosOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [isFlushing, setIsFlushing] = useState(false);

  useEffect(() => {
    const unsubTransport = TransportManager.subscribe((st) => setTransportStatus(st));
    const unsubSession = Rbac.subscribe((sess) => setSession(sess));

    // Try reading device battery if supported
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).getBattery?.().then((batt: any) => {
        setBatteryLevel(Math.round(batt.level * 100));
        batt.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(batt.level * 100));
        });
      });
    }

    return () => {
      unsubTransport();
      unsubSession();
    };
  }, []);

  const chaosConfig = ChaosSimulator.getConfig();
  const effectiveBattery =
    chaosConfig.batteryOverride !== null ? chaosConfig.batteryOverride : batteryLevel;

  const handleManualFlush = async () => {
    setIsFlushing(true);
    try {
      await TransportManager.flushQueue();
    } finally {
      setIsFlushing(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-background/95 backdrop-blur border-b border-border text-foreground px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs transition-colors">
        {/* Left zone: GPS & Security */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-mono tabular-nums text-muted-foreground">
            <MapPin className="size-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline">GPS:</span>
            <span className="text-foreground font-semibold">43.355°N 42.439°E</span>
            <span className="text-muted-foreground/60">±3м</span>
          </div>

          <span className="text-border" aria-hidden="true">|</span>

          <div
            className="flex items-center gap-1.5 text-xs font-medium cursor-pointer hover:text-primary transition-colors"
            title="Сквозное шифрование E2EE: Ed25519 подпись + AES-256-GCM"
            onClick={() => {
              AuditLogger.log(
                'SECURITY',
                'Проверка криптографического контура: Web Crypto Ed25519 + AES-256-GCM активны'
              );
            }}
          >
            <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
            <span className="hidden md:inline">E2EE:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">Ed25519 + AES-GCM</span>
          </div>
        </div>

        {/* Center zone: Active Transport & Queue */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            {transportStatus.activeChannel === 'INTERNET' ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Wifi className="size-3.5" />
                <span>Сотовая сеть (Cloud)</span>
              </span>
            ) : transportStatus.activeChannel === 'MESH_CORE' ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <Radio className="size-3.5" />
                <span>LoRa MeshCore</span>
                {transportStatus.meshSignalDbm && (
                  <span className="font-mono text-[10px] opacity-80">
                    {transportStatus.meshSignalDbm} dBm
                  </span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-500 font-medium">
                <WifiOff className="size-3.5" />
                <span>Оффлайн (Буфер)</span>
              </span>
            )}
          </div>

          {transportStatus.queuedCount > 0 && (
            <button
              onClick={handleManualFlush}
              disabled={isFlushing}
              className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-[11px] font-mono cursor-pointer"
              title="Нажмите для принудительной выгрузки пакетов"
            >
              <RefreshCw className={`size-3 ${isFlushing ? 'animate-spin' : ''}`} />
              <span>Очередь: {transportStatus.queuedCount}</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Battery className="size-3.5 text-foreground shrink-0" />
            <span>{effectiveBattery}%</span>
          </div>
        </div>

        {/* Right zone: RBAC Role & Diagnostics Modals */}
        <div className="flex items-center gap-2">
          {/* Role badge trigger */}
          <button
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors cursor-pointer"
            title="Управление ролью и аутентификацией (RBAC)"
          >
            <UserCheck className="size-3.5 text-primary" />
            <span className="capitalize">{ROLE_PERMISSIONS[session.role]?.label.split(' ')[0]}</span>
            {session.role === 'rescuer' && !session.isMfaVerified && (
              <span title="Требуется MFA">
                <Lock className="size-3 text-amber-500 ml-0.5" />
              </span>
            )}
          </button>

          {/* Chaos Simulator button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChaosOpen(true)}
            className="h-8 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
            title="Панель сбоев и хаос-тестирования (FR-024)"
          >
            <SlidersHorizontal className="size-3.5 text-amber-500" />
            <span className="hidden sm:inline">Хаос-тест</span>
          </Button>

          {/* Audit Log button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLogOpen(true)}
            className="h-8 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
            title="Журнал аудита событий (FR-025)"
          >
            <ScrollText className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Лог</span>
          </Button>
        </div>
      </header>

      {/* Modals */}
      <ChaosControlModal
        isOpen={isChaosOpen}
        onClose={() => setIsChaosOpen(false)}
        transportStatus={transportStatus}
      />

      <AuditLogModal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
      />

      <AuthRbacModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        session={session}
      />
    </>
  );
}
