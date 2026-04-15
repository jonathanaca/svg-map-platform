import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import type { Floorplan } from '@svg-map/types';

interface Props {
  floorplan: Floorplan;
  scale: number;
}

export default function IsometricFloor({ floorplan, scale }: Props) {
  const w = (floorplan.canvas_width ?? 1000) * scale;
  const h = (floorplan.canvas_height ?? 800) * scale;

  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      `/api/floorplans/${floorplan.id}/source-preview`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => setTexture(null), // fail silently
    );
  }, [floorplan.id]);

  const material = useMemo(() => {
    if (texture) {
      return new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
    }
    return new THREE.MeshBasicMaterial({
      color: '#e2e8f0',
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
  }, [texture]);

  return (
    <group>
      {/* Floor base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[w + 0.3, h + 0.3]} />
        <meshBasicMaterial color="#cbd5e1" side={THREE.DoubleSide} />
      </mesh>
      {/* Floor surface with texture */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow material={material}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}
