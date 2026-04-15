import { useState, useEffect, useCallback } from 'react';
import type { AvailabilityState, MapObject } from '@svg-map/types';
import { getPlaceOSConfig, getPlaceOSSystems, type PlaceOSSystem } from '../lib/api.js';

export function useAvailabilityPolling(
  objects: MapObject[],
  placeosLevelZoneId?: string,
  intervalMs = 30_000,
): Record<string, AvailabilityState> {
  const [states, setStates] = useState<Record<string, AvailabilityState>>({});
  const [usePlaceOS, setUsePlaceOS] = useState(false);

  // Check if PlaceOS is configured
  useEffect(() => {
    getPlaceOSConfig().then(cfg => {
      setUsePlaceOS(cfg.configured);
    }).catch(() => setUsePlaceOS(false));
  }, []);

  // Initialize default states from objects
  useEffect(() => {
    const defaults: Record<string, AvailabilityState> = {};
    for (const obj of objects) {
      if (obj.object_type === 'room') defaults[obj.id] = 'free';
      else if (obj.object_type === 'desk') defaults[obj.id] = 'available';
    }
    setStates(defaults);
  }, [objects]);

  // Poll PlaceOS systems for real status, or simulate
  const poll = useCallback(async () => {
    if (objects.length === 0) return;

    if (usePlaceOS && placeosLevelZoneId) {
      try {
        const systems = await getPlaceOSSystems(placeosLevelZoneId);
        const updated: Record<string, AvailabilityState> = {};
        for (const obj of objects) {
          if (obj.object_type !== 'room' && obj.object_type !== 'desk') continue;
          const mapId = obj.svg_id || obj.id;
          const system = systems.find(s => s.map_id === mapId);
          if (system) {
            // PlaceOS system found — for now map bookable status
            // Real implementation would check module status bindings
            updated[obj.id] = system.bookable ? 'free' : 'out-of-service';
          } else {
            updated[obj.id] = obj.object_type === 'room' ? 'free' : 'available';
          }
        }
        setStates(updated);
        return;
      } catch {
        // Fall through to simulation
      }
    }

    // Simulation mode — randomize states
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
  }, [objects, usePlaceOS, placeosLevelZoneId]);

  useEffect(() => {
    if (objects.length === 0) return;
    const initTimer = setTimeout(poll, 2000);
    const interval = setInterval(poll, intervalMs);
    return () => { clearTimeout(initTimer); clearInterval(interval); };
  }, [objects, intervalMs, poll]);

  return states;
}
