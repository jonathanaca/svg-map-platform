import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Floorplan, MapObject, AvailabilityState } from '@svg-map/types';
import IsometricFloor from './IsometricFloor.js';
import RoomMesh from './RoomMesh.js';
import DeskMesh from './DeskMesh.js';
import FurnitureMesh from './FurnitureMesh.js';
import WallMesh from './WallMesh.js';
import AmenityPin from './AmenityPin.js';

interface Props {
  floorplan: Floorplan;
  objects: MapObject[];
  availability: Record<string, AvailabilityState>;
}

const SCALE = 0.01;

function CameraSetup({ canvasW, canvasH }: { canvasW: number; canvasH: number }) {
  const { camera, size } = useThree();
  const maxDim = Math.max(canvasW, canvasH) * SCALE;

  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      const aspect = size.width / size.height;
      const frustum = maxDim * 0.7;
      camera.left = -frustum * aspect;
      camera.right = frustum * aspect;
      camera.top = frustum;
      camera.bottom = -frustum;
      camera.position.set(10, 14, 10);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
  }, [camera, size, maxDim]);

  return null;
}

export default function IsometricScene({ floorplan, objects, availability }: Props) {
  const canvasW = floorplan.canvas_width ?? 1000;
  const canvasH = floorplan.canvas_height ?? 800;

  const visibleObjects = objects.filter(o => o.visible);

  return (
    <Canvas
      orthographic
      camera={{ position: [10, 14, 10], zoom: 1, near: 0.1, far: 500 }}
      style={{ background: '#0f1419' }}
      gl={{ antialias: true }}
    >
      <CameraSetup canvasW={canvasW} canvasH={canvasH} />
      <OrbitControls
        enableRotate={true}
        enablePan={true}
        enableZoom={true}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={0.2}
        dampingFactor={0.1}
        enableDamping
      />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <directionalLight position={[-3, 6, -3]} intensity={0.3} />

      <IsometricFloor floorplan={floorplan} scale={SCALE} />

      {visibleObjects.map((obj) => {
        const state = availability[obj.id];
        switch (obj.object_type) {
          case 'room':
          case 'zone':
          case 'area':
          case 'parking':
          case 'locker':
            return (
              <RoomMesh
                key={obj.id}
                obj={obj}
                canvasW={canvasW}
                canvasH={canvasH}
                scale={SCALE}
                state={state}
              />
            );
          case 'desk':
            return (
              <DeskMesh
                key={obj.id}
                obj={obj}
                canvasW={canvasW}
                canvasH={canvasH}
                scale={SCALE}
                state={state}
              />
            );
          case 'decorative':
            // Walls get extruded 3D walls, furniture gets furniture mesh
            if (obj.layer === 'walls') {
              return (
                <WallMesh
                  key={obj.id}
                  obj={obj}
                  canvasW={canvasW}
                  canvasH={canvasH}
                  scale={SCALE}
                />
              );
            }
            return (
              <FurnitureMesh
                key={obj.id}
                obj={obj}
                canvasW={canvasW}
                canvasH={canvasH}
                scale={SCALE}
              />
            );
          case 'amenity':
            return (
              <AmenityPin
                key={obj.id}
                obj={obj}
                canvasW={canvasW}
                canvasH={canvasH}
                scale={SCALE}
              />
            );
          default:
            return null;
        }
      })}
    </Canvas>
  );
}
