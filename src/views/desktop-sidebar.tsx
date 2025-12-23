'use client';

import { memo } from 'react';
import Image from 'next/image';
import {
  Mountain,
  PanelLeft,
  Users,
  MessageSquare,
  CloudSun,
  Waypoints,
  Search,
  Map,
  Siren,
  Info,
  Code,
} from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarSeparator,
} from '@/shared/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { cn } from '@/shared/lib/utils';
import { useAppContext, type View } from '@/entities/app';


const menuItems = [
  { id: 'map' as View, icon: Map, label: 'Карта', tooltip: 'Карта' },
  {
    id: 'tracker' as View,
    icon: Users,
    label: 'Трекер',
    tooltip: 'Трекер группы',
  },
  {
    id: 'chat' as View,
    icon: MessageSquare,
    label: 'Чат',
    tooltip: 'Групповой чат',
  },
  {
    id: 'weather' as View,
    icon: CloudSun,
    label: 'Погода',
    tooltip: 'Прогноз погоды',
  },
  {
    id: 'routes' as View,
    icon: Waypoints,
    label: 'Маршруты',
    tooltip: 'Планировщик маршрутов',
  },
];

const secondaryMenuItems = [
  {
    id: 'search' as View,
    icon: Search,
    label: 'SOS Поиск',
    tooltip: 'Поиск туриста',
  },
  {
    id: 'emergency' as View,
    icon: Siren,
    label: 'Вызов служб',
    tooltip: 'Вызов служб',
  },
];

const DesktopSidebar = memo(() => {
  const { activeView, setView } = useAppContext();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-base font-bold"
              tooltip="Дозор"
            >
              <Mountain className="text-primary shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">
                Дозор
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
      </SidebarHeader>

      <SidebarContent className="flex flex-col p-2">
        <SidebarMenu>
          {menuItems.map(({ id, icon: Icon, label, tooltip }) => (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton
                onClick={() => setView(id)}
                isActive={activeView === id}
                tooltip={tooltip}
              >
                <Icon />
                <span className="group-data-[collapsible=icon]:hidden">
                  {label}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarSeparator className="my-2" />
          {secondaryMenuItems.map(
            ({ id, icon: Icon, label, tooltip }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  onClick={() => setView(id)}
                  isActive={activeView === id}
                  tooltip={tooltip}
                  className={cn(
                    id === 'search' && activeView === 'search' &&
                      'bg-accent/20 text-accent hover:bg-accent/30 hover:text-accent-foreground',
                    id === 'search' && 'data-[active=true]:bg-accent/20 data-[active=true]:text-accent',
                    id === 'emergency' &&
                      'bg-destructive/20 text-destructive-foreground hover-bg-destructive/30 hover:text-destructive-foreground data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground data-[active=true]:hover:bg-destructive/90'
                  )}
                >
                  <Icon />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {label}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
         <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="О нас"
              onClick={() => setView('about')}
              isActive={activeView === 'about'}
            >
              <Info />
              <span className="group-data-[collapsible=icon]:hidden">
                О нас
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="О приложении"
              onClick={() => setView('about-app')}
              isActive={activeView === 'about-app'}
            >
              <Code />
              <span className="group-data-[collapsible=icon]:hidden">
                О приложении
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Профиль пользователя"
              onClick={() => setView('profile')}
              isActive={activeView === 'profile'}
            >
              <Avatar className="size-6 shrink-0">
                <AvatarImage
                  src="https://picsum.photos/seed/user/40/40"
                  alt="Аватар пользователя"
                  width={40}
                  height={40}
                />
                <AvatarFallback>Д</AvatarFallback>
              </Avatar>
              <span className="group-data-[collapsible=icon]:hidden">
                Даниил
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTrigger variant="ghost" size="icon" className="w-full h-8">
              <PanelLeft />
            </SidebarTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
});
DesktopSidebar.displayName = 'DesktopSidebar';

export default DesktopSidebar;
