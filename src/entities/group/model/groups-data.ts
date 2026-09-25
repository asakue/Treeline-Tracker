import type { Group as DomainGroup, Member } from '@/core/domain/types';
import type { Hiker } from '@/entities/hiker';

export type Group = DomainGroup;
export type { Hiker };


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
