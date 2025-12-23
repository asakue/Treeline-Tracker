export type Route = {
  id: string;
  name: string;
  location: string;
  difficulty: 'Легко' | 'Средне' | 'Сложно' | 'Очень сложно';
  distance: string;
  time: string;
  type: string;
  altitude: string;
  coordinates: string;
  path: [number, number][];
};
