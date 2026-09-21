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
  Archive,
  RotateCcw,
  Map,
  Inbox,
  AlertCircle,
  ArchiveRestore,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { Separator } from '@/shared/ui/separator';
import { type Route } from '@/entities/route';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

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
  const { setView, routesHook } = useAppContext();
  const routes = routesHook?.routes || [];
  const archivedRoutes = routesHook?.archivedRoutes || [];
  const addRoute = routesHook?.addRoute;
  const updateRoute = routesHook?.updateRoute;
  const archiveRoute = routesHook?.archiveRoute;
  const restoreRoute = routesHook?.restoreRoute;
  const deleteRoute = routesHook?.deleteRoute;
  const clearArchive = routesHook?.clearArchive;

  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [routeToEdit, setRouteToEdit] = useState<Route | undefined>(undefined);
  
  // Permanent delete dialog state
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<Route | null>(null);
  
  // Clear all archive dialog state
  const [isClearArchiveOpen, setIsClearArchiveOpen] = useState(false);

  const handleFormSubmit = async (routeData: Omit<Route, 'id'>, id?: string) => {
    if (id && updateRoute) {
      await updateRoute(id, routeData);
      toast({
        title: 'Маршрут обновлен',
        description: `Маршрут "${routeData.name}" успешно сохранен.`,
      });
    } else if (addRoute) {
      await addRoute(routeData);
      toast({
        title: 'Маршрут создан',
        description: `Маршрут "${routeData.name}" добавлен на карту.`,
      });
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

  const handleShowOnMap = (route: Route) => {
    if (route.path && route.path.length > 0) {
      setView('map', { centerOn: route.path[0] });
    } else {
      setView('map');
    }
  };

  const handleArchive = async (route: Route) => {
    if (!archiveRoute) return;
    await archiveRoute(route.id);
    toast({
      title: 'Маршрут перемещен в архив',
      description: `"${route.name}" скрыт с карты и перемещен в архив.`,
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => restoreRoute && restoreRoute(route.id)}
          className="gap-1.5"
        >
          <RotateCcw className="size-3.5" />
          Вернуть
        </Button>
      ),
    });
  };

  const handleRestore = async (route: Route) => {
    if (!restoreRoute) return;
    await restoreRoute(route.id);
    toast({
      title: 'Маршрут восстановлен',
      description: `"${route.name}" снова отображается на карте и доступен в группах.`,
    });
  };

  const openDeleteDialog = (route: Route) => {
    setRouteToDelete(route);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (routeToDelete && deleteRoute) {
      await deleteRoute(routeToDelete.id);
      toast({
        title: 'Маршрут удален навсегда',
        description: `Маршрут "${routeToDelete.name}" был полностью удален.`,
      });
    }
    setDeleteDialogOpen(false);
    setRouteToDelete(null);
  };

  const confirmClearArchive = async () => {
    if (clearArchive) {
      await clearArchive();
      toast({
        title: 'Архив очищен',
        description: 'Все архивные маршруты были удалены навсегда.',
      });
    }
    setIsClearArchiveOpen(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Планировщик маршрутов
          </h2>
          <p className="text-sm text-muted-foreground">
            Создание, редактирование, архивирование и управление маршрутами на карте.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => handleOpenForm()}
            className="gap-2"
          >
            <Plus className="size-4" />
            <span>Новый маршрут</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDrawOnMap}
            className="gap-2"
          >
            <Pencil className="size-4" />
            <span className="hidden sm:inline">Рисовать на карте</span>
          </Button>
        </div>
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'archive')} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-2">
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="active" className="gap-2">
              <Waypoints className="size-4" />
              <span>Активные маршруты</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs font-semibold">
                {routes.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-2">
              <Archive className="size-4" />
              <span>Архив маршрутов</span>
              {archivedRoutes.length > 0 && (
                <Badge variant="outline" className="ml-1 px-1.5 py-0 text-xs bg-muted">
                  {archivedRoutes.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'archive' && archivedRoutes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsClearArchiveOpen(true)}
              className="text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10 self-end sm:self-auto"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Очистить весь архив
            </Button>
          )}
        </div>

        {/* Tab 1: Active Routes */}
        <TabsContent value="active" className="mt-4 space-y-4 focus-visible:outline-none">
          {routes.length === 0 ? (
            <Card className="bg-card/50 border-dashed border-2 border-border/80 p-8 text-center">
              <CardContent className="flex flex-col items-center justify-center space-y-3 pt-6">
                <div className="p-3 bg-muted rounded-full">
                  <Inbox className="size-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Нет активных маршрутов</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Создайте новый маршрут вручную по координатам или нарисуйте его прямо на интерактивной карте.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <Button onClick={() => handleOpenForm()} size="sm" className="gap-2">
                    <Plus className="size-4" />
                    По координатам
                  </Button>
                  <Button onClick={handleDrawOnMap} variant="outline" size="sm" className="gap-2">
                    <Pencil className="size-4" />
                    Нарисовать на карте
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {routes.map((route) => {
                const TypeIcon = typeIcons[route.type] || Footprints;
                return (
                  <Card
                    key={route.id}
                    className="bg-card border-border transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg">{route.name}</CardTitle>
                            <Badge
                              variant="outline"
                              className={cn(difficultyStyles[route.difficulty])}
                            >
                              {route.difficulty}
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-1.5 text-xs pt-1">
                            <MapPin className="size-3 shrink-0" />
                            {route.location}
                          </CardDescription>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => handleShowOnMap(route)}
                            title="Посмотреть на карте"
                          >
                            <Map className="size-3.5" />
                            <span className="hidden sm:inline">На карте</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => handleOpenForm(route)}
                            title="Редактировать параметры маршрута"
                          >
                            <Pencil className="size-3.5" />
                            <span className="hidden sm:inline">Изменить</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleArchive(route)}
                            title="Переместить в архив (скрыть с карты)"
                          >
                            <Archive className="size-3.5" />
                            <span className="hidden sm:inline">В архив</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteDialog(route)}
                            title="Удалить маршрут"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Удалить маршрут</span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pb-4">
                      <div className="flex items-center gap-2">
                        <Waypoints className="size-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Расстояние</p>
                          <p className="font-medium">{route.distance}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="size-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Время в пути</p>
                          <p className="font-medium">{route.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mountain className="size-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Высота</p>
                          <p className="font-medium">{route.altitude}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="size-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Тип</p>
                          <p className="font-medium">{route.type}</p>
                        </div>
                      </div>
                    </CardContent>
                    <Separator className="w-[96%] mx-auto" />
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <LocateFixed className="size-3.5 shrink-0" />
                        <span className="truncate">{route.coordinates}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Archived Routes */}
        <TabsContent value="archive" className="mt-4 space-y-4 focus-visible:outline-none">
          <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60 text-xs text-muted-foreground flex items-start gap-2.5">
            <AlertCircle className="size-4 text-primary shrink-0 mt-0.5" />
            <p>
              Архив позволяет скрыть неиспользуемые маршруты с карты и из активных списков групп, сохраняя все точки и параметры. Вы можете восстановить их в один клик.
            </p>
          </div>

          {archivedRoutes.length === 0 ? (
            <Card className="bg-card/40 border-dashed border border-border p-8 text-center">
              <CardContent className="flex flex-col items-center justify-center space-y-2 pt-6">
                <div className="p-3 bg-muted rounded-full">
                  <Archive className="size-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground">Архив пуст</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Здесь будут сохраняться архивные маршруты. Вы можете отправлять сюда пройденные или сезонные треки.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {archivedRoutes.map((route) => {
                const TypeIcon = typeIcons[route.type] || Footprints;
                const archivedDateStr = route.archivedAt
                  ? new Date(route.archivedAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : undefined;

                return (
                  <Card
                    key={route.id}
                    className="bg-card/70 border-border/70 opacity-90 hover:opacity-100 transition-all duration-300 shadow-sm"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg text-foreground/90">{route.name}</CardTitle>
                            <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                              В архиве
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(difficultyStyles[route.difficulty], 'opacity-70')}
                            >
                              {route.difficulty}
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-1.5 text-xs pt-1">
                            <MapPin className="size-3 shrink-0" />
                            {route.location}
                            {archivedDateStr && (
                              <span className="text-muted-foreground/80 ml-2">
                                • Архивирован {archivedDateStr}
                              </span>
                            )}
                          </CardDescription>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90"
                            onClick={() => handleRestore(route)}
                            title="Восстановить маршрут на карту"
                          >
                            <ArchiveRestore className="size-3.5" />
                            <span>Восстановить</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteDialog(route)}
                            title="Удалить маршрут навсегда"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Удалить навсегда</span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pb-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Waypoints className="size-5 shrink-0" />
                        <div>
                          <p className="text-xs">Расстояние</p>
                          <p className="font-medium text-foreground/80">{route.distance}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="size-5 shrink-0" />
                        <div>
                          <p className="text-xs">Время</p>
                          <p className="font-medium text-foreground/80">{route.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mountain className="size-5 shrink-0" />
                        <div>
                          <p className="text-xs">Высота</p>
                          <p className="font-medium text-foreground/80">{route.altitude}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="size-5 shrink-0" />
                        <div>
                          <p className="text-xs">Тип</p>
                          <p className="font-medium text-foreground/80">{route.type}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить маршрут?</AlertDialogTitle>
            <AlertDialogDescription>
              {routeToDelete?.isArchived ? (
                <>Маршрут <strong>"{routeToDelete?.name}"</strong> будет удален навсегда. Данные трека нельзя будет восстановить.</>
              ) : (
                <>
                  Вы можете переместить маршрут <strong>"{routeToDelete?.name}"</strong> в архив, чтобы скрыть его с карты с возможностью восстановления, либо удалить его навсегда.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            {!routeToDelete?.isArchived && (
              <Button
                variant="outline"
                onClick={() => {
                  if (routeToDelete) {
                    handleArchive(routeToDelete);
                    setDeleteDialogOpen(false);
                    setRouteToDelete(null);
                  }
                }}
                className="gap-1.5"
              >
                <Archive className="size-4" />
                В архив
              </Button>
            )}
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Удалить навсегда
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Entire Archive Dialog */}
      <AlertDialog open={isClearArchiveOpen} onOpenChange={setIsClearArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Очистить весь архив маршрутов?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие навсегда удалит все {archivedRoutes.length} архивных маршрутов из памяти устройства. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearArchive}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Очистить архив
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    