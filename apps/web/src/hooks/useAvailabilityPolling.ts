import { useState, useEffect, useCallback } from 'react';
import type { AvailabilityState, MapObject } from '@svg-map/types';

export function useAvailabilityPolling(
  objects: MapObject[],
  intervalMs = 30_000,
): Record<string, AvailabilityState> {
  const [states, setStates] = useState<Record<string, AvailabilityState>>({});

  // Initialize default states from objects
  useEffect(() => {
    const defaults: Record<string, AvailabilityState> = {};
    for (const obj of objects) {
      if (obj.object_type === 'room') defaults[obj.id] = 'free';
      else if (obj.object_type === 'desk') defaults[obj.id] = 'available';
    }
    setStates(defaults);
  }, [objects]);

  // Simulate random state changes for demo (replace with PlaceOS API later)
  const randomize = useCallback(() => {
    const roomStates: AvailabilityState[] = ['free', 'booked', 'occupied', 'pending'];
    const deskStates: AvailabilityState[] = ['available', 'booked', 'occupied'];
    const updated: Record<string, AvailabilityState> = {};
    for (const obj of objects) {
      if (obj.object_type === 'room') {
        updated[obj.id] = roomStates[Math.floor(Math.random() * roomStates.length)];
      } else if (obj.object_type === 'desk') {
        updated[obj.id] = deskStates[Math.floor(Math.random() * deskStates.length)];
      }
    }
    setStates(updated);
  }, [objects]);

  useEffect(() => {
    if (objects.length === 0) return;
    // Randomize on first load after a short delay
    const initTimer = setTimeout(randomize, 2000);
    const interval = setInterval(randomize, intervalMs);
    return () => { clearTimeout(initTimer); clearInterval(interval); };
  }, [objects, intervalMs, randomize]);

  return states;
}
