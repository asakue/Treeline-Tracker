'use client';

import dynamic from 'next/dynamic';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import DesktopSidebar from './desktop-sidebar';
import MobileBottomNav from './mobile-bottom-nav';
import { useAppContext } from './app-provider';
import ViewLoader from './view-loader';


const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => <ViewLoader />,
});

const MapRouteDrawer = dynamic(() => import('./map-route-drawer'), {
  ssr: false,
  loading: () => <ViewLoader />,
});

const LocationTracker = dynamic(() => import('./location-tracker'), { ssr: false, loading: () => <ViewLoader /> });
const GroupChat = dynamic(() => import('./group-chat'), { ssr: false, loading: () => <ViewLoader /> });
const WeatherForecast = dynamic(() => import('./weather-forecast'), { loading: () => <ViewLoader /> });
const RoutePlanner = dynamic(() => import('./route-planner'), { loading: () => <ViewLoader /> });
const LostHikerTool = dynamic(() => import('./lost-hiker-tool'), { loading: () => <ViewLoader /> });
const EmergencyServices = dynamic(() => import('./emergency-services'), { loading: () => <ViewLoader /> });
const ProfilePage = dynamic(() => import('./profile-page'), { loading: () => <ViewLoader /> });
const AboutUs = dynamic(() => import('./about-us'), { loading: () => <ViewLoader /> });
const AboutApp = dynamic(() => import('./about-app'), { loading: () => <ViewLoader /> });


export default function AppLayout() {
  const { activeView, viewProps, groupsHook } = useAppContext();
  const isMobile = useIsMobile();

  const renderMainContent = () => {
    // Wait for groups to be loaded from localStorage
    if (!groupsHook.isLoaded) {
      return <ViewLoader />;
    }
    
    // Views that need full-screen layout
    if (activeView === 'map' && !viewProps?.drawingMode) {
      return (
        <div className="absolute inset-0">
          <MapView {...viewProps} />
        </div>
      );
    }
     if (activeView === 'map' && viewProps?.drawingMode) {
      return (
        <div className="absolute inset-0">
          <MapRouteDrawer />
        </div>
      );
    }
    if (activeView === 'chat') {
      return <GroupChat />;
    }


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

    if (currentView) {
       return (
         <div className="p-4 md:p-6 space-y-6">
          {currentView}
        </div>
      );
    }

    // Fallback to map
    return (
      <div className="absolute inset-0">
        <MapView {...viewProps}/>
      </div>
    );
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        {!isMobile && <DesktopSidebar />}
        <div className="flex-1 overflow-y-auto relative pb-16 md:pb-0">
           {renderMainContent()}
        </div>
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
