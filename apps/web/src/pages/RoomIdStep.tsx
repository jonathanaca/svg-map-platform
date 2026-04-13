import React, { useState } from 'react';
import type { RoomEntry, BrandConfig, IconPlacement, AmenityIcon } from '@svg-map/types';
// saveConfig + generateSvg moved to StateStep
import FloorplanEditor from '../components/FloorplanEditor.js';

const AMENITY_ICONS: { value: AmenityIcon; label: string }[] = [
  { value: 'male-restroom', label: 'Male Restroom' },
  { value: 'female-restroom', label: 'Female Restroom' },
  { value: 'accessible-restroom', label: 'Accessible' },
  { value: 'staircase', label: 'Stairs' },
  { value: 'elevator', label: 'Elevator' },
  { value: 'fire-exit', label: 'Fire Exit' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'reception', label: 'Reception' },
  { value: 'aed', label: 'AED' },
  { value: 'lockers', label: 'Lockers' },
  { value: 'presentation', label: 'Presentation' },
];

interface RoomIdStepProps {
  jobId: string;
  brandConfig: BrandConfig;
  onComplete: (rooms: RoomEntry[], icons: IconPlacement[]) => void;
  onBack: () => void;
}

const ROOM_ID_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export default function RoomIdStep({ jobId, brandConfig, onComplete, onBack }: RoomIdStepProps) {
  // Floor outline is always index 0
  const initialRooms = brandConfig.roomIds.length > 0
    ? brandConfig.roomIds
    : [{ id: 'floor', label: 'Floor', x: 0, y: 0, width: 200, height: 150 }];

  const [rooms, setRooms] = useState<RoomEntry[]>(initialRooms);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [icons, setIcons] = useState<IconPlacement[]>(brandConfig.iconPlacements ?? []);
  const [placingIcon, setPlacingIcon] = useState<AmenityIcon | null>(null);
  const [placeType, setPlaceType] = useState<'room' | 'desk' | 'desk-select'>('room');
  const [error, setError] = useState<string | null>(null);

  const imageUrl = `/api/files/processed/${jobId}.jpg`;

  // Check if floor outline has been drawn (polygon points stored in _outlinePoints)
  const floorRoom = rooms.find(r => r.id === 'floor');
  const floorOutline = (floorRoom as Record<string, unknown> | undefined)?._outlinePoints;
  const hasFloorOutline = Array.isArray(floorOutline) && floorOutline.length >= 3;

  function updateRoom(index: number, field: keyof RoomEntry, value: string | number) {
    setRooms(prev => prev.map((room, i) => (i === index ? { ...room, [field]: value } : room)));
  }

  function updateRoomPartial(index: number, updates: Partial<RoomEntry>) {
    setRooms(prev => prev.map((room, i) => (i === index ? { ...room, ...updates } : room)));
  }

  function addRoom() {
    const newRooms = [...rooms, { id: '', label: '', x: 0, y: 0, width: 200, height: 150 }];
    setRooms(newRooms);
    setSelectedIndex(newRooms.length - 1);
  }

  function createRoomAt(x: number, y: number) {
    if (!hasFloorOutline) return;

    // If placing an icon, add icon instead of room
    if (placingIcon) {
      const iconInfo = AMENITY_ICONS.find(i => i.value === placingIcon);
      const newIcon: IconPlacement = {
        id: `icon-${placingIcon}-${icons.length + 1}`,
        icon: placingIcon,
        label: iconInfo?.label ?? placingIcon,
        x, y,
      };
      setIcons(prev => [...prev, newIcon]);
      setPlacingIcon(null);
      return;
    }

    if (placeType === 'desk-select') return; // select mode — don't create

    if (placeType === 'desk') {
      const deskNum = rooms.filter(r => r.id.startsWith('desk-')).length + 1;
      const newDesk: RoomEntry = { id: `desk-${String(deskNum).padStart(3, '0')}`, label: `Desk ${deskNum}`, x, y, width: 90, height: 60 };
      setRooms(prev => [...prev, newDesk]);
      setSelectedIndex(rooms.length);
    } else {
      const num = rooms.filter(r => r.id !== 'floor' && !r.id.startsWith('desk-')).length + 1;
      const newRoom: RoomEntry = { id: `room-${num}`, label: `Room ${num}`, x, y, width: 200, height: 150 };
      const newRooms = [...rooms, newRoom];
      setRooms(newRooms);
      setSelectedIndex(newRooms.length - 1);
    }
  }

  function removeRoom(index: number) {
    if (rooms[index]?.id === 'floor') return;
    setRooms(prev => prev.filter((_, i) => i !== index));
    if (selectedIndex === index) setSelectedIndex(null);
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1);
  }

  function reorderRoom(fromIndex: number, toIndex: number) {
    setRooms(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    // Update selection to follow the moved item
    if (selectedIndex === fromIndex) setSelectedIndex(toIndex);
    else if (selectedIndex !== null) {
      if (fromIndex < selectedIndex && toIndex >= selectedIndex) setSelectedIndex(selectedIndex - 1);
      else if (fromIndex > selectedIndex && toIndex <= selectedIndex) setSelectedIndex(selectedIndex + 1);
    }
  }

  function getIdError(id: string, index: number): string | null {
    if (id.length === 0) return 'Required';
    if (!ROOM_ID_REGEX.test(id)) return 'Invalid format';
    const isDuplicate = rooms.some((r, i) => i !== index && r.id === id);
    if (isDuplicate) return 'Duplicate ID';
    return null;
  }

  function hasValidationErrors(): boolean {
    if (!hasFloorOutline) return true;
    // Only validate non-floor rooms
    return rooms.some((room, i) => {
      if (room.id === 'floor') return false;
      if (getIdError(room.id, i) !== null) return true;
      if (room.label.trim().length === 0) return true;
      return false;
    });
  }

  function handleContinue() {
    if (hasValidationErrors()) return;
    onComplete(rooms, icons);
  }

  const roomCount = rooms.filter(r => r.id !== 'floor').length;

  return (
    <div className="card" style={{ maxWidth: 1400 }}>
      <h2>Define Floor & Rooms</h2>

      {!hasFloorOutline ? (
        <div className="alert" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          <strong>Step 1:</strong> Click <strong>"Draw Floor Outline"</strong> then click around the building perimeter to trace its shape. Click the green dot to close.
        </div>
      ) : (
        <>
        <div className="alert" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          <strong>Floor outline set!</strong> Select a mode below, then <strong>click anywhere on the floorplan</strong> to place. Drag to reposition, handles to resize, double-click to rename, Backspace to delete.
        </div>

        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          position: 'sticky', top: 56, zIndex: 20,
          background: 'var(--color-surface)', padding: '10px 0', marginBottom: 8,
          borderBottom: '1px solid var(--color-border)',
        }}>
          {/* Room mode */}
          <button
            onClick={() => { setPlaceType('room'); setPlacingIcon(null); }}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
              border: placeType === 'room' ? '2px solid #7c3aed' : '1px solid var(--color-border)',
              background: placeType === 'room' ? '#ede9fe' : 'var(--color-surface)',
              color: placeType === 'room' ? '#7c3aed' : 'var(--color-text)',
            }}
          >
            + Room
          </button>

          <span style={{ width: 1, height: 24, background: 'var(--color-border)' }} />

          {/* Desk modes */}
          <button
            onClick={() => { setPlaceType('desk'); setPlacingIcon(null); }}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
              border: placeType === 'desk' ? '2px solid #2563eb' : '1px solid var(--color-border)',
              background: placeType === 'desk' ? '#eff6ff' : 'var(--color-surface)',
              color: placeType === 'desk' ? '#2563eb' : 'var(--color-text)',
            }}
          >
            + Desk
          </button>
          <button
            onClick={() => { setPlaceType('desk-select'); setPlacingIcon(null); }}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
              border: placeType === 'desk-select' ? '2px solid #059669' : '1px solid var(--color-border)',
              background: placeType === 'desk-select' ? '#f0fdf4' : 'var(--color-surface)',
              color: placeType === 'desk-select' ? '#059669' : 'var(--color-text)',
            }}
          >
            Move Desk
          </button>

          <span style={{ width: 1, height: 24, background: 'var(--color-border)' }} />

          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            {rooms.filter(r => r.id !== 'floor' && !r.id.startsWith('desk-')).length} rooms,{' '}
            {rooms.filter(r => r.id.startsWith('desk-')).length} desks
          </span>
        </div>
        </>
      )}

      {error && (
        <div className="alert alert-error" role="alert">{error}</div>
      )}

      <FloorplanEditor
        imageUrl={imageUrl}
        rooms={rooms}
        selectedIndex={selectedIndex}
        onSelectRoom={setSelectedIndex}
        onUpdateRoom={updateRoomPartial}
        onDeleteRoom={removeRoom}
        onReorderRoom={reorderRoom}
        onCreateRoom={hasFloorOutline ? createRoomAt : undefined}
        icons={icons}
        placingMode={placingIcon !== null || placeType === 'desk'} /* desk-select = false, allows drag */
      />

      {hasFloorOutline && (
        <>
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Room ID <span style={{ color: 'var(--color-danger)' }}>*</span></th>
                  <th>Label <span style={{ color: 'var(--color-danger)' }}>*</span></th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Width</th>
                  <th>Height</th>
                  <th className="row-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, index) => {
                  // Skip the floor entry in the table
                  if (room.id === 'floor') return null;

                  const idError = getIdError(room.id, index);
                  const labelEmpty = room.id.length > 0 && room.label.trim().length === 0;
                  const isSelected = index === selectedIndex;

                  return (
                    <tr
                      key={index}
                      style={{ background: isSelected ? 'rgba(74, 32, 128, 0.08)' : undefined, cursor: 'pointer' }}
                      onClick={() => setSelectedIndex(index)}
                    >
                      <td style={{ textAlign: 'center', fontWeight: 600, color: isSelected ? '#7c3aed' : '#999' }}>
                        {isSelected ? '▶' : ''}
                      </td>
                      <td>
                        <input
                          type="text"
                          className={idError ? 'invalid' : ''}
                          value={room.id}
                          onChange={(e) => updateRoom(index, 'id', e.target.value)}
                          placeholder="meeting-3-01"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {idError && <span role="alert" style={{ fontSize: '0.72rem', color: 'var(--color-danger)', display: 'block', marginTop: 2 }}>{idError}</span>}
                      </td>
                      <td>
                        <input
                          type="text"
                          className={labelEmpty ? 'invalid' : ''}
                          value={room.label}
                          onChange={(e) => updateRoom(index, 'label', e.target.value)}
                          placeholder="Meeting 3.01"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {labelEmpty && <span role="alert" style={{ fontSize: '0.72rem', color: 'var(--color-danger)', display: 'block', marginTop: 2 }}>Required</span>}
                      </td>
                      <td><input type="number" min="0" value={room.x ?? 0} onChange={(e) => updateRoom(index, 'x', Number(e.target.value))} onClick={(e) => e.stopPropagation()} style={{ width: 70 }} /></td>
                      <td><input type="number" min="0" value={room.y ?? 0} onChange={(e) => updateRoom(index, 'y', Number(e.target.value))} onClick={(e) => e.stopPropagation()} style={{ width: 70 }} /></td>
                      <td><input type="number" min="1" value={room.width ?? 200} onChange={(e) => updateRoom(index, 'width', Number(e.target.value))} onClick={(e) => e.stopPropagation()} style={{ width: 70 }} /></td>
                      <td><input type="number" min="1" value={room.height ?? 150} onChange={(e) => updateRoom(index, 'height', Number(e.target.value))} onClick={(e) => e.stopPropagation()} style={{ width: 70 }} /></td>
                      <td className="row-actions">
                        <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); removeRoom(index); }} aria-label={`Remove room`} type="button">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={addRoom} type="button">+ Add Room</button>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{roomCount} room(s)</span>
          </div>

          {/* Icons / Amenities */}
          <div style={{ marginTop: 24, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Amenity Icons</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              Select an icon then click on the floorplan to place it.
              {placingIcon && <strong style={{ color: '#7c3aed' }}> Placing: {AMENITY_ICONS.find(i => i.value === placingIcon)?.label}. Click on the map.</strong>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {AMENITY_ICONS.map(icon => (
                <button
                  key={icon.value}
                  onClick={() => setPlacingIcon(placingIcon === icon.value ? null : icon.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                    border: placingIcon === icon.value ? '2px solid #7c3aed' : '1px solid var(--color-border)',
                    background: placingIcon === icon.value ? '#ede9fe' : 'var(--color-surface)',
                    fontSize: '0.78rem', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  title={`Place ${icon.label}`}
                >
                  {icon.label}
                </button>
              ))}
            </div>

            {icons.length > 0 && (
              <div style={{ fontSize: '0.82rem' }}>
                <strong>{icons.length} icon(s) placed:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {icons.map((ic, idx) => (
                    <span key={idx} style={{ padding: '3px 8px', borderRadius: 4, background: '#f3f4f6', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {ic.label}
                      <button
                        onClick={() => setIcons(prev => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: '0.7rem', padding: '0 2px' }}
                      >x</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onBack} type="button">Back</button>
        <button
          className="btn btn-primary"
          onClick={handleContinue}
          disabled={hasValidationErrors() || !hasFloorOutline}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
