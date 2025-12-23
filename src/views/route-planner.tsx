'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import {
  Plus,
  Waypoints,
  Clock,
  Mountain,
  Footprints,
  MapPin,
  LocateFixed,
  Waves,
  Bike,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { Separator } from '@/shared/ui/separator';
import { useRoutes, type Route } from '@/entities/route';
import CreateRouteForm from '@/features/route-drawing/ui/create-route-form';
import { useAppContext } from '@/entities/app';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { useToast } from '@/shared/hooks/use-toast';

const difficultyStyles = {
  'Легко': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Средне': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Сложно': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Очень сложно': 'bg-red-500/10 text-red-400 border-red-500/20',
};

const typeIcons: { [key: string]: React.ElementType } = {
  'Горный': Mountain,
  'Равнинный': Footprints,
  'Сплав': Waves,
  'Велосипедный': Bike,
};

export default function RoutePlanner() {
  const { routes, addRoute, updateRoute, deleteRoute } = useRoutes();
  const { setView } = useAppContext();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [routeToEdit, setRouteToEdit] = useState<Route | undefined>(undefined);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<Route | null>(null);

  const handleFormSubmit = (routeData: Omit<Route, 'id'>, id?: string) => {
    if (id) {
      updateRoute(id, routeData);
    } else {
      addRoute(routeData);
    }
    setIsFormOpen(false);
    setRouteToEdit(undefined);
  };

  const handleOpenForm = (route?: Route) => {
    setRouteToEdit(route);
    setIsFormOpen(true);
  };

  const handleDrawOnMap = () => {
    setView('map', { drawingMode: true });
  };

  const openDeleteDialog = (route: Route) => {
    setRouteToDelete(route);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (routeToDelete) {
      deleteRoute(routeToDelete.id);
      toast({
        title: 'Маршрут удален',
        description: `Маршрут "${routeToDelete.name}" был успешно удален.`,
      });
    }
    setDeleteDialogOpen(false);
    setRouteToDelete(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Планировщик маршрутов
        </h2>
        <p className="text-sm text-muted-foreground">
          Планируйте и управляйте своими маршрутами.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button
          variant="default"
          onClick={() => handleOpenForm()}
          className="h-auto py-3 px-4 whitespace-normal"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center text-center gap-2">
            <Plus className="size-5 shrink-0" />
            <span>Новый маршрут по координатам</span>
          </div>
        </Button>
        <Button
          variant="outline"
          onClick={handleDrawOnMap}
          className="h-auto py-3 px-4 whitespace-normal"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center text-center gap-2">
            <Pencil className="size-4 shrink-0" />
            <span>Нарисовать маршрут на карте</span>
          </div>
        </Button>
      </div>

      <CreateRouteForm
        key={routeToEdit?.id || 'new'}
        open={isFormOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRouteToEdit(undefined);
          setIsFormOpen(isOpen);
        }}
        onRouteSubmit={handleFormSubmit}
        routeToEdit={routeToEdit}
      />

      <div>
        <h3 className="font-semibold mb-3 text-foreground">
          Сохраненные маршруты
        </h3>
        <div className="space-y-4">
          {routes.map((route) => {
            const TypeIcon = typeIcons[route.type] || Footprints;
            return (
              <Card
                key={route.id}
                className="bg-card border-border transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg">{route.name}</CardTitle>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(difficultyStyles[route.difficulty])}
                      >
                        {route.difficulty}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenForm(route);
                        }}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">Редактировать маршрут</span>
                      </Button>
                       <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-destructive/70 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteDialog(route);
                        }}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Удалить маршрут</span>
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-1.5 text-xs pt-1">
                    <MapPin className="size-3" />
                    {route.location}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Waypoints className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Расстояние</p>
                      <p className="font-medium">{route.distance}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Время</p>
                      <p className="font-medium">{route.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mountain className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Высота</p>
                      <p className="font-medium">{route.altitude}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TypeIcon className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Тип</p>
                      <p className="font-medium">{route.type}</p>
                    </div>
                  </div>
                </CardContent>
                <Separator className="mb-4 w-[95%] mx-auto" />
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LocateFixed className="size-4" />
                    <span>{route.coordinates}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Маршрут "{routeToDelete?.name}" будет удален навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    