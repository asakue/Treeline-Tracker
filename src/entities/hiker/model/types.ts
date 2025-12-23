export type Hiker = {
  id: string;
  name: string;
  avatar: string;
  status: 'На тропе' | 'На воде' | 'В лагере';
  battery: number;
  coords: string;
  lastUpdate: string;
  lastUpdateTimestamp?: number; // Add this to store the raw timestamp
};
