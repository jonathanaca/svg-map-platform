import React, { useMemo } from 'react';
import type { MapObject, AvailabilityState } from '@svg-map/types';

interface Props {
  objects: MapObject[];
  availability: Record<string, AvailabilityState>;
  canvasW: number;
  canvasH: number;
  enabled: boolean;
}

// Convert availability state to a utilization score (0 = free, 1 = fully occupied)
function stateToScore(state?: AvailabilityState): number {
  switch (state) {
    case 'free': case 'available': return 0;
    case 'pending': return 0.3;
    case 'booked': return 0.5;
    case 'checked-in': return 0.7;
    case 'occupied': return 1;
    case 'out-of-service': case 'restricted': return 0.2;
    default: return 0; // no state = assumed free
  }
}

// Map score to color: green (0) → yellow (0.5) → red (1)
function scoreToColor(score: number): string {
  if (score <= 0.5) {
    const t = score / 0.5;
    const r = Math.round(76 + (255 - 76) * t);
    const g = Math.round(175 + (152 - 175) * t);
    const b = Math.round(80 + (0 - 80) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (score - 0.5) / 0.5;
    const r = Math.round(255 - (255 - 244) * t);
    const g = Math.round(152 - (152 - 67) * t);
    const b = Math.round(0 + 54 * t);
    return `rgb(${r},${g},${b})`;
  }
}

export default function HeatmapOverlay({ objects, availability, canvasW, canvasH, enabled }: Props) {
  // Compute heatmap cells
  const cells = useMemo(() => {
    if (!enabled) return [];

    const CELL_SIZE = Math.max(canvasW, canvasH) / 20; // ~20 cells across
    const cols = Math.ceil(canvasW / CELL_SIZE);
    const rows = Math.ceil(canvasH / CELL_SIZE);

    // Build grid
    const grid: { score: number; count: number }[][] = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = { score: 0, count: 0 };
      }
    }

    // Accumulate object scores into grid cells
    const bookable = objects.filter(o =>
      o.visible && (o.object_type === 'room' || o.object_type === 'desk')
    );

    for (const obj of bookable) {
      const g = obj.geometry;
      const ox = g.x ?? 0;
      const oy = g.y ?? 0;
      const ow = g.width ?? 30;
      const oh = g.height ?? 30;
      const cx = ox + ow / 2;
      const cy = oy + oh / 2;
      const score = stateToScore(availability[obj.id]);

      // Spread influence to nearby cells (gaussian-ish)
      const radius = 2; // cells
      const col = Math.floor(cx / CELL_SIZE);
      const row = Math.floor(cy / CELL_SIZE);

      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
          const dist = Math.sqrt(dr * dr + dc * dc);
          const weight = Math.max(0, 1 - dist / (radius + 1));
          grid[r][c].score += score * weight;
          grid[r][c].count += weight;
        }
      }
    }

    // Generate cells with averaged scores
    const result: { x: number; y: number; w: number; h: number; color: string; opacity: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell.count === 0) continue;
        const avgScore = cell.score / cell.count;
        result.push({
          x: c * CELL_SIZE,
          y: r * CELL_SIZE,
          w: CELL_SIZE,
          h: CELL_SIZE,
          color: scoreToColor(avgScore),
          opacity: Math.min(0.5, cell.count * 0.15),
        });
      }
    }

    return result;
  }, [objects, availability, canvasW, canvasH, enabled]);

  if (!enabled || cells.length === 0) return null;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <defs>
        <filter id="heatmap-blur">
          <feGaussianBlur stdDeviation={canvasW / 40} />
        </filter>
      </defs>
      <g filter="url(#heatmap-blur)">
        {cells.map((cell, i) => (
          <rect
            key={i}
            x={cell.x}
            y={cell.y}
            width={cell.w}
            height={cell.h}
            fill={cell.color}
            opacity={cell.opacity}
          />
        ))}
      </g>
    </g>
  );
}
