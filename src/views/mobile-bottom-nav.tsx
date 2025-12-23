'use client';

import { memo, useState } from 'react';
import {
  Map,
  MessageSquare,
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
    { id: 'chat' as View, icon: MessageSquare, tooltip: 'Чат' },
    {
      id: 'emergency' as View,
      icon: Siren,
      tooltip: 'Вызов служб',
      className: () =>
        cn(
          'text-destructive hover:bg-destructive/10 hover:text-destructive',
          activeView === 'emergency' &&
            'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground'
        ),
    },
  ];

  const handleViewChange = (view: View) => {
    setView(view);
    setIsMenuOpen(false);
  };


  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t md:hidden z-50">
      <div className="flex justify-around items-center p-2">
        {mainNavItems.map(({ id, icon: Icon, tooltip, className }) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            className={cn(
              'flex flex-col h-auto items-center justify-center p-1 rounded-md w-1/4',
              activeView === id && !className && 'bg-accent text-accent-foreground',
              className && className()
            )}
            onClick={() => setView(id)}
          >
            <Icon className="size-5" />
            <span className="text-xs mt-1">{tooltip}</span>
          </Button>
        ))}
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col h-auto items-center justify-center p-1 rounded-md w-1/4"
            >
              <MoreHorizontal className="size-5" />
              <span className="text-xs mt-1">Меню</span>
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
