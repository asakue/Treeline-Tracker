'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import DesktopSidebar from '@/views/desktop-sidebar';
import MobileBottomNav from '@/views/mobile-bottom-nav';
import { useAppContext } from '@/entities/app';
import ViewLoader from '@/shared/ui/view-loader';
import ViewErrorBoundary from '@/shared/ui/view-error-boundary';
import { getViewDefinition } from '@/shared/lib/view-registry';

// Direct imports for reliable bundling without missing chunk errors
import LocationTracker from '@/views/location-tracker';
import GroupChat from '@/views/group-chat';
import WeatherForecast from '@/views/weather-forecast';
import RoutePlanner from '@/views/route-planner';
import LostHikerTool from '@/features/hiker-search/ui/lost-hiker-tool';
import EmergencyServices from '@/views/emergency-services';
import ProfilePage from '@/views/profile-page';
import AnalyticsView from '@/views/analytics-view';
import AboutUs from '@/views/about-us';
import AboutApp from '@/views/about-app';
import ExpeditionStatusBar from '@/features/expedition/ui/expedition-status-bar';

// Leaflet map components require dynamic import with ssr: false due to browser-only window/DOM APIs
const MapView = dynamic(() => import('@/views/map-view'), {
  ssr: false,
  loading: () => <ViewLoader />,
});

const MapRouteDrawer = dynamic(() => import('@/features/route-drawing/ui/map-route-drawer'), {
  ssr: false,
  loading: () => <ViewLoader />,
});

export default function AppLayout() {
  const { activeView, setView, viewProps, groupsHook } = useAppContext();
  const isMobile = useIsMobile();
  const activeDef = getViewDefinition(activeView);

  const renderViewContent = () => {
    switch (activeView) {
      case 'tracker':
        return <LocationTracker />;
      case 'weather':
        return <WeatherForecast />;
      case 'routes':
        return <RoutePlanner />;
      case 'analytics':
        return <AnalyticsView />;
      case 'search':
        return <LostHikerTool />;
      case 'emergency':
        return <EmergencyServices />;
      case 'profile':
        return <ProfilePage />;
      case 'about':
        return <AboutUs />;
      case 'about-app':
        return <AboutApp />;
      default:
        return null;
    }
  };

  const renderMainContent = () => {
    // Fullscreen route drawing mode
    if (activeView === 'map' && viewProps?.drawingMode) {
      return (
        <ViewErrorBoundary viewName="Редактор маршрута" onGoToMap={() => setView('map')}>
          <MapRouteDrawer />
        </ViewErrorBoundary>
      );
    }

    // Fullscreen group chat
    if (activeView === 'chat') {
      return (
        <ViewErrorBoundary viewName={activeDef.label} onGoToMap={() => setView('map')}>
          <GroupChat />
        </ViewErrorBoundary>
      );
    }

    const currentViewContent = renderViewContent();

    // Default to map view if no overlay view is active
    if (!currentViewContent) {
      return (
        <div className="absolute inset-0">
          <ViewErrorBoundary viewName="Интерактивная карта" onGoToMap={() => setView('map')}>
            <MapView {...viewProps} />
          </ViewErrorBoundary>
        </div>
      );
    }

    // Render interactive map in background with view content overlaid in glassmorphic container
    return (
      <>
        <div className="absolute inset-0 z-0">
          <ViewErrorBoundary viewName="Интерактивная карта" onGoToMap={() => setView('map')}>
            <MapView {...viewProps} />
          </ViewErrorBoundary>
        </div>
        <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm overflow-y-auto pb-16 md:pb-0 animate-fade-in">
          <ViewErrorBoundary
            key={activeView}
            viewName={activeDef.label}
            onGoToMap={() => setView('map')}
          >
            {currentViewContent}
          </ViewErrorBoundary>
        </div>
      </>
    );
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {!isMobile && <DesktopSidebar />}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          <ExpeditionStatusBar />
          <main className="flex-1 relative overflow-y-auto min-h-0" role="main">
            <React.Suspense fallback={<ViewLoader />}>
              {renderMainContent()}
            </React.Suspense>
          </main>
        </div>
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
