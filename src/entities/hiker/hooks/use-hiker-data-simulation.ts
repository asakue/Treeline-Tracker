'use client';

import { useState, useEffect } from 'react';
import type { Hiker } from '@/entities/hiker';
import { availableHikers as initialHikers } from '@/entities/group';

// Function to format time difference
const formatTimeAgo = (lastUpdate: number): string => {
  const now = Date.now();
  const seconds = Math.floor((now - lastUpdate) / 1000);

  if (seconds < 5) return 'только что';
  if (seconds < 60) return `${seconds} секунд назад`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} минут назад`;
  const hours = Math.floor(minutes / 60);
  return `${hours} часов назад`;
};

// Simulation parameters
const COORD_CHANGE_AMOUNT = 0.0001; // smaller change for smoother movement
const BATTERY_DRAIN_RATE = 0.05; // percentage points per interval
const UPDATE_INTERVAL = 5000; // 5 seconds

export const useHikerDataSimulation = () => {
  const [hikers, setHikers] = useState<Hiker[]>(() => 
    initialHikers.map(h => ({...h, lastUpdateTimestamp: Date.now()}))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setHikers(currentHikers =>
        currentHikers.map(hiker => {
          // 1. Simulate coordinate change
          const latChange = (Math.random() - 0.5) * COORD_CHANGE_AMOUNT;
          const lonChange = (Math.random() - 0.5) * COORD_CHANGE_AMOUNT;
          
          const coordsParts = hiker.coords.replace(/° с\.ш\.,?|° в\.д\./g, '').split(/,?\s+/);
          let newLat = parseFloat(coordsParts[0]);
          let newLon = parseFloat(coordsParts[1]);

          if (!isNaN(newLat) && !isNaN(newLon)) {
              newLat += latChange;
              newLon += lonChange;
          }

          // 2. Simulate battery drain
          let newBattery = hiker.battery - BATTERY_DRAIN_RATE;
          if (newBattery < 0) newBattery = 0;

          // 3. Update timestamp
          const newTimestamp = Date.now();

          return {
            ...hiker,
            coords: `${newLat.toFixed(6)}° с.ш., ${newLon.toFixed(6)}° в.д.`,
            battery: parseFloat(newBattery.toFixed(2)),
            lastUpdate: formatTimeAgo(newTimestamp),
            lastUpdateTimestamp: newTimestamp, // Store raw timestamp
          };
        })
      );
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return hikers;
};
