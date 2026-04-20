import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MapObject } from '@svg-map/types';

interface MinimapProps {
  objects: MapObject[];
  canvasW: number;
  canvasH: number;
  containerRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  floorplanId?: string;
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

export default function Minimap({ objects, canvasW, canvasH, containerRef, zoom, floorplanId }: MinimapProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, w: 100, h: 100 });
  const minimapRef = useRef<HTMLDivElement>(null);

  const MINIMAP_W = 180;
  const aspect = canvasH / canvasW;
  const MINIMAP_H = Math.round(MINIMAP_W * aspect);
  const scaleX = MINIMAP_W / canvasW;
  const scaleY = MINIMAP_H / canvasH;

  // Update viewport indicator on scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const svgDisplayW = canvasW * zoom;
      const svgDisplayH = canvasH * zoom;
      const viewX = (el.scrollLeft / svgDisplayW) * canvasW;
      const viewY = (el.scrollTop / svgDisplayH) * canvasH;
      const viewW = (el.clientWidth / svgDisplayW) * canvasW;
      const viewH = (el.clientHeight / svgDisplayH) * canvasH;
      setViewport({ x: viewX, y: viewY, w: Math.min(viewW, canvasW), h: Math.min(viewH, canvasH) });
    };

    update();
    el.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [containerRef, canvasW, canvasH, zoom]);

  // Click on minimap to navigate
  const handleMinimapClick = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    const mm = minimapRef.current;
    if (!el || !mm) return;

    const rect = mm.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / MINIMAP_W * canvasW;
    const my = (e.clientY - rect.top) / MINIMAP_H * canvasH;

    const svgDisplayW = canvasW * zoom;
    const svgDisplayH = canvasH * zoom;
    const scrollX = (mx / canvasW) * svgDisplayW - el.clientWidth / 2;
    const scrollY = (my / canvasH) * svgDisplayH - el.clientHeight / 2;
    el.scrollTo({ left: scrollX, top: scrollY, behavior: 'smooth' });
  }, [containerRef, canvasW, canvasH, zoom, MINIMAP_H]);

  if (collapsed) {
    return (
      <div style={{
        position: 'fixed', bottom: 40, right: 240, zIndex: 100,
        background: 'var(--color-surface)', borderRadius: 6,
        border: '1px solid var(--color-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '4px 8px', cursor: 'pointer',
        fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
      }} onClick={() => setCollapsed(false)}>
        Map
      </div>
    );
  }

  const visibleObjects = objects.filter(o => o.visible);

  return (
    <div
      ref={minimapRef}
      style={{
        position: 'fixed', bottom: 40, right: 240, zIndex: 100,
        width: MINIMAP_W, height: MINIMAP_H,
        background: '#f8fafc',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        cursor: 'crosshair',
      }}
      onClick={handleMinimapClick}
    >
      {/* Collapse button */}
      <div
        onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}
        style={{
          position: 'absolute', top: 2, right: 4, zIndex: 2,
          cursor: 'pointer', fontSize: 12, color: '#94a3b8',
          lineHeight: 1, padding: 2,
        }}
      >
        &times;
      </div>

      {/* Minimap SVG */}
      <svg width={MINIMAP_W} height={MINIMAP_H} viewBox={`0 0 ${canvasW} ${canvasH}`}>
        {/* Canvas background */}
        <rect x={0} y={0} width={canvasW} height={canvasH} fill="#e8e8e8" />

        {/* Floor plan image */}
        {floorplanId && (
          <image
            href={`/api/floorplans/${floorplanId}/source-preview`}
            x={0} y={0}
            width={canvasW} height={canvasH}
            opacity={0.7}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Objects as colored rects */}
        {visibleObjects.map(obj => {
          const g = obj.geometry;
          const color = TYPE_COLORS[obj.object_type] ?? '#94a3b8';
          if (g.type === 'rect') {
            return (
              <rect
                key={obj.id}
                x={g.x ?? 0} y={g.y ?? 0}
                width={g.width ?? 10} height={g.height ?? 10}
                fill={color} opacity={0.75}
                stroke={color} strokeWidth={Math.max(canvasW / 300, 2)}
              />
            );
          }
          if (g.type === 'circle') {
            return (
              <circle
                key={obj.id}
                cx={g.x ?? 0} cy={g.y ?? 0} r={g.r ?? 5}
                fill={color} opacity={0.6}
              />
            );
          }
          if (g.type === 'polygon' && g.points) {
            return (
              <polygon
                key={obj.id}
                points={g.points.map(p => `${p.x},${p.y}`).join(' ')}
                fill={color} opacity={0.6}
              />
            );
          }
          return null;
        })}

        {/* Viewport indicator */}
        <rect
          x={viewport.x} y={viewport.y}
          width={viewport.w} height={viewport.h}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="#3b82f6"
          strokeWidth={Math.max(canvasW / MINIMAP_W * 1.5, 3)}
          rx={2}
        />
      </svg>
    </div>
  );
}
