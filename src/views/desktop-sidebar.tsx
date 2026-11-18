'use client';

import { memo, useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Mountain,
  PanelLeft,
  Info,
  Code,
  User,
  Shield,
  ShieldCheck,
  Siren,
  CheckCircle2,
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
import { Rbac, ROLE_PERMISSIONS } from '@/core/security/rbac-service';
import type { UserRole } from '@/core/domain/types';

const DesktopSidebar = memo(() => {
  const { activeView, setView, userProfile } = useAppContext();
  const [role, setRole] = useState<UserRole>(() => Rbac.getSession().role);

  useEffect(() => {
    return Rbac.subscribe((sess) => setRole(sess.role));
  }, []);

  const userInitial = userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : '';

  const getRoleDotClass = (r: UserRole) => {
    switch (r) {
      case 'hiker':
        return 'bg-emerald-500';
      case 'guide':
        return 'bg-amber-500';
      case 'rescuer':
        return 'bg-rose-500';
      case 'admin':
        return 'bg-sky-500';
      default:
        return 'bg-primary';
    }
  };

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
              <div className="flex flex-col group-data-[collapsible=icon]:hidden leading-tight">
                <span className="font-semibold tracking-wide">Дозор</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono uppercase">
                  <span className={cn('size-1.5 rounded-full shrink-0', getRoleDotClass(role))} />
                  {ROLE_PERMISSIONS[role].label.split(' ')[0]}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
      </SidebarHeader>

      <SidebarContent className="flex flex-col p-2">
        <SidebarMenu>
          {getDesktopPrimaryNav(role).map(({ id, icon: Icon, label, tooltip }) => (
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
          {getDesktopSafetyNav(role).map(
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
