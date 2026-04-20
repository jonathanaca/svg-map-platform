import React, { useState, useMemo } from 'react';
import type { MapObject } from '@svg-map/types';

interface Props {
  objects: MapObject[];
  selectedObjectId: string | null;
  onSelect: (id: string) => void;
  onScrollTo: (obj: MapObject) => void;
}

const TYPE_COLORS: Record<string, string> = {
  room: '#3b82f6',
  desk: '#22c55e',
  zone: '#a855f7',
  area: '#f59e0b',
  amenity: '#06b6d4',
  decorative: '#6b7280',
  parking: '#8b5cf6',
  locker: '#ec4899',
};

const TYPE_ORDER: string[] = ['room', 'desk', 'zone', 'area', 'amenity', 'locker', 'parking', 'decorative'];

export default function ObjectListPanel({ objects, selectedObjectId, onSelect, onScrollTo }: Props) {
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!filter.trim()) return objects;
    const q = filter.toLowerCase();
    return objects.filter(o =>
      o.label?.toLowerCase().includes(q) ||
      o.svg_id?.toLowerCase().includes(q) ||
      o.object_type.toLowerCase().includes(q)
    );
  }, [objects, filter]);

  const grouped = useMemo(() => {
    const groups: Record<string, MapObject[]> = {};
    for (const obj of filtered) {
      const type = obj.object_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(obj);
    }
    return groups;
  }, [filtered]);

  const sortedTypes = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a);
      const bi = TYPE_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [grouped]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Objects</span>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          background: 'var(--color-bg)',
          padding: '2px 8px',
          borderRadius: 10,
          color: 'var(--color-text-secondary)',
        }}>{objects.length}</span>
      </div>

      {/* Filter */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          placeholder="Filter objects..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            width: '100%',
            padding: '5px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: '0.75rem',
            outline: 'none',
            background: 'var(--color-bg)',
          }}
        />
      </div>

      {/* Object list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedTypes.map(type => {
          const items = grouped[type];
          const isCollapsed = collapsed[type] ?? false;
          const color = TYPE_COLORS[type] ?? '#6b7280';

          return (
            <div key={type}>
              {/* Group header */}
              <div
                onClick={() => setCollapsed(prev => ({ ...prev, [type]: !isCollapsed }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  background: 'var(--color-bg)',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  color: 'var(--color-text-secondary)',
                  userSelect: 'none',
                }}
              >
                <span style={{
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                  fontSize: 10,
                }}>
                  &#9660;
                </span>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0,
                }} />
                <span>{type}s</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  background: 'var(--color-surface)',
                  padding: '1px 6px',
                  borderRadius: 8,
                }}>{items.length}</span>
              </div>

              {/* Items */}
              {!isCollapsed && items.map(obj => (
                <div
                  key={obj.id}
                  onClick={() => {
                    onSelect(obj.id);
                    onScrollTo(obj);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 12px 5px 28px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                    background: obj.id === selectedObjectId ? 'var(--color-primary-light)' : 'transparent',
                    borderLeft: obj.id === selectedObjectId ? '3px solid var(--color-primary)' : '3px solid transparent',
                    transition: 'background 0.1s',
                    fontSize: '0.78rem',
                  }}
                  onMouseEnter={e => {
                    if (obj.id !== selectedObjectId) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--color-bg)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (obj.id !== selectedObjectId) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    opacity: obj.visible ? 1 : 0.3,
                  }} />
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: obj.id === selectedObjectId ? 600 : 400,
                  }}>
                    {obj.label || obj.svg_id || 'Unnamed'}
                  </span>
                  {obj.locked && (
                    <span style={{ fontSize: 10, opacity: 0.5 }} title="Locked">
                      &#128274;
                    </span>
                  )}
                  {!obj.visible && (
                    <span style={{ fontSize: 10, opacity: 0.4 }} title="Hidden">
                      &#128065;
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {sortedTypes.length === 0 && (
          <div style={{
            padding: '20px 12px',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: '0.78rem',
          }}>
            {filter ? 'No objects match filter' : 'No objects yet'}
          </div>
        )}
      </div>
    </div>
  );
}
