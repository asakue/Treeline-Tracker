'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  User,
  Shield,
  Siren,
  Sliders,
  Terminal,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { TransportManager } from '@/core/transport';
import { ChaosSimulator, type ChaosConfig } from '@/core/transport/chaos-simulator';
import { AuditLogger } from '@/core/transport/audit-logger';
import { Rbac, ROLE_PERMISSIONS, type AuthSession } from '@/core/security/rbac-service';
import type { UserRole, AuditLogEntry } from '@/core/domain/types';
import type { TransportStatus } from '@/core/transport/interfaces';
import { LocationFilter } from '@/core/location';
import { TelemetryIndicators } from './telemetry-indicators';
import { AuthDialog } from './auth-dialog';
import { ChaosDialog } from './chaos-dialog';
import { AuditLogDialog } from './audit-log-dialog';

export default function ExpeditionStatusBar() {
  // Live status states
  const [transportStatus, setTransportStatus] = useState<TransportStatus>(() =>
    TransportManager.getStatus()
  );
  const [session, setSession] = useState<AuthSession>(() => Rbac.getSession());
  const [chaosConfig, setChaosConfig] = useState<ChaosConfig>(() => ChaosSimulator.getConfig());

  // GPS state with deadband filtering
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const locationFilterRef = useRef<LocationFilter>(
    new LocationFilter({ deadbandMeters: 5, minIntervalMs: 5000, adaptiveBatterySavings: true })
  );

  // Battery state
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [isCharging, setIsCharging] = useState<boolean>(false);

  // Modal dialog states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChaosModalOpen, setIsChaosModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Audit entries state
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>(() =>
    AuditLogger.getEntries()
  );

  // Subscriptions to core services
  useEffect(() => {
    const unsubTransport = TransportManager.subscribe((status) => {
      setTransportStatus(status);
    });
    const unsubRbac = Rbac.subscribe((sess) => {
      setSession(sess);
    });
    const unsubChaos = ChaosSimulator.subscribe((cfg) => {
      setChaosConfig(cfg);
      if (cfg.batteryOverride !== null) {
        setBatteryLevel(cfg.batteryOverride);
      }
    });
    const unsubAudit = AuditLogger.subscribe(() => {
      setAuditEntries(AuditLogger.getEntries());
    });

    return () => {
      unsubTransport();
      unsubRbac();
      unsubChaos();
      unsubAudit();
    };
  }, []);

  // Battery API integration
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          const update = () => {
            if (ChaosSimulator.getConfig().batteryOverride === null) {
              setBatteryLevel(Math.round(battery.level * 100));
              setIsCharging(battery.charging);
            }
          };
          update();
          battery.addEventListener('levelchange', update);
          battery.addEventListener('chargingchange', update);
        })
        .catch(() => {});
    }
  }, []);

  // Geolocation watch
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const raw = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          acc: Math.round(pos.coords.accuracy),
        };
        const filter = locationFilterRef.current;
        const evaluation = filter.evaluateTransmission({
          latitude: raw.lat,
          longitude: raw.lng,
          accuracy: raw.acc,
          timestamp: pos.timestamp,
        });

        if (evaluation.shouldTransmit || !gpsCoords) {
          setGpsCoords({ lat: raw.lat, lng: raw.lng });
          setGpsAccuracy(raw.acc);
        }
      },
      (err) => {
        console.warn('Geolocation sensor notice:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [session.uid, gpsCoords]);

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'hiker':
        return User;
      case 'guide':
        return ShieldCheck;
      case 'rescuer':
        return Siren;
      case 'admin':
        return Shield;
      default:
        return User;
    }
  };

  const RoleIcon = getRoleIcon(session.role);

  return (
    <>
      <header className="h-10 sm:h-11 bg-card/90 backdrop-blur-md border-b border-border/80 px-2 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-30 select-none">
        {/* Left & Middle Telemetry: Active Channel, GPS, Battery */}
        <TelemetryIndicators
          transportStatus={transportStatus}
          gpsAccuracy={gpsAccuracy}
          gpsCoords={gpsCoords}
          batteryLevel={batteryLevel}
          isCharging={isCharging}
        />

        {/* Right controls: RBAC Role switcher, Chaos button, Audit log button */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAuthModalOpen(true)}
            className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs gap-1 border-border/80 hover:bg-accent/40"
            title="Нажмите для смены роли (Hiker, Guide, Rescuer, Admin) и проверки RBAC"
          >
            <RoleIcon className="size-3 sm:size-3.5 text-primary shrink-0" />
            <span className="font-medium text-xs max-w-[80px] sm:max-w-none truncate">
              {ROLE_PERMISSIONS[session.role].label.split(' ')[0]}
            </span>
            <ChevronDown className="size-3 text-muted-foreground hidden sm:inline" />
          </Button>

          <Button
            variant={
              chaosConfig.forceOfflineInternet ||
              chaosConfig.forceOfflineMesh ||
              chaosConfig.packetDropRate > 0
                ? 'destructive'
                : 'ghost'
            }
            size="icon"
            onClick={() => setIsChaosModalOpen(true)}
            className="size-7 sm:size-8 text-muted-foreground hover:text-foreground shrink-0"
            title="Хаос-тестирование: обрыв связи, потеря пакетов, задержка"
          >
            <Sliders className="size-3.5 sm:size-4" />
            <span className="sr-only">Хаос-симулятор</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsAuditModalOpen(true)}
            className="size-7 sm:size-8 text-muted-foreground hover:text-foreground shrink-0"
            title="Журнал аудита событий безопасности и транспорта"
          >
            <Terminal className="size-3.5 sm:size-4" />
            <span className="sr-only">Журнал событий</span>
          </Button>
        </div>
      </header>

      {/* Modular Modals */}
      <AuthDialog
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        session={session}
      />

      <ChaosDialog
        open={isChaosModalOpen}
        onOpenChange={setIsChaosModalOpen}
        chaosConfig={chaosConfig}
      />

      <AuditLogDialog
        open={isAuditModalOpen}
        onOpenChange={setIsAuditModalOpen}
        entries={auditEntries}
        onClear={() => {
          AuditLogger.clear();
          setAuditEntries([]);
        }}
      />
    </>
  );
}
