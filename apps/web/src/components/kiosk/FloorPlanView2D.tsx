import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { MapObject, Floorplan, AvailabilityState } from '@svg-map/types';
import { STATE_COLORS } from '../../lib/availabilityColors.js';
import HeatmapOverlay from './HeatmapOverlay.js';

interface Props {
  floorplan: Floorplan;
  objects: MapObject[];
  availability: Record<string, AvailabilityState>;
  heatmapEnabled?: boolean;
}

const STATUS_FILLS: Record<string, string> = {
  free: 'rgba(76, 175, 80, 0.55)',
  available: 'rgba(33, 150, 243, 0.55)',
  booked: 'rgba(255, 152, 0, 0.55)',
  pending: 'rgba(255, 152, 0, 0.45)',
  occupied: 'rgba(244, 67, 54, 0.55)',
  'checked-in': 'rgba(33, 150, 243, 0.55)',
  'out-of-service': 'rgba(158, 158, 158, 0.45)',
  restricted: 'rgba(121, 85, 72, 0.45)',
};

const STATUS_STROKES: Record<string, string> = {
  free: '#4CAF50',
  available: '#2196F3',
  booked: '#FF9800',
  pending: '#FF9800',
  occupied: '#F44336',
  'checked-in': '#2196F3',
  'out-of-service': '#9E9E9E',
  restricted: '#795548',
};

const DEFAULT_FILL = 'rgba(100, 116, 139, 0.2)';
const DEFAULT_STROKE = '#475569';

