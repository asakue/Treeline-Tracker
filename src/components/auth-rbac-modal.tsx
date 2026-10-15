'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import {
  UserCheck,
  Shield,
  KeyRound,
  LogOut,
  Link,
  CheckCircle2,
  Lock,
  User,
  AlertCircle,
} from 'lucide-react';
import { Rbac, AuthSession, ROLE_PERMISSIONS } from '@/core/security/rbac-service';
import { UserRole } from '@/core/domain/types';
import { useToast } from '@/shared/hooks/use-toast';

interface AuthRbacModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AuthSession;
}

export function AuthRbacModal({ isOpen, onClose, session }: AuthRbacModalProps) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<UserRole>(session.role);
  const [mfaCode, setMfaCode] = useState('');
  const [emailInput, setEmailInput] = useState(session.email || '');
  const [nameInput, setNameInput] = useState(session.displayName || '');

  const handleRoleSwitch = (role: UserRole) => {
    setSelectedRole(role);
    Rbac.switchRole(role);
    toast({
      title: 'Роль переключена',
      description: `Установлены права: ${ROLE_PERMISSIONS[role].label}`,
    });
  };

  const handleMfaVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const success = Rbac.verifyMfa(mfaCode);
    if (success) {
      toast({
        title: 'MFA подтверждён',
        description: 'Двухфакторная аутентификация TOTP успешно пройдена.',
      });
      setMfaCode('');
    } else {
      toast({
        title: 'Неверный код MFA',
        description: 'Введите 6-значный проверочный код (для теста: 123456).',
        variant: 'destructive',
      });
    }
  };

  const handleLinkAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    Rbac.linkAccount(emailInput.trim(), nameInput.trim());
    toast({
      title: 'Аккаунт привязан',
      description: `Гостевой сеанс успешно связан с ${emailInput} без потери сохранённых треков.`,
    });
  };

  const handleSignInGoogle = () => {
    Rbac.signIn('guide.alex@gmail.com', 'Алексей Смирнов (Google)', selectedRole);
    toast({
      title: 'Вход через Google',
      description: 'Авторизован аккаунт guide.alex@gmail.com',
    });
  };

  const handleSignOut = () => {
    Rbac.signOut();
    toast({
      title: 'Сеанс завершён',
      description: 'Кэш сессии очищен, выполнен безопасный выход.',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Аутентификация & RBAC (FR-001)</DialogTitle>
              <DialogDescription>
                Управление ролями доступа, MFA и связыванием учётных записей
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="role" className="w-full">
          <TabsList className="grid grid-cols-3 h-9 text-xs">
            <TabsTrigger value="role" className="text-xs">Переключатель ролей</TabsTrigger>
            <TabsTrigger value="auth" className="text-xs">Вход / Привязка</TabsTrigger>
            <TabsTrigger value="mfa" className="text-xs">MFA Защита</TabsTrigger>
          </TabsList>

          {/* TAB 1: Fast Role Switcher */}
          <TabsContent value="role" className="space-y-4 pt-3">
            <div className="text-xs text-muted-foreground">
              Выберите активную роль пользователя для мгновенного тестирования прав доступа и интерцепторов:
            </div>

            <RadioGroup
              value={selectedRole}
              onValueChange={(val) => handleRoleSwitch(val as UserRole)}
              className="space-y-2.5"
            >
              {(Object.keys(ROLE_PERMISSIONS) as UserRole[]).map((roleKey) => {
                const conf = ROLE_PERMISSIONS[roleKey];
                const isSelected = selectedRole === roleKey;
                return (
                  <Label
                    key={roleKey}
                    htmlFor={`role-${roleKey}`}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-muted/30'
                    }`}
                  >
                    <RadioGroupItem value={roleKey} id={`role-${roleKey}`} className="mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{conf.label}</span>
                        {conf.requiresMfa && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            MFA Обязательно
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-normal">
                        {conf.description}
                      </p>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
          </TabsContent>

          {/* TAB 2: Authentication & Account Linking */}
          <TabsContent value="auth" className="space-y-4 pt-3">
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Текущий сеанс:</span>
                <span className="font-mono font-semibold">
                  {session.isAnonymous ? 'Гостевой (Анонимный)' : 'Постоянный аккаунт'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">UID пользователя:</span>
                <span className="font-mono">{session.uid}</span>
              </div>
              {session.email && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-mono text-primary font-semibold">{session.email}</span>
                </div>
              )}
            </div>

            {session.isAnonymous ? (
              <form onSubmit={handleLinkAccount} className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Link className="size-4 text-primary" />
                  <span>Бесшовное связывание аккаунта (FR-001b)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Привяжите анонимную сессию к постоянному аккаунту без потери созданных треков и групп.
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="link-email" className="text-xs">Email адрес</Label>
                  <Input
                    id="link-email"
                    type="email"
                    placeholder="hiker@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="link-name" className="text-xs">Имя в походе</Label>
                  <Input
                    id="link-name"
                    type="text"
                    placeholder="Даниил Г."
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                  />
                </div>

                <Button type="submit" size="sm" className="w-full text-xs">
                  Связать учётную запись
                </Button>

                <div className="relative py-2 text-center text-xs text-muted-foreground">
                  <span className="bg-background px-2">или войти через</span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleSignInGoogle}
                >
                  Войти через Google OAuth 2.0
                </Button>
              </form>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  <span>Учётная запись полностью верифицирована</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full text-xs text-destructive hover:text-destructive"
                >
                  <LogOut className="size-3.5 mr-1.5" />
                  Выйти из учётной записи (сброс кэша)
                </Button>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Multi-Factor Authentication */}
          <TabsContent value="mfa" className="space-y-4 pt-3">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold">
                <KeyRound className="size-4 text-amber-500" />
                <span>Двухфакторная защита TOTP (FR-001d)</span>
              </div>
              <p className="text-muted-foreground">
                Для доступа к оперативным координатам и вызову спасателей (роли Rescuer и Admin) требуется подтверждение одноразовым 6-значным паролем.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Статус MFA для роли:</span>
                <span className="font-mono font-semibold">
                  {ROLE_PERMISSIONS[session.role].requiresMfa ? (
                    session.isMfaVerified ? (
                      <span className="text-emerald-500 font-bold">ПОДТВЕРЖДЕНО</span>
                    ) : (
                      <span className="text-amber-500 font-bold">ТРЕБУЕТСЯ ВВОД КОДА</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">НЕ ТРЕБУЕТСЯ</span>
                  )}
                </span>
              </div>
            </div>

            {ROLE_PERMISSIONS[session.role].requiresMfa && !session.isMfaVerified && (
              <form onSubmit={handleMfaVerify} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-input" className="text-xs">
                    Код аутентификатора (TOTP / SMS)
                  </Label>
                  <Input
                    id="mfa-input"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    className="font-mono tracking-widest text-center text-base"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Для тестового стенда введите любой 6-значный код (например, 123456).
                  </p>
                </div>

                <Button type="submit" size="sm" className="w-full text-xs">
                  Подтвердить двухфакторный вход
                </Button>
              </form>
            )}

            {session.isMfaVerified && (
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Оперативный доступ к координатам всех групп разблокирован.</span>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="secondary" size="sm" onClick={onClose} className="w-full">
            Готово
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
