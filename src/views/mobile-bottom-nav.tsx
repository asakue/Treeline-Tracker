'use client';

import { memo, useState } from 'react';
import {
  Map,
  Users,
  Waypoints,
  Siren,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/sheet';
import MobileMenu from './mobile-menu';
import { useAppContext, type View } from '@/entities/app';

const MobileBottomNav = memo(() => {
  const { activeView, setView } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mainNavItems = [
    { id: 'map' as View, icon: Map, tooltip: 'Карта' },
    { id: 'tracker' as View, icon: Users, tooltip: 'Трекер' },
    { id: 'routes' as View, icon: Waypoints, tooltip: 'Маршруты' },
    {
      id: 'emergency' as View,
      icon: Siren,
      tooltip: 'SOS',
      className: () =>
        cn(
          'text-destructive hover:bg-destructive/10 hover:text-destructive',
          activeView === 'emergency' &&
            'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground font-bold'
        ),
    },
  ];

  const handleViewChange = (view: View) => {
    setView(view);
    setIsMenuOpen(false);
  };


  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border md:hidden z-50">
      <div className="flex justify-around items-center px-1 py-1">
        {mainNavItems.map(({ id, icon: Icon, tooltip, className }) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            className={cn(
              'flex flex-col h-12 items-center justify-center p-1 rounded-md flex-1 min-w-0 transition-all cursor-pointer',
              activeView === id && !className && 'bg-accent/80 text-accent-foreground font-semibold',
              className && className()
            )}
            onClick={() => setView(id)}
          >
            <Icon className="size-4.5 shrink-0" />
            <span className="text-[10px] sm:text-xs mt-0.5 truncate">{tooltip}</span>
          </Button>
        ))}
        <Sheet key="mobile-nav-more-sheet" open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col h-12 items-center justify-center p-1 rounded-md flex-1 min-w-0 cursor-pointer"
            >
              <MoreHorizontal className="size-4.5 shrink-0" />
              <span className="text-[10px] sm:text-xs mt-0.5 truncate">Меню</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto pt-4 px-0 pb-0">
             <SheetHeader className="px-4 pb-4">
                <SheetTitle>Дополнительное меню</SheetTitle>
              </SheetHeader>
             <MobileMenu onNavigate={handleViewChange} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
});
MobileBottomNav.displayName = 'MobileBottomNav';

export default MobileBottomNav;
