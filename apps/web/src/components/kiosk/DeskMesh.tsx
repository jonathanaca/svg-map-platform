import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { MapObject, AvailabilityState } from '@svg-map/types';
import { getAvailabilityColor } from '../../lib/availabilityColors.js';

interface Props {
  obj: MapObject;
  canvasW: number;
  canvasH: number;
  scale: number;
  state?: AvailabilityState;
}

export default function DeskMesh({ obj, canvasW, canvasH, scale, state }: Props) {
  const geom = obj.geometry;
  const x = ((geom.x ?? 0) + (geom.width ?? 0) / 2 - canvasW / 2) * scale;
  const z = ((geom.y ?? 0) + (geom.height ?? 0) / 2 - canvasH / 2) * scale;
  const w = (geom.width ?? 30) * scale;
  const d = (geom.height ?? 20) * scale;

  const surfaceH = 0.04;
  const legH = 0.18;
  const legW = 0.015;

  const color = state ? getAvailabilityColor(state) : '#64748b';

  const surfaceMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.7 }),
    [color],
  );

  const legMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#94a3b8', transparent: true, opacity: 0.5 }),
    [],
  );

  const legOffX = w * 0.38;
  const legOffZ = d * 0.35;

  return (
    <group position={[x, 0, z]}>
      {/* Desk surface */}
      <mesh position={[0, legH + surfaceH / 2, 0]} material={surfaceMat}>
        <boxGeometry args={[w, surfaceH, d]} />
      </mesh>
      {/* 4 legs */}
      {[[-legOffX, -legOffZ], [legOffX, -legOffZ], [-legOffX, legOffZ], [legOffX, legOffZ]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, legH / 2, lz]} material={legMat}>
          <boxGeometry args={[legW, legH, legW]} />
        </mesh>
      ))}
      {/* Monitor hint — small thin box on top */}
      <mesh position={[0, legH + surfaceH + 0.025, -d * 0.2]}>
        <boxGeometry args={[w * 0.4, 0.05, 0.01]} />
        <meshLambertMaterial color="#475569" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}
