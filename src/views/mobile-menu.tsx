'use client';

import { useState, useEffect } from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';
import { User, Shield } from 'lucide-react';
import type { View } from '@/entities/app';
import { useAppContext } from '@/entities/app';
import { getMobileDrawerItems } from '@/shared/lib/view-registry';
import { Rbac, ROLE_PERMISSIONS } from '@/core/security/rbac-service';
import type { UserRole } from '@/core/domain/types';
import { RoleActionHud } from '@/features/expedition/ui/role-action-hud';

type MobileMenuProps = {
  onNavigate: (view: View) => void;
};

export default function MobileMenu({ onNavigate }: MobileMenuProps) {
  const { activeView, userProfile } = useAppContext();
  const [role, setRole] = useState<UserRole>(() => Rbac.getSession().role);

  useEffect(() => {
    return Rbac.subscribe((sess) => setRole(sess.role));
  }, []);

  const userInitial = userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : '';
  
  return (
    <div className="p-4 flex flex-col space-y-3">
      <div
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
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
          <p className="font-semibold text-foreground text-sm">
            {userProfile.displayName || 'Мой профиль'}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {ROLE_PERMISSIONS[role].label}
          </p>
        </div>
      </div>

      <div className="py-1">
        <RoleActionHud />
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-1.5 pt-1">
        {getMobileDrawerItems(role).map(({ id, icon: Icon, label }) => (
          <Button
            key={id}
            variant={activeView === id ? 'secondary' : 'ghost'}
            className="justify-start gap-3 h-10 text-sm font-medium"
            onClick={() => onNavigate(id)}
          >
            <Icon className="size-4.5 text-muted-foreground" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
