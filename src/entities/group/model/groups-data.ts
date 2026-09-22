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

// Initialized empty for dynamic user-created hikers and groups
export const availableHikers: Hiker[] = [];

export const groups: Group[] = [];

export type GroupMessage = {
  id: string;
  name: string;
  avatar: string;
  text: string;
  time: string;
  isSender?: boolean;
};

export type GroupChatData = {
  id: string;
  messages: GroupMessage[];
};

export const groupChats: Record<string, GroupChatData> = {};
