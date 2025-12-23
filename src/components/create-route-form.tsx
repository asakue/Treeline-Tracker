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
import { useToast } from '@/hooks/use-toast';
import type { Route } from '@/lib/routes-data';
import { Textarea } from './ui/textarea';
import { calculateRouteStats } from '@/lib/route-calculations';

const formSchema = z.object({
  name: z.string().min(3, 'Название должно содержать не менее 3 символов.'),
  location: z.string().min(3, 'Укажите локацию.'),
  difficulty: z.enum(['Легко', 'Средне', 'Сложно', 'Очень сложно']),
  type: z.enum(['Горный', 'Равнинный', 'Сплав', 'Велосипедный']),
  coordinates: z.string().min(10, 'Укажите координаты маршрута.'),
});

type CreateRouteFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRouteSubmit: (route: Omit<Route, 'id'>, id?: string) => void;
  routeToEdit?: Route;
  initialCoordinates?: string;
};

const parsePath = (coordsStr: string): [number, number][] => {
    return coordsStr
        .split('\n')
        .map(line => {
            const parts = line.replace(/,/g, ' ').trim().split(/\s+/);
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lon = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lon)) {
                    return [lat, lon];
                }
            }
            return null;
        })
        .filter((p): p is [number, number] => p !== null);
};


export default function CreateRouteForm({
  open,
  onOpenChange,
  onRouteSubmit,
  routeToEdit,
  initialCoordinates = '',
}: CreateRouteFormProps) {
  const { toast } = useToast();
  const isEditing = !!routeToEdit;

  const getCoordsString = (path: [number, number][]) => {
      return path.map(p => `${p[0].toFixed(6)} ${p[1].toFixed(6)}`).join('\n');
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      location: '',
      difficulty: 'Средне',
      type: 'Горный',
      coordinates: '',
    },
  });
  
  useEffect(() => {
    if (routeToEdit) {
      form.reset({
        name: routeToEdit.name,
        location: routeToEdit.location,
        difficulty: routeToEdit.difficulty,
        type: routeToEdit.type as any,
        coordinates: getCoordsString(routeToEdit.path),
      });
    } else {
       form.reset({
        name: '',
        location: '',
        difficulty: 'Средне',
        type: 'Горный',
        coordinates: initialCoordinates,
      });
    }
  }, [routeToEdit, initialCoordinates, open, form]);


  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const path = parsePath(values.coordinates);

    if (path.length < 2) {
        toast({
            variant: 'destructive',
            title: 'Ошибка в координатах',
            description: 'Пожалуйста, введите как минимум две корректные пары координат.',
        });
        return;
    }
    
    const { distance, time, altitude } = calculateRouteStats(path);
    const startCoords = `${path[0][0].toFixed(4)}° с.ш., ${path[0][1].toFixed(4)}° в.д.`;

    const routeData = {
        ...values,
        path,
        distance,
        time,
        altitude,
        coordinates: startCoords,
    };
    
    onRouteSubmit(routeData, routeToEdit?.id);
    
    toast({
      title: isEditing ? 'Маршрут обновлен!' : 'Маршрут создан!',
      description: `Маршрут "${values.name}" был успешно сохранен.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Редактировать маршрут' : 'Создание нового маршрута'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Измените данные маршрута.' : 'Заполните информацию о маршруте. Каждая пара координат с новой строки.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название маршрута</FormLabel>
                  <FormControl>
                    <Input placeholder="например, Поход к озеру" {...field} />
                  </FormControl>
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
                    <Input placeholder="например, Архыз" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
               <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип маршрута</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Горный">Горный</SelectItem>
                        <SelectItem value="Равнинный">Равнинный</SelectItem>
                        <SelectItem value="Сплав">Сплав</SelectItem>
                        <SelectItem value="Велосипедный">Велосипедный</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

             <FormField
                control={form.control}
                name="coordinates"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Координаты маршрута (широта долгота)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="43.285 42.518\n43.295 42.516\n43.300 42.515"
                        className="h-32 font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Отмена</Button>
              </DialogClose>
              <Button type="submit">{isEditing ? 'Сохранить изменения' : 'Создать маршрут'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
