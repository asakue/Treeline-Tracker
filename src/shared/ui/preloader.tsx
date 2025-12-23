'use client';

import { useState, useEffect } from 'react';
import { Mountain } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export default function Preloader() {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
    }, 2500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500',
        isExiting ? 'opacity-0' : 'opacity-100'
      )}
    >
      <div className="relative flex items-center justify-center animate-pulse-slow">
        <Mountain className="size-24 text-primary" />
         <div className="absolute inset-0 bg-primary rounded-full blur-2xl opacity-20"></div>
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-wider text-foreground animate-fade-in-up-long">
        Добро пожаловать в Дозор
      </h1>
    </div>
  );
}
