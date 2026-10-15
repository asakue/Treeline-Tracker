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
import { UserPlus, Waypoints, Trash2, ShieldCheck, User, Calendar } from 'lucide-react';
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
  startDate: z.string().min(4, 'Укажите дату выхода группы.'),
  leaderName: z.string().optional(),
  safeRadiusMeters: z.coerce.number().min(50, 'Минимум 50м').max(10000, 'Максимум 10 000м').default(500),
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
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberEmergency, setNewMemberEmergency] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'GUIDE' | 'MEDIC' | 'MEMBER'>('MEMBER');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      location: '',
      distance: '',
      difficulty: 'Средне',
      routeId: '',
      startDate: new Date().toISOString().split('T')[0],
      leaderName: '',
      safeRadiusMeters: 500,
    },
  });

  useEffect(() => {
    // Get user profile name if available
    let userName = 'Вы (Лидер)';
    let userPhone = '';
    let userEmergency = '';
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('treeline_user_profile');
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          if (parsed.displayName) {
            userName = `${parsed.displayName} (Вы)`;
          }
          if (parsed.phone) userPhone = parsed.phone;
          if (parsed.emergencyContact) userEmergency = parsed.emergencyContact;
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
        startDate: groupToEdit.startDate || new Date(groupToEdit.createdAt || Date.now()).toISOString().split('T')[0],
        leaderName: groupToEdit.leaderName || '',
        safeRadiusMeters: groupToEdit.safeRadiusMeters ?? 500,
      });
      setMembersList(groupToEdit.hikers || []);
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      form.reset({
        name: '',
        location: '',
        distance: '',
        difficulty: 'Средне',
        routeId: '',
        startDate: todayStr,
        leaderName: userName.replace(' (Вы)', ''),
        safeRadiusMeters: 500,
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
          phone: userPhone || '+7 (900) 000-00-01',
          emergencyContact: userEmergency || 'Доверенное лицо (+7 900 111-22-33)',
          lastUpdate: 'только что',
          lastUpdateTimestamp: Date.now(),
        },
      ]);
    }
    setNewMemberName('');
    setNewMemberPhone('');
    setNewMemberEmergency('');
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

    // Check duplicate phone in the same group (ФЗ-02)
    if (newMemberPhone.trim()) {
      const existingWithPhone = membersList.find(
        (m) => m.phone && m.phone.trim() === newMemberPhone.trim()
      );
      if (existingWithPhone) {
        toast({
          title: 'Запрет дублирования записей (ФЗ-02)',
          description: `Участник с телефоном "${newMemberPhone.trim()}" уже включен в состав этой группы (${existingWithPhone.name}).`,
          variant: 'destructive',
        });
        return;
      }
    }

    const newMember: Member = {
      id: `member_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newMemberName.trim(),
      avatar: '',
      role: newMemberRole,
      status: 'На тропе',
      battery: 100,
      coords: 'Ожидание геоданных',
      phone: newMemberPhone.trim() || undefined,
      emergencyContact: newMemberEmergency.trim() || undefined,
      lastUpdate: 'только что',
      lastUpdateTimestamp: Date.now(),
    };

    setMembersList([...membersList, newMember]);
    setNewMemberName('');
    setNewMemberPhone('');
    setNewMemberEmergency('');
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
      startDate: values.startDate,
      leaderName: values.leaderName || undefined,
      safeRadiusMeters: values.safeRadiusMeters ?? 500,
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-primary" />
                      Дата выхода
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="leaderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Руководитель / Инструктор группы</FormLabel>
                  <FormControl>
                    <Input placeholder="например, Смирнов Алексей (Инструктор клуба)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {activeRoutes.length > 0 && (
              <FormField
                control={form.control}
                name="routeId"
                render={({ field }) => {
                  const selectedRoute = activeRoutes.find((r) => r.id === field.value);
                  return (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Waypoints className="size-4 text-primary" /> Выбрать из справочника маршрутов (ФЗ-01)
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
                            <SelectValue placeholder="Выберите маршрут для автозаполнения параметров" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <ScrollArea className="h-40">
                            {activeRoutes.map((route, idx) => (
                              <SelectItem key={`form-route-${route.id}-${idx}`} value={route.id}>
                                {route.name} ({route.distance}, {route.difficulty})
                              </SelectItem>
                            ))}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                      {selectedRoute && (
                        <div className="p-2.5 rounded-md bg-primary/10 border border-primary/20 text-xs text-foreground flex items-center justify-between">
                          <span className="text-primary font-medium">
                            ✓ Автозаполнено из маршрута:
                          </span>
                          <span className="font-mono">
                            {selectedRoute.distance} | {selectedRoute.difficulty}
                          </span>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
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

            <FormField
              control={form.control}
              name="safeRadiusMeters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    Безопасный радиус группы (геозона, метры)
                  </FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={50} max={10000} step={50} placeholder="500" {...field} />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">метров</span>
                    </div>
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground">
                    При удалении участника дальше этого радиуса от лидера сработает тревога выхода из зоны (UC-02 / FR-002).
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Participants / Members Management */}
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-sm font-semibold flex items-center justify-between">
                <span>Участники группы ({membersList.length})</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  ФИО, телефон, экстренный контакт
                </span>
              </Label>

              {/* Add Member Inputs */}
              <div className="space-y-2 bg-muted/40 p-2.5 rounded-lg border border-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="ФИО участника..."
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="flex-1 text-sm h-8"
                  />
                  <Select
                    value={newMemberRole}
                    onValueChange={(v) => setNewMemberRole(v as 'GUIDE' | 'MEDIC' | 'MEMBER')}
                  >
                    <SelectTrigger className="w-[110px] text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Участник</SelectItem>
                      <SelectItem value="GUIDE">Гид</SelectItem>
                      <SelectItem value="MEDIC">Медик</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Телефон (+7 900 123-45-67)"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    className="flex-1 text-xs h-8"
                  />
                  <Input
                    placeholder="Доверенное лицо / Экстренный контакт"
                    value={newMemberEmergency}
                    onChange={(e) => setNewMemberEmergency(e.target.value)}
                    className="flex-1 text-xs h-8"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddMember}
                    disabled={!newMemberName.trim()}
                    className="shrink-0 h-8 text-xs gap-1"
                  >
                    <UserPlus className="size-3.5" />
                    Добавить
                  </Button>
                </div>
              </div>

              {/* Members List Cards */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto p-1">
                {membersList.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/60 text-foreground border border-border text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="size-6 shrink-0">
                        <AvatarImage src={member.avatar} alt={member.name} />
                        <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground truncate">{member.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({member.role === 'LEADER' ? 'Лидер' : member.role === 'GUIDE' ? 'Гид' : member.role === 'MEDIC' ? 'Медик' : 'Участник'})
                          </span>
                        </div>
                        {(member.phone || member.emergencyContact) && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {member.phone && <span>Тел: {member.phone}</span>}
                            {member.emergencyContact && <span className="ml-2">| SOS: {member.emergencyContact}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    {membersList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
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
