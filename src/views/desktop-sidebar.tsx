'use client';

import { memo } from 'react';
import Image from 'next/image';
import {
  Mountain,
  PanelLeft,
  Info,
  Code,
  User,
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
import { useAppContext } from '@/entities/app';
import { getDesktopPrimaryNav, getDesktopSafetyNav } from '@/shared/lib/view-registry';


const DesktopSidebar = memo(() => {
  const { activeView, setView, userProfile } = useAppContext();

  const userInitial = userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : '';

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
          {getDesktopPrimaryNav().map(({ id, icon: Icon, label, tooltip }) => (
            <SidebarMenuItem key={`desktop-nav-${id}`}>
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
          <SidebarSeparator key="sidebar-menu-separator" className="my-2" />
          {getDesktopSafetyNav().map(
            ({ id, icon: Icon, label, tooltip }) => (
              <SidebarMenuItem key={`desktop-sec-${id}`}>
                <SidebarMenuButton
                  onClick={() => setView(id)}
                  isActive={activeView === id}
                  tooltip={tooltip}
                  className={cn(
                    id === 'search' && activeView === 'search' &&
                      'bg-accent/20 text-accent hover:bg-accent/30 hover:text-accent-foreground',
                    id === 'search' && 'data-[active=true]:bg-accent/20 data-[active=true]:text-accent',
                    id === 'emergency' &&
                      'bg-destructive/20 text-destructive-foreground hover:bg-destructive/30 hover:text-destructive-foreground data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground data-[active=true]:hover:bg-destructive/90'
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
              tooltip={userProfile.displayName || 'Профиль пользователя'}
              onClick={() => setView('profile')}
              isActive={activeView === 'profile'}
            >
              <Avatar className="size-6 shrink-0">
                {userProfile.avatarUrl ? (
                  <AvatarImage
                    src={userProfile.avatarUrl}
                    alt={userProfile.displayName || 'Профиль'}
                    width={24}
                    height={24}
                  />
                ) : null}
                <AvatarFallback className="text-[11px] bg-primary/20 text-primary font-medium">
                  {userInitial || <User className="size-3.5" />}
                </AvatarFallback>
              </Avatar>
              <span className="group-data-[collapsible=icon]:hidden truncate">
                {userProfile.displayName || 'Мой профиль'}
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
