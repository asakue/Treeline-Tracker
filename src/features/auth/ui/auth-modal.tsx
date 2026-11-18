'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Shield, KeyRound, UserPlus, LogIn, Users, CheckCircle2 } from 'lucide-react';
import { SignInForm } from './sign-in-form';
import { SignUpForm } from './sign-up-form';
import { PasswordResetForm } from './password-reset-form';
import { SessionSecurityCard } from './session-security-card';
import { Rbac, ROLE_PERMISSIONS, type AuthSession } from '@/core/security/rbac-service';
import type { UserRole } from '@/core/domain/types';
import { useToast } from '@/shared/hooks/use-toast';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AuthSession;
  initialTab?: 'signin' | 'signup' | 'reset' | 'session' | 'roles';
}

export function AuthModal({ open, onOpenChange, session, initialTab = 'signin' }: AuthModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>(
    session.email ? 'session' : initialTab
  );

  const handleRoleSwitch = (newRole: UserRole) => {
    Rbac.switchRole(newRole);
    toast({
      title: 'Роль обновлена',
      description: `Активирован оперативный профиль: ${ROLE_PERMISSIONS[newRole].label}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-card border-border/70 text-card-foreground">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Shield className="size-4" />
            </div>
            <DialogTitle className="text-base font-semibold tracking-tight">
              Безопасность и Доступ (RBAC)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Единая система аутентификации, криптографических ключей и разграничения полномочий.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-8 bg-muted/60 p-0.5 rounded-md border border-border/50">
            <TabsTrigger value="signin" className="text-xs py-1 data-[state=active]:bg-background cursor-pointer">
              Вход
            </TabsTrigger>
            <TabsTrigger value="signup" className="text-xs py-1 data-[state=active]:bg-background cursor-pointer">
              Регистрация
            </TabsTrigger>
            <TabsTrigger value="roles" className="text-xs py-1 data-[state=active]:bg-background cursor-pointer">
              Роли
            </TabsTrigger>
            <TabsTrigger value="session" className="text-xs py-1 data-[state=active]:bg-background cursor-pointer">
              Сессия
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="pt-3">
            <SignInForm
              onSuccess={() => onOpenChange(false)}
              onSwitchToSignUp={() => setActiveTab('signup')}
              onSwitchToReset={() => setActiveTab('reset')}
            />
          </TabsContent>

          <TabsContent value="signup" className="pt-3">
            <SignUpForm
              onSuccess={() => onOpenChange(false)}
              onSwitchToSignIn={() => setActiveTab('signin')}
            />
          </TabsContent>

          <TabsContent value="reset" className="pt-3">
            <PasswordResetForm
              onSuccess={() => setActiveTab('signin')}
              onSwitchToSignIn={() => setActiveTab('signin')}
            />
          </TabsContent>

          <TabsContent value="session" className="pt-3">
            <SessionSecurityCard
              session={session}
              onLoggedOut={() => {
                setActiveTab('signin');
                onOpenChange(false);
              }}
            />
          </TabsContent>

          <TabsContent value="roles" className="pt-3 space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Оперативный профиль участника
              </span>
              <p className="text-[11px] text-muted-foreground">
                Интерфейс приложения автоматически перестраивается под выбранную роль.
              </p>
            </div>

            <div className="space-y-2">
              {(['hiker', 'guide', 'rescuer', 'admin'] as UserRole[]).map((role) => {
                const isSelected = session.role === role;
                const meta = ROLE_PERMISSIONS[role];
                return (
                  <button
                    key={`role-select-${role}`}
                    type="button"
                    onClick={() => handleRoleSwitch(role)}
                    className={`w-full p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/60 bg-background/50 hover:bg-accent/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {meta.label}
                      </span>
                      {isSelected && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
