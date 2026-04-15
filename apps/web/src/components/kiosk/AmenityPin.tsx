import React from 'react';
import { Html } from '@react-three/drei';
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

  const iconId = (obj.metadata as Record<string, unknown>)?.icon as string | undefined;
  const label = obj.label || iconId?.replace(/-/g, ' ') || 'Amenity';

  return (
    <group position={[x, 0, z]}>
      {/* Glow ring on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.08, 0.14, 16]} />
        <meshBasicMaterial color="#58a6ff" transparent opacity={0.6} />
      </mesh>
      {/* Pin stem */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.8, 6]} />
        <meshBasicMaterial color="#58a6ff" transparent opacity={0.4} />
      </mesh>
      {/* Pin head */}
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color="#58a6ff" />
      </mesh>
      {/* Label */}
      <Html position={[0, 1.1, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: '#1e293b',
          color: '#f1f5f9',
          padding: '4px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          fontFamily: '-apple-system, sans-serif',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
          border: '1px solid #334155',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}
