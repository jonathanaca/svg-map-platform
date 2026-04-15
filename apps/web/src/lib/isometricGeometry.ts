import * as THREE from 'three';
import type { MapObject, MapObjectType } from '@svg-map/types';

const DEFAULT_SCALE = 0.01;

export function getExtrusionHeight(objectType: MapObjectType): number {
  switch (objectType) {
    case 'room': return 0.8;
    case 'zone': case 'area': return 0.1;
    case 'desk': return 0.25;
    case 'parking': case 'locker': return 0.4;
    case 'decorative': return 0.18;
    case 'amenity': return 0.06;
    default: return 0.3;
  }
}

export function mapObjectToWorldPos(
  obj: MapObject,
  canvasW: number,
  canvasH: number,
  scale = DEFAULT_SCALE,
): [number, number, number] {
  const geom = obj.geometry;
  const cx = (geom.x ?? 0) + (geom.width ?? 0) / 2;
  const cy = (geom.y ?? 0) + (geom.height ?? 0) / 2;
  // Center the floor plan at origin
  const wx = (cx - canvasW / 2) * scale;
  const wz = (cy - canvasH / 2) * scale;
  return [wx, 0, wz];
}

export function buildShapeFromRect(
  x: number, y: number, w: number, h: number,
  canvasW: number, canvasH: number, scale = DEFAULT_SCALE,
): THREE.Shape {
  const ox = (x - canvasW / 2) * scale;
  const oz = (y - canvasH / 2) * scale;
  const sw = w * scale;
  const sh = h * scale;

  const shape = new THREE.Shape();
  shape.moveTo(ox, -oz);
  shape.lineTo(ox + sw, -oz);
  shape.lineTo(ox + sw, -oz - sh);
  shape.lineTo(ox, -oz - sh);
  shape.closePath();
  return shape;
}

export function buildShapeFromPolygon(
  points: { x: number; y: number }[],
  canvasW: number, canvasH: number, scale = DEFAULT_SCALE,
): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach((p, i) => {
    const wx = (p.x - canvasW / 2) * scale;
    const wz = (p.y - canvasH / 2) * scale;
    if (i === 0) shape.moveTo(wx, -wz);
    else shape.lineTo(wx, -wz);
  });
  shape.closePath();
  return shape;
}

export function buildExtrudedGeometry(
  obj: MapObject,
  canvasW: number,
  canvasH: number,
  scale = DEFAULT_SCALE,
): THREE.BufferGeometry | null {
  const geom = obj.geometry;
  const height = getExtrusionHeight(obj.object_type);
  const extrudeSettings = { depth: height, bevelEnabled: false };

  if (geom.type === 'rect') {
    const shape = buildShapeFromRect(
      geom.x ?? 0, geom.y ?? 0, geom.width ?? 50, geom.height ?? 50,
      canvasW, canvasH, scale,
    );
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  if (geom.type === 'polygon' && geom.points && geom.points.length >= 3) {
    const shape = buildShapeFromPolygon(geom.points, canvasW, canvasH, scale);
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  if (geom.type === 'circle') {
    const r = (geom.r ?? 12) * scale;
    return new THREE.CylinderGeometry(r, r, height, 24);
  }

  // path type — render as flat rect fallback
  if (geom.type === 'path' && geom.x != null && geom.width != null) {
    const shape = buildShapeFromRect(
      geom.x, geom.y ?? 0, geom.width, geom.height ?? 50,
      canvasW, canvasH, scale,
    );
    return new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
  }

  return null;
}

export function getFurnitureHeight(furnitureType: string): number {
  switch (furnitureType) {
    case 'desk-single': case 'desk-pair': case 'desk-pod': case 'standing-desk':
      return 0.1;
    case 'table-small': case 'table-medium': case 'table-large': case 'table-round':
      return 0.1;
    case 'bench': case 'lounge-chair': case 'sofa':
      return 0.08;
    case 'phone-booth':
      return 0.3;
    case 'plant': case 'plant-large':
      return 0.25;
    case 'partition':
      return 0.25;
    case 'whiteboard': case 'tv-screen':
      return 0.2;
    case 'lockers': case 'filing-cabinet': case 'bookshelf':
      return 0.2;
    default:
      return 0.1;
  }
}
