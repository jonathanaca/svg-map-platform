import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { MapObject } from '@svg-map/types';

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

  // Key the entire render by furnitureType + position so R3F fully recreates meshes on type change
  return <group key={`${furnitureType}-${x}-${z}-${w}-${d}`}><FurnitureMeshInner x={x} z={z} w={w} d={d} furnitureType={furnitureType} /></group>;
}

function FurnitureMeshInner({ x, z, w, d, furnitureType }: { x: number; z: number; w: number; d: number; furnitureType?: string }) {
  // ── Plant ──
  if (furnitureType === 'plant' || furnitureType === 'plant-large') {
    const r = Math.max(w, d) / 2;
    const tall = furnitureType === 'plant-large';
    const potH = tall ? 0.08 : 0.05;
    const trunkH = tall ? 0.15 : 0.08;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, potH / 2, 0]}>
          <cylinderGeometry args={[r * 0.5, r * 0.65, potH, 8]} />
          <meshLambertMaterial color="#8B6914" />
        </mesh>
        <mesh position={[0, potH, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r * 0.48, 8]} />
          <meshLambertMaterial color="#3E2723" />
        </mesh>
        <mesh position={[0, potH + trunkH / 2, 0]}>
          <cylinderGeometry args={[0.008, 0.01, trunkH, 5]} />
          <meshLambertMaterial color="#5D4037" />
        </mesh>
        <mesh position={[0, potH + trunkH + r * 0.5, 0]}>
          <sphereGeometry args={[r * 0.8, 8, 6]} />
          <meshLambertMaterial color="#2E7D32" transparent opacity={0.8} />
        </mesh>
        <mesh position={[r * 0.3, potH + trunkH + r * 0.3, r * 0.2]}>
          <sphereGeometry args={[r * 0.5, 8, 6]} />
          <meshLambertMaterial color="#388E3C" transparent opacity={0.7} />
        </mesh>
      </group>
    );
  }

  // ── Round table ──
  if (furnitureType === 'table-round') {
    const r = Math.max(w, d) / 2;
    const legH = 0.1;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, legH / 2, 0]}>
          <cylinderGeometry args={[0.008, 0.015, legH, 6]} />
          <meshLambertMaterial color="#888888" />
        </mesh>
        <mesh position={[0, 0.004, 0]}>
          <cylinderGeometry args={[r * 0.4, r * 0.45, 0.006, 8]} />
          <meshLambertMaterial color="#777777" />
        </mesh>
        <mesh position={[0, legH + 0.003, 0]}>
          <cylinderGeometry args={[r, r, 0.005, 16]} />
          <meshLambertMaterial color="#d4c4a8" />
        </mesh>
      </group>
    );
  }

  // ── Conference table ──
  if (furnitureType === 'conference-table') {
    const legH = 0.1;
    const topH = 0.006;
    return (
      <group position={[x, 0, z]}>
        {[[-w * 0.35, -d * 0.3], [w * 0.35, -d * 0.3], [-w * 0.35, d * 0.3], [w * 0.35, d * 0.3]].map(([px, pz], i) => (
          <mesh key={i} position={[px, legH / 2, pz]}>
            <boxGeometry args={[0.012, legH, 0.012]} />
            <meshLambertMaterial color="#5D4037" />
          </mesh>
        ))}
        <mesh position={[0, legH + topH / 2, 0]}>
          <boxGeometry args={[w * 0.95, topH, d * 0.9]} />
          <meshLambertMaterial color="#6D4C41" />
        </mesh>
        {/* Center strip */}
        <mesh position={[0, legH + topH + 0.001, 0]}>
          <boxGeometry args={[w * 0.6, 0.001, d * 0.15]} />
          <meshLambertMaterial color="#8D6E63" />
        </mesh>
      </group>
    );
  }

  // ── Rectangular tables ──
  if (furnitureType?.startsWith('table-')) {
    const legH = 0.1;
    const lx = w * 0.42;
    const lz = d * 0.38;
    return (
      <group position={[x, 0, z]}>
        {[[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([px, pz], i) => (
          <mesh key={i} position={[px, legH / 2, pz]}>
            <boxGeometry args={[0.008, legH, 0.008]} />
            <meshLambertMaterial color="#888888" />
          </mesh>
        ))}
        <mesh position={[0, legH + 0.003, 0]}>
          <boxGeometry args={[w * 0.95, 0.005, d * 0.9]} />
          <meshLambertMaterial color="#d4c4a8" />
        </mesh>
      </group>
    );
  }

  // ── Sofa ──
  if (furnitureType === 'sofa' || furnitureType === 'lounge-chair') {
    const seatH = 0.06;
    const backH = 0.08;
    const cushionW = furnitureType === 'sofa' ? w * 0.9 : w * 0.85;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, seatH / 2, 0]}>
          <boxGeometry args={[cushionW, seatH, d * 0.7]} />
          <meshLambertMaterial color="#5C6BC0" />
        </mesh>
        <mesh position={[0, seatH + backH / 2, -d * 0.38]}>
          <boxGeometry args={[cushionW, backH, d * 0.15]} />
          <meshLambertMaterial color="#3F51B5" />
        </mesh>
        <mesh position={[-cushionW / 2 - w * 0.04, seatH / 2 + 0.025, 0]}>
          <boxGeometry args={[w * 0.08, 0.05, d * 0.65]} />
          <meshLambertMaterial color="#3F51B5" />
        </mesh>
        <mesh position={[cushionW / 2 + w * 0.04, seatH / 2 + 0.025, 0]}>
          <boxGeometry args={[w * 0.08, 0.05, d * 0.65]} />
          <meshLambertMaterial color="#3F51B5" />
        </mesh>
      </group>
    );
  }

  // ── Bench ──
  if (furnitureType === 'bench') {
    const legH = 0.07;
    return (
      <group position={[x, 0, z]}>
        {[[-w * 0.38, -d * 0.3], [w * 0.38, -d * 0.3], [-w * 0.38, d * 0.3], [w * 0.38, d * 0.3]].map(([px, pz], i) => (
          <mesh key={i} position={[px, legH / 2, pz]}>
            <boxGeometry args={[0.008, legH, 0.008]} />
            <meshLambertMaterial color="#888888" />
          </mesh>
        ))}
        <mesh position={[0, legH + 0.02, 0]}>
          <boxGeometry args={[w * 0.9, 0.04, d * 0.75]} />
          <meshLambertMaterial color="#8D6E63" />
        </mesh>
      </group>
    );
  }

  // ── Office Chair ──
  if (furnitureType === 'chair-office') {
    const seatW = Math.min(w, d) * 0.8;
    const legH = 0.06;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.006, 0]}>
          <cylinderGeometry args={[seatW * 0.45, seatW * 0.5, 0.005, 8]} />
          <meshLambertMaterial color="#555555" />
        </mesh>
        <mesh position={[0, legH / 2 + 0.006, 0]}>
          <cylinderGeometry args={[0.004, 0.005, legH, 6]} />
          <meshLambertMaterial color="#888888" />
        </mesh>
        <mesh position={[0, legH + 0.01, 0]}>
          <boxGeometry args={[seatW, 0.004, seatW]} />
          <meshLambertMaterial color="#2a2a2a" />
        </mesh>
        <mesh position={[0, legH + 0.04, -seatW * 0.45]}>
          <boxGeometry args={[seatW * 0.9, 0.06, 0.005]} />
          <meshLambertMaterial color="#2a2a2a" />
        </mesh>
      </group>
    );
  }

  // ── Phone booth ──
  if (furnitureType === 'phone-booth') {
    const wallH = 0.3;
    const wallT = 0.005;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.002, 0]}>
          <boxGeometry args={[w * 0.95, 0.004, d * 0.95]} />
          <meshLambertMaterial color="#455A64" />
        </mesh>
        <mesh position={[0, wallH / 2, -d * 0.47]}>
          <boxGeometry args={[w * 0.95, wallH, wallT]} />
          <meshLambertMaterial color="#37474F" transparent opacity={0.85} />
        </mesh>
        <mesh position={[-w * 0.47, wallH / 2, 0]}>
          <boxGeometry args={[wallT, wallH, d * 0.95]} />
          <meshLambertMaterial color="#37474F" transparent opacity={0.85} />
        </mesh>
        <mesh position={[w * 0.47, wallH / 2, 0]}>
          <boxGeometry args={[wallT, wallH, d * 0.95]} />
          <meshLambertMaterial color="#37474F" transparent opacity={0.85} />
        </mesh>
      </group>
    );
  }

  // ── Whiteboard ──
  if (furnitureType === 'whiteboard') {
    const standH = 0.15;
    const boardH = 0.12;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, standH / 2, 0]}>
          <cylinderGeometry args={[0.006, 0.01, standH, 6]} />
          <meshLambertMaterial color="#666666" />
        </mesh>
        <mesh position={[0, 0.004, 0]}>
          <boxGeometry args={[w * 0.3, 0.006, d * 0.4]} />
          <meshLambertMaterial color="#555555" />
        </mesh>
        <mesh position={[0, standH + boardH / 2, 0]}>
          <boxGeometry args={[w * 0.9, boardH, 0.005]} />
          <meshLambertMaterial color="#f5f5f5" />
        </mesh>
      </group>
    );
  }

  // ── TV/Screen ──
  if (furnitureType === 'tv-screen' || furnitureType === 'monitor-arm') {
    const standH = furnitureType === 'monitor-arm' ? 0.08 : 0.15;
    const screenH = furnitureType === 'monitor-arm' ? 0.06 : 0.12;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, standH / 2, 0]}>
          <cylinderGeometry args={[0.005, 0.008, standH, 6]} />
          <meshLambertMaterial color="#666666" />
        </mesh>
        <mesh position={[0, 0.003, 0]}>
          <boxGeometry args={[w * 0.25, 0.005, d * 0.3]} />
          <meshLambertMaterial color="#444444" />
        </mesh>
        <mesh position={[0, standH + screenH / 2, 0]}>
          <boxGeometry args={[w * 0.9, screenH, 0.004]} />
          <meshLambertMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, standH + screenH / 2, 0.003]}>
          <boxGeometry args={[w * 0.82, screenH * 0.85, 0.001]} />
          <meshLambertMaterial color="#1565C0" emissive="#0D47A1" emissiveIntensity={0.15} />
        </mesh>
      </group>
    );
  }

  // ── Bookshelf ──
  if (furnitureType === 'bookshelf') {
    const h = 0.2;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w * 0.9, h, d * 0.85]} />
          <meshLambertMaterial color="#795548" />
        </mesh>
        {[0.33, 0.66].map((frac, i) => (
          <mesh key={i} position={[0, h * frac, d * 0.43]}>
            <boxGeometry args={[w * 0.88, 0.003, 0.002]} />
            <meshLambertMaterial color="#5D4037" />
          </mesh>
        ))}
      </group>
    );
  }

  // ── Filing cabinet ──
  if (furnitureType === 'filing-cabinet') {
    const h = 0.15;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w * 0.9, h, d * 0.85]} />
          <meshLambertMaterial color="#78909C" />
        </mesh>
        {[0.25, 0.5, 0.75].map((frac, i) => (
          <mesh key={i} position={[0, h * frac, d * 0.43]}>
            <boxGeometry args={[w * 0.7, 0.002, 0.002]} />
            <meshLambertMaterial color="#546E7A" />
          </mesh>
        ))}
        {[0.25, 0.5, 0.75].map((frac, i) => (
          <mesh key={`k${i}`} position={[0, h * frac, d * 0.44]}>
            <sphereGeometry args={[0.004, 6, 6]} />
            <meshLambertMaterial color="#B0BEC5" />
          </mesh>
        ))}
      </group>
    );
  }

  // ── Lockers / Locker Unit ──
  if (furnitureType === 'lockers' || furnitureType === 'locker-unit') {
    const h = 0.22;
    const cols = furnitureType === 'locker-unit' ? 3 : 2;
    const colW = (w * 0.9) / cols;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w * 0.95, h, d * 0.9]} />
          <meshLambertMaterial color="#607D8B" />
        </mesh>
        {/* Door lines */}
        {Array.from({ length: cols - 1 }).map((_, i) => (
          <mesh key={i} position={[-w * 0.45 + colW * (i + 1), h / 2, d * 0.46]}>
            <boxGeometry args={[0.002, h * 0.9, 0.001]} />
            <meshLambertMaterial color="#455A64" />
          </mesh>
        ))}
        {/* Horizontal divider */}
        <mesh position={[0, h / 2, d * 0.46]}>
          <boxGeometry args={[w * 0.93, 0.002, 0.001]} />
          <meshLambertMaterial color="#455A64" />
        </mesh>
        {/* Handles */}
        {Array.from({ length: cols }).map((_, i) => (
          <mesh key={`h${i}`} position={[-w * 0.45 + colW * (i + 0.5), h * 0.35, d * 0.46]}>
            <sphereGeometry args={[0.005, 6, 6]} />
            <meshLambertMaterial color="#B0BEC5" />
          </mesh>
        ))}
      </group>
    );
  }

  // ── Printer ──
  if (furnitureType === 'printer') {
    const h = 0.08;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w * 0.9, h, d * 0.85]} />
          <meshLambertMaterial color="#455A64" />
        </mesh>
        {/* Paper tray */}
        <mesh position={[0, h + 0.005, -d * 0.15]}>
          <boxGeometry args={[w * 0.6, 0.008, d * 0.35]} />
          <meshLambertMaterial color="#f5f5f5" />
        </mesh>
        {/* Output tray */}
        <mesh position={[0, h * 0.4, d * 0.45]}>
          <boxGeometry args={[w * 0.6, 0.004, d * 0.15]} />
          <meshLambertMaterial color="#37474F" />
        </mesh>
      </group>
    );
  }

  // ── Partition ──
  if (furnitureType === 'partition') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[w * 0.95, 0.24, 0.005]} />
          <meshLambertMaterial color="#B0BEC5" transparent opacity={0.7} />
        </mesh>
      </group>
    );
  }

  // ── Bin / Recycling ──
  if (furnitureType === 'bin' || furnitureType === 'recycling') {
    const r = Math.max(w, d) / 2;
    const h = 0.06;
    const color = furnitureType === 'recycling' ? '#2E7D32' : '#616161';
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}>
          <cylinderGeometry args={[r * 0.65, r * 0.75, h, 8]} />
          <meshLambertMaterial color={color} />
        </mesh>
        <mesh position={[0, h, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r * 0.4, r * 0.65, 8]} />
          <meshLambertMaterial color={color} />
        </mesh>
      </group>
    );
  }

  // ── Standing desk ──
  if (furnitureType === 'standing-desk') {
    const legH = 0.16;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[-w * 0.4, legH / 2, 0]}>
          <boxGeometry args={[0.008, legH, 0.008]} />
          <meshLambertMaterial color="#666666" />
        </mesh>
        <mesh position={[w * 0.4, legH / 2, 0]}>
          <boxGeometry args={[0.008, legH, 0.008]} />
          <meshLambertMaterial color="#666666" />
        </mesh>
        <mesh position={[0, legH + 0.003, 0]}>
          <boxGeometry args={[w * 0.95, 0.005, d * 0.9]} />
          <meshLambertMaterial color="#e0e0e0" />
        </mesh>
      </group>
    );
  }

  // ── Coat rack ──
  if (furnitureType === 'coat-rack') {
    const h = 0.2;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.004, 0]}>
          <cylinderGeometry args={[w * 0.35, w * 0.4, 0.006, 8]} />
          <meshLambertMaterial color="#5D4037" />
        </mesh>
        <mesh position={[0, h / 2, 0]}>
          <cylinderGeometry args={[0.006, 0.006, h, 6]} />
          <meshLambertMaterial color="#795548" />
        </mesh>
        {[0, 1.57, 3.14, 4.71].map((angle, i) => (
          <mesh key={i} position={[Math.cos(angle) * w * 0.25, h * 0.85, Math.sin(angle) * w * 0.25]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[w * 0.15, 0.005, 0.005]} />
            <meshLambertMaterial color="#795548" />
          </mesh>
        ))}
      </group>
    );
  }

  // ── Water cooler ──
  if (furnitureType === 'water-cooler') {
    const h = 0.15;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w * 0.7, h, d * 0.7]} />
          <meshLambertMaterial color="#e0e0e0" />
        </mesh>
        {/* Water bottle */}
        <mesh position={[0, h + 0.04, 0]}>
          <cylinderGeometry args={[w * 0.15, w * 0.2, 0.08, 8]} />
          <meshLambertMaterial color="#B3E5FC" transparent opacity={0.6} />
        </mesh>
        {/* Tap */}
        <mesh position={[0, h * 0.4, d * 0.36]}>
          <boxGeometry args={[0.01, 0.02, 0.01]} />
          <meshLambertMaterial color="#90A4AE" />
        </mesh>
      </group>
    );
  }

  // ── Fire extinguisher ──
  if (furnitureType === 'fire-extinguisher') {
    const h = 0.1;
    const r = Math.min(w, d) * 0.3;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}>
          <cylinderGeometry args={[r, r * 1.1, h, 8]} />
          <meshLambertMaterial color="#D32F2F" />
        </mesh>
        <mesh position={[0, h + 0.01, 0]}>
          <cylinderGeometry args={[r * 0.4, r * 0.5, 0.02, 6]} />
          <meshLambertMaterial color="#424242" />
        </mesh>
        <mesh position={[r * 0.3, h + 0.02, 0]}>
          <boxGeometry args={[r * 0.3, 0.005, 0.005]} />
          <meshLambertMaterial color="#212121" />
        </mesh>
      </group>
    );
  }

  // ── Umbrella stand ──
  if (furnitureType === 'umbrella-stand') {
    const r = Math.max(w, d) / 2;
    const h = 0.08;
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}>
          <cylinderGeometry args={[r * 0.5, r * 0.6, h, 8]} />
          <meshLambertMaterial color="#5D4037" />
        </mesh>
        <mesh position={[0, h, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r * 0.2, r * 0.5, 8]} />
          <meshLambertMaterial color="#4E342E" />
        </mesh>
      </group>
    );
  }

  // ── Desk pod / desk pair ──
  if (furnitureType === 'desk-pod' || furnitureType === 'desk-pair') {
    const legH = 0.1;
    return (
      <group position={[x, 0, z]}>
        {[[-w * 0.45, -d * 0.42], [w * 0.45, -d * 0.42], [-w * 0.45, d * 0.42], [w * 0.45, d * 0.42]].map(([px, pz], i) => (
          <mesh key={i} position={[px, legH / 2, pz]}>
            <boxGeometry args={[0.008, legH, 0.008]} />
            <meshLambertMaterial color="#888888" />
          </mesh>
        ))}
        <mesh position={[0, legH + 0.003, 0]}>
          <boxGeometry args={[w * 0.95, 0.005, d * 0.9]} />
          <meshLambertMaterial color="#d4c4a8" />
        </mesh>
        {/* Divider line */}
        <mesh position={[0, legH + 0.007, 0]}>
          <boxGeometry args={[w * 0.93, 0.002, 0.003]} />
          <meshLambertMaterial color="#bbb" />
        </mesh>
      </group>
    );
  }

  // ── Default: simple colored box ──
  return (
    <mesh position={[x, 0.04, z]}>
      <boxGeometry args={[w * 0.9, 0.08, d * 0.9]} />
      <meshLambertMaterial color="#94a3b8" transparent opacity={0.5} />
    </mesh>
  );
}
