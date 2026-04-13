import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { BrandConfig, RoomEntry, AvailabilityState } from '@svg-map/types';
import { saveConfig, generateSvg } from '../lib/api.js';
import {
  STATE_COLORS,
  DESK_STATES,
  ROOM_STATES,
  ALL_STATES,
  getStatesForType,
  cycleState,
} from '../components/AvailabilityPreview.js';

interface StateStepProps {
  jobId: string;
  brandConfig: BrandConfig;
  stateAssignments: Record<string, AvailabilityState>;
  onComplete: (assignments: Record<string, AvailabilityState>) => void;
  onBack: () => void;
}

function getRoomType(room: RoomEntry): string {
  if (room.id.startsWith('desk')) return 'desk';
  return 'room';
}

function formatState(state: string): string {
  return state.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StateStep({
  jobId,
  brandConfig,
  stateAssignments: initialAssignments,
  onComplete,
  onBack,
}: StateStepProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const imageUrl = `/api/files/processed/${jobId}.jpg`;

  // Get bookable rooms/desks (exclude floor)
  const bookableRooms = useMemo(
    () => brandConfig.roomIds.filter((r) => r.id !== 'floor'),
    [brandConfig.roomIds],
  );

  // Floor outline
  const floorRoom = brandConfig.roomIds.find((r) => r.id === 'floor');
  const outlinePoints: { x: number; y: number }[] = useMemo(() => {
    if (!floorRoom) return [];
    try {
      const raw = (floorRoom as unknown as Record<string, unknown>)._outlinePoints;
      if (Array.isArray(raw)) return raw as { x: number; y: number }[];
    } catch { /* ignore */ }
    return [];
  }, [floorRoom]);

  // Initialize assignments — default rooms to 'free', desks to 'available'
  const [assignments, setAssignments] = useState<Record<string, AvailabilityState>>(() => {
    const defaults: Record<string, AvailabilityState> = {};
    for (const room of bookableRooms) {
      const type = getRoomType(room);
      defaults[room.id] = initialAssignments[room.id] ?? (type === 'desk' ? 'available' : 'free');
    }
    return defaults;
  });

  // Load image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  // State counts
  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const state of Object.values(assignments)) {
      counts[state] = (counts[state] || 0) + 1;
    }
    return counts;
  }, [assignments]);

  const handleCycleState = useCallback((roomId: string) => {
    const room = bookableRooms.find((r) => r.id === roomId);
    if (!room) return;
    const type = getRoomType(room);
    setAssignments((prev) => ({
      ...prev,
      [roomId]: cycleState(prev[roomId], type),
    }));
    setSelectedId(roomId);
  }, [bookableRooms]);

  const handleSetState = useCallback((roomId: string, state: AvailabilityState) => {
    setAssignments((prev) => ({ ...prev, [roomId]: state }));
  }, []);

  const handleRandomize = useCallback(() => {
    const newAssignments: Record<string, AvailabilityState> = {};
    for (const room of bookableRooms) {
      const states = getStatesForType(getRoomType(room));
      newAssignments[room.id] = states[Math.floor(Math.random() * states.length)];
    }
    setAssignments(newAssignments);
  }, [bookableRooms]);

  const handleClearAll = useCallback(() => {
    const cleared: Record<string, AvailabilityState> = {};
    for (const room of bookableRooms) {
      cleared[room.id] = getRoomType(room) === 'desk' ? 'available' : 'free';
    }
    setAssignments(cleared);
  }, [bookableRooms]);

  const handleSetAll = useCallback((state: AvailabilityState) => {
    const updated: Record<string, AvailabilityState> = {};
    for (const room of bookableRooms) {
      const type = getRoomType(room);
      const valid = getStatesForType(type);
      updated[room.id] = valid.includes(state) ? state : valid[0];
    }
    setAssignments(updated);
  }, [bookableRooms]);

  async function handleContinue() {
    setError(null);
    setSubmitting(true);
    try {
      const fullConfig: BrandConfig = {
        ...brandConfig,
        stateAssignments: assignments,
      };
      await saveConfig(jobId, fullConfig);
      await generateSvg(jobId);
      onComplete(assignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate SVG.');
    } finally {
      setSubmitting(false);
    }
  }

  // Outline polygon path
  const outlinePath = outlinePoints.length >= 3
    ? outlinePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
    : '';

  return (
    <div className="card" style={{ maxWidth: 1400 }}>
      <h2>Assign Booking States</h2>

      <div className="ss-info-banner">
        Click rooms/desks on the map or use the dropdowns to assign booking states.
        This defines how each space appears when the map is live.
      </div>

      {/* State Legend */}
      <div className="ss-legend">
        <div className="ss-legend-title">State Legend</div>
        <div className="ss-legend-grid">
          {ALL_STATES.map((state) => (
            <div key={state} className="ss-legend-item">
              <span
                className="ss-legend-swatch"
                style={{ backgroundColor: STATE_COLORS[state] }}
              />
              <span className="ss-legend-label">{formatState(state)}</span>
              {stateCounts[state] ? (
                <span className="ss-legend-count">{stateCounts[state]}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="ss-bulk-actions">
        <button className="btn btn-secondary btn-sm" onClick={handleRandomize}>
          Randomize
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleClearAll}>
          Clear All
        </button>
        <label className="ss-set-all">
          Set All:
          <select
            onChange={(e) => {
              if (e.target.value) handleSetAll(e.target.value as AvailabilityState);
              e.target.value = '';
            }}
            defaultValue=""
          >
            <option value="" disabled>Choose...</option>
            {ALL_STATES.map((s) => (
              <option key={s} value={s}>{formatState(s)}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Two-panel layout */}
      <div className="ss-layout">
        {/* Canvas */}
        <div className="ss-canvas-wrap">
          {imageDims ? (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
              className="ss-canvas"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Background image */}
              <image
                href={imageUrl}
                width={imageDims.width}
                height={imageDims.height}
                opacity={0.4}
              />

              {/* Floor outline */}
              {outlinePath && (
                <path
                  d={outlinePath}
                  fill="none"
                  stroke="#333"
                  strokeWidth={3}
                  strokeDasharray="8 4"
                />
              )}

              {/* Rooms/desks */}
              {bookableRooms.map((room) => {
                const state = assignments[room.id];
                const color = state ? STATE_COLORS[state] : '#ccc';
                const isSelected = selectedId === room.id;
                const x = room.x ?? 0;
                const y = room.y ?? 0;
                const w = room.width ?? 200;
                const h = room.height ?? 150;
                const fontSize = Math.min(w, h) * 0.18;
                const stateFontSize = fontSize * 0.75;

                return (
                  <g
                    key={room.id}
                    onClick={() => handleCycleState(room.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={color}
                      fillOpacity={0.55}
                      stroke={isSelected ? '#000' : color}
                      strokeWidth={isSelected ? 3 : 1.5}
                      rx={4}
                    />
                    {/* Label */}
                    <text
                      x={x + w / 2}
                      y={y + h / 2 - stateFontSize * 0.4}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      fontWeight="600"
                      fill="#1a1a1a"
                    >
                      {room.label || room.id}
                    </text>
                    {/* State badge */}
                    <text
                      x={x + w / 2}
                      y={y + h / 2 + fontSize * 0.6}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={stateFontSize}
                      fill={color}
                      fontWeight="700"
                    >
                      {state ? formatState(state) : '--'}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="ss-loading">Loading floorplan...</div>
          )}
        </div>

        {/* Object list with dropdowns */}
        <div className="ss-object-list">
          <div className="ss-list-title">
            Bookable Spaces ({bookableRooms.length})
          </div>
          {bookableRooms.length === 0 && (
            <p className="ss-empty">No rooms or desks placed yet.</p>
          )}
          {bookableRooms.map((room) => {
            const type = getRoomType(room);
            const validStates = getStatesForType(type);
            const state = assignments[room.id];
            const color = state ? STATE_COLORS[state] : '#ccc';
            const isSelected = selectedId === room.id;

            return (
              <div
                key={room.id}
                className={`ss-object-row ${isSelected ? 'ss-object-row--selected' : ''}`}
                onClick={() => setSelectedId(room.id)}
              >
                <span
                  className="ss-object-dot"
                  style={{ backgroundColor: color }}
                />
                <div className="ss-object-info">
                  <span className="ss-object-label">{room.label || room.id}</span>
                  <span className="ss-object-type">{type}</span>
                </div>
                <select
                  className="ss-state-select"
                  value={state || ''}
                  onChange={(e) => handleSetState(room.id, e.target.value as AvailabilityState)}
                >
                  {validStates.map((s) => (
                    <option key={s} value={s}>{formatState(s)}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: 8, marginTop: 16 }}>
          {error}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={onBack} type="button">Back</button>
        <button
          className="btn btn-primary"
          onClick={handleContinue}
          disabled={submitting}
        >
          {submitting ? 'Generating...' : 'Generate SVG'}
        </button>
      </div>
    </div>
  );
}
