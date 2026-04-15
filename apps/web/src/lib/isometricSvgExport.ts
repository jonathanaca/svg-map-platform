import type { MapObject, MapObjectType } from '@svg-map/types';

// Isometric projection: 30-degree tilt
const ISO_ANGLE = Math.PI / 6; // 30 degrees
const COS_A = Math.cos(ISO_ANGLE);
const SIN_A = Math.sin(ISO_ANGLE);

function isoProject(x: number, y: number, z: number): [number, number] {
  const ix = (x - z) * COS_A;
  const iy = (x + z) * SIN_A - y;
  return [ix, iy];
}

function getHeight(objectType: MapObjectType): number {
  switch (objectType) {
    case 'room': return 0.8;
    case 'zone': case 'area': return 0.1;
    case 'desk': return 0.25;
    case 'parking': case 'locker': return 0.4;
    case 'decorative': return 0.18;
    default: return 0.3;
  }
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function darkenHex(hex: string, factor = 0.65): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface IsoRect {
  x: number; y: number; w: number; h: number;
}

function buildIsometricBox(
  rect: IsoRect,
  height: number,
  scale: number,
  canvasW: number,
  canvasH: number,
): { top: string; left: string; right: string } {
  // Convert canvas coords to world coords (centered at origin)
  const wx = (rect.x - canvasW / 2) * scale;
  const wz = (rect.y - canvasH / 2) * scale;
  const ww = rect.w * scale;
  const wh = rect.h * scale;

  // 4 corners of the rectangle at ground level (y=0)
  const corners = [
    { x: wx, z: wz },           // top-left
    { x: wx + ww, z: wz },      // top-right
    { x: wx + ww, z: wz + wh }, // bottom-right
    { x: wx, z: wz + wh },      // bottom-left
  ];

  // Project corners at top and bottom of extrusion
  const topCorners = corners.map(c => isoProject(c.x, height, c.z));
  const botCorners = corners.map(c => isoProject(c.x, 0, c.z));

  // Top face (polygon)
  const top = topCorners.map(([x, y]) => `${x},${y}`).join(' ');

  // Left face (front-left wall): bottom-left, top-left, top of top-left, bottom of bottom-left
  const left = [botCorners[3], topCorners[3], topCorners[0], botCorners[0]]
    .map(([x, y]) => `${x},${y}`).join(' ');

  // Right face (front-right wall): bottom-right, top-right, top of bottom-right at top, bottom of bottom-right
  const right = [botCorners[3], topCorners[3], topCorners[2], botCorners[2]]
    .map(([x, y]) => `${x},${y}`).join(' ');

  return { top, left, right };
}

export function exportIsometricSvg(
  objects: MapObject[],
  canvasW: number,
  canvasH: number,
  bgDataUri?: string,
): string {
  const scale = 0.01;

  // Calculate viewport bounds
  const allPoints: [number, number][] = [];
  // Add floor corners
  const floorCorners = [
    isoProject(-canvasW / 2 * scale, 0, -canvasH / 2 * scale),
    isoProject(canvasW / 2 * scale, 0, -canvasH / 2 * scale),
    isoProject(canvasW / 2 * scale, 0, canvasH / 2 * scale),
    isoProject(-canvasW / 2 * scale, 0, canvasH / 2 * scale),
  ];
  allPoints.push(...floorCorners);

  // Add extruded object top corners
  for (const obj of objects) {
    if (!obj.visible) continue;
    const geom = obj.geometry;
    if (geom.type !== 'rect') continue;
    const h = getHeight(obj.object_type);
    const corners = [
      isoProject((geom.x! - canvasW / 2) * scale, h, (geom.y! - canvasH / 2) * scale),
      isoProject(((geom.x! + geom.width!) - canvasW / 2) * scale, h, (geom.y! - canvasH / 2) * scale),
      isoProject(((geom.x! + geom.width!) - canvasW / 2) * scale, h, ((geom.y! + geom.height!) - canvasH / 2) * scale),
      isoProject((geom.x! - canvasW / 2) * scale, h, ((geom.y! + geom.height!) - canvasH / 2) * scale),
    ];
    allPoints.push(...corners);
  }

  const xs = allPoints.map(p => p[0]);
  const ys = allPoints.map(p => p[1]);
  const padding = 1;
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;
  const viewW = maxX - minX;
  const viewH = maxY - minY;

  const svgW = Math.round(viewW * 80);
  const svgH = Math.round(viewH * 80);

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${viewW} ${viewH}" width="${svgW}" height="${svgH}">\n`;
  svg += `<!-- Isometric SVG Map | Generated: ${new Date().toISOString()} -->\n`;

  // CSS status classes
  svg += `<style>\n`;
  svg += `  .st4-top, .st5-top { fill: #e2e8f0; opacity: 0.55; pointer-events: all; }\n`;
  svg += `  .st4-side, .st5-side { fill: #78859b; opacity: 0.75; }\n`;
  svg += `  .st4-wall { fill: #94a3b8; opacity: 0.75; }\n`;
  svg += `  .free-top, .available-top { fill: #4CAF50; opacity: 0.55; }\n`;
  svg += `  .free-side, .available-side { fill: ${darkenHex('#4CAF50')}; opacity: 0.75; }\n`;
  svg += `  .booked-top, .pending-top { fill: #FF9800; opacity: 0.55; }\n`;
  svg += `  .booked-side, .pending-side { fill: ${darkenHex('#FF9800')}; opacity: 0.75; }\n`;
  svg += `  .occupied-top { fill: #F44336; opacity: 0.55; }\n`;
  svg += `  .occupied-side { fill: ${darkenHex('#F44336')}; opacity: 0.75; }\n`;
  svg += `  .checked-in-top { fill: #2196F3; opacity: 0.55; }\n`;
  svg += `  .checked-in-side { fill: ${darkenHex('#2196F3')}; opacity: 0.75; }\n`;
  svg += `  .out-of-service-top, .unavailable-top { fill: #9E9E9E; opacity: 0.55; }\n`;
  svg += `  .out-of-service-side, .unavailable-side { fill: ${darkenHex('#9E9E9E')}; opacity: 0.75; }\n`;
  svg += `  .restricted-top { fill: #795548; opacity: 0.55; }\n`;
  svg += `  .restricted-side { fill: ${darkenHex('#795548')}; opacity: 0.75; }\n`;
  svg += `  .iso-label { font-family: -apple-system, Arial, sans-serif; font-size: 0.09px; font-weight: 700; fill: #334155; text-anchor: middle; dominant-baseline: central; }\n`;
  svg += `  .iso-floor { fill: #cbd5e1; }\n`;
  svg += `  .iso-floor-surface { fill: #e2e8f0; opacity: 0.8; }\n`;
  svg += `</style>\n`;

  // Floor base
  const floorBase = floorCorners.map(([x, y]) => `${x},${y}`).join(' ');
  svg += `<polygon points="${floorBase}" class="iso-floor"/>\n`;

  // Floor image (projected as parallelogram)
  if (bgDataUri) {
    // Use a clip path with the isometric floor shape
    svg += `<defs><clipPath id="floor-clip"><polygon points="${floorBase}"/></clipPath></defs>\n`;
    const fx = Math.min(...floorCorners.map(c => c[0]));
    const fy = Math.min(...floorCorners.map(c => c[1]));
    const fw = Math.max(...floorCorners.map(c => c[0])) - fx;
    const fh = Math.max(...floorCorners.map(c => c[1])) - fy;
    svg += `<image href="${bgDataUri}" x="${fx}" y="${fy}" width="${fw}" height="${fh}" opacity="0.5" clip-path="url(#floor-clip)" preserveAspectRatio="none"/>\n`;
  }

  // Sort objects by depth (back-to-front for isometric: higher z + x = further back)
  const sortedObjects = [...objects]
    .filter(o => o.visible && o.geometry.type === 'rect')
    .sort((a, b) => {
      const az = (a.geometry.y ?? 0) + (a.geometry.x ?? 0);
      const bz = (b.geometry.y ?? 0) + (b.geometry.x ?? 0);
      return az - bz; // back to front
    });

  const bookable = sortedObjects.filter(o => o.object_type === 'room' || o.object_type === 'desk');
  const nonBookable = sortedObjects.filter(o => o.object_type !== 'room' && o.object_type !== 'desk');

  // Render non-bookable objects first (decorative, zones, areas)
  for (const obj of nonBookable) {
    const geom = obj.geometry;
    const rect = { x: geom.x ?? 0, y: geom.y ?? 0, w: geom.width ?? 50, h: geom.height ?? 50 };
    const h = getHeight(obj.object_type);
    const box = buildIsometricBox(rect, h, scale, canvasW, canvasH);
    const color = obj.fill_color?.replace(/[0-9a-f]{2}$/i, '') || '#94a3b8';

    svg += `<g>\n`;
    svg += `  <polygon points="${box.right}" fill="${darkenHex(color, 0.5)}" opacity="0.5"/>\n`;
    svg += `  <polygon points="${box.left}" fill="${darkenHex(color, 0.6)}" opacity="0.5"/>\n`;
    svg += `  <polygon points="${box.top}" fill="${color}" opacity="0.4"/>\n`;
    svg += `</g>\n`;
  }

  // Render bookable objects with PlaceOS IDs
  svg += `<g id="room-bookings">\n`;
  for (const obj of bookable) {
    const geom = obj.geometry;
    const rect = { x: geom.x ?? 0, y: geom.y ?? 0, w: geom.width ?? 50, h: geom.height ?? 50 };
    const h = getHeight(obj.object_type);
    const box = buildIsometricBox(rect, h, scale, canvasW, canvasH);

    const mapId = obj.svg_id || obj.id;
    const placeosId = mapId.startsWith('area-') ? `${mapId}-status` : `area-${mapId}-status`;
    const clsPrefix = obj.object_type === 'desk' ? 'st5' : 'st4';

    svg += `  <g id="${escXml(placeosId)}">\n`;
    svg += `    <polygon points="${box.right}" class="${clsPrefix}-side"/>\n`;
    svg += `    <polygon points="${box.left}" class="${clsPrefix}-wall"/>\n`;
    svg += `    <polygon points="${box.top}" class="${clsPrefix}-top" pointer-events="all"/>\n`;
    svg += `  </g>\n`;
  }
  svg += `</g>\n`;

  // Labels for rooms
  svg += `<g id="labels">\n`;
  for (const obj of bookable) {
    if (obj.object_type !== 'room' || !obj.label) continue;
    const geom = obj.geometry;
    const cx = ((geom.x ?? 0) + (geom.width ?? 50) / 2 - canvasW / 2) * scale;
    const cz = ((geom.y ?? 0) + (geom.height ?? 50) / 2 - canvasH / 2) * scale;
    const h = getHeight(obj.object_type);
    const [lx, ly] = isoProject(cx, h + 0.15, cz);
    svg += `  <text x="${lx}" y="${ly}" class="iso-label">${escXml(obj.label)}</text>\n`;
  }
  svg += `</g>\n`;

  svg += `</svg>\n`;
  return svg;
}
