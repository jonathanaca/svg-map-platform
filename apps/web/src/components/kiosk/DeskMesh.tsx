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

  const color = state ? getAvailabilityColor(state) : '#4CAF50';
  const darkColor = state ? new THREE.Color(color).multiplyScalar(0.6).getStyle() : '#5a6a8a';

  // Desk dimensions
  const tableH = 0.005;   // tabletop thickness
  const legH = 0.12;      // leg height
  const legW = 0.008;     // leg thickness
  const tableY = legH;    // tabletop sits on top of legs

  // Monitor
  const monW = w * 0.35;
  const monH = 0.06;
  const monD = 0.004;
  const monBaseW = 0.015;
  const monBaseD = 0.012;

  // Keyboard
  const kbW = w * 0.3;
  const kbD = d * 0.15;
  const kbH = 0.003;

  // Chair
  const chairSeatW = Math.min(w * 0.3, d * 0.35);
  const chairSeatD = chairSeatW;
  const chairSeatH = 0.004;
  const chairLegH = 0.08;
  const chairBackH = 0.06;

  const legOffX = w * 0.45;
  const legOffZ = d * 0.42;

  const tableMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color }),
    [color],
  );
  const legMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#888888' }),
    [],
  );
  const monMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#222222' }),
    [],
  );
  const screenMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#4a90d9', emissive: '#1a3a5c', emissiveIntensity: 0.3 }),
    [],
  );
  const kbMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#333333' }),
    [],
  );
  const chairMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#2a2a2a' }),
    [],
  );
  const chairBaseMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#555555' }),
    [],
  );
  // Status indicator — colored strip on desk edge
  const statusMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.15 }),
    [color],
  );

  return (
    <group position={[x, 0, z]}>
      {/* Tabletop */}
      <mesh position={[0, tableY + tableH / 2, 0]} material={tableMat}>
        <boxGeometry args={[w * 0.95, tableH, d * 0.9]} />
      </mesh>

      {/* 4 legs */}
      {[[-legOffX, -legOffZ], [legOffX, -legOffZ], [-legOffX, legOffZ], [legOffX, legOffZ]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, legH / 2, lz]} material={legMat}>
          <boxGeometry args={[legW, legH, legW]} />
        </mesh>
      ))}

      {/* Monitor stand base */}
      <mesh position={[0, tableY + tableH + 0.002, -d * 0.25]} material={monMat}>
        <boxGeometry args={[monBaseW, 0.003, monBaseD]} />
      </mesh>
      {/* Monitor stand neck */}
      <mesh position={[0, tableY + tableH + 0.02, -d * 0.25]} material={legMat}>
        <cylinderGeometry args={[0.003, 0.003, 0.03, 6]} />
      </mesh>
      {/* Monitor frame */}
      <mesh position={[0, tableY + tableH + monH / 2 + 0.035, -d * 0.25]} material={monMat}>
        <boxGeometry args={[monW, monH, monD]} />
      </mesh>
      {/* Monitor screen */}
      <mesh position={[0, tableY + tableH + monH / 2 + 0.035, -d * 0.25 + monD / 2 + 0.001]} material={screenMat}>
        <boxGeometry args={[monW * 0.9, monH * 0.85, 0.001]} />
      </mesh>

      {/* Keyboard */}
      <mesh position={[0, tableY + tableH + kbH / 2 + 0.001, d * 0.05]} material={kbMat}>
        <boxGeometry args={[kbW, kbH, kbD]} />
      </mesh>

      {/* Mouse */}
      <mesh position={[kbW * 0.7, tableY + tableH + 0.002, d * 0.08]} material={kbMat}>
        <boxGeometry args={[0.008, 0.003, 0.012]} />
      </mesh>

      {/* Office chair — positioned in front of desk */}
      <group position={[0, 0, d * 0.65]}>
        {/* Chair base (5-star) */}
        <mesh position={[0, 0.008, 0]} material={chairBaseMat}>
          <cylinderGeometry args={[chairSeatW * 0.45, chairSeatW * 0.5, 0.006, 8]} />
        </mesh>
        {/* Chair hydraulic cylinder */}
        <mesh position={[0, chairLegH / 2 + 0.008, 0]} material={legMat}>
          <cylinderGeometry args={[0.004, 0.005, chairLegH, 6]} />
        </mesh>
        {/* Seat cushion */}
        <mesh position={[0, chairLegH + chairSeatH / 2 + 0.008, 0]} material={chairMat}>
          <boxGeometry args={[chairSeatW, chairSeatH, chairSeatD]} />
        </mesh>
        {/* Backrest — facing the desk */}
        <mesh position={[0, chairLegH + chairSeatH + chairBackH / 2 + 0.008, chairSeatD * 0.45]} material={chairMat}>
          <boxGeometry args={[chairSeatW * 0.9, chairBackH, 0.005]} />
        </mesh>
      </group>
    </group>
  );
}
