'use client';

import { useState } from 'react';
import {
  Shield,
  KeyRound,
  CheckCircle2,
  User,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';
import { Rbac, ROLE_PERMISSIONS, type AuthSession } from '@/core/security/rbac-service';
import type { UserRole } from '@/core/domain/types';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AuthSession;
}

export function AuthDialog({ open, onOpenChange, session }: AuthDialogProps) {
  const { toast } = useToast();
  const [mfaCode, setMfaCode] = useState('');

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'hiker':
        return User;
      case 'guide':
        return ShieldCheck;
      case 'rescuer':
        return Siren;
      case 'admin':
        return Shield;
      default:
        return User;
    }
  };

  const handleSelectRole = (newRole: UserRole) => {
    Rbac.switchRole(newRole);
    toast({
      title: 'Роль обновлена',
      description: `Активирован профиль: ${ROLE_PERMISSIONS[newRole].label}`,
    });
  };

  const handleVerifyMfa = () => {
    if (!mfaCode.trim() || mfaCode.length < 6) {
      toast({
        title: 'Неверный код MFA',
        description: 'Введите 6-значный проверочный код TOTP (например, 123456).',
        variant: 'destructive',
      });
      return;
    }
    const success = Rbac.verifyMfa(mfaCode);
    if (success) {
      toast({
        title: 'MFA подтверждено',
        description: 'Двухфакторная аутентификация успешно пройдена.',
      });
      setMfaCode('');
    } else {
      toast({
        title: 'Ошибка проверки MFA',
        description: 'Не удалось валидировать проверочный код.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <span>Аутентификация и роли (RBAC)</span>
          </DialogTitle>
          <DialogDescription>
            Быстрое переключение ролей для проверки прав доступа и сценариев работы.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current user card */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-sm">
                {session.displayName}
              </span>
              <Badge variant="outline" className="text-xs">
                {session.isAnonymous ? 'Гостевой режим' : session.provider}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {session.email || 'Анонимный сеанс с локальным криптографическим ключом'}
            </p>
            <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
              <span>UID: {session.uid.slice(0, 16)}...</span>
              {session.isMfaVerified && (
                <span className="text-emerald-500 flex items-center gap-0.5">
                  <CheckCircle2 className="size-3" /> MFA подтверждено
                </span>
              )}
            </div>
          </div>

          {/* Role switcher selection */}
          <div>
            <Label className="text-xs font-semibold mb-2 block">
              Выберите активную роль системы:
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['hiker', 'guide', 'rescuer', 'admin'] as UserRole[]).map((role) => {
                const info = ROLE_PERMISSIONS[role];
                const isCurrent = session.role === role;
                const Icon = getRoleIcon(role);

                return (
                  <button
                    key={`role-pick-${role}`}
                    onClick={() => handleSelectRole(role)}
                    className={cn(
                      'p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1 cursor-pointer',
                      isCurrent
                        ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary/40'
                        : 'bg-card hover:bg-muted/60 border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                        <Icon className="size-3.5 text-primary" />
                        {info.label.split(' ')[0]}
                      </span>
                      {isCurrent && <CheckCircle2 className="size-3.5 text-primary" />}
                    </div>
                    <span className="text-[10px] leading-tight text-muted-foreground">
                      {info.description.slice(0, 58)}...
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MFA prompt for Rescuer / Admin */}
          {ROLE_PERMISSIONS[session.role].requiresMfa && !session.isMfaVerified && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                <KeyRound className="size-4" />
                <span>Требуется двухфакторная аутентификация (MFA)</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Для доступа к закрытым координатам всех групп и спасательным ИИ-моделям введите проверочный код TOTP (любые 6 цифр, напр. 123456):
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="6-значный код"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                  maxLength={6}
                />
                <Button size="sm" onClick={handleVerifyMfa} className="h-8 text-xs shrink-0">
                  Подтвердить
                </Button>
              </div>
            </div>
          )}

          {/* Fast sign-in / link account */}
          <div className="pt-2 border-t border-border space-y-2">
            <Label className="text-xs font-semibold">Учётная запись:</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  Rbac.signIn('guide@treeline.app', 'Иван (Инструктор)', 'guide');
                  toast({ title: 'Вход выполнен', description: 'Сеанс руководителя группы активирован.' });
                }}
              >
                Войти как Инструктор
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  Rbac.signIn('rescuer@mchs.gov', 'Отряд ПСО 112', 'rescuer');
                  toast({ title: 'Вход выполнен', description: 'Сеанс дежурного спасателя активирован.' });
                }}
              >
                Войти как Спасатель
              </Button>
            </div>
            <div className="flex justify-between items-center pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10"
                onClick={() => {
                  Rbac.signOut();
                  toast({ title: 'Сеанс завершен', description: 'Кэш очищен. Активирован гостевой профиль.' });
                }}
              >
                Выйти из системы
              </Button>
              <span className="text-[11px] text-muted-foreground">
                JWT: автопродление
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
