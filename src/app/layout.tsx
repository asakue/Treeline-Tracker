import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { Toaster } from '@/shared/ui/toaster';
import { Inter } from 'next/font/google';
import { cn } from '@/shared/lib/utils';
import { ThemeProvider } from '@/shared/ui/theme-provider';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Treeline Tracker',
  description: 'Hiking group tracking, route planning, weather forecast, emergency services, and lost hiker search tool with AI recommendations.',
  openGraph: {
    title: 'Treeline Tracker',
    description: 'Hiking group tracking, route planning, weather forecast, emergency services, and lost hiker search tool with AI recommendations.',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
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
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}

    