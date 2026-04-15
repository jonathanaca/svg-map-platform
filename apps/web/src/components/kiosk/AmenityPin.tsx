import React from 'react';
import type { MapObject } from '@svg-map/types';

interface Props {
  obj: MapObject;
  canvasW: number;
  canvasH: number;
  scale: number;
}

export default function AmenityPin({ obj, canvasW, canvasH, scale }: Props) {
  const geom = obj.geometry;
  const x = ((geom.x ?? 0) - canvasW / 2) * scale;
  const z = ((geom.y ?? 0) - canvasH / 2) * scale;

  return (
    <mesh position={[x, 0.08, z]}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshLambertMaterial color="#3b82f6" transparent opacity={0.7} />
    </mesh>
  );
}
