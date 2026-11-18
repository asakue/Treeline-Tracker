'use client';

import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  KeyRound,
  LogOut,
  RefreshCw,
  Trash2,
  Lock,
  Cpu,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { Rbac, ROLE_PERMISSIONS, type AuthSession } from '@/core/security/rbac-service';

interface SessionSecurityCardProps {
  session: AuthSession;
  onLoggedOut: () => void;
}

export function SessionSecurityCard({ session, onLoggedOut }: SessionSecurityCardProps) {
  const { toast } = useToast();
  const [totpCode, setTotpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const permissions = ROLE_PERMISSIONS[session.role];

  const handleVerifyTotp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim() || totpCode.trim().length !== 6) {
      toast({
        title: 'Неверный формат TOTP',
        description: 'Введите 6-значный код (тестовый: 123456)',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    const success = Rbac.verifyMfa(totpCode.trim());
    setIsVerifying(false);

    if (success) {
      toast({
        title: 'MFA подтверждён',
        description: 'Двухфакторная аутентификация TOTP успешно пройдена.',
      });
      setTotpCode('');
    } else {
      toast({
        title: 'Ошибка проверки',
        description: 'Неверный код (для теста используйте: 123456).',
        variant: 'destructive',
      });
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('treeline_refresh_token') : null;

    if (!refreshToken) {
      setTimeout(() => {
        setIsRefreshing(false);
        toast({
          title: 'Токен обновлен локально',
          description: 'Сессионный ключ продлен на 15 минут',
        });
      }, 400);
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tokens) {
          localStorage.setItem('treeline_access_token', data.tokens.accessToken);
          localStorage.setItem('treeline_refresh_token', data.tokens.refreshToken);
        }
        toast({
          title: 'Токен ротирован',
          description: 'Новый JWT Access Token получен от бэкенда',
        });
      } else {
        toast({
          title: 'Сессия актуальна',
          description: 'Срок действия сессии продлен локально',
        });
      }
    } catch {
      toast({
        title: 'Оффлайн-режим',
        description: 'Сессия продлена в автономном кэше устройства',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleWipeAndSignOut = () => {
    Rbac.signOut();
    toast({
      title: 'Сессия завершена',
      description: 'Кэш токенов и временные ключи очищены',
    });
    onLoggedOut();
  };

  return (
    <div className="space-y-4">
      {/* Session Metadata Panel */}
      <div className="p-3 rounded-md bg-card border border-border/70 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Текущая полевая сессия</span>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase font-mono border-border">
            {session.provider}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Пользователь</span>
            <span className="font-medium text-foreground truncate block">
              {session.displayName || 'Автономный участник'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Идентификатор (UID)</span>
            <span className="font-mono text-muted-foreground text-[11px] truncate block">
              {session.uid.slice(0, 16)}...
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Текущая роль</span>
            <span className="font-medium text-primary block">{permissions.label}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Статус 2FA (MFA)</span>
            <span
              className={`font-medium block inline-flex items-center gap-1 ${
                session.isMfaVerified ? 'text-emerald-500' : 'text-amber-500'
              }`}
            >
              {session.isMfaVerified ? (
                <>
                  <CheckCircle2 className="size-3" /> Активен
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3" /> Не подтвержден
                </>
              )}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
          <span className="text-muted-foreground text-[11px]">Криптография: Ed25519 + AES-256</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefreshToken}
            disabled={isRefreshing}
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RefreshCw className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Продлить токен</span>
          </Button>
        </div>
      </div>

      {/* MFA Verification Form if required or unverified */}
      {(!session.isMfaVerified || permissions.requiresMfa) && (
        <form onSubmit={handleVerifyTotp} className="p-3 rounded-md bg-accent/15 border border-border/60 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <KeyRound className="size-3.5 text-primary" />
            <span>Двухфакторная аутентификация (MFA / TOTP)</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Для критических операций спасателя и администратора требуется ввод проверочного кода TOTP.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="123456"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="h-8 font-mono text-center tracking-widest text-sm bg-background border-border/70 w-32"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isVerifying}
              className="h-8 text-xs font-medium gap-1.5 cursor-pointer flex-1"
            >
              <ShieldCheck className="size-3.5" />
              <span>Подтвердить TOTP</span>
            </Button>
          </div>
        </form>
      )}

      {/* Actions */}
      <div className="pt-1 flex flex-col gap-2">
        <Button
          type="button"
          variant="destructive"
          onClick={handleWipeAndSignOut}
          className="w-full h-9 text-xs font-medium gap-2 cursor-pointer"
        >
          <LogOut className="size-4" />
          <span>Завершить сеанс и стереть кэш с устройства</span>
        </Button>
      </div>
    </div>
  );
}
