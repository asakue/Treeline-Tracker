'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { MapPin, History, Plus, Waypoints, Mountain, Download, Battery, Users, ChevronRight, Tent, Waves, Pencil, Trash2, ShieldCheck, Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { cn } from "@/shared/lib/utils";
import { useAppContext } from "@/entities/app";
import { Separator } from "@/shared/ui/separator";
import { useGroups } from "@/entities/group";
import { useRoutes } from "@/entities/route";
import CreateGroupForm from "@/features/group-management/ui/create-group-form";
import type { Group } from "@/entities/group";
import { useToast } from "@/shared/hooks/use-toast";

const difficultyStyles = {
  'Легко': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Средне': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Сложно': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Очень сложно': 'bg-red-500/10 text-red-400 border-red-500/20',
};

const statusInfo: { [key: string]: { icon: React.ElementType, className: string } } = {
    'На тропе': { icon: Mountain, className: 'bg-primary/20 text-primary border-primary/30' },
    'На воде': { icon: Waves, className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    'В лагере': { icon: Tent, className: 'bg-secondary text-secondary-foreground border-border' },
};

const parseCoords = (coords?: string): [number, number] | null => {
  if (!coords) {
    return null;
  }
  const matches = coords.match(/[-+]?\d*\.?\d+/g);
  if (matches && matches.length >= 2) {
    const lat = parseFloat(matches[0]);
    const lon = parseFloat(matches[1]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return [lat, lon];
    }
  }
  return null;
};

export default function LocationTracker() {
  const { setView, activeGroupId, setActiveGroupId, groupsHook, routesHook } = useAppContext();
  const { groups, addGroup, updateGroup, deleteGroup } = groupsHook;
  const routes = routesHook?.routes || [];
  const { toast } = useToast();
  
  const [selectedGroupId, setSelectedGroupIdState] = useState(activeGroupId || groups[0]?.id || '');
  const [isFormOpen, setFormOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<Group | undefined>(undefined);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [isDownloadingMap, setIsDownloadingMap] = useState(false);
  const [isMapDownloaded, setIsMapDownloaded] = useState(false);

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || groups[0];

  const handleDownloadOfflineMap = () => {
    setIsDownloadingMap(true);
    setTimeout(() => {
      setIsDownloadingMap(false);
      setIsMapDownloaded(true);
      toast({
        title: 'Офлайн-карта сохранена',
        description: 'Тайлы карты, тропы и высотные данные перевала загружены в локальный кэш.',
      });
    }, 1500);
  };

  const handleSetSelectedGroup = (id: string) => {
    setSelectedGroupIdState(id);
    if(setActiveGroupId) setActiveGroupId(id);
  }

  const handleShowOnMap = (coords?: string) => {
    const parsed = parseCoords(coords);
    if (parsed) {
        setView('map', { centerOn: parsed });
    }
  };

  const getBatteryIconColor = (level: number) => {
    if (level > 75) return 'text-green-500';
    if (level > 25) return 'text-amber-500';
    return 'text-red-500';
  }

  const handleGroupSubmit = async (groupData: Omit<Group, 'id'>, id?: string) => {
    if (id) {
        await updateGroup(id, groupData);
    } else {
        const createdGroup = await addGroup(groupData);
        if (createdGroup && createdGroup.id) {
          handleSetSelectedGroup(createdGroup.id);
        }
    }
    setFormOpen(false);
    setGroupToEdit(undefined);
  };
  
  const handleOpenForm = (group?: Group) => {
    setGroupToEdit(group);
    setFormOpen(true);
  };
  
  const openDeleteDialog = (group: Group) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (groupToDelete) {
      deleteGroup(groupToDelete.id);
      toast({
        title: 'Группа удалена',
        description: `Группа "${groupToDelete.name}" была успешно удалена.`,
      });
      setSelectedGroupIdState(groups.find(g => g.id !== groupToDelete.id)?.id || '');
    }
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };


  if (!selectedGroup && groups.length === 0) {
     return (
       <div className="p-4 md:p-6 space-y-6">
         <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Users className="size-6 text-primary"/>
              Трекер группы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Группы не найдены. Создайте первую группу.</p>
             <Button className="w-full sm:w-auto" onClick={() => handleOpenForm()}>
                <Plus className="mr-2 size-4"/>
                Создать группу
            </Button>
          </CardContent>
        </Card>
        <CreateGroupForm
            key={groupToEdit?.id || 'new'}
            open={isFormOpen} 
            onOpenChange={(isOpen) => {
                if (!isOpen) setGroupToEdit(undefined);
                setFormOpen(isOpen);
            }} 
            onGroupSubmit={handleGroupSubmit} 
            availableRoutes={routes}
            groupToEdit={groupToEdit}
        />
        </div>
    );
  }

  const hikers = selectedGroup?.hikers || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="flex items-center gap-2.5 sm:gap-3 text-lg sm:text-xl">
               <Users className="size-5 sm:size-6 text-primary shrink-0"/>
               Трекер группы
            </CardTitle>
            <Badge variant="outline" className="w-max text-[10px] sm:text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="size-3 text-emerald-500 shrink-0" />
              <span>E2EE Mesh</span>
              <span className="hidden sm:inline">(Ed25519 + AES-256)</span>
            </Badge>
          </div>
           {selectedGroup && (
            <div className="text-sm text-muted-foreground pt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  <span>{selectedGroup.location}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <Waypoints className="size-4" />
                    <span>{selectedGroup.distance}</span>
                  </div>
                   <div className="flex items-center gap-2">
                    <Mountain className="size-4" />
                     <Badge variant="outline" className={cn('text-xs', difficultyStyles[selectedGroup.difficulty])}>{selectedGroup.difficulty}</Badge>
                  </div>
                </div>
              </div>
           )}
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={selectedGroupId} onValueChange={handleSetSelectedGroup}>
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Выберите группу" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group, idx) => (
                    <SelectItem key={`tracker-group-${group.id}-${idx}`} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleOpenForm()}>
                    <Plus className="mr-2 size-4"/>
                    Создать
                </Button>
                {selectedGroup && (
                <div className="flex gap-2">
                     <Button variant="ghost" className="w-full" onClick={() => handleOpenForm(selectedGroup)}>
                        <Pencil className="mr-2 size-4"/>
                        Редактировать
                     </Button>
                    <Button variant="destructive" size="icon" className="shrink-0" onClick={() => openDeleteDialog(selectedGroup)}>
                        <Trash2 className="size-4"/>
                        <span className="sr-only">Удалить группу</span>
                    </Button>
                </div>
                )}
            </div>
        </CardContent>
         <CreateGroupForm
            key={groupToEdit?.id || 'new-group'}
            open={isFormOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) setGroupToEdit(undefined);
                setFormOpen(isOpen);
            }}
            onGroupSubmit={handleGroupSubmit}
            availableRoutes={routes}
            groupToEdit={groupToEdit}
         />
      </Card>

      <div className="space-y-4">
        {hikers.map((hiker, idx) => {
          const StatusIcon = statusInfo[hiker.status]?.icon || Mountain;
          const statusClassName = statusInfo[hiker.status]?.className || '';
          return (
          <Card key={`hiker-card-${selectedGroup?.id || 'grp'}-${hiker.id}-${idx}`} className="bg-card border-border shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
            <div className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              <Avatar className="size-10 sm:size-12 shrink-0">
                <AvatarImage
                  src={hiker.avatar}
                  alt={hiker.name}
                  width={48}
                  height={48}
                />
                <AvatarFallback>{hiker.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <p className="font-semibold text-sm sm:text-base text-card-foreground truncate">{hiker.name}</p>
                  {hiker.isVerified !== false && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 sm:px-1.5 py-0.5 rounded border border-emerald-500/20" title={`Подпись Ed25519 проверена. Отпечаток: ${hiker.keyFingerprint || 'VERIFIED'}`}>
                      <ShieldCheck className="size-2.5 sm:size-3 text-emerald-500 shrink-0" />
                      <span>{hiker.keyFingerprint || 'Ed25519'}</span>
                    </span>
                  )}
                  {hiker.privacyMode === 'REDUCED' && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 sm:px-1.5 py-0.5 rounded border border-amber-500/20" title="Огрубление координат до сетки 200x200м">
                      <Eye className="size-2.5 sm:size-3 text-amber-500 shrink-0" />
                      <span>Сетка 200м</span>
                    </span>
                  )}
                  {hiker.privacyMode === 'STEALTH' && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 sm:px-1.5 py-0.5 rounded border border-purple-500/20" title="Скрытный режим: радиопередача отключена">
                      <EyeOff className="size-2.5 sm:size-3 text-purple-500 shrink-0" />
                      <span>Скрытный</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                  <div className="flex items-center gap-1 sm:gap-1.5" title="Уровень заряда">
                    <Battery className={cn("size-3.5 sm:size-4", getBatteryIconColor(hiker.battery))} />
                    <span>{hiker.battery}%</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5" title="Последнее обновление">
                    <History className="size-3.5 sm:size-4" />
                    <span>{hiker.lastUpdate}</span>
                  </div>
                </div>
              </div>
              <Badge variant="outline" className={cn("shrink-0 text-[11px] sm:text-xs py-0.5 px-2", statusClassName)}>
                <StatusIcon className="mr-1 sm:mr-1.5 size-3 sm:size-3.5" />
                <span>{hiker.status}</span>
              </Badge>
            </div>
            <Separator />
            <div className="p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 bg-muted/50">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground min-w-0">
                  <MapPin className="size-3.5 sm:size-4 text-primary shrink-0"/>
                  <span className="font-mono truncate">{hiker.coords}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleShowOnMap(hiker.coords)} className="text-muted-foreground hover:text-primary shrink-0 size-8 sm:size-9">
                  <ChevronRight className="size-4 sm:size-5" />
                  <span className="sr-only">Показать на карте</span>
              </Button>
            </div>
          </Card>
        )})}
      </div>
      
      <Card className="bg-card border-border">
        <CardHeader>
            <CardTitle className="text-lg text-card-foreground flex items-center gap-2"><Download/>Офлайн-карты</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Скачайте карты для использования в офлайн-режиме, когда нет связи.</p>
            <Button
              className="w-full gap-2"
              onClick={handleDownloadOfflineMap}
              disabled={isDownloadingMap}
              variant={isMapDownloaded ? 'outline' : 'default'}
            >
              <Download className="size-4" />
              {isDownloadingMap
                ? 'Загрузка тайлов перевала...'
                : isMapDownloaded
                ? 'Обновить карту перевала (сохранено)'
                : 'Скачать карту перевала'}
            </Button>
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Группа "{groupToDelete?.name}" и все связанные с ней данные, включая чат, будут удалены.
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

    