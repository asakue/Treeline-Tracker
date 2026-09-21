'use client';

import { useState, useEffect } from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import {
  Mail,
  Calendar,
  LogOut,
  Edit,
  TrendingUp,
  MapPin,
  Settings,
  Bell,
  Palette,
  Monitor,
  Sun,
  Moon,
  ShieldCheck,
  KeyRound,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Navigation,
} from 'lucide-react';
import { Separator } from '@/shared/ui/separator';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { useTheme } from 'next-themes';
import {
  getOrCreateLocalIdentity,
  rotateLocalIdentity,
} from '@/core/security/identity-manager';
import { UserIdentity, PrivacyMode } from '@/core/domain/types';

interface StatItem {
  id: string;
  label: string;
  value: string;
  icon: typeof TrendingUp;
  iconColor: string;
  iconBg: string;
  hoverBorder: string;
}

const statisticsData: StatItem[] = [
  {
    id: 'stat-routes-completed',
    label: 'Пройдено маршрутов',
    value: '12',
    icon: TrendingUp,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    hoverBorder: 'hover:border-primary/50',
  },
  {
    id: 'stat-total-distance',
    label: 'Общее расстояние',
    value: '158 км',
    icon: MapPin,
    iconColor: 'text-accent',
    iconBg: 'bg-accent/10',
    hoverBorder: 'hover:border-accent/50',
  },
];

interface NotificationSetting {
  id: string;
  label: string;
  defaultChecked: boolean;
}

const notificationSettings: NotificationSetting[] = [
  {
    id: 'notification-sos-alert',
    label: 'Сигналы SOS от группы',
    defaultChecked: true,
  },
  {
    id: 'notification-safe-radius',
    label: 'Выход из безопасного радиуса',
    defaultChecked: true,
  },
  {
    id: 'notification-chat-messages',
    label: 'Новые сообщения в чате',
    defaultChecked: false,
  },
];

interface ThemeOption {
  id: 'light' | 'dark' | 'system';
  label: string;
  icon: typeof Sun;
}

const themeOptions: ThemeOption[] = [
  {
    id: 'light',
    label: 'Светлая',
    icon: Sun,
  },
  {
    id: 'dark',
    label: 'Темная',
    icon: Moon,
  },
  {
    id: 'system',
    label: 'Системная',
    icon: Monitor,
  },
];

