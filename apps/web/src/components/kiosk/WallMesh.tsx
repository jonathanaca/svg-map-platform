import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { MapObject } from '@svg-map/types';

interface Props {
  obj: MapObject;
  canvasW: number;
  canvasH: number;
  scale: number;
}

const WALL_HEIGHT = 0.25;

export default function WallMesh({ obj, canvasW, canvasH, scale }: Props) {
  const geom = obj.geometry;

  const geometry = useMemo(() => {
    if (geom.type === 'polygon' && geom.points && geom.points.length >= 3) {
      // Build a shape from the polygon points
      const shape = new THREE.Shape();
      geom.points.forEach((p, i) => {
        const wx = (p.x - canvasW / 2) * scale;
        const wz = (p.y - canvasH / 2) * scale;
        if (i === 0) shape.moveTo(wx, -wz);
        else shape.lineTo(wx, -wz);
      });
      shape.closePath();
      return new THREE.ExtrudeGeometry(shape, { depth: WALL_HEIGHT, bevelEnabled: false });
    }

    if (geom.type === 'rect') {
      const x = (geom.x ?? 0), y = (geom.y ?? 0);
      const w = (geom.width ?? 10), h = (geom.height ?? 10);
      const shape = new THREE.Shape();
      const ox = (x - canvasW / 2) * scale;
      const oz = (y - canvasH / 2) * scale;
      const sw = w * scale;
      const sh = h * scale;
      shape.moveTo(ox, -oz);
      shape.lineTo(ox + sw, -oz);
      shape.lineTo(ox + sw, -oz - sh);
      shape.lineTo(ox, -oz - sh);
      shape.closePath();
      return new THREE.ExtrudeGeometry(shape, { depth: WALL_HEIGHT, bevelEnabled: false });
    }

    return null;
  }, [geom, canvasW, canvasH, scale]);

  const materials = useMemo(() => [
    new THREE.MeshLambertMaterial({ color: '#6b7280', transparent: true, opacity: 0.9 }),
    new THREE.MeshLambertMaterial({ color: '#9ca3af', transparent: true, opacity: 0.8 }),
  ], []);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} material={materials} rotation={[-Math.PI / 2, 0, 0]} />
  );
}
