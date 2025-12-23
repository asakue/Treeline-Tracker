'use client';

import Image from 'next/image';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  CloudSun,
  Waypoints,
  Search,
  Info,
  Code,
} from 'lucide-react';
import type { View } from './app-provider';
import { useAppContext } from './app-provider';


const menuItems = [
  {
    id: 'tracker' as View,
    icon: Users,
    label: 'Трекер группы',
  },
  {
    id: 'weather' as View,
    icon: CloudSun,
    label: 'Прогноз погоды',
  },
  {
    id: 'routes' as View,
    icon: Waypoints,
    label: 'Планировщик маршрутов',
  },
  {
    id: 'search' as View,
    icon: Search,
    label: 'Поиск пропавшего туриста',
  },
   {
    id: 'about' as View,
    icon: Info,
    label: 'О нас',
  },
   {
    id: 'about-app' as View,
    icon: Code,
    label: 'О приложении',
  },
];

type MobileMenuProps = {
  onNavigate: (view: View) => void;
};

export default function MobileMenu({ onNavigate }: MobileMenuProps) {
  const { activeView } = useAppContext();
  
  return (
    <div className="p-4 flex flex-col">
      <div
        className="flex items-center gap-3 mb-4"
        onClick={() => onNavigate('profile')}
      >
        <Avatar className="size-10">
          <AvatarImage
            src="https://picsum.photos/seed/user/40/40"
            alt="Аватар пользователя"
            width={40}
            height={40}
          />
          <AvatarFallback>Д</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">Даниил</p>
          <p className="text-sm text-muted-foreground">Профиль</p>
        </div>
      </div>
      <Separator className="mb-4" />
      <div className="grid grid-cols-1 gap-2">
        {menuItems.map(({ id, icon: Icon, label }) => (
          <Button
            key={id}
            variant={activeView === id ? 'secondary' : 'ghost'}
            className="justify-start gap-3 h-12 text-base"
            onClick={() => onNavigate(id)}
          >
            <Icon className="size-5 text-muted-foreground" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
