'use client';

import React, { useState } from 'react';
import { Mail, Lock, KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useToast } from '@/shared/hooks/use-toast';

interface PasswordResetFormProps {
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
}

export function PasswordResetForm({ onSuccess, onSwitchToSignIn }: PasswordResetFormProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg('Укажите email адрес');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep('verify');
      toast({
        title: 'Код подтверждения отправлен',
        description: `6-значный одноразовый код выслан на ${email}. Для теста используйте 123456`,
      });
    }, 600);
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (code.trim() !== '123456' && code.trim().length !== 6) {
      setErrorMsg('Неверный проверочный код. Тестовый код: 123456');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Пароль должен содержать от 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: 'Пароль успешно изменен',
        description: 'Используйте новый пароль для входа в систему',
      });
      onSuccess();
    }, 600);
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {step === 'request' ? (
        <form onSubmit={handleRequestCode} className="space-y-3.5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Введите адрес электронной почты, связанный с вашей учетной записью. Мы отправим одноразовый криптографический код подтверждения.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="reset-email" className="text-xs font-medium text-muted-foreground">
              Электронная почта
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="reset-email"
                type="email"
                placeholder="hiker@treeline.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-9 text-sm bg-background border-border/70"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-9 text-sm font-medium gap-2 cursor-pointer"
            disabled={isLoading}
          >
            <KeyRound className="size-4" />
            <span>{isLoading ? 'Генерация токена...' : 'Получить код сброса'}</span>
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyAndReset} className="space-y-3.5">
          <div className="p-2.5 rounded-md bg-accent/20 border border-border/50 text-xs text-muted-foreground">
            Код отправлен на <span className="font-semibold text-foreground">{email}</span>
          </div>

          <div className="space-y-1">
            <Label htmlFor="reset-code" className="text-xs font-medium text-muted-foreground">
              6-значный код подтверждения
            </Label>
            <Input
              id="reset-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-9 text-center font-mono text-base tracking-widest bg-background border-border/70"
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="new-pass" className="text-xs font-medium text-muted-foreground">
              Новый пароль
            </Label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="new-pass"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-9 h-9 text-sm bg-background border-border/70"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-new-pass" className="text-xs font-medium text-muted-foreground">
              Подтверждение нового пароля
            </Label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="confirm-new-pass"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9 h-9 text-sm bg-background border-border/70"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-9 text-sm font-medium gap-2 cursor-pointer"
            disabled={isLoading}
          >
            <CheckCircle2 className="size-4" />
            <span>{isLoading ? 'Обновление пароля...' : 'Сохранить новый пароль'}</span>
          </Button>
        </form>
      )}

      <div className="pt-2 text-center text-xs text-muted-foreground">
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="size-3" /> Вернуться ко входу
        </button>
      </div>
    </div>
  );
}
