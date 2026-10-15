'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="ru">
      <body className="min-h-screen flex items-center justify-center p-4 bg-slate-900 text-slate-100 font-sans">
        <div className="max-w-md w-full p-6 rounded-xl border border-slate-800 bg-slate-950 text-center space-y-4 shadow-xl">
          <h2 className="text-xl font-bold text-rose-500">Системная ошибка приложения</h2>
          <p className="text-sm text-slate-400">
            Произошел непредвиденный сбой при загрузке основного интерфейса.
          </p>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors cursor-pointer"
          >
            Повторить попытку
          </button>
        </div>
      </body>
    </html>
  );
}
