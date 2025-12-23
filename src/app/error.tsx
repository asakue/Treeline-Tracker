'use client';

import { useEffect } from 'react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Логирование ошибки в сервис мониторинга
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md text-center bg-card">
        <CardHeader>
          <div className="mx-auto bg-destructive/10 p-3 rounded-full">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <CardTitle className="mt-4 text-2xl">Что-то пошло не так</CardTitle>
          <CardDescription>
            В приложении произошла непредвиденная ошибка.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Вы можете попробовать перезагрузить страницу. Если проблема повторится, свяжитесь с поддержкой.
          </p>
          <Button onClick={() => reset()} className="w-full">
            Перезагрузить страницу
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

    