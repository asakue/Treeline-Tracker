
'use client';

import Image from 'next/image';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Calendar, LogOut, Edit, TrendingUp, MapPin, Settings, Bell, Palette, Monitor, Sun, Moon } from 'lucide-react';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useTheme } from 'next-themes';

export default function ProfilePage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    toast({
      title: 'Выход из системы',
      description: 'Вы успешно вышли из своего аккаунта.',
    });
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Профиль</h2>
      
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
                  <Edit className="size-4"/>
                  <span className="sr-only">Редактировать</span>
              </Button>
            </div>
            <div className="text-center sm:text-left flex-grow">
              <CardTitle className="text-2xl">Даниил</CardTitle>
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
                  <LogOut className="mr-2" />
                  Выйти
                </Button>
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
                <div key="stat-routes" className="p-4 bg-muted/50 rounded-lg flex items-center gap-4 border border-transparent hover:border-primary/50 transition-colors">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <TrendingUp className="text-primary size-6"/>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-sm">Пройдено маршрутов</p>
                        <p className="text-xl font-bold">12</p>
                    </div>
                </div>
                <div key="stat-distance" className="p-4 bg-muted/50 rounded-lg flex items-center gap-4 border border-transparent hover:border-accent/50 transition-colors">
                     <div className="p-3 bg-accent/10 rounded-full">
                        <MapPin className="text-accent size-6"/>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-sm">Общее расстояние</p>
                        <p className="text-xl font-bold">158 км</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Settings Card */}
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="size-5" />
                    Настройки профиля
                </CardTitle>
                <CardDescription>Управляйте настройками вашего аккаунта.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                  <Label className="font-semibold flex items-center gap-2 mb-4"><Bell className="size-4" />Уведомления</Label>
                  <div className="space-y-3">
                    <div key="notification-sos" className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <Label htmlFor="notification-sos">Сигналы SOS от группы</Label>
                      <Switch id="notification-sos" defaultChecked />
                    </div>
                    <div key="notification-radius" className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <Label htmlFor="notification-radius">Выход из безопасного радиуса</Label>
                      <Switch id="notification-radius" defaultChecked />
                    </div>
                    <div key="notification-chat" className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <Label htmlFor="notification-chat">Новые сообщения в чате</Label>
                      <Switch id="notification-chat" />
                    </div>
                  </div>
                </div>
                <Separator />
                 <div>
                  <Label className="font-semibold flex items-center gap-2 mb-4"><Palette className="size-4" />Тема оформления</Label>
                  <RadioGroup defaultValue={theme} onValueChange={setTheme} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Label key="theme-light" htmlFor="theme-light" className="flex flex-col items-center gap-2 p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has([data-state=checked])]:bg-accent [&:has([data-state=checked])]:text-accent-foreground">
                       <Sun className="size-6" />
                       Светлая
                       <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                    </Label>
                     <Label key="theme-dark" htmlFor="theme-dark" className="flex flex-col items-center gap-2 p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has([data-state=checked])]:bg-accent [&:has([data-state=checked])]:text-accent-foreground">
                       <Moon className="size-6" />
                       Темная
                       <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                    </Label>
                     <Label key="theme-system" htmlFor="theme-system" className="flex flex-col items-center gap-2 p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has([data-state=checked])]:bg-accent [&:has([data-state=checked])]:text-accent-foreground">
                       <Monitor className="size-6" />
                       Системная
                       <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                    </Label>
                  </RadioGroup>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
