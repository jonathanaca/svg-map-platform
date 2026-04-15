import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { AvailabilityState, MapObject, Floorplan } from '@svg-map/types';
import { useKioskData } from '../hooks/useKioskData.js';
import { useAvailabilityPolling } from '../hooks/useAvailabilityPolling.js';
import { STATE_COLORS, ALL_STATES } from '../lib/availabilityColors.js';
import IsometricScene from '../components/kiosk/IsometricScene.js';
import './KioskPage.css';

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="kiosk-clock">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

interface StatCardProps { value: number; total: number; label: string; color: string }
function StatCard({ value, total, label, color }: StatCardProps) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="kiosk-stat-card">
      <div className="kiosk-stat-numbers">
        <span className="kiosk-stat-value" style={{ color }}>{value}</span>
        <span className="kiosk-stat-divider">/</span>
        <span className="kiosk-stat-total">{total}</span>
      </div>
      <div className="kiosk-stat-label">{label}</div>
      <div className="kiosk-stat-bar">
        <div className="kiosk-stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function KioskPage() {
  const { projectId, floorplanId: urlFloorplanId } = useParams<{ projectId: string; floorplanId?: string }>();
  const [activeFloorplanId, setActiveFloorplanId] = useState<string | null>(urlFloorplanId ?? null);
  const { project, floorplan, objects, isLoading } = useKioskData(projectId!, activeFloorplanId);
  const availability = useAvailabilityPolling(objects);

  // Set default floor on project load
  useEffect(() => {
    if (project?.floorplans?.length && !activeFloorplanId) {
      const sorted = [...project.floorplans].sort((a, b) => a.floor_index - b.floor_index);
      setActiveFloorplanId(sorted[0].id);
    }
  }, [project, activeFloorplanId]);

  // Stats
  const rooms = objects.filter(o => o.object_type === 'room');
  const desks = objects.filter(o => o.object_type === 'desk');
  const freeRooms = rooms.filter(r => availability[r.id] === 'free' || !availability[r.id]).length;
  const availDesks = desks.filter(d => availability[d.id] === 'available' || !availability[d.id]).length;
  const occupiedRooms = rooms.filter(r => availability[r.id] === 'occupied').length;
  const bookedRooms = rooms.filter(r => availability[r.id] === 'booked' || availability[r.id] === 'pending').length;

  const sortedFloors = project?.floorplans
    ? [...project.floorplans].sort((a, b) => a.floor_index - b.floor_index)
    : [];

  if (isLoading && !floorplan) {
    return (
      <div className="kiosk-loading">
        <div className="kiosk-loading-spinner" />
        <p>Loading floor plan...</p>
      </div>
    );
  }

  return (
    <div className="kiosk-layout">
      {/* Header */}
      <header className="kiosk-header">
        <div className="kiosk-header-left">
          <div className="kiosk-building-name">{project?.building_name || project?.name || 'Building'}</div>
          <div className="kiosk-floor-name">{floorplan?.floor_name || 'Level 1'}</div>
        </div>
        <div className="kiosk-header-right">
          <LiveClock />
        </div>
      </header>

      {/* Sidebar */}
      <aside className="kiosk-sidebar">
        <div className="kiosk-stats">
          <StatCard value={freeRooms} total={rooms.length} label="Rooms Available" color="#4CAF50" />
          <StatCard value={availDesks} total={desks.length} label="Desks Available" color="#2196F3" />
          <StatCard value={occupiedRooms} total={rooms.length} label="Rooms Occupied" color="#F44336" />
          <StatCard value={bookedRooms} total={rooms.length} label="Rooms Booked" color="#FF9800" />
        </div>

        <div className="kiosk-legend">
          <div className="kiosk-legend-title">Status</div>
          {(['free', 'booked', 'occupied', 'checked-in', 'out-of-service', 'available', 'restricted'] as AvailabilityState[]).map(state => (
            <div key={state} className="kiosk-legend-item">
              <span className="kiosk-legend-dot" style={{ background: STATE_COLORS[state] }} />
              <span className="kiosk-legend-label">{state.replace(/-/g, ' ')}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* 3D Scene */}
      <main className="kiosk-scene">
        {floorplan && (
          <IsometricScene
            floorplan={floorplan}
            objects={objects}
            availability={availability}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="kiosk-footer">
        <div className="kiosk-floor-tabs">
          {sortedFloors.map(fp => (
            <button
              key={fp.id}
              className={`kiosk-floor-tab ${fp.id === activeFloorplanId ? 'active' : ''}`}
              onClick={() => setActiveFloorplanId(fp.id)}
            >
              {fp.floor_name || `Floor ${fp.floor_index + 1}`}
            </button>
          ))}
        </div>
        <div className="kiosk-brand">
          Floor Plan Studio
        </div>
      </footer>
    </div>
  );
}