export default function ProfilePage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('NORMAL');
  const [isRotatingKey, setIsRotatingKey] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Инициализация криптографической идентичности
    getOrCreateLocalIdentity('Даниил').then((id) => {
      setIdentity(id);
    });

    // Загрузка режима приватности
    const savedPrivacy = (typeof window !== 'undefined' ? localStorage.getItem('treeline_privacy_mode') : null) as PrivacyMode | null;
    if (savedPrivacy && ['NORMAL', 'REDUCED', 'STEALTH'].includes(savedPrivacy)) {
      setPrivacyMode(savedPrivacy);
    }
  }, []);

  const handlePrivacyChange = (mode: PrivacyMode) => {
    setPrivacyMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('treeline_privacy_mode', mode);
    }
    toast({
      title: 'Режим приватности обновлен',
      description:
        mode === 'NORMAL'
          ? 'Максимальная точность GNSS (~5м) для группы.'
          : mode === 'REDUCED'
          ? 'Координаты огрубляются до сетки 200х200м.'
          : 'Стелс-режим: геоданные сохраняются только локально.',
    });
  };

  const handleCopyPublicKey = () => {
    if (!identity?.publicKey) return;
    navigator.clipboard.writeText(identity.publicKey);
    toast({
      title: 'Открытый ключ скопирован',
      description: 'Публичный ключ Ed25519 скопирован в буфер обмена.',
    });
  };

  const handleRotateKey = async () => {
    setIsRotatingKey(true);
    try {
      const newIdentity = await rotateLocalIdentity(identity?.displayName || 'Даниил');
      setIdentity(newIdentity);
      toast({
        title: 'Ключи успешно обновлены',
        description: 'Сгенерирована новая ключевая пара Ed25519.',
      });
    } finally {
      setIsRotatingKey(false);
    }
  };

  const handleLogout = () => {
    toast({
      title: 'Выход из системы',
      description: 'Вы успешно вышли из своего аккаунта.',
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Профиль и Безопасность</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info Card */}
        <Card className="lg:col-span-3 bg-card border-border shadow-sm">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <Avatar className="size-24 border-4 border-background ring-2 ring-primary">
                <AvatarImage
                  src="https://picsum.photos/seed/user/100/100"
                  width={100}
                  height={100}
                  alt="Аватар пользователя"
                />
                <AvatarFallback>Д</AvatarFallback>
              </Avatar>
              <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2 size-8 rounded-full border-2 border-background">
                <Edit className="size-4" />
                <span className="sr-only">Редактировать</span>
              </Button>
            </div>
            <div className="text-center sm:text-left flex-grow">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <CardTitle className="text-2xl">{identity?.displayName || 'Даниил'}</CardTitle>
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium border border-primary/20 flex items-center gap-1">
                  <ShieldCheck className="size-3.5" /> E2EE Active
                </span>
              </div>
              <CardDescription className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                <Mail className="size-4" />
                daniil@example.com
              </CardDescription>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-2 mt-2">
                <Calendar className="size-4" />
                <span>Участник с Января 2023</span>
              </p>
            </div>
            <div className="sm:ml-auto w-full sm:w-auto">
              <Button variant="destructive" onClick={handleLogout} className="w-full">
                <LogOut className="mr-2 size-4" />
                Выйти
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cryptographic Identity (Ed25519 & E2EE) Card */}
        <Card className="lg:col-span-2 border-primary/30 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <KeyRound className="size-5 text-primary shrink-0" />
                  Криптографическая идентичность (Ed25519)
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-0.5">
                  Децентрализованная пара ключей для цифровой подписи и E2EE аутентификации
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotateKey}
                disabled={isRotatingKey}
                className="text-xs flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0"
              >
                <RefreshCw className={`size-3.5 ${isRotatingKey ? 'animate-spin' : ''}`} />
                Сменить ключ
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted/60 rounded-lg space-y-1.5 border border-border/70">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Идентификатор пользователя (User ID)
                </Label>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono px-2 py-0.5 rounded">
                  Verified
                </span>
              </div>
              <p className="font-mono text-sm break-all font-semibold text-foreground">
                {identity?.userId || 'Загрузка...'}
              </p>
            </div>

            <div className="p-3 bg-muted/60 rounded-lg space-y-1.5 border border-border/70">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Открытый ключ подписи (Ed25519 Public Key)
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPublicKey}
                  className="h-6 px-2 text-xs flex items-center gap-1 text-primary hover:text-primary"
                >
                  <Copy className="size-3" />
                  Копировать
                </Button>
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all bg-background/80 p-2 rounded border border-border/50">
                {identity?.publicKey || 'Генерация аппаратного ключа...'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Modes Selector */}
        <Card className="lg:col-span-1 border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="size-5 text-primary" />
              Приватность геоданных
            </CardTitle>
            <CardDescription>
              Уровень детализации передачи координат в эфир
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              onClick={() => handlePrivacyChange('NORMAL')}
              className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-start gap-3 ${
                privacyMode === 'NORMAL'
                  ? 'border-primary bg-primary/10 text-primary-foreground'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <Navigation className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">NORMAL (Стандарт)</p>
                <p className="text-xs text-muted-foreground mt-0.5">Точные координаты GNSS (~5м) для проводника и группы</p>
              </div>
            </div>

            <div
              onClick={() => handlePrivacyChange('REDUCED')}
              className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-start gap-3 ${
                privacyMode === 'REDUCED'
                  ? 'border-primary bg-primary/10 text-primary-foreground'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <Eye className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">REDUCED (Огрубление)</p>
                <p className="text-xs text-muted-foreground mt-0.5">Сетка 200х200м без микро-траекторий и скорости</p>
              </div>
            </div>

            <div
              onClick={() => handlePrivacyChange('STEALTH')}
              className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-start gap-3 ${
                privacyMode === 'STEALTH'
                  ? 'border-primary bg-primary/10 text-primary-foreground'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <EyeOff className="size-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">STEALTH (Стелс)</p>
                <p className="text-xs text-muted-foreground mt-0.5">Локальная запись трека, радиоэфир отключен</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Статистика</CardTitle>
            <CardDescription>Ваши достижения.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statisticsData.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.id}
                  className={`p-4 bg-muted/50 rounded-lg flex items-center gap-4 border border-transparent ${stat.hoverBorder} transition-colors`}
                >
                  <div className={`p-3 ${stat.iconBg} rounded-full`}>
                    <Icon className={`${stat.iconColor} size-6`} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">{stat.label}</p>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              Настройки приложения
            </CardTitle>
            <CardDescription>Управляйте уведомлениями и темой интерфейса.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="font-semibold flex items-center gap-2 mb-4">
                <Bell className="size-4" />
                Уведомления
              </Label>
              <div className="space-y-3">
                {notificationSettings.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <Label htmlFor={setting.id}>{setting.label}</Label>
                    <Switch id={setting.id} defaultChecked={setting.defaultChecked} />
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <Label className="font-semibold flex items-center gap-2 mb-4">
                <Palette className="size-4" />
                Тема оформления
              </Label>
              <RadioGroup value={mounted ? theme : undefined} onValueChange={setTheme} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <Label
                      key={`theme-option-${option.id}`}
                      htmlFor={`theme-input-${option.id}`}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has([data-state=checked])]:bg-accent [&:has([data-state=checked])]:text-accent-foreground"
                    >
                      <Icon className="size-6" />
                      {option.label}
                      <RadioGroupItem value={option.id} id={`theme-input-${option.id}`} className="sr-only" />
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

