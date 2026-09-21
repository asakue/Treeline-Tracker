'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Group, Hiker } from '@/entities/group';
import { groupRepository } from '@/core/repositories';
import { groupChats as initialChats } from '../model/groups-data';

const CHATS_STORAGE_KEY = 'groupChats';

export const useGroups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const data = await groupRepository.getGroups();
      setGroups(data);

      if (typeof window !== 'undefined') {
        const savedChats = localStorage.getItem(CHATS_STORAGE_KEY);
        if (!savedChats) {
          localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(initialChats));
        }
      }
    } catch (error) {
      console.error('Failed to load groups via repository:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadGroups();

    const handleUpdate = () => {
      loadGroups();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('hiker_groups_updated', handleUpdate);
      return () => {
        window.removeEventListener('hiker_groups_updated', handleUpdate);
      };
    }
  }, [loadGroups]);

  const updateGroupsWithSimulatedData = useCallback((simulatedHikers: Hiker[]) => {
    if (simulatedHikers.length > 0) {
      setGroups((currentGroups) =>
        currentGroups.map((group) => ({
          ...group,
          hikers: group.hikers.map((hiker) => {
            const matchingSimulatedHiker = simulatedHikers.find((sh) => sh.id === hiker.id);
            return matchingSimulatedHiker || hiker;
          }),
        }))
      );
    }
  }, []);

  const saveGroups = useCallback(
    async (updatedGroups: Group[]) => {
      try {
        setGroups(updatedGroups);
        if (typeof window !== 'undefined') {
          localStorage.setItem('hiker_groups_data', JSON.stringify(updatedGroups));
          window.dispatchEvent(new Event('hiker_groups_updated'));
        }
      } catch (error) {
        console.error('Failed to save groups:', error);
      }
    },
    []
  );

  const addGroup = useCallback(
    async (newGroupData: Omit<Group, 'id'>) => {
      const newGroup: Group = {
        ...newGroupData,
        id: `group-${Date.now()}`,
      };

      await groupRepository.createGroup(newGroup);
      setGroups((prev) => [...prev, newGroup]);

      try {
        if (typeof window !== 'undefined') {
          const savedChats = localStorage.getItem(CHATS_STORAGE_KEY);
          const currentChats = savedChats ? JSON.parse(savedChats) : {};
          if (!currentChats[newGroup.id]) {
            currentChats[newGroup.id] = { messages: [] };
            localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(currentChats));
          }
        }
      } catch (error) {
        console.error('Failed to create chat for new group', error);
      }

      return newGroup;
    },
    []
  );

  const updateGroup = useCallback(
    async (id: string, updatedData: Omit<Group, 'id'>) => {
      const existing = groups.find((g) => g.id === id);
      if (!existing) return;

      const updatedGroup: Group = {
        ...existing,
        ...updatedData,
        id,
      };

      await groupRepository.updateGroup(updatedGroup);
      setGroups((prev) => prev.map((g) => (g.id === id ? updatedGroup : g)));
    },
    [groups]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      await groupRepository.deleteGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));

      try {
        if (typeof window !== 'undefined') {
          const savedChats = localStorage.getItem(CHATS_STORAGE_KEY);
          const currentChats = savedChats ? JSON.parse(savedChats) : {};
          if (currentChats[groupId]) {
            delete currentChats[groupId];
            localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(currentChats));
          }
        }
      } catch (error) {
        console.error(`Failed to delete chat for group ${groupId}`, error);
      }
    },
    []
  );

  return {
    groups,
    addGroup,
    updateGroup,
    deleteGroup,
    isLoaded,
    setGroups: saveGroups,
    updateGroupsWithSimulatedData,
  };
};

