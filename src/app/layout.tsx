'use client';

import './globals.css';
import 'leaflet/dist/leaflet.css';
import { Toaster } from '@/shared/ui/toaster';
import { Inter } from 'next/font/google';
import { cn } from '@/shared/lib/utils';
import { ThemeProvider } from '@/shared/ui/theme-provider';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
       <head>
        <title>Дозор</title>
        <link rel="icon" href="/favicon.svg" sizes="any" />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

    