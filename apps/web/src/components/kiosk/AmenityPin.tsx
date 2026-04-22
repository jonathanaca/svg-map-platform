import React from 'react';
import { Html } from '@react-three/drei';
import type { MapObject } from '@svg-map/types';

interface Props {
  obj: MapObject;
  canvasW: number;
  canvasH: number;
  scale: number;
}

function getColor(iconId?: string): string {
  switch (iconId) {
    case 'cafe': case 'coffee': return '#8B4513';
    case 'male-restroom': case 'female-restroom': case 'accessible-restroom': return '#2196F3';
    case 'elevator': return '#9E9E9E';
    case 'staircase': return '#795548';
    case 'fire-exit': return '#F44336';
    case 'first-aid': case 'aed': return '#E53935';
    case 'reception': return '#9C27B0';
    case 'lockers': return '#607D8B';
    case 'presentation': return '#5C6BC0';
    case 'door': return '#8D6E63';
    case 'window': return '#64B5F6';
    case 'water-fountain': case 'shower': return '#03A9F4';
    case 'kitchen': return '#FF9800';
    case 'vending': return '#FF9800';
    case 'wifi': return '#00BCD4';
    case 'security-camera': return '#607D8B';
    case 'parking-spot': return '#3F51B5';
    case 'bike-rack': return '#3F51B5';
    case 'charging': return '#4CAF50';
    case 'mail': return '#9C27B0';
    case 'smoking': return '#78909C';
    case 'fire-extinguisher': return '#D32F2F';
    default: return '#58a6ff';
  }
}

