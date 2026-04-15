import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { MapObject } from '@svg-map/types';
import { getFurnitureHeight } from '../../lib/isometricGeometry.js';

interface Props {
  obj: MapObject;
  canvasW: number;
  canvasH: number;
  scale: number;
}

export default function FurnitureMesh({ obj, canvasW, canvasH, scale }: Props) {
  const geom = obj.geometry;
  const x = ((geom.x ?? 0) + (geom.width ?? 0) / 2 - canvasW / 2) * scale;
  const z = ((geom.y ?? 0) + (geom.height ?? 0) / 2 - canvasH / 2) * scale;
  const w = (geom.width ?? 20) * scale;
  const d = (geom.height ?? 20) * scale;

  const furnitureType = (obj.metadata as Record<string, unknown>)?.furnitureType as string | undefined;
  const h = getFurnitureHeight(furnitureType ?? 'default');

  const isPlant = furnitureType === 'plant' || furnitureType === 'plant-large';
  const isRound = furnitureType === 'table-round' || isPlant;
  const isChair = furnitureType === 'lounge-chair' || furnitureType === 'sofa' || furnitureType === 'bench';

  const color = isPlant ? '#4ade80' : isChair ? '#a78bfa' : '#94a3b8';

  const material = useMemo(
    () => new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.55 }),
    [color],
  );

  if (isPlant) {
    const r = Math.max(w, d) / 2;
    return (
      <group position={[x, 0, z]}>
        {/* Pot */}
        <mesh position={[0, 0.03, 0]} material={material}>
          <cylinderGeometry args={[r * 0.7, r * 0.9, 0.06, 10]} />
        </mesh>
        {/* Foliage */}
        <mesh position={[0, h * 0.6, 0]}>
          <sphereGeometry args={[r * 1.2, 8, 8]} />
          <meshLambertMaterial color="#22c55e" transparent opacity={0.5} />
        </mesh>
      </group>
    );
  }

  if (isRound) {
    const r = Math.max(w, d) / 2;
    return (
      <mesh position={[x, h / 2, z]} material={material}>
        <cylinderGeometry args={[r, r, h, 16]} />
      </mesh>
    );
  }

  return (
    <mesh position={[x, h / 2, z]} material={material}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}
