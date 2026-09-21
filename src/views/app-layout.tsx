'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import DesktopSidebar from '@/views/desktop-sidebar';
import MobileBottomNav from '@/views/mobile-bottom-nav';
import { useAppContext } from '@/entities/app';
import ViewLoader from '@/shared/ui/view-loader';

// Direct imports for reliable bundling without missing chunk errors
import LocationTracker from '@/views/location-tracker';
import GroupChat from '@/views/group-chat';
import WeatherForecast from '@/views/weather-forecast';
import RoutePlanner from '@/views/route-planner';
import LostHikerTool from '@/features/hiker-search/ui/lost-hiker-tool';
import EmergencyServices from '@/views/emergency-services';
import ProfilePage from '@/views/profile-page';
import AboutUs from '@/views/about-us';
import AboutApp from '@/views/about-app';

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
  const { activeView, viewProps, groupsHook } = useAppContext();
  const isMobile = useIsMobile();

  const renderMainContent = () => {
    // Wait for groups to be loaded from localStorage
    if (!groupsHook.isLoaded) {
      return <ViewLoader />;
    }
    
    // Full-screen views that don't need padding
    if (activeView === 'map' && viewProps?.drawingMode) {
      return <MapRouteDrawer />;
    }
     if (activeView === 'chat') {
        return <GroupChat />;
    }

    const isMapView = activeView === 'map';

    // Other views are rendered with padding
    const views: Record<string, React.ReactNode> = {
      tracker: <LocationTracker />,
      weather: <WeatherForecast />,
      routes: <RoutePlanner />,
      search: <LostHikerTool />,
      emergency: <EmergencyServices />,
      profile: <ProfilePage />,
      about: <AboutUs />,
      'about-app': <AboutApp />,
    };

    const currentView = views[activeView];

    // Default to map view if no other view is active
    if (!currentView && !isMapView) {
        return (
             <div className="absolute inset-0">
                <MapView {...viewProps}/>
            </div>
        )
    }

    // Render map in the background for all padded views
    return (
      <>
        <div className="absolute inset-0 z-0">
            <MapView {...viewProps}/>
        </div>
        {currentView && (
            <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm overflow-y-auto pb-16 md:pb-0 animate-fade-in">
                {currentView}
            </div>
        )}
     </>
    );
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        {!isMobile && <DesktopSidebar />}
        <div className="flex-1 relative overflow-y-auto">
          <React.Suspense fallback={<ViewLoader />}>
            {renderMainContent()}
          </React.Suspense>
        </div>
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
