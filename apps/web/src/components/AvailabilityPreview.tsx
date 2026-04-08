import React, { useState, useCallback, useMemo } from 'react';
import type { MapObject, AvailabilityState } from '@svg-map/types';

interface Props {
  objects: MapObject[];
  onStateChange: (objectId: string, state: AvailabilityState) => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const STATE_COLORS: Record<AvailabilityState, string> = {
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

const DESK_STATES: AvailabilityState[] = [
  'available', 'booked', 'occupied', 'restricted', 'unavailable',
];

const ROOM_STATES: AvailabilityState[] = [
  'free', 'checked-in', 'pending', 'booked', 'out-of-service',
];

const ALL_STATES = Object.keys(STATE_COLORS) as AvailabilityState[];

function getStatesForType(objectType: string): AvailabilityState[] {
  if (objectType === 'room') return ROOM_STATES;
  if (objectType === 'desk') return DESK_STATES;
  return ALL_STATES;
}

function cycleState(current: AvailabilityState | undefined, objectType: string): AvailabilityState {
  const states = getStatesForType(objectType);
  if (!current) return states[0];
  const idx = states.indexOf(current);
  return states[(idx + 1) % states.length];
}

export default function AvailabilityPreview({
  objects,
  onStateChange,
  enabled,
  onToggle,
}: Props) {
  const [objectStates, setObjectStates] = useState<Record<string, AvailabilityState>>({});

  const bookableObjects = useMemo(
    () => objects.filter((o) => o.object_type === 'desk' || o.object_type === 'room'),
    [objects],
  );

  const handleRandomize = useCallback(() => {
    const newStates: Record<string, AvailabilityState> = {};
    for (const obj of bookableObjects) {
      const states = getStatesForType(obj.object_type);
      const randomState = states[Math.floor(Math.random() * states.length)];
      newStates[obj.id] = randomState;
      onStateChange(obj.id, randomState);
    }
    setObjectStates(newStates);
  }, [bookableObjects, onStateChange]);

  const handleClear = useCallback(() => {
    const cleared: Record<string, AvailabilityState> = {};
    for (const obj of bookableObjects) {
      const defaultState = obj.object_type === 'room' ? 'free' : 'available';
      cleared[obj.id] = defaultState;
      onStateChange(obj.id, defaultState);
    }
    setObjectStates(cleared);
  }, [bookableObjects, onStateChange]);

  const handleObjectClick = useCallback(
    (obj: MapObject) => {
      if (!enabled) return;
      const current = objectStates[obj.id];
      const next = cycleState(current, obj.object_type);
      setObjectStates((prev) => ({ ...prev, [obj.id]: next }));
      onStateChange(obj.id, next);
    },
    [enabled, objectStates, onStateChange],
  );

  // Count objects per state
  const stateCounts: Record<string, number> = {};
  for (const [, state] of Object.entries(objectStates)) {
    stateCounts[state] = (stateCounts[state] || 0) + 1;
  }

  return (
    <div className="ap-panel">
      <div className="ap-header">
        <h3>Availability Preview</h3>
        <label className="ap-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="ap-toggle-label">{enabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      {enabled && (
        <>
          {/* Action buttons */}
          <div className="ap-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleRandomize}>
              Randomize
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleClear}>
              Clear
            </button>
          </div>

          {/* Legend */}
          <div className="ap-legend">
            <div className="ap-legend-title">State Legend</div>
            <div className="ap-legend-grid">
              {ALL_STATES.map((state) => (
                <div key={state} className="ap-legend-item">
                  <span
                    className="ap-legend-swatch"
                    style={{ backgroundColor: STATE_COLORS[state] }}
                  />
                  <span className="ap-legend-label">{state}</span>
                  {stateCounts[state] ? (
                    <span className="ap-legend-count">{stateCounts[state]}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Object list */}
          <div className="ap-object-list">
            <div className="ap-list-title">
              Bookable Objects ({bookableObjects.length})
            </div>
            {bookableObjects.length === 0 && (
              <p className="ap-empty">No desks or rooms to preview.</p>
            )}
            {bookableObjects.map((obj) => {
              const state = objectStates[obj.id];
              const color = state ? STATE_COLORS[state] : undefined;
              return (
                <div
                  key={obj.id}
                  className="ap-object-item"
                  onClick={() => handleObjectClick(obj)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleObjectClick(obj);
                  }}
                >
                  <span
                    className="ap-object-indicator"
                    style={{ backgroundColor: color || 'var(--color-border)' }}
                  />
                  <div className="ap-object-info">
                    <span className="ap-object-label">
                      {obj.label || obj.svg_id || obj.id.slice(0, 8)}
                    </span>
                    <span className="ap-object-type">{obj.object_type}</span>
                  </div>
                  <span className="ap-object-state">
                    {state || '--'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!enabled && (
        <div className="ap-disabled-msg">
          <p>Enable availability preview to simulate booking states on desks and rooms.</p>
        </div>
      )}
    </div>
  );
}

/** Utility: get the fill color for an object based on its availability state */
export function getAvailabilityColor(state: AvailabilityState | undefined): string | undefined {
  if (!state) return undefined;
  return STATE_COLORS[state];
}

export { STATE_COLORS, DESK_STATES, ROOM_STATES };
