'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, Radio, ArrowLeft, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { Rbac, ROLE_PERMISSIONS } from '@/core/security/rbac-service';
import type { UserRole } from '@/core/domain/types';

interface SignUpFormProps {
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
}

export function SignUpForm({ onSuccess, onSwitchToSignIn }: SignUpFormProps) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [callSign, setCallSign] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('hiker');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!displayName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Заполните обязательные поля');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Пароль должен содержать минимум 6 символов');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try to register against backend API if reachable
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          callSign: callSign.trim() || displayName.trim().slice(0, 8),
          role: selectedRole,
        }),
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        if (data.tokens) {
          localStorage.setItem('treeline_access_token', data.tokens.accessToken);
          localStorage.setItem('treeline_refresh_token', data.tokens.refreshToken);
        }
      }

      // Update local session
      Rbac.signIn(
        email.trim(),
        `${displayName.trim()}${callSign ? ` [${callSign.trim()}]` : ''}`,
        selectedRole
      );

      toast({
        title: 'Регистрация завершена',
        description: `Аккаунт создан с профилем ${ROLE_PERMISSIONS[selectedRole].label}`,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {errorMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="signup-name" className="text-xs font-medium text-muted-foreground">
            Имя и фамилия
          </Label>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="signup-name"
              placeholder="Алексей Смирнов"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="pl-9 h-9 text-sm bg-background border-border/70"
              disabled={isLoading}
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="signup-callsign" className="text-xs font-medium text-muted-foreground">
            Позывной (LoRa / Радио)
          </Label>
          <div className="relative">
            <Radio className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="signup-callsign"
              placeholder="БЕРКУТ-01"
              value={callSign}
              onChange={(e) => setCallSign(e.target.value.toUpperCase())}
              className="pl-9 h-9 text-sm font-mono bg-background border-border/70 uppercase"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground">
          Электронная почта
        </Label>
        <div className="relative">
          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="signup-email"
            type="email"
            placeholder="guide@treeline.app"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9 h-9 text-sm bg-background border-border/70"
            disabled={isLoading}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="signup-pass" className="text-xs font-medium text-muted-foreground">
            Пароль
          </Label>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="signup-pass"
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

        <div className="space-y-1">
          <Label htmlFor="signup-pass-confirm" className="text-xs font-medium text-muted-foreground">
            Повтор пароля
          </Label>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="signup-pass-confirm"
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
      </div>

      {/* Role selection cards */}
      <div className="space-y-1.5 pt-1">
        <Label className="text-xs font-medium text-muted-foreground">
          Роль и уровень ответственности
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {(['hiker', 'guide', 'rescuer', 'admin'] as UserRole[]).map((role) => {
            const isSelected = selectedRole === role;
            const meta = ROLE_PERMISSIONS[role];
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`p-2 rounded-md border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/60 bg-card hover:bg-accent/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{meta.label.split(' ')[0]}</span>
                  {isSelected && <CheckCircle2 className="size-3.5 text-primary" />}
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground mt-0.5 truncate">
                  {role === 'hiker'
                    ? 'Личный трек и SOS'
                    : role === 'guide'
                    ? 'Управление группой'
                    : role === 'rescuer'
                    ? 'ПСО / МЧС / SAR'
                    : 'Конфигурация узлов'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          className="w-full h-9 text-sm font-medium gap-2 cursor-pointer"
          disabled={isLoading}
        >
          <Shield className="size-4" />
          <span>{isLoading ? 'Создание учетной записи...' : 'Зарегистрировать профиль'}</span>
        </Button>
      </div>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="size-3" /> Вернуться ко входу
        </button>
      </div>
    </form>
  );
}
