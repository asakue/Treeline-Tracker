'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import DesktopSidebar from '@/views/desktop-sidebar';
import MobileBottomNav from '@/views/mobile-bottom-nav';
import { useAppContext } from '@/entities/app';
import ViewLoader from '@/shared/ui/view-loader';


const MapView = dynamic(() => import('@/views/map-view'), {
  ssr: false,
  loading: () => <ViewLoader />,
});

const MapRouteDrawer = dynamic(() => import('@/features/route-drawing/ui/map-route-drawer'), {
  ssr: false,
  loading: () => <ViewLoader />,
});

const LocationTracker = dynamic(() => import('@/views/location-tracker'), { ssr: false, loading: () => <ViewLoader /> });
const GroupChat = dynamic(() => import('@/views/group-chat'), { ssr: false, loading: () => <ViewLoader /> });
const WeatherForecast = dynamic(() => import('@/views/weather-forecast'), { loading: () => <ViewLoader /> });
const RoutePlanner = dynamic(() => import('@/views/route-planner'), { loading: () => <ViewLoader /> });
const LostHikerTool = dynamic(() => import('@/features/hiker-search/ui/lost-hiker-tool'), { loading: () => <ViewLoader /> });
const EmergencyServices = dynamic(() => import('@/views/emergency-services'), { loading: () => <ViewLoader /> });
const ProfilePage = dynamic(() => import('@/views/profile-page'), { loading: () => <ViewLoader /> });
const AboutUs = dynamic(() => import('@/views/about-us'), { loading: () => <ViewLoader /> });
const AboutApp = dynamic(() => import('@/views/about-app'), { loading: () => <ViewLoader /> });


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
