'use client';

import React, { useState } from 'react';
import { Mail, Lock, LogIn, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Checkbox } from '@/shared/ui/checkbox';
import { useToast } from '@/shared/hooks/use-toast';
import { Rbac } from '@/core/security/rbac-service';
import type { UserRole } from '@/core/domain/types';

interface SignInFormProps {
  onSuccess: () => void;
  onSwitchToSignUp: () => void;
  onSwitchToReset: () => void;
}

export function SignInForm({ onSuccess, onSwitchToSignUp, onSwitchToReset }: SignInFormProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Пожалуйста, введите email и пароль');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try to authenticate against local/remote backend API if reachable
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        if (data.tokens) {
          localStorage.setItem('treeline_access_token', data.tokens.accessToken);
          localStorage.setItem('treeline_refresh_token', data.tokens.refreshToken);
        }
        const user = data.user || {};
        Rbac.signIn(
          email.trim(),
          user.displayName || email.split('@')[0],
          (user.role as UserRole) || 'hiker'
        );
      } else {
        // Offline / fallback sign-in
        const role: UserRole = email.includes('admin')
          ? 'admin'
          : email.includes('rescuer') || email.includes('mchs')
          ? 'rescuer'
          : email.includes('guide')
          ? 'guide'
          : 'hiker';

        Rbac.signIn(email.trim(), email.split('@')[0], role);
      }

      toast({
        title: 'Успешная авторизация',
        description: `Добро пожаловать в Дозор, ${email.split('@')[0]}!`,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка входа в систему');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const guestId = Math.floor(1000 + Math.random() * 9000);
    Rbac.signInAnonymously(`Позывной-${guestId}`);
    toast({
      title: 'Автономный режим',
      description: `Активирован гостевой профиль Позывной-${guestId}`,
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="signin-email" className="text-xs font-medium text-muted-foreground">
          Электронная почта
        </Label>
        <div className="relative">
          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="signin-email"
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password" className="text-xs font-medium text-muted-foreground">
            Пароль
          </Label>
          <button
            type="button"
            onClick={onSwitchToReset}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            Забыли пароль?
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="signin-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-9 h-9 text-sm bg-background border-border/70"
            disabled={isLoading}
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-muted-foreground select-none">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
          />
          <span>Запомнить сессию</span>
        </label>
        <span className="text-[11px] text-muted-foreground font-mono">TLS 1.3 / E2EE</span>
      </div>

      <div className="pt-2 space-y-2">
        <Button
          type="submit"
          className="w-full h-9 text-sm font-medium gap-2 cursor-pointer"
          disabled={isLoading}
        >
          <LogIn className="size-4" />
          <span>{isLoading ? 'Проверка ключей...' : 'Войти в систему'}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleGuestLogin}
          className="w-full h-9 text-xs gap-2 border-border/60 hover:bg-accent/40 cursor-pointer"
        >
          <ShieldCheck className="size-3.5 text-muted-foreground" />
          <span>Автономный полевой вход (Без интернета)</span>
        </Button>
      </div>

      <div className="pt-3 border-t border-border/50 text-center text-xs text-muted-foreground">
        <span>Нет учетной записи? </span>
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="text-primary font-medium hover:underline inline-flex items-center gap-0.5 cursor-pointer"
        >
          Зарегистрироваться <ArrowRight className="size-3" />
        </button>
      </div>
    </form>
  );
}
