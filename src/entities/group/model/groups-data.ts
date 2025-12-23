import type { Hiker } from '@/entities/hiker';
import type { Route } from '@/entities/route';

export type Group = {
  id: string;
  name: string;
  location: string;
  distance: string;
  difficulty: 'Легко' | 'Средне' | 'Сложно' | 'Очень сложно';
  hikers: Hiker[];
  routeId?: string;
};

export const availableHikers: Hiker[] = [
  {
    id: 'hiker1',
    name: 'Алексей',
    avatar: 'https://picsum.photos/seed/hiker1/40/40',
    status: 'На тропе',
    battery: 82,
    coords: '43.3550° с.ш., 42.4392° в.д.',
    lastUpdate: '2 минуты назад',
  },
  {
    id: 'hiker2',
    name: 'Мария',
    avatar: 'https://picsum.photos/seed/hiker2/40/40',
    status: 'На тропе',
    battery: 91,
    coords: '43.3540° с.ш., 42.4382° в.д.',
    lastUpdate: 'только что',
  },
  {
    id: 'user',
    name: 'Вы',
    avatar: 'https://picsum.photos/seed/user/40/40',
    status: 'На тропе',
    battery: 95,
    coords: '43.3530° с.ш., 42.4372° в.д.',
    lastUpdate: '1 минуту назад',
  },
  {
    id: 'hiker3',
    name: 'Сергей',
    avatar: 'https://picsum.photos/seed/hiker3/40/40',
    status: 'В лагере',
    battery: 65,
    coords: '44.0725° с.ш., 40.0036° в.д.',
    lastUpdate: '15 минут назад',
  },
  {
    id: 'hiker5',
    name: 'Ольга',
    avatar: 'https://picsum.photos/seed/hiker5/40/40',
    status: 'В лагере',
    battery: 78,
    coords: '44.0715° с.ш., 40.0026° в.д.',
    lastUpdate: '20 минут назад',
  },
  {
    id: 'hiker6',
    name: 'Виктор',
    avatar: 'https://picsum.photos/seed/hiker6/40/40',
    status: 'На воде',
    battery: 88,
    coords: '44.2951° с.ш., 40.1685° в.д.',
    lastUpdate: '5 минут назад',
  },
  {
    id: 'hiker7',
    name: 'Елена',
    avatar: 'https://picsum.photos/seed/hiker7/40/40',
    status: 'На воде',
    battery: 92,
    coords: '44.2941° с.ш., 40.1675° в.д.',
    lastUpdate: '5 минут назад',
  },
];


const findHikersByIds = (ids: string[]) => availableHikers.filter(h => ids.includes(h.id));

export const groups: Group[] = [
  {
    id: 'group1',
    name: 'Восхождение на Эльбрус',
    location: 'Кавказ, Приэльбрусье',
    distance: '20 км',
    difficulty: 'Очень сложно',
    hikers: findHikersByIds(['hiker1', 'hiker2', 'user']),
    routeId: '1',
  },
  {
    id: 'group2',
    name: 'Плато Лаго-Наки',
    location: 'Кавказ, Адыгея',
    distance: '15 км',
    difficulty: 'Средне',
    hikers: findHikersByIds(['hiker3', 'hiker5']),
    routeId: '3',
  },
  {
    id: 'group3',
    name: 'Сплав по реке Белая',
    location: 'Кавказ, Адыгея',
    distance: '25 км',
    difficulty: 'Средне',
    hikers: findHikersByIds(['hiker6', 'hiker7', 'user']),
    routeId: '4',
  },
];

export const groupChats: Record<string, { messages: any[] }> = {
  group1: {
    messages: [
      {
        id: 'g1m1',
        name: 'Алексей',
        avatar: 'https://picsum.photos/seed/hiker1/40/40',
        text: 'Вышел на 4200. Погода ухудшается, видимость 50 метров. Продолжаю подъем по навигатору.',
        time: '10:42',
        isSender: false,
      },
      {
        id: 'g1m2',
        name: 'Вы',
        avatar: 'https://picsum.photos/seed/user/40/40',
        text: 'Принял. Двигаюсь за тобой, отставание ~200 метров. Будь осторожен на леднике.',
        time: '10:44',
        isSender: true,
      },
      {
        id: 'g1m3',
        name: 'Мария',
        avatar: 'https://picsum.photos/seed/hiker2/40/40',
        text: 'Замыкаю группу. Вижу вас обоих. При необходимости готова оказать помощь.',
        time: '10:45',
        isSender: false,
      },
    ],
  },
  group2: {
    messages: [
      {
        id: 'g2m1',
        name: 'Сергей',
        avatar: 'https://picsum.photos/seed/hiker3/40/40',
        text: 'Разбил лагерь в точке [44.0725, 40.0036]. Начинаю готовить ужин.',
        time: '18:30',
        isSender: false,
      },
      {
        id: 'g2m2',
        name: 'Ольга',
        avatar: 'https://picsum.photos/seed/hiker5/40/40',
        text: 'Подхожу. Собрала дрова, буду через 10 минут.',
        time: '18:35',
        isSender: false,
      },
    ],
  },
  group3: {
    messages: [
      {
        id: 'g3m1',
        name: 'Виктор',
        avatar: 'https://picsum.photos/seed/hiker6/40/40',
        text: 'Проходим порог "Пронеси, Господи!". Идем по левому краю.',
        time: '14:10',
        isSender: false,
      },
      {
        id: 'g3m2',
        name: 'Вы',
        avatar: 'https://picsum.photos/seed/user/40/40',
        text: 'Принял, держусь правее для страховки. Как пройдете, дайте знать.',
        time: '14:11',
        isSender: true,
      },
       {
        id: 'g3m3',
        name: 'Елена',
        avatar: 'https://picsum.photos/seed/hiker7/40/40',
        text: 'Порог пройден успешно. Повреждений нет. Продолжаем движение.',
        time: '14:15',
        isSender: false,
      },
    ],
  },
};
