import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { MapObject, AvailabilityState } from '@svg-map/types';
import { buildExtrudedGeometry, getExtrusionHeight, buildShapeFromRect, buildShapeFromPolygon } from '../../lib/isometricGeometry.js';
import { getAvailabilityColor, darkenColor } from '../../lib/availabilityColors.js';

interface Props {
  obj: MapObject;
  canvasW: number;
  canvasH: number;
  scale: number;
  state?: AvailabilityState;
}

export default function RoomMesh({ obj, canvasW, canvasH, scale, state }: Props) {
  const geometry = useMemo(
    () => buildExtrudedGeometry(obj, canvasW, canvasH, scale),
    [obj, canvasW, canvasH, scale],
  );

  const height = getExtrusionHeight(obj.object_type);
  const statusColor = state ? getAvailabilityColor(state) : null;
  const wallColor = '#94a3b8';
  const topColor = statusColor ?? '#e2e8f0';
  const sideColor = statusColor ? darkenColor(statusColor, 0.65) : '#78859b';

  // Wall materials: sides = wall grey or darkened status, top = status colour or light
  const materials = useMemo(() => [
    new THREE.MeshLambertMaterial({ color: sideColor, transparent: true, opacity: 0.75 }),
    new THREE.MeshLambertMaterial({ color: topColor, transparent: true, opacity: 0.55 }),
  ], [topColor, sideColor]);

  // Floor fill inside the room (flat coloured plane at ground level)
  const floorGeometry = useMemo(() => {
    const geom = obj.geometry;
    if (geom.type === 'rect') {
      const shape = buildShapeFromRect(geom.x ?? 0, geom.y ?? 0, geom.width ?? 50, geom.height ?? 50, canvasW, canvasH, scale);
      return new THREE.ShapeGeometry(shape);
    }
    if (geom.type === 'polygon' && geom.points && geom.points.length >= 3) {
      const shape = buildShapeFromPolygon(geom.points, canvasW, canvasH, scale);
      return new THREE.ShapeGeometry(shape);
    }
    return null;
  }, [obj, canvasW, canvasH, scale]);

  if (!geometry) return null;

  const geom = obj.geometry;
  const cx = ((geom.x ?? 0) + (geom.width ?? 0) / 2 - canvasW / 2) * scale;
  const cz = ((geom.y ?? 0) + (geom.height ?? 0) / 2 - canvasH / 2) * scale;

  const showLabel = obj.object_type === 'room' && obj.label;

  return (
    <group>
      {/* Room floor fill */}
      {floorGeometry && (
        <mesh geometry={floorGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <meshLambertMaterial color={statusColor ?? '#f1f5f9'} transparent opacity={0.35} />
        </mesh>
      )}
      {/* Extruded walls */}
      <mesh geometry={geometry} material={materials} rotation={[-Math.PI / 2, 0, 0]} />
      {/* Top edge highlight */}
      {showLabel && (
        <Html position={[cx, height + 0.12, cz]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(255,255,255,0.9)',
            color: '#334155',
            padding: '2px 7px',
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 600,
            fontFamily: '-apple-system, sans-serif',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            borderLeft: `2px solid ${statusColor ?? '#94a3b8'}`,
          }}>
            {obj.label}
          </div>
        </Html>
      )}
    </group>
  );
}
