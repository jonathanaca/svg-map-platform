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
  const topColor = statusColor ?? '#e2e8f0';
  const sideColor = statusColor ? darkenColor(statusColor, 0.65) : '#78859b';

  const materials = useMemo(() => [
    new THREE.MeshLambertMaterial({ color: sideColor, transparent: true, opacity: 0.75 }),
    new THREE.MeshLambertMaterial({ color: topColor, transparent: true, opacity: 0.55 }),
  ], [topColor, sideColor]);

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

  const isRoom = obj.object_type === 'room';
  const pinColor = statusColor ?? '#94a3b8';
  const pinHeight = height + 0.6;
  const stemHeight = 0.4;

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

      {/* Pin with room name */}
      {isRoom && obj.label && (
        <group position={[cx, 0, cz]}>
          {/* Pin stem */}
          <mesh position={[0, height + stemHeight / 2, 0]}>
            <cylinderGeometry args={[0.01, 0.01, stemHeight, 4]} />
            <meshBasicMaterial color={pinColor} opacity={0.6} transparent />
          </mesh>
          {/* Pin dot */}
          <mesh position={[0, pinHeight, 0]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshLambertMaterial color={pinColor} emissive={pinColor} emissiveIntensity={0.2} />
          </mesh>
          {/* Label */}
          <Html position={[0, pinHeight + 0.15, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(255,255,255,0.94)',
              color: '#1e293b',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
              borderBottom: `2px solid ${pinColor}`,
              letterSpacing: '-0.2px',
            }}>
              {obj.label}
              {state && (
                <span style={{
                  display: 'inline-block',
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: pinColor,
                  marginLeft: 5,
                  verticalAlign: 'middle',
                }} />
              )}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
