'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Group, Hiker } from '@/entities/group';
import { groups as initialGroups, groupChats as initialChats } from '../model/groups-data';

const GROUPS_STORAGE_KEY = 'tracker-groups';
const CHATS_STORAGE_KEY = 'groupChats';

export const useGroups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
      const savedChats = localStorage.getItem(CHATS_STORAGE_KEY);

      const groupsToLoad = savedGroups ? JSON.parse(savedGroups) : initialGroups;
      setGroups(groupsToLoad);

      if (!savedGroups) {
         localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(initialGroups));
      }
      
      if (!savedChats) {
        localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(initialChats));
      }

    } catch (error) {
      console.error("Failed to load data from localStorage, using initial data.", error);
      setGroups(initialGroups);
      localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(initialChats));
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const updateGroupsWithSimulatedData = useCallback((simulatedHikers: Hiker[]) => {
    if (simulatedHikers.length > 0) {
        setGroups(currentGroups =>
            currentGroups.map(group => ({
                ...group,
                hikers: group.hikers.map(hiker => {
                    const matchingSimulatedHiker = simulatedHikers.find(sh => sh.id === hiker.id);
                    return matchingSimulatedHiker || hiker;
                })
            }))
        );
    }
  }, []);

  const saveGroups = useCallback((updatedGroups: Group[]) => {
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(updatedGroups));
      setGroups(updatedGroups);
    } catch (error) {
      console.error("Failed to save groups to localStorage", error);
    }
  }, []);

  const addGroup = useCallback((newGroupData: Omit<Group, 'id'>) => {
    const currentGroups = JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY) || '[]');
    const newGroup: Group = {
      ...newGroupData,
      id: `group-${Date.now()}`,
    };
    
    const updatedGroups = [...currentGroups, newGroup];
    saveGroups(updatedGroups);

    try {
        const savedChats = localStorage.getItem(CHATS_STORAGE_KEY);
        const currentChats = savedChats ? JSON.parse(savedChats) : {};
        if (!currentChats[newGroup.id]) {
            currentChats[newGroup.id] = { messages: [] };
            localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(currentChats));
        }
    } catch (error) {
        console.error("Failed to create chat for new group", error);
    }


    return newGroup;
  }, [saveGroups]);

  const updateGroup = useCallback((id: string, updatedData: Omit<Group, 'id'>) => {
    const currentGroups = JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY) || '[]');
    const updatedGroups = currentGroups.map((group: Group) =>
      group.id === id ? { ...group, ...updatedData, id: group.id } : group
    );
    saveGroups(updatedGroups);
  }, [saveGroups]);

  const deleteGroup = useCallback((groupId: string) => {
    const currentGroups = JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY) || '[]');
    const updatedGroups = currentGroups.filter((group: Group) => group.id !== groupId);
    saveGroups(updatedGroups);

    try {
      const savedChats = localStorage.getItem(CHATS_STORAGE_KEY);
      const currentChats = savedChats ? JSON.parse(savedChats) : {};
      if (currentChats[groupId]) {
        delete currentChats[groupId];
        localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(currentChats));
      }
    } catch (error) {
      console.error(`Failed to delete chat for group ${groupId}`, error);
    }
  }, [saveGroups]);


  return { groups, addGroup, updateGroup, deleteGroup, isLoaded, setGroups: saveGroups, updateGroupsWithSimulatedData };
};
