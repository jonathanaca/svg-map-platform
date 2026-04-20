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
  const topColor = statusColor ?? '#64748b';
  const sideColor = statusColor ? darkenColor(statusColor, 0.7) : '#475569';

  const materials = useMemo(() => [
    new THREE.MeshLambertMaterial({ color: sideColor, transparent: true, opacity: 0.9 }),
    new THREE.MeshLambertMaterial({ color: topColor, transparent: true, opacity: 0.45 }),
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

  // Wall outline around room edges
  const wallOutlineGeometry = useMemo(() => {
    const geom = obj.geometry;
    const points: THREE.Vector3[] = [];
    if (geom.type === 'rect') {
      const x = (geom.x ?? 0), y = (geom.y ?? 0), w = (geom.width ?? 50), h = (geom.height ?? 50);
      const corners = [
        { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y },
      ];
      corners.forEach(p => {
        const wx = (p.x - canvasW / 2) * scale;
        const wz = (p.y - canvasH / 2) * scale;
        points.push(new THREE.Vector3(wx, height + 0.01, wz));
      });
    } else if (geom.type === 'polygon' && geom.points && geom.points.length >= 3) {
      geom.points.forEach(p => {
        const wx = (p.x - canvasW / 2) * scale;
        const wz = (p.y - canvasH / 2) * scale;
        points.push(new THREE.Vector3(wx, height + 0.01, wz));
      });
      // Close the loop
      const first = geom.points[0];
      points.push(new THREE.Vector3((first.x - canvasW / 2) * scale, height + 0.01, (first.y - canvasH / 2) * scale));
    }
    if (points.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [obj, canvasW, canvasH, scale, height]);

  if (!geometry) return null;

  const geom = obj.geometry;
  const cx = ((geom.x ?? 0) + (geom.width ?? 0) / 2 - canvasW / 2) * scale;
  const cz = ((geom.y ?? 0) + (geom.height ?? 0) / 2 - canvasH / 2) * scale;

  const isRoom = obj.object_type === 'room';
  const pinColor = statusColor ?? '#94a3b8';
  const pinHeight = height + 0.3;
  const stemHeight = 0.2;

  return (
    <group>
      {/* Room floor fill */}
      {floorGeometry && (
        <mesh geometry={floorGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <meshLambertMaterial color={statusColor ?? '#94a3b8'} transparent opacity={0.12} />
        </mesh>
      )}
      {/* Extruded walls */}
      <mesh geometry={geometry} material={materials} rotation={[-Math.PI / 2, 0, 0]} />

      {/* Wall outline around room */}
      {wallOutlineGeometry && (
        <line geometry={wallOutlineGeometry}>
          <lineBasicMaterial color="#1a1a1a" linewidth={2} />
        </line>
      )}

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
              background: 'rgba(22,27,34,0.9)',
              color: '#e6edf3',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
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