export default function AmenityPin({ obj, canvasW, canvasH, scale }: Props) {
  const geom = obj.geometry;
  const x = ((geom.x ?? 0) - canvasW / 2) * scale;
  const z = ((geom.y ?? 0) - canvasH / 2) * scale;
  const iconId = (obj.metadata as Record<string, unknown>)?.icon as string | undefined;
  const label = obj.label || iconId?.replace(/-/g, ' ') || 'Amenity';
  const color = getColor(iconId);
  const s = 0.06; // base unit scale

  function renderAsset() {
    switch (iconId) {
      // ── Cafe / Coffee machine ──
      case 'cafe':
      case 'coffee':
        return (
          <group>
            {/* Counter */}
            <mesh position={[0, s * 1.2, 0]}>
              <boxGeometry args={[s * 3, s * 2.4, s * 2]} />
              <meshLambertMaterial color="#5D4037" />
            </mesh>
            {/* Coffee machine */}
            <mesh position={[0, s * 3, 0]}>
              <boxGeometry args={[s * 1.5, s * 1.2, s * 1.2]} />
              <meshLambertMaterial color="#212121" />
            </mesh>
            {/* Cup */}
            <mesh position={[s * 1, s * 2.6, s * 0.3]}>
              <cylinderGeometry args={[s * 0.25, s * 0.2, s * 0.5, 8]} />
              <meshLambertMaterial color="#FFFFFF" />
            </mesh>
          </group>
        );

      // ── Restrooms ──
      case 'male-restroom':
      case 'female-restroom':
      case 'accessible-restroom':
        return (
          <group>
            {/* Sign post */}
            <mesh position={[0, s * 2.5, 0]}>
              <cylinderGeometry args={[s * 0.1, s * 0.1, s * 5, 6]} />
              <meshLambertMaterial color="#BDBDBD" />
            </mesh>
            {/* Sign board */}
            <mesh position={[0, s * 5, 0]}>
              <boxGeometry args={[s * 2.5, s * 2, s * 0.15]} />
              <meshLambertMaterial color={color} />
            </mesh>
            {/* White icon circle */}
            <mesh position={[0, s * 5, s * 0.1]}>
              <circleGeometry args={[s * 0.6, 12]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
          </group>
        );

      // ── Elevator ──
      case 'elevator':
        return (
          <group>
            {/* Elevator box */}
            <mesh position={[0, s * 3, 0]}>
              <boxGeometry args={[s * 3, s * 6, s * 3]} />
              <meshLambertMaterial color="#BDBDBD" />
            </mesh>
            {/* Doors */}
            <mesh position={[-s * 0.5, s * 2.5, s * 1.51]}>
              <boxGeometry args={[s * 1.2, s * 4.5, s * 0.05]} />
              <meshLambertMaterial color="#90A4AE" />
            </mesh>
            <mesh position={[s * 0.5, s * 2.5, s * 1.51]}>
              <boxGeometry args={[s * 1.2, s * 4.5, s * 0.05]} />
              <meshLambertMaterial color="#90A4AE" />
            </mesh>
            {/* Indicator */}
            <mesh position={[0, s * 5.5, s * 1.52]}>
              <boxGeometry args={[s * 0.8, s * 0.3, s * 0.02]} />
              <meshLambertMaterial color="#4CAF50" emissive="#4CAF50" emissiveIntensity={0.3} />
            </mesh>
          </group>
        );

      // ── Staircase ──
      case 'staircase':
        return (
          <group>
            {[0, 1, 2, 3, 4].map(i => (
              <mesh key={i} position={[0, s * (i * 0.8 + 0.4), -s * i * 0.6]}>
                <boxGeometry args={[s * 3, s * 0.3, s * 1]} />
                <meshLambertMaterial color={i % 2 === 0 ? '#795548' : '#8D6E63'} />
              </mesh>
            ))}
            {/* Railing */}
            <mesh position={[s * 1.6, s * 2.5, -s * 1.2]}>
              <boxGeometry args={[s * 0.1, s * 4, s * 0.1]} />
              <meshLambertMaterial color="#9E9E9E" />
            </mesh>
          </group>
        );

      // ── Fire Exit ──
      case 'fire-exit':
        return (
          <group>
            {/* Door frame */}
            <mesh position={[0, s * 3, 0]}>
              <boxGeometry args={[s * 2.5, s * 5, s * 0.3]} />
              <meshLambertMaterial color="#795548" />
            </mesh>
            {/* Door */}
            <mesh position={[0, s * 2.5, s * 0.2]}>
              <boxGeometry args={[s * 2, s * 4.5, s * 0.15]} />
              <meshLambertMaterial color="#4CAF50" />
            </mesh>
            {/* Exit sign */}
            <mesh position={[0, s * 5.8, 0]}>
              <boxGeometry args={[s * 2, s * 0.6, s * 0.5]} />
              <meshLambertMaterial color="#F44336" emissive="#F44336" emissiveIntensity={0.3} />
            </mesh>
          </group>
        );

      // ── First Aid / AED ──
      case 'first-aid':
      case 'aed':
        return (
          <group>
            {/* Box on wall */}
            <mesh position={[0, s * 3, 0]}>
              <boxGeometry args={[s * 2.5, s * 2, s * 1]} />
              <meshLambertMaterial color={iconId === 'aed' ? '#4CAF50' : '#F44336'} />
            </mesh>
            {/* Cross */}
            <mesh position={[0, s * 3, s * 0.51]}>
              <boxGeometry args={[s * 1.2, s * 0.3, s * 0.02]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0, s * 3, s * 0.51]}>
              <boxGeometry args={[s * 0.3, s * 1.2, s * 0.02]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
          </group>
        );

      // ── Reception desk ──
      case 'reception':
        return (
          <group>
            {/* Desk - L shape */}
            <mesh position={[0, s * 1.5, 0]}>
              <boxGeometry args={[s * 4, s * 3, s * 1.5]} />
              <meshLambertMaterial color="#5D4037" />
            </mesh>
            {/* Top surface */}
            <mesh position={[0, s * 3.1, 0]}>
              <boxGeometry args={[s * 4.2, s * 0.15, s * 1.7]} />
              <meshLambertMaterial color="#4E342E" />
            </mesh>
            {/* Monitor */}
            <mesh position={[-s * 0.8, s * 4, -s * 0.3]}>
              <boxGeometry args={[s * 1.5, s * 1, s * 0.1]} />
              <meshLambertMaterial color="#212121" />
            </mesh>
          </group>
        );

      // ── Lockers ──
      case 'lockers':
        return (
          <group>
            {[-1, 0, 1].map(i => (
              <mesh key={i} position={[s * i * 1.2, s * 2.5, 0]}>
                <boxGeometry args={[s * 1.1, s * 5, s * 1.5]} />
                <meshLambertMaterial color="#607D8B" />
              </mesh>
            ))}
            {[-1, 0, 1].map(i => (
              <mesh key={`h${i}`} position={[s * i * 1.2, s * 2.5, s * 0.76]}>
                <sphereGeometry args={[s * 0.12, 6, 6]} />
                <meshLambertMaterial color="#B0BEC5" />
              </mesh>
            ))}
          </group>
        );

      // ── Door ──
      case 'door':
        return (
          <group>
            <mesh position={[0, s * 2.5, 0]}>
              <boxGeometry args={[s * 2.5, s * 5, s * 0.2]} />
              <meshLambertMaterial color="#8D6E63" />
            </mesh>
            <mesh position={[s * 0.8, s * 2.5, s * 0.12]}>
              <sphereGeometry args={[s * 0.15, 8, 8]} />
              <meshLambertMaterial color="#FDD835" />
            </mesh>
          </group>
        );

      // ── Window ──
      case 'window':
        return (
          <group>
            {/* Frame */}
            <mesh position={[0, s * 3.5, 0]}>
              <boxGeometry args={[s * 3, s * 2.5, s * 0.15]} />
              <meshLambertMaterial color="#FFFFFF" />
            </mesh>
            {/* Glass */}
            <mesh position={[0, s * 3.5, s * 0.02]}>
              <boxGeometry args={[s * 2.6, s * 2.1, s * 0.08]} />
              <meshLambertMaterial color="#B3E5FC" transparent opacity={0.4} />
            </mesh>
            {/* Cross divider */}
            <mesh position={[0, s * 3.5, s * 0.08]}>
              <boxGeometry args={[s * 2.6, s * 0.08, s * 0.03]} />
              <meshLambertMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0, s * 3.5, s * 0.08]}>
              <boxGeometry args={[s * 0.08, s * 2.1, s * 0.03]} />
              <meshLambertMaterial color="#FFFFFF" />
            </mesh>
          </group>
        );

      // ── Kitchen ──
      case 'kitchen':
        return (
          <group>
            {/* Counter */}
            <mesh position={[0, s * 1.5, 0]}>
              <boxGeometry args={[s * 4, s * 3, s * 2]} />
              <meshLambertMaterial color="#FAFAFA" />
            </mesh>
            {/* Stovetop circles */}
            {[[-s * 0.6, -s * 0.4], [s * 0.6, -s * 0.4], [-s * 0.6, s * 0.4], [s * 0.6, s * 0.4]].map(([bx, bz], i) => (
              <mesh key={i} position={[bx, s * 3.05, bz]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[s * 0.15, s * 0.25, 12]} />
                <meshLambertMaterial color="#424242" />
              </mesh>
            ))}
            {/* Sink */}
            <mesh position={[s * 1.5, s * 2.8, 0]}>
              <boxGeometry args={[s * 0.8, s * 0.4, s * 0.6]} />
              <meshLambertMaterial color="#B0BEC5" />
            </mesh>
          </group>
        );

      // ── Vending machine ──
      case 'vending':
        return (
          <group>
            <mesh position={[0, s * 3, 0]}>
              <boxGeometry args={[s * 2, s * 6, s * 1.5]} />
              <meshLambertMaterial color="#F44336" />
            </mesh>
            {/* Display window */}
            <mesh position={[0, s * 4, s * 0.76]}>
              <boxGeometry args={[s * 1.5, s * 2.5, s * 0.05]} />
              <meshLambertMaterial color="#212121" transparent opacity={0.7} />
            </mesh>
            {/* Dispensing slot */}
            <mesh position={[0, s * 1.2, s * 0.76]}>
              <boxGeometry args={[s * 1.2, s * 0.8, s * 0.05]} />
              <meshLambertMaterial color="#1a1a1a" />
            </mesh>
          </group>
        );

      // ── WiFi access point ──
      case 'wifi':
        return (
          <group>
            {/* Ceiling mount box */}
            <mesh position={[0, s * 0.15, 0]}>
              <boxGeometry args={[s * 1.5, s * 0.3, s * 1.5]} />
              <meshLambertMaterial color="#EEEEEE" />
            </mesh>
            {/* LED indicator */}
            <mesh position={[0, s * 0.31, 0]}>
              <boxGeometry args={[s * 0.2, s * 0.02, s * 0.2]} />
              <meshLambertMaterial color="#4CAF50" emissive="#4CAF50" emissiveIntensity={0.5} />
            </mesh>
          </group>
        );

      // ── Security camera ──
      case 'security-camera':
        return (
          <group>
            {/* Mount pole */}
            <mesh position={[0, s * 2.5, 0]}>
              <cylinderGeometry args={[s * 0.1, s * 0.1, s * 5, 6]} />
              <meshLambertMaterial color="#9E9E9E" />
            </mesh>
            {/* Camera body */}
            <mesh position={[0, s * 5, s * 0.5]}>
              <boxGeometry args={[s * 0.5, s * 0.5, s * 1.2]} />
              <meshLambertMaterial color="#37474F" />
            </mesh>
            {/* Lens */}
            <mesh position={[0, s * 5, s * 1.15]}>
              <cylinderGeometry args={[s * 0.15, s * 0.2, s * 0.15, 8]} />
              <meshLambertMaterial color="#212121" />
            </mesh>
          </group>
        );

      // ── Parking spot ──
      case 'parking-spot':
        return (
          <group>
            {/* Ground marking */}
            <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[s * 4, s * 6]} />
              <meshLambertMaterial color="#37474F" />
            </mesh>
            {/* P sign */}
            <mesh position={[-s * 2.2, s * 2.5, 0]}>
              <cylinderGeometry args={[s * 0.08, s * 0.08, s * 5, 6]} />
              <meshLambertMaterial color="#9E9E9E" />
            </mesh>
            <mesh position={[-s * 2.2, s * 5.2, 0]}>
              <boxGeometry args={[s * 1.5, s * 1.5, s * 0.1]} />
              <meshLambertMaterial color="#3F51B5" />
            </mesh>
          </group>
        );

      // ── Bike rack ──
      case 'bike-rack':
        return (
          <group>
            {/* Base bar */}
            <mesh position={[0, s * 0.15, 0]}>
              <boxGeometry args={[s * 4, s * 0.15, s * 0.15]} />
              <meshLambertMaterial color="#9E9E9E" />
            </mesh>
            {/* Hoops */}
            {[-1, 0, 1].map(i => (
              <mesh key={i} position={[s * i * 1.3, s * 1.5, 0]}>
                <torusGeometry args={[s * 1, s * 0.08, 6, 12, Math.PI]} />
                <meshLambertMaterial color="#9E9E9E" />
              </mesh>
            ))}
          </group>
        );

      // ── Charging station ──
      case 'charging':
        return (
          <group>
            {/* Post */}
            <mesh position={[0, s * 2, 0]}>
              <boxGeometry args={[s * 1, s * 4, s * 0.8]} />
              <meshLambertMaterial color="#E0E0E0" />
            </mesh>
            {/* Screen */}
            <mesh position={[0, s * 3.5, s * 0.42]}>
              <boxGeometry args={[s * 0.7, s * 0.7, s * 0.05]} />
              <meshLambertMaterial color="#4CAF50" emissive="#4CAF50" emissiveIntensity={0.2} />
            </mesh>
            {/* Cable */}
            <mesh position={[s * 0.3, s * 1.5, s * 0.42]}>
              <cylinderGeometry args={[s * 0.05, s * 0.05, s * 1.5, 6]} />
              <meshLambertMaterial color="#212121" />
            </mesh>
          </group>
        );

      // ── Mail / Mailroom ──
      case 'mail':
        return (
          <group>
            {/* Mailbox */}
            <mesh position={[0, s * 1.5, 0]}>
              <boxGeometry args={[s * 3, s * 3, s * 2]} />
              <meshLambertMaterial color="#5D4037" />
            </mesh>
            {/* Slots */}
            {[0, 1, 2].map(i => (
              <mesh key={i} position={[0, s * (0.8 + i * 0.9), s * 1.01]}>
                <boxGeometry args={[s * 2.5, s * 0.15, s * 0.02]} />
                <meshLambertMaterial color="#3E2723" />
              </mesh>
            ))}
          </group>
        );

      // ── Water fountain ──
      case 'water-fountain':
        return (
          <group>
            <mesh position={[0, s * 1.5, 0]}>
              <boxGeometry args={[s * 1.5, s * 3, s * 1.2]} />
              <meshLambertMaterial color="#E0E0E0" />
            </mesh>
            {/* Basin */}
            <mesh position={[0, s * 3.05, s * 0.2]}>
              <boxGeometry args={[s * 1, s * 0.1, s * 0.8]} />
              <meshLambertMaterial color="#B0BEC5" />
            </mesh>
            {/* Water arc */}
            <mesh position={[0, s * 3.3, s * 0.2]}>
              <sphereGeometry args={[s * 0.12, 8, 8]} />
              <meshLambertMaterial color="#29B6F6" transparent opacity={0.6} />
            </mesh>
          </group>
        );

      // ── Shower ──
      case 'shower':
        return (
          <group>
            {/* Shower head pipe */}
            <mesh position={[0, s * 4, -s * 0.8]}>
              <cylinderGeometry args={[s * 0.06, s * 0.06, s * 8, 6]} />
              <meshLambertMaterial color="#BDBDBD" />
            </mesh>
            {/* Shower head */}
            <mesh position={[0, s * 7.5, 0]}>
              <boxGeometry args={[s * 0.15, s * 0.15, s * 1.5]} />
              <meshLambertMaterial color="#BDBDBD" />
            </mesh>
            <mesh position={[0, s * 7.3, s * 0.5]}>
              <cylinderGeometry args={[s * 0.4, s * 0.3, s * 0.1, 8]} />
              <meshLambertMaterial color="#9E9E9E" />
            </mesh>
            {/* Base tray */}
            <mesh position={[0, s * 0.1, 0]}>
              <cylinderGeometry args={[s * 1.2, s * 1.3, s * 0.2, 8]} />
              <meshLambertMaterial color="#EEEEEE" />
            </mesh>
          </group>
        );

      // ── Smoking area ──
      case 'smoking':
        return (
          <group>
            {/* Ashtray stand */}
            <mesh position={[0, s * 1.5, 0]}>
              <cylinderGeometry args={[s * 0.12, s * 0.15, s * 3, 6]} />
              <meshLambertMaterial color="#757575" />
            </mesh>
            {/* Ashtray top */}
            <mesh position={[0, s * 3.1, 0]}>
              <cylinderGeometry args={[s * 0.6, s * 0.5, s * 0.3, 8]} />
              <meshLambertMaterial color="#616161" />
            </mesh>
            {/* Base */}
            <mesh position={[0, s * 0.05, 0]}>
              <cylinderGeometry args={[s * 0.5, s * 0.5, s * 0.1, 8]} />
              <meshLambertMaterial color="#757575" />
            </mesh>
          </group>
        );

      // ── Fire extinguisher ──
      case 'fire-extinguisher':
        return (
          <group>
            <mesh position={[0, s * 1.5, 0]}>
              <cylinderGeometry args={[s * 0.4, s * 0.5, s * 3, 8]} />
              <meshLambertMaterial color="#D32F2F" />
            </mesh>
            <mesh position={[0, s * 3.2, 0]}>
              <cylinderGeometry args={[s * 0.2, s * 0.3, s * 0.4, 6]} />
              <meshLambertMaterial color="#424242" />
            </mesh>
            <mesh position={[s * 0.3, s * 3.4, 0]} rotation={[0, 0, -0.5]}>
              <boxGeometry args={[s * 0.8, s * 0.08, s * 0.08]} />
              <meshLambertMaterial color="#212121" />
            </mesh>
          </group>
        );

      // ── Presentation screen ──
      case 'presentation':
        return (
          <group>
            {/* Stand */}
            <mesh position={[0, s * 2.5, 0]}>
              <cylinderGeometry args={[s * 0.08, s * 0.12, s * 5, 6]} />
              <meshLambertMaterial color="#9E9E9E" />
            </mesh>
            {/* Screen */}
            <mesh position={[0, s * 5, 0]}>
              <boxGeometry args={[s * 4, s * 2.5, s * 0.1]} />
              <meshLambertMaterial color="#FAFAFA" />
            </mesh>
            {/* Base */}
            <mesh position={[0, s * 0.05, 0]}>
              <boxGeometry args={[s * 2, s * 0.1, s * 1.5]} />
              <meshLambertMaterial color="#9E9E9E" />
            </mesh>
          </group>
        );

      // ── Default: colored cylinder marker ──
      default:
        return (
          <group>
            <mesh position={[0, s * 0.8, 0]}>
              <cylinderGeometry args={[s * 0.6, s * 0.7, s * 1.6, 8]} />
              <meshLambertMaterial color={color} />
            </mesh>
            <mesh position={[0, s * 1.65, 0]}>
              <sphereGeometry args={[s * 0.6, 8, 8]} />
              <meshLambertMaterial color={color} />
            </mesh>
          </group>
        );
    }
  }

  const labelH = iconId === 'wifi' ? 0.08 : 0.45;

  return (
    <group position={[x, 0, z]} key={`${iconId}-${x}-${z}`}>
      <group key={iconId || 'default'}>
        {renderAsset()}
      </group>

      {/* Label */}
      <Html position={[0, labelH, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(15,20,25,0.92)',
          color: '#e6edf3',
          padding: '3px 7px',
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 600,
          fontFamily: '-apple-system, sans-serif',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
          borderLeft: `2px solid ${color}`,
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}
