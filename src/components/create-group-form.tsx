
'use client';

import { useEffect } from 'react';
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
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Check, ChevronsUpDown, UserPlus, Waypoints } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { Group, Route } from '@/lib/groups-data';
import { availableHikers } from '@/lib/groups-data';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';

const formSchema = z.object({
  name: z.string().min(3, 'Название должно содержать не менее 3 символов.'),
  location: z.string().min(3, 'Укажите локацию.'),
  distance: z.string().min(1, 'Укажите дистанцию.'),
  difficulty: z.enum(['Легко', 'Средне', 'Сложно', 'Очень сложно']),
  hikerIds: z.array(z.string()).min(1, 'Выберите хотя бы одного участника.'),
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      location: '',
      distance: '',
      difficulty: 'Средне',
      hikerIds: [],
      routeId: '',
    },
  });

  useEffect(() => {
    if (groupToEdit) {
      form.reset({
        name: groupToEdit.name,
        location: groupToEdit.location,
        distance: groupToEdit.distance,
        difficulty: groupToEdit.difficulty,
        hikerIds: groupToEdit.hikers.map(h => h.id),
        routeId: groupToEdit.routeId || '',
      });
    } else {
        form.reset({
            name: '',
            location: '',
            distance: '',
            difficulty: 'Средне',
            hikerIds: [],
            routeId: '',
        });
    }
  }, [groupToEdit, form, open]);


  const handleRouteChange = (routeId: string) => {
    const selectedRoute = availableRoutes.find(r => r.id === routeId);
    if (selectedRoute) {
      form.setValue('location', selectedRoute.location);
      form.setValue('distance', selectedRoute.distance);
      form.setValue('difficulty', selectedRoute.difficulty);
      form.setValue('routeId', selectedRoute.id);
    }
  }

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const hikers = availableHikers.filter(h => values.hikerIds.includes(h.id));
    const { hikerIds, ...groupData } = values;
    onGroupSubmit({ ...groupData, hikers }, groupToEdit?.id);
    
    toast({
      title: isEditing ? 'Группа обновлена!' : 'Группа создана!',
      description: `Группа "${values.name}" была успешно сохранена.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Редактировать группу' : 'Создание новой группы'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Измените информацию о группе.' : 'Заполните информацию, выберите маршрут и добавьте участников.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название группы</FormLabel>
                  <FormControl>
                    <Input placeholder="например, Поход на выходные" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="routeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Waypoints className="size-4"/> Выбрать маршрут (опционально)</FormLabel>
                   <Select onValueChange={(value) => { field.onChange(value); handleRouteChange(value); }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите из созданных маршрутов" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-48">
                          {availableRoutes.map(route => (
                              <SelectItem key={route.id} value={route.id}>{route.name}</SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Локация</FormLabel>
                  <FormControl>
                    <Input placeholder="например, Архыз, долина реки" {...field} />
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
              name="hikerIds"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Участники</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !field.value?.length && 'text-muted-foreground'
                          )}
                        >
                          <div className='flex gap-2 items-center'>
                            <UserPlus className="size-4" />
                           {field.value?.length > 0
                            ? `${field.value.length} участник(а/ов) выбрано`
                            : 'Выберите участников'}
                          </div>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Поиск участника..." />
                        <CommandEmpty>Участник не найден.</CommandEmpty>
                        <CommandGroup>
                          <CommandList>
                            {availableHikers.map((hiker) => (
                              <CommandItem
                                value={hiker.name}
                                key={hiker.id}
                                onSelect={() => {
                                  const selectedIds = field.value || [];
                                  const newIds = selectedIds.includes(hiker.id)
                                    ? selectedIds.filter((id) => id !== hiker.id)
                                    : [...selectedIds, hiker.id];
                                  field.onChange(newIds);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    field.value?.includes(hiker.id)
                                      ? 'opacity-100'
                                      : 'opacity-0'
                                  )}
                                />
                                <Avatar className="mr-2 size-6">
                                  <AvatarImage src={hiker.avatar} alt={hiker.name} />
                                  <AvatarFallback>{hiker.name[0]}</AvatarFallback>
                                </Avatar>
                                {hiker.name}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.watch('hikerIds')?.length > 0 && (
              <div className="space-y-2">
                 <Label>Выбранные участники:</Label>
                  <div className="flex flex-wrap gap-2">
                      {availableHikers
                        .filter(h => form.watch('hikerIds').includes(h.id))
                        .map(hiker => (
                          <Badge key={hiker.id} variant="secondary" className="flex items-center gap-2">
                             <Avatar className="mr-1 size-4">
                                <AvatarImage src={hiker.avatar} alt={hiker.name} />
                                <AvatarFallback>{hiker.name[0]}</AvatarFallback>
                              </Avatar>
                              {hiker.name}
                          </Badge>
                        ))
                      }
                  </div>
              </div>
            )}
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Отмена</Button>
              </DialogClose>
              <Button type="submit">{isEditing ? 'Сохранить' : 'Создать группу'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
