import type { AvailabilityState } from '@svg-map/types';

export const STATE_COLORS: Record<AvailabilityState, string> = {
  available: '#4CAF50',
  booked: '#FF9800',
  occupied: '#F44336',
  free: '#4CAF50',
  'checked-in': '#2196F3',
  pending: '#FF9800',
  'out-of-service': '#9E9E9E',
  restricted: '#795548',
  unavailable: '#9E9E9E',
};

export const DESK_STATES: AvailabilityState[] = [
  'available', 'booked', 'occupied', 'restricted', 'unavailable',
];

export const ROOM_STATES: AvailabilityState[] = [
  'free', 'checked-in', 'pending', 'booked', 'out-of-service',
];

export const ALL_STATES = Object.keys(STATE_COLORS) as AvailabilityState[];

export function getStatesForType(objectType: string): AvailabilityState[] {
  if (objectType === 'room') return ROOM_STATES;
  if (objectType === 'desk') return DESK_STATES;
  return ALL_STATES;
}

export function getAvailabilityColor(state: AvailabilityState): string {
  return STATE_COLORS[state] ?? '#9E9E9E';
}

export function darkenColor(hex: string, factor = 0.6): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
}
