'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/views/app-layout';
import { AppProvider } from '@/entities/app';
import Preloader from '@/shared/ui/preloader';

const PRELOADER_KEY = 'preloader_shown';

export default function Page() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PRELOADER_KEY)) {
        setLoading(false);
      } else {
        const timer = setTimeout(() => {
          setLoading(false);
          sessionStorage.setItem(PRELOADER_KEY, 'true');
        }, 3000); 
        return () => clearTimeout(timer);
      }
    } catch (error) {
      // In case sessionStorage is not available (e.g., in some privacy modes)
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <Preloader />;
  }

  return (
    <AppProvider>
      <AppLayout key="app-layout" />
    </AppProvider>
  );
}
