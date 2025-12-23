'use client';

import { useState, useEffect } from 'react';
import { Loader2, WifiOff } from 'lucide-react';

export default function ViewLoader() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSlow(true);
    }, 5000); // 5 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background p-8 text-center">
      {!isSlow ? (
        <>
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Загрузка раздела...</p>
        </>
      ) : (
        <div className="animate-fade-in-slow">
          <WifiOff className="mx-auto size-10 text-destructive" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Загрузка занимает больше времени
          </h3>
          <p className="mt-2 text-muted-foreground">
            Пожалуйста, проверьте ваше интернет-соединение и попробуйте обновить страницу.
          </p>
        </div>
      )}
    </div>
  );
}
