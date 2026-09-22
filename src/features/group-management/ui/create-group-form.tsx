'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/shared/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { UserPlus, Waypoints, Trash2, ShieldCheck, User } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import type { Group, Member } from '@/core/domain/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Label } from '@/shared/ui/label';
import { ScrollArea } from '@/shared/ui/scroll-area';
import type { Route } from '@/entities/route';

const formSchema = z.object({
  name: z.string().min(2, 'Название должно содержать не менее 2 символов.'),
  location: z.string().min(2, 'Укажите локацию.'),
  distance: z.string().min(1, 'Укажите дистанцию.'),
  difficulty: z.enum(['Легко', 'Средне', 'Сложно', 'Очень сложно']),
  routeId: z.string().optional(),
});

type CreateGroupFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupSubmit: (group: Omit<Group, 'id'>, id?: string) => void;
  availableRoutes: Route[];
  groupToEdit?: Group;
};

export default function CreateGroupForm({
  open,
  onOpenChange,
  onGroupSubmit,
  availableRoutes,
  groupToEdit,
}: CreateGroupFormProps) {
  const { toast } = useToast();
  const isEditing = !!groupToEdit;

  const [membersList, setMembersList] = useState<Member[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'GUIDE' | 'MEDIC' | 'MEMBER'>('MEMBER');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      location: '',
      distance: '',
      difficulty: 'Средне',
      routeId: '',
    },
  });

  useEffect(() => {
    // Get user profile name if available
    let userName = 'Вы (Лидер)';
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('treeline_user_profile');
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          if (parsed.displayName) {
            userName = `${parsed.displayName} (Вы)`;
          }
        } catch {
          // fallback
        }
      }
    }

    if (groupToEdit) {
      form.reset({
        name: groupToEdit.name,
        location: groupToEdit.location,
        distance: groupToEdit.distance,
        difficulty: groupToEdit.difficulty,
        routeId: groupToEdit.routeId || '',
      });
      setMembersList(groupToEdit.hikers || []);
    } else {
      form.reset({
        name: '',
        location: '',
        distance: '',
        difficulty: 'Средне',
        routeId: '',
      });
      // Default leader member
      setMembersList([
        {
          id: `member_${Date.now()}_self`,
          name: userName,
          avatar: '',
          role: 'LEADER',
          status: 'На тропе',
          battery: 98,
          coords: '43.3550° с.ш., 42.4392° в.д.',
          lastUpdate: 'только что',
          lastUpdateTimestamp: Date.now(),
        },
      ]);
    }
    setNewMemberName('');
  }, [groupToEdit, form, open]);

  const activeRoutes = availableRoutes.filter((r) => !r.isArchived);

  const handleRouteChange = (routeId: string) => {
    const selectedRoute = activeRoutes.find((r) => r.id === routeId);
    if (selectedRoute) {
      form.setValue('location', selectedRoute.location);
      form.setValue('distance', selectedRoute.distance);
      form.setValue('difficulty', selectedRoute.difficulty);
      form.setValue('routeId', selectedRoute.id);
    }
  };

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;

    const newMember: Member = {
      id: `member_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newMemberName.trim(),
      avatar: '',
      role: newMemberRole,
      status: 'На тропе',
      battery: 100,
      coords: 'Ожидание геоданных',
      lastUpdate: 'только что',
      lastUpdateTimestamp: Date.now(),
    };

    setMembersList([...membersList, newMember]);
    setNewMemberName('');
  };

  const handleRemoveMember = (id: string) => {
    setMembersList(membersList.filter((m) => m.id !== id));
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (membersList.length === 0) {
      toast({
        title: 'Участники не добавлены',
        description: 'Добавьте хотя бы одного участника в группу.',
        variant: 'destructive',
      });
      return;
    }

    const groupPayload: Omit<Group, 'id'> = {
      name: values.name,
      location: values.location,
      distance: values.distance,
      difficulty: values.difficulty,
      routeId: values.routeId || undefined,
      hikers: membersList,
    };

    onGroupSubmit(groupPayload, groupToEdit?.id);

    toast({
      title: isEditing ? 'Группа обновлена!' : 'Группа создана!',
      description: `Группа "${values.name}" с ${membersList.length} участник(ами) сохранена.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Редактировать группу' : 'Создание новой группы'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Измените параметры группы и состав участников.'
              : 'Задайте название, маршрут и добавьте участников группы.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название группы</FormLabel>
                  <FormControl>
                    <Input placeholder="например, Поход на перевал Азау" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {activeRoutes.length > 0 && (
              <FormField
                control={form.control}
                name="routeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Waypoints className="size-4 text-primary" /> Выбрать из созданных маршрутов
                    </FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleRouteChange(value);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите маршрут для автозаполнения" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-40">
                          {activeRoutes.map((route, idx) => (
                            <SelectItem key={`form-route-${route.id}-${idx}`} value={route.id}>
                              {route.name} ({route.distance})
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Локация / Регион</FormLabel>
                  <FormControl>
                    <Input placeholder="например, Кавказ, Приэльбрусье" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="distance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дистанция</FormLabel>
                    <FormControl>
                      <Input placeholder="15 км" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сложность</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите сложность" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Легко">Легко</SelectItem>
                        <SelectItem value="Средне">Средне</SelectItem>
                        <SelectItem value="Сложно">Сложно</SelectItem>
                        <SelectItem value="Очень сложно">Очень сложно</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Participants / Members Management */}
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-sm font-semibold flex items-center justify-between">
                <span>Участники группы ({membersList.length})</span>
                <span className="text-[11px] text-muted-foreground font-normal">E2EE Mesh Ready</span>
              </Label>

              {/* Add Member Row */}
              <div className="flex gap-2">
                <Input
                  placeholder="Имя нового участника..."
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMember();
                    }
                  }}
                  className="flex-1 text-sm"
                />
                <Select
                  value={newMemberRole}
                  onValueChange={(v) => setNewMemberRole(v as 'GUIDE' | 'MEDIC' | 'MEMBER')}
                >
                  <SelectTrigger className="w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Участник</SelectItem>
                    <SelectItem value="GUIDE">Гид / Проводник</SelectItem>
                    <SelectItem value="MEDIC">Медик</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddMember}
                  disabled={!newMemberName.trim()}
                  className="shrink-0"
                >
                  <UserPlus className="size-4 mr-1" />
                  Добавить
                </Button>
              </div>

              {/* Members List Chips */}
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                {membersList.map((member) => (
                  <Badge
                    key={member.id}
                    variant="secondary"
                    className="flex items-center gap-1.5 py-1 px-2.5 bg-muted text-foreground border border-border"
                  >
                    <Avatar className="size-4">
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{member.name}</span>
                    {member.role && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({member.role === 'LEADER' ? 'Лидер' : member.role === 'GUIDE' ? 'Гид' : member.role === 'MEDIC' ? 'Медик' : 'Участник'})
                      </span>
                    )}
                    {membersList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Отмена
                </Button>
              </DialogClose>
              <Button type="submit">{isEditing ? 'Сохранить изменения' : 'Создать группу'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
