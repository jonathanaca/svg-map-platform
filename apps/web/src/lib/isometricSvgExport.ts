import type { MapObject } from '@svg-map/types';

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function darkenHex(hex: string, factor = 0.65): string {
  const m = hex.match(/^#?([0-9a-f]{6})/i);
  if (!m) return '#555555';
  const r = Math.round(parseInt(m[1].slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(m[1].slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(m[1].slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function pointsStr(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

function getDepth(objectType: string): number {
  switch (objectType) {
    case 'room': return 30;
    case 'zone': case 'area': return 10;
    case 'desk': return 16;
    case 'parking': case 'locker': return 20;
    default: return 12;
  }
}

function renderShape(obj: MapObject, attrs: string): string {
  const geom = obj.geometry;
  if (geom.type === 'rect') {
    return `<rect x="${geom.x ?? 0}" y="${geom.y ?? 0}" width="${geom.width ?? 50}" height="${geom.height ?? 50}" rx="3" ${attrs}${geom.rotation ? ` transform="rotate(${geom.rotation} ${(geom.x ?? 0) + (geom.width ?? 50) / 2} ${(geom.y ?? 0) + (geom.height ?? 50) / 2})"` : ''}/>`;
  } else if (geom.type === 'polygon' && geom.points) {
    return `<polygon points="${geom.points.map((p: {x:number;y:number}) => `${p.x},${p.y}`).join(' ')}" ${attrs}/>`;
  } else if (geom.type === 'circle') {
    return `<circle cx="${geom.x ?? 0}" cy="${geom.y ?? 0}" r="${geom.r ?? 12}" ${attrs}/>`;
  } else if (geom.type === 'path' && geom.d) {
    return `<path d="${escXml(geom.d)}" ${attrs}/>`;
  }
  return '';
}

// Build a "depth shadow" — the same shape offset down-right to simulate extrusion
function renderDepthShadow(obj: MapObject, depth: number, color: string): string {
  const geom = obj.geometry;
  const dx = depth * 0.7;
  const dy = depth;

  if (geom.type === 'rect') {
    const x = geom.x ?? 0, y = geom.y ?? 0, w = geom.width ?? 50, h = geom.height ?? 50;
    // Draw a polygon connecting the bottom shape to the top shape to create a 3D extrusion effect
    const topTL = `${x},${y}`;
    const topTR = `${x + w},${y}`;
    const topBR = `${x + w},${y + h}`;
    const topBL = `${x},${y + h}`;
    const botTR = `${x + w + dx},${y + dy}`;
    const botBR = `${x + w + dx},${y + h + dy}`;
    const botBL = `${x + dx},${y + h + dy}`;

    // Right face
    const right = `<polygon points="${topTR} ${botTR} ${botBR} ${topBR}" fill="${darkenHex(color, 0.7)}" opacity="0.8"/>`;
    // Bottom face
    const bottom = `<polygon points="${topBL} ${topBR} ${botBR} ${botBL}" fill="${darkenHex(color, 0.5)}" opacity="0.8"/>`;
    return right + '\n' + bottom;
  }
  if (geom.type === 'polygon' && geom.points?.length) {
    const pts = geom.points;
    const shifted = pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    const faces: string[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const a2 = shifted[i];
      const b2 = shifted[(i + 1) % pts.length];
      // Use edge orientation to bias visibility towards right/bottom faces.
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      if (ey < -2 && ex < 2) continue;
      faces.push(
        `<polygon points="${a.x},${a.y} ${b.x},${b.y} ${b2.x},${b2.y} ${a2.x},${a2.y}" fill="${darkenHex(color, 0.62)}" opacity="0.7"/>`
      );
    }
    return faces.join('\n');
  }
  return '';
}

export function exportIsometricSvg(
  objects: MapObject[],
  canvasW: number,
  canvasH: number,
  bgDataUri?: string,
): string {
  // Use a generous viewport so the rotated/skewed map fits entirely
  const maxDim = Math.max(canvasW, canvasH);
  const viewW = maxDim * 2.2;
  const viewH = maxDim * 1.6;

  // Slightly stronger tilt + scale for a more volumetric read.
  const isoTransform = `translate(${viewW * 0.5}, ${viewH * 0.45}) scale(0.69, 0.54) rotate(-30) translate(${-canvasW / 2}, ${-canvasH / 2})`;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" width="${viewW}" height="${viewH}" style="background:#0f1419">\n`;
  svg += `<!-- Isometric SVG Map | Bookable spaces: ${objects.filter(o => o.object_type === 'room' || o.object_type === 'desk').length} | Generated: ${new Date().toISOString()} -->\n`;

  // CSS status classes
  svg += `<style>\n`;
  svg += `  .st4, .st5 { fill: #3a4555; fill-opacity: 0.82; pointer-events: all; }\n`;
  svg += `  .free, .available { fill: #4CAF50; fill-opacity: 0.4; pointer-events: all; }\n`;
  svg += `  .booked, .pending { fill: #FF9800; fill-opacity: 0.4; pointer-events: all; }\n`;
  svg += `  .occupied { fill: #F44336; fill-opacity: 0.4; pointer-events: all; }\n`;
  svg += `  .checked-in { fill: #2196F3; fill-opacity: 0.4; pointer-events: all; }\n`;
  svg += `  .out-of-service, .unavailable { fill: #9E9E9E; fill-opacity: 0.4; pointer-events: all; }\n`;
  svg += `  .restricted { fill: #795548; fill-opacity: 0.4; pointer-events: all; }\n`;
  svg += `  .iso-label { font-family: -apple-system, Arial, sans-serif; font-weight: 700; fill: #e2e8f0; text-anchor: middle; dominant-baseline: central; pointer-events: none; }\n`;
  svg += `</style>\n`;

  // Drop shadow filter for the whole map
  svg += `<defs>\n`;
  svg += `  <linearGradient id="floor-grad" x1="0%" y1="0%" x2="100%" y2="100%">\n`;
  svg += `    <stop offset="0%" stop-color="#222c3a"/>\n`;
  svg += `    <stop offset="100%" stop-color="#17202b"/>\n`;
  svg += `  </linearGradient>\n`;
  svg += `  <filter id="map-shadow" x="-20%" y="-20%" width="160%" height="160%">\n`;
  svg += `    <feDropShadow dx="8" dy="14" stdDeviation="18" flood-color="#000" flood-opacity="0.55"/>\n`;
  svg += `  </filter>\n`;
  svg += `</defs>\n`;

  // Isometric group
  svg += `<g transform="${isoTransform}" filter="url(#map-shadow)">\n`;

  // Background floor
  svg += `  <rect x="0" y="0" width="${canvasW}" height="${canvasH}" rx="10" fill="url(#floor-grad)"/>\n`;

  // Floor plan image
  if (bgDataUri) {
    svg += `  <image href="${bgDataUri}" x="0" y="0" width="${canvasW}" height="${canvasH}" opacity="0.2" preserveAspectRatio="xMidYMid meet"/>\n`;
  }

  // Sort objects back-to-front by "footprint depth" in screen space.
  const sorted = [...objects]
    .filter(o => o.visible)
    .sort((a, b) => {
      const aBottom = (a.geometry.y ?? 0) + (a.geometry.height ?? 0);
      const bBottom = (b.geometry.y ?? 0) + (b.geometry.height ?? 0);
      if (aBottom !== bBottom) return aBottom - bBottom;
      return (a.geometry.x ?? 0) - (b.geometry.x ?? 0);
    });

  const bookable = sorted.filter(o => o.object_type === 'room' || o.object_type === 'desk');
  const nonBookable = sorted.filter(o => o.object_type !== 'room' && o.object_type !== 'desk');

  // Non-bookable objects (zones, areas, furniture)
  for (const obj of nonBookable) {
    if (obj.object_type === 'amenity') continue; // skip amenity pins
    const depth = getDepth(obj.object_type);
    const color = obj.fill_color?.replace(/[0-9a-f]{2}$/i, '') || '#94a3b8';
    if (depth > 3) {
      svg += `  ${renderDepthShadow(obj, depth, color)}\n`;
    }
    svg += `  ${renderShape(obj, `fill="${color}" opacity="0.55" stroke="${obj.stroke_color || '#6b7280'}" stroke-width="1.3"`)}\n`;
  }

  // Depth shadows for bookable spaces (rendered before the top faces)
  svg += `  <g id="depth-shadows">\n`;
  for (const obj of bookable) {
    const depth = getDepth(obj.object_type);
    svg += `    ${renderDepthShadow(obj, depth, '#3f4b5d')}\n`;
  }
  svg += `  </g>\n`;

  // Bookable overlay top faces with PlaceOS IDs
  svg += `  <g id="room-bookings">\n`;
  for (const obj of bookable) {
    const mapId = obj.svg_id || obj.id;
    const placeosId = mapId.startsWith('area-') ? `${mapId}-status` : `area-${mapId}-status`;
    const cls = obj.object_type === 'desk' ? 'st5' : 'st4';
    const topStroke = obj.object_type === 'desk' ? '#1f2937' : '#0f172a';
    svg += `    ${renderShape(obj, `id="${escXml(placeosId)}" class="${cls}" stroke="${topStroke}" stroke-width="1.4"`)}\n`;
  }
  svg += `  </g>\n`;

  // Labels
  svg += `  <g id="labels">\n`;
  for (const obj of bookable) {
    if (obj.object_type !== 'room' || !obj.label) continue;
    const geom = obj.geometry;
    const cx = (geom.x ?? 0) + (geom.width ?? 50) / 2;
    const cy = (geom.y ?? 0) + (geom.height ?? 50) / 2;
    const area = (geom.width ?? 50) * (geom.height ?? 50);
    if (area < 2800) continue;
    const fontSize = Math.max(8, Math.min((geom.width ?? 50) / 6, 16));
    const label = obj.label.length > 22 ? `${obj.label.slice(0, 21)}…` : obj.label;
    // Label background
    const lw = label.length * fontSize * 0.52 + 12;
    const lh = fontSize + 8;
    svg += `    <rect x="${cx - lw / 2}" y="${cy - lh / 2 - 2}" width="${lw}" height="${lh}" rx="3" fill="#1a2030" opacity="0.85"/>\n`;
    svg += `    <text x="${cx}" y="${cy}" class="iso-label" font-size="${fontSize}">${escXml(label)}</text>\n`;
  }
  svg += `  </g>\n`;

  svg += `</g>\n`; // close isometric group
  svg += `</svg>\n`;
  return svg;
}
