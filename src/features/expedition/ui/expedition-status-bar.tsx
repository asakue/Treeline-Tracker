'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Wifi,
  Radio,
  CloudOff,
  Battery,
  BatteryCharging,
  ShieldCheck,
  Navigation,
  User,
  Shield,
  Siren,
  KeyRound,
  Sliders,
  Terminal,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Download,
  Trash2,
  Search,
  ExternalLink,
  ChevronDown,
  Mountain,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { Slider } from '@/shared/ui/slider';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';
import { TransportManager } from '@/core/transport';
import { ChaosSimulator, type ChaosConfig } from '@/core/transport/chaos-simulator';
import { AuditLogger } from '@/core/transport/audit-logger';
import { Rbac, ROLE_PERMISSIONS, type AuthSession } from '@/core/security/rbac-service';
import type { UserRole, AuditLogEntry } from '@/core/domain/types';
import type { TransportStatus } from '@/core/transport/interfaces';
import { LocationFilter } from '@/core/location';

export default function ExpeditionStatusBar() {
  const { toast } = useToast();

  // Status states
  const [transportStatus, setTransportStatus] = useState<TransportStatus>(() =>
    TransportManager.getStatus()
  );
  const [session, setSession] = useState<AuthSession>(() => Rbac.getSession());
  const [chaosConfig, setChaosConfig] = useState<ChaosConfig>(() => ChaosSimulator.getConfig());

  // GPS state
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const locationFilterRef = useRef<LocationFilter>(
    new LocationFilter({ deadbandMeters: 5, minIntervalMs: 5000, adaptiveBatterySavings: true })
  );

  // Battery state
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [isCharging, setIsCharging] = useState<boolean>(false);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChaosModalOpen, setIsChaosModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Auth form state
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState(false);

  // Audit filter state
  const [auditFilter, setAuditFilter] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>(() =>
    AuditLogger.getEntries()
  );

  // Subscribe to TransportManager, Rbac, Chaos, Audit
  useEffect(() => {
    const unsubTransport = TransportManager.subscribe((status) => {
      setTransportStatus(status);
    });
    const unsubRbac = Rbac.subscribe((sess) => {
      setSession(sess);
    });
    const unsubChaos = ChaosSimulator.subscribe((cfg) => {
      setChaosConfig(cfg);
      setTransportStatus(TransportManager.getStatus());
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

  // Monitor Geolocation
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const evalTrans = locationFilterRef.current.evaluateTransmission({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          batteryLevel,
          timestamp: pos.timestamp,
        });

        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsCoords({
          lat: parseFloat(pos.coords.latitude.toFixed(5)),
          lng: parseFloat(pos.coords.longitude.toFixed(5)),
        });

        if (evalTrans.shouldTransmit) {
          AuditLogger.log(
            'GPS',
            `[GPS ТЕЛЕМЕТРИЯ] Точка зафиксирована: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (±${Math.round(pos.coords.accuracy)}м, смещение: ${Math.round(evalTrans.distanceMoved)}м)`
          );
        }
      },
      () => {
        // Fallback simulated mountain GPS lock
        setGpsAccuracy(6);
        setGpsCoords({ lat: 43.5042, lng: 42.0125 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Battery monitoring (with Chaos simulator override)
  useEffect(() => {
    if (chaosConfig.batteryOverride !== null) {
      setBatteryLevel(chaosConfig.batteryOverride);
      return;
    }

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as unknown as { getBattery: () => Promise<any> })
        .getBattery()
        .then((battery) => {
          setBatteryLevel(Math.round(battery.level * 100));
          setIsCharging(battery.charging);

          const onLevelChange = () => setBatteryLevel(Math.round(battery.level * 100));
          const onChargingChange = () => setIsCharging(battery.charging);

          battery.addEventListener('levelchange', onLevelChange);
          battery.addEventListener('chargingchange', onChargingChange);
        })
        .catch(() => {});
    }
  }, [chaosConfig.batteryOverride]);

  // Flush offline queue action
  const handleFlushQueue = async () => {
    const count = await TransportManager.flushQueue();
    if (count > 0) {
      toast({
        title: 'Очередь синхронизирована',
        description: `Успешно отправлено ${count} пакетов через активный канал.`,
      });
    } else {
      toast({
        title: 'Очередь пуста',
        description: 'Все накопленные пакеты уже доставлены на сервер или в радиосеть.',
      });
    }
    setTransportStatus(TransportManager.getStatus());
  };

  // Switch role handler
  const handleSelectRole = (newRole: UserRole) => {
    Rbac.switchRole(newRole);
    toast({
      title: `Роль изменена: ${ROLE_PERMISSIONS[newRole].label}`,
      description: ROLE_PERMISSIONS[newRole].description,
    });
  };

  // MFA verification
  const handleVerifyMfa = () => {
    if (Rbac.verifyMfa(mfaCode)) {
      setMfaError(false);
      setMfaCode('');
      toast({
        title: 'MFA подтверждено',
        description: 'Двухфакторная аутентификация успешно пройдена.',
      });
    } else {
      setMfaError(true);
      toast({
        title: 'Ошибка проверки',
        description: 'Введите 6-значный проверочный код (например: 123456)',
        variant: 'destructive',
      });
    }
  };

  // Filtered audit entries
  const filteredAuditEntries = useMemo(() => {
    return auditEntries.filter((entry) => {
      const matchCat = auditFilter === 'ALL' || entry.category === auditFilter;
      const matchSearch =
        !auditSearch ||
        entry.message.toLowerCase().includes(auditSearch.toLowerCase()) ||
        entry.category.toLowerCase().includes(auditSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [auditEntries, auditFilter, auditSearch]);

  // Export audit logs
  const handleExportAudit = () => {
    const json = JSON.stringify(auditEntries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treeline-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Журнал экспортирован',
      description: 'Файл treeline-audit.json сохранен на устройство.',
    });
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'guide':
        return Mountain;
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
      {/* Top Expedition Status Bar */}
      <header
        role="region"
        aria-label="Панель состояния экспедиции"
        className="w-full bg-card/95 backdrop-blur-md border-b border-border/80 text-foreground z-30 shrink-0 select-none shadow-xs"
      >
        <div className="flex items-center justify-between px-2.5 sm:px-4 py-1.5 sm:py-2 gap-2 overflow-x-auto no-scrollbar">
          {/* Left section: Transport status & failover indicator */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {transportStatus.activeChannel === 'INTERNET' && (
              <span
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                title="Подключено к облачному серверу через Интернет (HTTPS / WebSocket)"
              >
                <Wifi className="size-3 sm:size-3.5 text-emerald-500" />
                <span className="hidden xs:inline">Интернет</span>
              </span>
            )}

            {transportStatus.activeChannel === 'MESH_CORE' && (
              <span
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                title={`Радиоканал MeshCore LoRa (${transportStatus.meshSignalDbm ?? -82} dBm)`}
              >
                <Radio className="size-3 sm:size-3.5 text-blue-500" />
                <span>Радиоканал Mesh</span>
                <span className="hidden sm:inline text-[10px] opacity-80">
                  {transportStatus.meshSignalDbm ?? -82} dBm
                </span>
              </span>
            )}

            {transportStatus.activeChannel === 'OFFLINE_QUEUE' && (
              <span
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                title="Связь отсутствует. Пакеты накапливаются в локальном буфере store-and-forward"
              >
                <CloudOff className="size-3 sm:size-3.5 text-amber-500" />
                <span>Офлайн-буфер</span>
              </span>
            )}

            {/* Offline queue count & flush action */}
            {transportStatus.queuedCount > 0 && (
              <button
                onClick={handleFlushQueue}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors cursor-pointer"
                title="Нажмите для синхронизации очереди"
              >
                <RefreshCw className="size-2.5 animate-spin" />
                <span>{transportStatus.queuedCount} в очереди</span>
              </button>
            )}

            {/* E2EE Crypto badge */}
            <span
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hidden md:inline-flex"
              title="Шифрование AES-256-GCM + цифровые подписи Ed25519"
            >
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>E2EE Защита</span>
            </span>
          </div>

          {/* Middle section: GPS satellite lock */}
          <div className="flex items-center gap-1.5 sm:gap-3 text-xs text-muted-foreground shrink-0">
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

          {/* Right section: RBAC Role switcher, Chaos button, Audit log button */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* RBAC Role trigger button */}
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

            {/* Chaos Simulator button */}
            <Button
              variant={chaosConfig.forceOfflineInternet || chaosConfig.forceOfflineMesh || chaosConfig.packetDropRate > 0 ? 'destructive' : 'ghost'}
              size="icon"
              onClick={() => setIsChaosModalOpen(true)}
              className="size-7 sm:size-8 text-muted-foreground hover:text-foreground shrink-0"
              title="Хаос-тестирование: обрыв связи, потеря пакетов, задержка"
            >
              <Sliders className="size-3.5 sm:size-4" />
              <span className="sr-only">Хаос-симулятор</span>
            </Button>

            {/* Audit Log button */}
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
        </div>
      </header>

      {/* ========================================================
          1. AUTH & RBAC ROLE SWITCHER MODAL (FR-001a – FR-001e)
         ======================================================== */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              <span>Аутентификация и роли (RBAC)</span>
            </DialogTitle>
            <DialogDescription>
              Быстрое переключение ролей для тестирования прав доступа и сценариев работы.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current user card */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">
                  {session.displayName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {session.isAnonymous ? 'Гостевой режим' : session.provider}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {session.email || 'Анонимный сеанс с локальным криптографическим ключом'}
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                <span>UID: {session.uid.slice(0, 16)}...</span>
                {session.isMfaVerified && (
                  <span className="text-emerald-500 flex items-center gap-0.5">
                    <CheckCircle2 className="size-3" /> MFA подтверждено
                  </span>
                )}
              </div>
            </div>

            {/* Role switcher selection */}
            <div>
              <Label className="text-xs font-semibold mb-2 block">
                Выберите активную роль системы:
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['hiker', 'guide', 'rescuer', 'admin'] as UserRole[]).map((role) => {
                  const info = ROLE_PERMISSIONS[role];
                  const isCurrent = session.role === role;
                  const Icon = getRoleIcon(role);

                  return (
                    <button
                      key={`role-pick-${role}`}
                      onClick={() => handleSelectRole(role)}
                      className={cn(
                        'p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1 cursor-pointer',
                        isCurrent
                          ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary/40'
                          : 'bg-card hover:bg-muted/60 border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                          <Icon className="size-3.5 text-primary" />
                          {info.label.split(' ')[0]}
                        </span>
                        {isCurrent && <CheckCircle2 className="size-3.5 text-primary" />}
                      </div>
                      <span className="text-[10px] leading-tight text-muted-foreground">
                        {info.description.slice(0, 58)}...
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MFA prompt for Rescuer / Admin */}
            {ROLE_PERMISSIONS[session.role].requiresMfa && !session.isMfaVerified && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                  <KeyRound className="size-4" />
                  <span>Требуется двухфакторная аутентификация (MFA)</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Для доступа к закрытым координатам всех групп и спасательным ИИ-моделям введите проверочный код TOTP (любые 6 цифр, напр. 123456):
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="6-значный код"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    className="h-8 text-xs font-mono"
                    maxLength={6}
                  />
                  <Button size="sm" onClick={handleVerifyMfa} className="h-8 text-xs shrink-0">
                    Подтвердить
                  </Button>
                </div>
              </div>
            )}

            {/* Fast sign-in / link account */}
            <div className="pt-2 border-t border-border space-y-2">
              <Label className="text-xs font-semibold">Учётная запись:</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    Rbac.signIn('guide@treeline.app', 'Иван (Инструктор)', 'guide');
                    toast({ title: 'Вход выполнен', description: 'Сеанс руководителя группы активирован.' });
                  }}
                >
                  Войти как Инструктор
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    Rbac.signIn('rescuer@mchs.gov', 'Отряд ПСО 112', 'rescuer');
                    toast({ title: 'Вход выполнен', description: 'Сеанс дежурного спасателя активирован.' });
                  }}
                >
                  Войти как Спасатель
                </Button>
              </div>
              <div className="flex justify-between items-center pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    Rbac.signOut();
                    toast({ title: 'Сеанс завершен', description: 'Кэш очищен. Активирован гостевой профиль.' });
                  }}
                >
                  Выйти из системы
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  JWT: автопродление
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsAuthModalOpen(false)} className="w-full sm:w-auto">
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          2. CHAOS SIMULATOR MODAL (FR-024)
         ======================================================== */}
      <Dialog open={isChaosModalOpen} onOpenChange={setIsChaosModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Sliders className="size-5" />
              <span>Хаос-тестирование устойчивости (FR-024)</span>
            </DialogTitle>
            <DialogDescription>
              Симуляция суровых условий горного похода: обрыв интернета, глушение радиоканала и потеря пакетов.
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
              onClick={() => {
                ChaosSimulator.updateConfig({
                  forceOfflineInternet: false,
                  forceOfflineMesh: false,
                  packetDropRate: 0,
                  batteryOverride: null,
                });
                toast({ title: 'Параметры сброшены', description: 'Все каналы связи восстановлены.' });
              }}
            >
              Восстановить нормальную связь
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsChaosModalOpen(false)}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          3. REAL-TIME AUDIT LOG MODAL (FR-025)
         ======================================================== */}
      <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="size-5 text-primary" />
              <span>Журнал аудита событий (FR-025)</span>
            </DialogTitle>
            <DialogDescription>
              Сквозной поток системных событий [GPS], [SECURITY], [TRANSPORT], [OCC], [AUTH], [SOS].
            </DialogDescription>
          </DialogHeader>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar shrink-0">
              {['ALL', 'TRANSPORT', 'SECURITY', 'OCC', 'AUTH', 'SOS'].map((cat) => (
                <Button
                  key={`audit-filter-${cat}`}
                  variant={auditFilter === cat ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setAuditFilter(cat)}
                >
                  {cat === 'ALL' ? 'Все' : cat}
                </Button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск по событиям..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="h-7 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Scrollable event log list */}
          <ScrollArea className="flex-1 h-[320px] rounded-lg border border-border p-2 bg-muted/20 font-mono text-[11px]">
            {filteredAuditEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                События не найдены
              </p>
            ) : (
              <div className="space-y-1.5">
                {filteredAuditEntries.map((entry) => {
                  const time = new Date(entry.timestamp).toLocaleTimeString('ru-RU');
                  let colorClass = 'text-muted-foreground';
                  if (entry.category === 'SECURITY') colorClass = 'text-emerald-500';
                  if (entry.category === 'TRANSPORT') colorClass = 'text-blue-500';
                  if (entry.category === 'OCC') colorClass = 'text-amber-500';
                  if (entry.category === 'SOS') colorClass = 'text-destructive';
                  if (entry.category === 'AUTH') colorClass = 'text-purple-500';

                  return (
                    <div
                      key={entry.id}
                      className="p-1.5 rounded hover:bg-muted/40 transition-colors border-b border-border/30 last:border-b-0 leading-relaxed"
                    >
                      <span className="text-muted-foreground mr-1.5">[{time}]</span>
                      <span className={cn('font-bold mr-1.5', colorClass)}>
                        [{entry.category}]
                      </span>
                      <span className="text-foreground">{entry.message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between items-center pt-2">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAudit}
                className="gap-1.5 text-xs h-8"
              >
                <Download className="size-3.5" />
                <span>Экспорт JSON</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  AuditLogger.clear();
                  setAuditEntries(AuditLogger.getEntries());
                  toast({ title: 'Журнал очищен' });
                }}
                className="text-xs h-8 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5 mr-1" />
                Очистить
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAuditModalOpen(false)}
              className="w-full sm:w-auto text-xs h-8"
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
