'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';
import {
  Users,
  CloudSun,
  Waypoints,
  Search,
  Info,
  Code,
  User,
} from 'lucide-react';
import type { View } from '@/entities/app';
import { useAppContext } from '@/entities/app';

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
  const { activeView, userProfile } = useAppContext();
  const userInitial = userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : '';
  
  return (
    <div className="p-4 flex flex-col">
      <div
        className="flex items-center gap-3 mb-4 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => onNavigate('profile')}
      >
        <Avatar className="size-10">
          {userProfile.avatarUrl ? (
            <AvatarImage
              src={userProfile.avatarUrl}
              alt={userProfile.displayName || 'Профиль'}
              width={40}
              height={40}
            />
          ) : null}
          <AvatarFallback className="text-sm bg-primary/20 text-primary font-medium">
            {userInitial || <User className="size-5" />}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-foreground">
            {userProfile.displayName || 'Мой профиль'}
          </p>
          <p className="text-xs text-muted-foreground">Нажмите для редактирования</p>
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