export default function FloorPlanView2D({ floorplan, objects, availability, heatmapEnabled = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);

  const canvasW = floorplan.canvas_width ?? 1000;
  const canvasH = floorplan.canvas_height ?? 800;

  // Load image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = `/api/floorplans/${floorplan.id}/source-preview`;
  }, [floorplan.id]);

  const visibleObjects = objects.filter(o => o.visible);
  const rooms = visibleObjects.filter(o => o.object_type === 'room');
  const desks = visibleObjects.filter(o => o.object_type === 'desk');
  const amenities = visibleObjects.filter(o => o.object_type === 'amenity');
  const walls = visibleObjects.filter(o => o.object_type === 'decorative' && o.layer === 'walls');
  const zones = visibleObjects.filter(o => o.object_type === 'zone' || o.object_type === 'area');
  const other = visibleObjects.filter(o =>
    !['room', 'desk', 'amenity', 'zone', 'area'].includes(o.object_type) &&
    !(o.object_type === 'decorative' && o.layer === 'walls')
  );

  function getFill(obj: MapObject): string {
    // When heatmap is on, make rooms/desks very faint so the heatmap colors show through
    if (heatmapEnabled && (obj.object_type === 'room' || obj.object_type === 'desk')) {
      return 'rgba(255, 255, 255, 0.08)';
    }
    const state = availability[obj.id];
    if (state && STATUS_FILLS[state]) {
      if (obj.object_type === 'desk') {
        const opaque: Record<string, string> = {
          free: 'rgba(76, 175, 80, 0.7)',
          available: 'rgba(76, 175, 80, 0.7)',
          booked: 'rgba(255, 152, 0, 0.7)',
          pending: 'rgba(255, 152, 0, 0.6)',
          occupied: 'rgba(244, 67, 54, 0.7)',
          'checked-in': 'rgba(33, 150, 243, 0.7)',
          'out-of-service': 'rgba(158, 158, 158, 0.6)',
          restricted: 'rgba(121, 85, 72, 0.6)',
        };
        return opaque[state] ?? STATUS_FILLS[state];
      }
      return STATUS_FILLS[state];
    }
    if (obj.object_type === 'desk') return 'rgba(76, 175, 80, 0.7)';
    return DEFAULT_FILL;
  }

  function getStroke(obj: MapObject): string {
    if (heatmapEnabled && (obj.object_type === 'room' || obj.object_type === 'desk')) {
      return 'rgba(255, 255, 255, 0.2)';
    }
    const state = availability[obj.id];
    if (state && STATUS_STROKES[state]) return STATUS_STROKES[state];
    if (obj.object_type === 'desk') return '#4CAF50';
    return DEFAULT_STROKE;
  }

  function getStrokeWidth(obj: MapObject): number {
    const base = Math.max(1, canvasW / 600);
    if (obj.id === hoveredId) return base * 2;
    return base;
  }

  function renderShape(obj: MapObject) {
    const geom = obj.geometry;
    const fill = getFill(obj);
    const stroke = getStroke(obj);
    const sw = getStrokeWidth(obj);
    const isHovered = obj.id === hoveredId;
    const state = availability[obj.id];
    const fontSize = Math.max(8, Math.min(canvasW / 80, 14));

    if (geom.type === 'rect') {
      const rx = geom.x ?? 0, ry = geom.y ?? 0;
      const rw = geom.width ?? 50, rh = geom.height ?? 50;
      return (
        <g
          key={obj.id}
          onMouseEnter={() => setHoveredId(obj.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{ cursor: 'pointer' }}
        >
          <rect
            x={rx} y={ry} width={rw} height={rh}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            rx={2}
            opacity={isHovered ? 1 : 0.9}
          />
          {/* Room/desk label */}
          {obj.label && rw > 30 && rh > 20 && (
            <text
              x={rx + rw / 2}
              y={ry + rh / 2 - (state ? fontSize * 0.3 : 0)}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#e6edf3"
              fontSize={fontSize}
              fontWeight="600"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
            >
              {obj.label}
            </text>
          )}
          {/* Status text */}
          {state && rw > 50 && rh > 30 && (
            <text
              x={rx + rw / 2}
              y={ry + rh / 2 + fontSize * 0.6}
              textAnchor="middle"
              dominantBaseline="central"
              fill={stroke}
              fontSize={fontSize * 0.65}
              fontWeight="700"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              style={{ pointerEvents: 'none', textTransform: 'uppercase' as const }}
              letterSpacing="0.5"
            >
              {state.replace(/-/g, ' ').toUpperCase()}
            </text>
          )}
          {/* Status dot for small objects */}
          {state && (rw <= 50 || rh <= 30) && (
            <circle
              cx={rx + rw / 2}
              cy={ry + rh / 2}
              r={Math.min(rw, rh) * 0.2}
              fill={stroke}
              opacity={0.8}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>
      );
    }

    if (geom.type === 'polygon' && geom.points) {
      const pts = geom.points.map(p => `${p.x},${p.y}`).join(' ');
      const cx = geom.points.reduce((s, p) => s + p.x, 0) / geom.points.length;
      const cy = geom.points.reduce((s, p) => s + p.y, 0) / geom.points.length;
      return (
        <g
          key={obj.id}
          onMouseEnter={() => setHoveredId(obj.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{ cursor: 'pointer' }}
        >
          <polygon
            points={pts}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity={isHovered ? 1 : 0.9}
          />
          {obj.label && (
            <text
              x={cx} y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#e6edf3"
              fontSize={fontSize}
              fontWeight="600"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
            >
              {obj.label}
            </text>
          )}
        </g>
      );
    }

    if (geom.type === 'circle') {
      return (
        <circle
          key={obj.id}
          cx={geom.x ?? 0}
          cy={geom.y ?? 0}
          r={geom.r ?? 12}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          onMouseEnter={() => setHoveredId(obj.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{ cursor: 'pointer' }}
        />
      );
    }

    return null;
  }

  function renderAmenity(obj: MapObject) {
    const geom = obj.geometry;
    const cx = geom.x ?? 0, cy = geom.y ?? 0;
    const r = Math.max(6, canvasW / 120);
    const isHovered = obj.id === hoveredId;
    return (
      <g
        key={obj.id}
        onMouseEnter={() => setHoveredId(obj.id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{ cursor: 'pointer' }}
      >
        {/* Amenity dot */}
        <circle cx={cx} cy={cy} r={r} fill="#0ea5e9" stroke="#fff" strokeWidth={1.5} opacity={0.9} />
        {/* Label on hover */}
        {isHovered && obj.label && (
          <g>
            <rect
              x={cx - obj.label.length * 3.5 - 6}
              y={cy - r - 22}
              width={obj.label.length * 7 + 12}
              height={18}
              rx={4}
              fill="rgba(15,20,25,0.92)"
              stroke="#334155"
              strokeWidth={0.5}
            />
            <text
              x={cx} y={cy - r - 13}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#e6edf3"
              fontSize={10}
              fontWeight="600"
              fontFamily="-apple-system, sans-serif"
            >
              {obj.label}
            </text>
          </g>
        )}
      </g>
    );
  }

  function renderWall(obj: MapObject) {
    const geom = obj.geometry;
    if (geom.type === 'polygon' && geom.points) {
      const pts = geom.points.map(p => `${p.x},${p.y}`).join(' ');
      return (
        <polygon
          key={obj.id}
          points={pts}
          fill="#374151"
          stroke="#1f2937"
          strokeWidth={1}
          opacity={0.85}
          style={{ pointerEvents: 'none' }}
        />
      );
    }
    if (geom.type === 'rect') {
      return (
        <rect
          key={obj.id}
          x={geom.x ?? 0} y={geom.y ?? 0}
          width={geom.width ?? 10} height={geom.height ?? 10}
          fill="#374151"
          stroke="#1f2937"
          strokeWidth={1}
          opacity={0.85}
          style={{ pointerEvents: 'none' }}
        />
      );
    }
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: '#0d1117',
        position: 'relative',
      }}
    >
      <svg
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        {/* Background */}
        <rect x={0} y={0} width={canvasW} height={canvasH} fill={(floorplan as any).background_color || '#161b22'} />

        {/* Floor plan image */}
        {floorplan.source_image_path && (
          <image
            href={`/api/floorplans/${floorplan.id}/source-preview`}
            x={0} y={0}
            width={canvasW} height={canvasH}
            opacity={0.35}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Heatmap overlay */}
        <HeatmapOverlay
          objects={objects}
          availability={availability}
          canvasW={canvasW}
          canvasH={canvasH}
          enabled={heatmapEnabled}
        />

        {/* Walls */}
        {walls.map(renderWall)}

        {/* Zones (under rooms) */}
        {zones.map(renderShape)}

        {/* Rooms */}
        {rooms.map(renderShape)}

        {/* Desks */}
        {desks.map(renderShape)}

        {/* Other objects */}
        {other.map(renderShape)}

        {/* Amenities (on top) */}
        {amenities.map(renderAmenity)}

        {/* Hover tooltip overlay */}
        {hoveredId && (() => {
          const obj = objects.find(o => o.id === hoveredId);
          if (!obj) return null;
          const state = availability[obj.id];
          const geom = obj.geometry;
          const tooltipX = (geom.x ?? 0) + (geom.width ?? 0);
          const tooltipY = (geom.y ?? 0);
          if (!state && obj.object_type !== 'room' && obj.object_type !== 'desk') return null;
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={tooltipX + 8}
                y={tooltipY - 5}
                width={120}
                height={state ? 38 : 22}
                rx={6}
                fill="rgba(13,17,23,0.95)"
                stroke="#30363d"
                strokeWidth={1}
              />
              <text
                x={tooltipX + 16}
                y={tooltipY + 9}
                fill="#e6edf3"
                fontSize={10}
                fontWeight="700"
                fontFamily="-apple-system, sans-serif"
              >
                {obj.label || obj.svg_id}
              </text>
              {state && (
                <>
                  <circle
                    cx={tooltipX + 20}
                    cy={tooltipY + 24}
                    r={3}
                    fill={STATE_COLORS[state] ?? '#666'}
                  />
                  <text
                    x={tooltipX + 28}
                    y={tooltipY + 27}
                    fill={STATE_COLORS[state] ?? '#999'}
                    fontSize={9}
                    fontWeight="600"
                    fontFamily="-apple-system, sans-serif"
                  >
                    {state.replace(/-/g, ' ').toUpperCase()}
                  </text>
                </>
              )}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
