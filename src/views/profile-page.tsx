'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  LogOut,
  Edit3,
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
  Download,
  FileCode,
  CheckCircle2,
  Check,
  Camera,
  Loader2,
  User,
  Lock,
  Phone,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Separator } from '@/shared/ui/separator';
import { Label } from '@/shared/ui/label';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { Switch } from '@/shared/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Progress } from '@/shared/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { useTheme } from 'next-themes';
import {
  getOrCreateLocalIdentity,
  rotateLocalIdentity,
} from '@/core/security/identity-manager';
import { UserIdentity, PrivacyMode, Route } from '@/core/domain/types';
import { routeRepository } from '@/core/repositories';
import { exportRoutesAsGpx } from '@/core/utils/gpx-exporter';
import { useAppContext, type AppUserProfile } from '@/entities/app';

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

export interface ProfilePageProps {
  profile?: Partial<AppUserProfile>;
  onUpdateProfile?: (data: Partial<AppUserProfile>) => void;
}

const fallbackDefaultProfile: AppUserProfile = {
  displayName: '',
  email: '',
  avatarUrl: '',
  phone: '',
  emergencyContact: '',
  experienceLevel: 'Beginner',
  bio: '',
};

export function ProfilePage({ profile, onUpdateProfile }: ProfilePageProps = {}) {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  // Safely resolve context when wrapped in AppProvider, or fallback gracefully in isolated tests
  let contextProfile: AppUserProfile = fallbackDefaultProfile;
  let contextUpdateProfile = (_data: Partial<AppUserProfile>) => {};

  try {
    const ctx = useAppContext();
    contextProfile = ctx.userProfile;
    contextUpdateProfile = ctx.updateUserProfile;
  } catch {
    // Graceful fallback when rendered without AppProvider (e.g., in unit tests)
  }

  const userProfile: AppUserProfile = useMemo(
    () => ({
      ...contextProfile,
      ...(profile || {}),
    }),
    [
      contextProfile.displayName,
      contextProfile.email,
      contextProfile.phone,
      contextProfile.emergencyContact,
      contextProfile.bio,
      contextProfile.avatarUrl,
      contextProfile.experienceLevel,
      profile?.displayName,
      profile?.email,
      profile?.phone,
      profile?.emergencyContact,
      profile?.bio,
      profile?.avatarUrl,
      profile?.experienceLevel,
    ]
  );
  const updateUserProfile = onUpdateProfile || contextUpdateProfile;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('NORMAL');
  const [isRotatingKey, setIsRotatingKey] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isExportingGpx, setIsExportingGpx] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Profile data & edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formProfile, setFormProfile] = useState<AppUserProfile>(userProfile);

  // Sync formProfile with userProfile when dialog is not actively being edited
  useEffect(() => {
    if (!isEditDialogOpen) {
      setFormProfile(userProfile);
    }
  }, [userProfile, isEditDialogOpen]);

  useEffect(() => {
    setMounted(true);

    // Инициализация криптографической идентичности
    getOrCreateLocalIdentity(userProfile.displayName || 'Пользователь').then((id) => {
      setIdentity(id);
    });

    // Загрузка режима приватности
    const savedPrivacy = (typeof window !== 'undefined' ? localStorage.getItem('treeline_privacy_mode') : null) as PrivacyMode | null;
    if (savedPrivacy && ['NORMAL', 'REDUCED', 'STEALTH'].includes(savedPrivacy)) {
      setPrivacyMode(savedPrivacy);
    }

    // Загрузка реальных пользовательских маршрутов
    routeRepository.getRoutes(true).then((loadedRoutes) => {
      setRoutes(loadedRoutes);
    });
  }, [userProfile.displayName]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Неверный формат',
        description: 'Пожалуйста, выберите файл изображения (JPEG, PNG, WebP).',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);
    toast({
      title: 'Загрузка аватара',
      description: 'Обработка и сохранение фотографии профиля...',
    });

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setTimeout(() => {
          updateUserProfile({ avatarUrl: result });
          setIsUploadingAvatar(false);
          toast({
            title: 'Аватар обновлен',
            description: 'Новое фото профиля успешно установлено.',
          });
        }, 400);
      }
    };
    reader.onerror = () => {
      setIsUploadingAvatar(false);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось прочитать выбранный файл.',
        variant: 'destructive',
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpenEditDialog = () => {
    setFormProfile(userProfile);
    setIsEditDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    updateUserProfile(formProfile);

    // Обновляем криптографическую идентичность под новое имя
    try {
      const updatedIdentity = await rotateLocalIdentity(formProfile.displayName || 'Пользователь');
      setIdentity(updatedIdentity);
    } catch {
      // Ignore
    }

    setIsEditDialogOpen(false);
    toast({
      title: 'Профиль сохранен',
      description: 'Данные профиля успешно обновлены и синхронизированы.',
    });
  };

  const totalDistanceKm = routes.reduce((acc, r) => {
    const num = parseFloat((r.distance || '').replace(/[^\d.]/g, ''));
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

  const totalTrackPoints = routes.reduce((acc, r) => acc + (r.path?.length || 0), 0);

  const profileCompletionChecks = [
    { id: 'avatar', label: 'Фото профиля', completed: Boolean(userProfile.avatarUrl) },
    { id: 'name', label: 'Имя профиля', completed: Boolean(userProfile.displayName && userProfile.displayName !== 'Мой профиль') },
    { id: 'email', label: 'Email контакт', completed: Boolean(userProfile.email) },
    { id: 'phone', label: 'Телефон', completed: Boolean(userProfile.phone) },
    { id: 'emergency', label: 'SOS контакт', completed: Boolean(userProfile.emergencyContact) },
    { id: 'crypto', label: 'Ключ Ed25519', completed: Boolean(identity?.publicKey) },
  ];
  const completedFieldsCount = profileCompletionChecks.filter((c) => c.completed).length;
  const profileCompletion = Math.round((completedFieldsCount / profileCompletionChecks.length) * 100);

  const handleExportGpx = async () => {
    setIsExportingGpx(true);
    try {
      const allRoutes = await routeRepository.getRoutes(true);
      if (!allRoutes || allRoutes.length === 0) {
        toast({
          title: 'Нет данных для экспорта',
          description: 'В истории маршрутов пока нет созданных треков. Создайте свой первый маршрут на карте!',
          variant: 'destructive',
        });
        return;
      }

      const totalPts = allRoutes.reduce((acc, r) => acc + (r.path?.length || 0), 0);
      const filename = `treeline-routes-${new Date().toISOString().slice(0, 10)}.gpx`;

      exportRoutesAsGpx(allRoutes, filename);

      toast({
        title: 'Маршруты экспортированы в GPX',
        description: `Успешно выгружено ${allRoutes.length} маршрутов (${totalPts} точек трека) в файл ${filename}.`,
      });
    } catch (err) {
      console.error('GPX Export failed:', err);
      toast({
        title: 'Ошибка экспорта',
        description: 'Не удалось сформировать GPX файл.',
        variant: 'destructive',
      });
    } finally {
      setIsExportingGpx(false);
    }
  };

  const handlePrivacyChange = (mode: PrivacyMode) => {
    setPrivacyMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('treeline_privacy_mode', mode);
    }
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privacyMode: mode }),
    }).catch(() => {});

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
      const newIdentity = await rotateLocalIdentity(userProfile.displayName || 'Пользователь');
      setIdentity(newIdentity);
      fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: newIdentity.publicKey }),
      }).catch(() => {});
      toast({
        title: 'Ключи успешно обновлены',
        description: 'Сгенерирована новая ключевая пара Ed25519.',
      });
    } finally {
      setIsRotatingKey(false);
    }
  };

  const handleLogout = () => {
    updateUserProfile({
      displayName: '',
      email: '',
      avatarUrl: '',
      phone: '',
      emergencyContact: '',
      experienceLevel: 'Beginner',
      bio: '',
    });
    toast({
      title: 'Сброс данных',
      description: 'Данные профиля очищены.',
    });
  };

  const userInitial = userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : '';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Личный кабинет</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Управление данными профиля, безопасностью и синхронизацией
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full sm:w-[380px] grid-cols-2 p-1 bg-muted/80 border border-border/60">
          <TabsTrigger value="profile" className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <User className="size-4" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <ShieldCheck className="size-4 text-emerald-500" />
            Безопасность
          </TabsTrigger>
        </TabsList>

        {/* -------------------- TAB 1: ПРОФИЛЬ -------------------- */}
        <TabsContent value="profile" className="space-y-6 focus-visible:outline-none">
          {/* User Info Card */}
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group cursor-pointer" onClick={handleAvatarClick} title="Нажмите, чтобы сменить фото">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                  disabled={isUploadingAvatar}
                />
                <Avatar className="size-24 border-4 border-background ring-2 ring-primary transition-opacity group-hover:opacity-90">
                  {userProfile.avatarUrl ? (
                    <AvatarImage
                      src={userProfile.avatarUrl}
                      width={100}
                      height={100}
                      alt={userProfile.displayName || 'Профиль'}
                    />
                  ) : null}
                  <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                    {userInitial || <User className="size-8 text-primary" />}
                  </AvatarFallback>
                </Avatar>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px] rounded-full flex items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAvatarClick();
                  }}
                  disabled={isUploadingAvatar}
                  className="absolute -bottom-2 -right-2 size-8 rounded-full border-2 border-background bg-card hover:bg-accent shadow-sm"
                  title="Сделать снимок / Загрузить фото"
                >
                  <Camera className="size-4 text-foreground" />
                  <span className="sr-only">Сменить фото</span>
                </Button>
              </div>
              <div className="text-center sm:text-left flex-grow space-y-3">
                <div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <CardTitle className="text-2xl">{userProfile.displayName || 'Мой профиль'}</CardTitle>
                    <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium border border-primary/20 flex items-center gap-1">
                      <ShieldCheck className="size-3.5" /> E2EE Active
                    </span>
                  </div>
                  <CardDescription className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                    <Mail className="size-4" />
                    {userProfile.email || 'Email не указан'}
                  </CardDescription>
                  {userProfile.phone && (
                    <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                      <Phone className="size-3.5" />
                      <span>{userProfile.phone}</span>
                    </p>
                  )}
                  {userProfile.bio && (
                    <p className="text-xs text-foreground/80 mt-1 max-w-md italic">
                      «{userProfile.bio}»
                    </p>
                  )}
                </div>

                {/* Profile Completion Progress Bar */}
                <div className="pt-2 border-t border-border/60 max-w-md">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      Заполненность профиля
                    </span>
                    <span className="font-semibold text-primary font-mono">{profileCompletion}%</span>
                  </div>
                  <Progress value={profileCompletion} className="h-2 bg-muted" />
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                    {profileCompletionChecks.map((item) => (
                      <span key={item.id} className="flex items-center gap-1">
                        <Check className={`size-3 ${item.completed ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                        <span className={item.completed ? 'text-foreground/80' : 'text-muted-foreground/60'}>
                          {item.label}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto w-full sm:w-auto">
                <Button variant="outline" onClick={handleOpenEditDialog} className="w-full sm:w-auto">
                  <Edit3 className="mr-2 size-4" />
                  Редактировать
                </Button>
                <Button variant="ghost" onClick={handleLogout} className="w-full sm:w-auto text-destructive hover:bg-destructive/10">
                  <LogOut className="mr-2 size-4" />
                  Сброс
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Statistics Card with GPX Export */}
            <Card className="lg:col-span-1 border-border shadow-sm flex flex-col justify-between">
              <div>
                <CardHeader className="p-4 sm:p-6 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <TrendingUp className="size-5 text-primary shrink-0" />
                    Статистика
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-0.5">
                    Реальные маршруты и пройденный километраж
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3.5 border border-transparent hover:border-primary/50 transition-colors">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-full shrink-0">
                      <TrendingUp className="size-5" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">Создано маршрутов</p>
                      <p className="text-lg font-bold text-foreground">{routes.length}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3.5 border border-transparent hover:border-accent/50 transition-colors">
                    <div className="p-2.5 bg-accent/10 text-accent rounded-full shrink-0">
                      <MapPin className="size-5" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">Общая дистанция</p>
                      <p className="text-lg font-bold text-foreground">
                        {totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(1)} км` : '0 км'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3.5 border border-transparent hover:border-emerald-500/50 transition-colors">
                    <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-full shrink-0">
                      <FileCode className="size-5" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">Точек трека (Waypoints)</p>
                      <p className="text-lg font-bold text-foreground">
                        {totalTrackPoints}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </div>

              <div className="p-4 sm:p-6 pt-2 space-y-2">
                <Button
                  onClick={handleExportGpx}
                  disabled={isExportingGpx}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all text-xs sm:text-sm h-10"
                >
                  <Download className={`size-4 ${isExportingGpx ? 'animate-bounce' : ''}`} />
                  <span>{isExportingGpx ? 'Формирование GPX...' : 'Экспорт истории в GPX'}</span>
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Стандарт GPX 1.1 (Garmin, OsmAnd, Gaia GPS)
                </p>
              </div>
            </Card>

            {/* Settings Card */}
            <Card className="lg:col-span-2 border-border shadow-sm">
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
        </TabsContent>

        {/* -------------------- TAB 2: БЕЗОПАСНОСТЬ -------------------- */}
        <TabsContent value="security" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    {identity?.userId || 'Генерация...'}
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
          </div>

          {/* Security Protocols and Cryptographic Overview Card */}
          <Card className="border-border shadow-sm bg-card">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Lock className="size-5 text-primary shrink-0" />
                Криптографическая защита и протоколы связи
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Архитектура нулевого доверия (Zero-Knowledge) для полевых и оффлайн условий
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    Ed25519 WebCrypto
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Асимметричная цифровая подпись каждого переданного пакета телеметрии.
                  </p>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    AES-256-GCM AEAD
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Сквозное шифрование координат и групповых сообщений со встроенной аутентификацией.
                  </p>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    Anti-Replay & Nonce
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Защита от повтора пакетов и подмены координат со строгим временным окном свежести.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Profile Modal Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="size-5 text-primary" />
              Редактирование профиля
            </DialogTitle>
            <DialogDescription>
              Укажите ваши персональные данные и контакты для экстренной связи
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Имя / Позывной</Label>
              <Input
                id="edit-name"
                placeholder="например, Александр"
                value={formProfile.displayName}
                onChange={(e) => setFormProfile({ ...formProfile, displayName: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="user@example.com"
                value={formProfile.email}
                onChange={(e) => setFormProfile({ ...formProfile, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Телефон</Label>
                <Input
                  id="edit-phone"
                  placeholder="+7 (999) 000-00-00"
                  value={formProfile.phone}
                  onChange={(e) => setFormProfile({ ...formProfile, phone: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-emergency">SOS Контакт</Label>
                <Input
                  id="edit-emergency"
                  placeholder="+7 (999) 111-22-33"
                  value={formProfile.emergencyContact}
                  onChange={(e) => setFormProfile({ ...formProfile, emergencyContact: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-experience">Опыт в туризме</Label>
              <Select
                value={formProfile.experienceLevel}
                onValueChange={(val) => setFormProfile({ ...formProfile, experienceLevel: val as AppUserProfile['experienceLevel'] })}
              >
                <SelectTrigger id="edit-experience">
                  <SelectValue placeholder="Выберите уровень" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Новичок (ПВД, легкие тропы)</SelectItem>
                  <SelectItem value="Intermediate">Любитель (Походы 1-2 к.с.)</SelectItem>
                  <SelectItem value="Advanced">Опытный (Горные/водные походы 3-4 к.с.)</SelectItem>
                  <SelectItem value="Expert">Эксперт / Инструктор</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-bio">О себе</Label>
              <Textarea
                id="edit-bio"
                placeholder="Расскажите о своем опыте, предпочтительных маршрутах..."
                rows={2}
                value={formProfile.bio}
                onChange={(e) => setFormProfile({ ...formProfile, bio: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setIsEditDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveProfile} className="bg-primary text-primary-foreground">
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProfilePage;
