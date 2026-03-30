import React, { useRef, useState, useCallback } from 'react';
import type { RoomEntry, IconPlacement } from '@svg-map/types';

interface FloorplanEditorProps {
  imageUrl: string;
  rooms: RoomEntry[];
  selectedIndex: number | null;
  onSelectRoom: (index: number | null) => void;
  onUpdateRoom: (index: number, updates: Partial<RoomEntry>) => void;
  onDeleteRoom: (index: number) => void;
  onReorderRoom?: (fromIndex: number, toIndex: number) => void;
  onCreateRoom?: (x: number, y: number) => void;
  icons?: IconPlacement[];
  placingMode?: boolean;  // when true, clicks always go to onCreateRoom (for icon placement)
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const HANDLE_CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
  se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
};

export default function FloorplanEditor({
  imageUrl, rooms, selectedIndex, onSelectRoom, onUpdateRoom, onDeleteRoom, onReorderRoom, onCreateRoom, icons = [], placingMode = false,
}: FloorplanEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
  const [dragging, setDragging] = useState<{ index: number; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ index: number; handle: Handle; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number } | null>(null);
  const [editing, setEditing] = useState<{ index: number; value: string } | null>(null);
  const [lockedIndices, setLockedIndices] = useState<Set<number>>(new Set());

  // Zoom & pan
  const [zoom, setZoom] = useState(1);
  const [longPress, setLongPress] = useState(false);
  const [scrollDrag, setScrollDrag] = useState<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Floor outline polygon drawing
  const [outlinePoints, setOutlinePoints] = useState<{ x: number; y: number }[]>([]);
  const [drawingOutline, setDrawingOutline] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const floorIndex = rooms.findIndex(r => r.id === 'floor');
  const floorRoom = floorIndex >= 0 ? rooms[floorIndex] : null;
  // Store outline points as a JSON string in a custom field — we'll use the label field with a prefix
  const floorOutlinePoints: { x: number; y: number }[] = (() => {
    if (!floorRoom) return [];
    try {
      const raw = (floorRoom as unknown as Record<string, unknown>)._outlinePoints;
      if (Array.isArray(raw)) return raw as { x: number; y: number }[];
    } catch { /* ignore */ }
    return [];
  })();

  function startOutlineDrawing() {
    setDrawingOutline(true);
    setOutlinePoints([]);
    onSelectRoom(null);
  }

  function finishOutline() {
    if (outlinePoints.length < 3) return;
    setDrawingOutline(false);

    // Calculate bounding box of polygon
    const xs = outlinePoints.map(p => p.x);
    const ys = outlinePoints.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    if (floorIndex >= 0) {
      onUpdateRoom(floorIndex, {
        x: minX, y: minY,
        width: maxX - minX, height: maxY - minY,
        _outlinePoints: outlinePoints,
      } as Partial<RoomEntry>);
    }
    setOutlinePoints([]);
  }

  function toImageCoords(clientX: number, clientY: number): { x: number; y: number } {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(svgPt.x), y: Math.round(svgPt.y) };
  }

  React.useEffect(() => {
    const img = new Image();
    img.onload = () => setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (editing) return;
      if (e.key === 'Escape') {
        if (drawingOutline) { setDrawingOutline(false); setOutlinePoints([]); }
        else onSelectRoom(null);
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIndex !== null) {
        e.preventDefault();
        onDeleteRoom(selectedIndex);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, editing, drawingOutline, onDeleteRoom, onSelectRoom]);

  function toggleLock(index: number) {
    setLockedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    const { x, y } = toImageCoords(e.clientX, e.clientY);

    // Placing mode (icon or new room) — always pass click through, don't select rooms
    if (placingMode && onCreateRoom) {
      onCreateRoom(x, y);
      e.preventDefault();
      return;
    }

    // Outline drawing mode — click to add points
    if (drawingOutline) {
      // Check if clicking near the first point to close
      if (outlinePoints.length >= 3) {
        const first = outlinePoints[0];
        const dist = Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2);
        const closeThreshold = Math.max(imageDims?.width ?? 1000, imageDims?.height ?? 1000) * 0.015;
        if (dist < closeThreshold) {
          finishOutline();
          e.preventDefault();
          return;
        }
      }
      setOutlinePoints(prev => [...prev, { x, y }]);
      e.preventDefault();
      return;
    }

    // Check resize handles of selected room first
    if (selectedIndex !== null && !lockedIndices.has(selectedIndex)) {
      const sel = rooms[selectedIndex];
      const sx = sel.x ?? 0, sy = sel.y ?? 0, sw = sel.width ?? 100, sh = sel.height ?? 100;
      const hs = Math.max(15, Math.min(sw, sh) * 0.04); // handle hit size in image space

      for (const h of HANDLES) {
        const [hx, hy] = getHandlePos(h, sx, sy, sw, sh);
        if (Math.abs(x - hx) < hs && Math.abs(y - hy) < hs) {
          setResizing({ index: selectedIndex, handle: h, startX: x, startY: y, origX: sx, origY: sy, origW: sw, origH: sh });
          e.preventDefault();
          return;
        }
      }
    }

    // Find all unlocked, non-floor rooms under cursor, pick smallest
    const hits: { index: number; area: number }[] = [];
    for (let i = 0; i < rooms.length; i++) {
      if (lockedIndices.has(i)) continue;
      if (rooms[i].id === 'floor') continue;
      const room = rooms[i];
      const rx = room.x ?? 0, ry = room.y ?? 0, rw = room.width ?? 100, rh = room.height ?? 100;
      if (rx === 0 && ry === 0 && rw <= 200 && rh <= 150) continue;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        hits.push({ index: i, area: rw * rh });
      }
    }

    if (hits.length > 0) {
      hits.sort((a, b) => a.area - b.area);
      const hit = hits[0];
      const hitRoom = rooms[hit.index];

      // In desk placingMode: clicking on a room creates a desk on top, clicking a desk selects it
      if (placingMode) {
        if (hitRoom.id.startsWith('desk-')) {
          // Clicked an existing desk — select it for editing
          onSelectRoom(hit.index);
          setDragging({ index: hit.index, offsetX: x - (hitRoom.x ?? 0), offsetY: y - (hitRoom.y ?? 0) });
          e.preventDefault();
          return;
        }
        // Clicked a room — create desk on top
        if (onCreateRoom) {
          onCreateRoom(x, y);
          e.preventDefault();
          return;
        }
      }

      // Normal mode (rooms): click selects for move/resize
      onSelectRoom(hit.index);
      setDragging({ index: hit.index, offsetX: x - (hitRoom.x ?? 0), offsetY: y - (hitRoom.y ?? 0) });
      e.preventDefault();
      return;
    }

    // Empty area — create room/desk
    if (onCreateRoom) {
      onCreateRoom(x, y);
      e.preventDefault();
    } else {
      onSelectRoom(null);
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const { x, y } = toImageCoords(e.clientX, e.clientY);

    if (drawingOutline) {
      setCursorPos({ x, y });
      return;
    }

    if (dragging) {
      onUpdateRoom(dragging.index, {
        x: Math.max(0, x - dragging.offsetX),
        y: Math.max(0, y - dragging.offsetY),
      });
    } else if (resizing) {
      const { handle, origX, origY, origW, origH } = resizing;
      let nx = origX, ny = origY, nw = origW, nh = origH;

      if (handle.includes('w')) { nx = Math.min(x, origX + origW - 40); nw = origX + origW - nx; }
      if (handle.includes('e')) { nw = Math.max(40, x - origX); }
      if (handle.includes('n')) { ny = Math.min(y, origY + origH - 40); nh = origY + origH - ny; }
      if (handle.includes('s')) { nh = Math.max(40, y - origY); }

      onUpdateRoom(resizing.index, { x: nx, y: ny, width: nw, height: nh });
    } else if (drawing && selectedIndex !== null) {
      const w = Math.abs(x - drawing.startX);
      const h = Math.abs(y - drawing.startY);
      onUpdateRoom(selectedIndex, {
        x: Math.min(x, drawing.startX), y: Math.min(y, drawing.startY),
        width: Math.max(40, w), height: Math.max(40, h),
      });
    }
  }

  function handleMouseUp() {
    setDragging(null);
    setResizing(null);
    setDrawing(null);
  }

  function handleDoubleClick(e: React.MouseEvent<SVGSVGElement>) {
    const { x, y } = toImageCoords(e.clientX, e.clientY);
    const hits: { index: number; area: number }[] = [];
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const rx = room.x ?? 0, ry = room.y ?? 0, rw = room.width ?? 100, rh = room.height ?? 100;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) hits.push({ index: i, area: rw * rh });
    }
    if (hits.length > 0) {
      hits.sort((a, b) => a.area - b.area);
      const hit = hits[0];
      setEditing({ index: hit.index, value: rooms[hit.index].label || '' });
      onSelectRoom(hit.index);
      e.preventDefault();
    }
  }

  function labelToId(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]/, 'r').replace(/-+$/, '') || 'room';
  }

  function finishEditing() {
    if (!editing) return;
    const newLabel = editing.value || 'Untitled';
    const newId = labelToId(newLabel);
    // Ensure unique — append number if duplicate
    const existing = rooms.filter((_, idx) => idx !== editing.index).map(r => r.id);
    let uniqueId = newId;
    let n = 1;
    while (existing.includes(uniqueId)) { uniqueId = `${newId}-${n++}`; }
    onUpdateRoom(editing.index, { label: newLabel, id: uniqueId });
    setEditing(null);
  }

  if (!imageDims) {
    return <div className="editor-canvas" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Loading floorplan...</div>;
  }

  const strokeW = Math.max(2, Math.min(imageDims.width / 500, 6));
  const handleR = Math.max(6, strokeW * 2);

  // Sort: largest area first (renders behind)
  const sorted = rooms.map((room, i) => ({ room, i }))
    .sort((a, b) => ((b.room.width ?? 0) * (b.room.height ?? 0)) - ((a.room.width ?? 0) * (a.room.height ?? 0)));

  // Categorize rooms by type based on ID/label
  function getRoomType(room: RoomEntry): string {
    const id = (room.id || '').toLowerCase();
    const label = (room.label || '').toLowerCase();
    if (id === 'floor' || label === 'floor') return 'Floor';
    if (id.includes('desk') || label.includes('desk') || label.includes('focus')) return 'Desk';
    if (id.includes('meeting') || label.includes('meeting')) return 'Meeting Room';
    if (id.includes('collab') || label.includes('collab') || label.includes('project')) return 'Collaboration';
    if (id.includes('phone') || label.includes('phone') || label.includes('booth')) return 'Phone Booth';
    if (id.includes('open') || label.includes('open plan')) return 'Open Plan';
    if (['lift', 'stair', 'locker', 'restroom', 'kitchen', 'teapoint', 'print', 'filing', 'comms', 'wellness'].some(f => id.includes(f) || label.includes(f))) return 'Facilities';
    if (id.includes('ceo') || label.includes('ceo')) return 'Executive';
    return 'Room';
  }

  const TYPE_COLORS: Record<string, string> = {
    'Floor': '#6b7280',
    'Meeting Room': '#7c3aed',
    'Desk': '#2563eb',
    'Collaboration': '#059669',
    'Phone Booth': '#d97706',
    'Open Plan': '#0891b2',
    'Facilities': '#dc2626',
    'Executive': '#9333ea',
    'Room': '#4b5563',
  };

  return (
    <div className="floorplan-editor">
      <div className="editor-toolbar">
        <span className="editor-hint">
          {drawingOutline
            ? `Drawing floor outline: click to add points (${outlinePoints.length} placed). Click the green dot to close. Esc to cancel.`
            : selectedIndex !== null
            ? `Selected: "${rooms[selectedIndex]?.label || 'Room ' + (selectedIndex + 1)}". Drag to move, handles to resize. Double-click to rename.`
            : 'Click a room to select. Click empty space to create a new room.'}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }}>
          {!drawingOutline && (
            <button
              onClick={startOutlineDrawing}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #7c3aed', background: floorOutlinePoints.length > 0 ? '#ede9fe' : '#7c3aed', color: floorOutlinePoints.length > 0 ? '#7c3aed' : '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', marginRight: 8 }}
            >
              {floorOutlinePoints.length > 0 ? 'Redraw Outline' : 'Draw Floor Outline'}
            </button>
          )}
          <span style={{ width: 1, height: 18, background: 'var(--color-border)' }} />
          <button onClick={() => setZoom(z => Math.min(8, z * 1.3))} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}>+</button>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, minWidth: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.2, z / 1.3))} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}>-</button>
          <button onClick={() => { setZoom(1); if (containerRef.current) { containerRef.current.scrollLeft = 0; containerRef.current.scrollTop = 0; } }} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 600 }}>Fit</button>
        </div>
      </div>

      <div style={{ display: 'flex', border: '2px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
      {/* Layers Panel */}
      <div style={{ width: 220, minWidth: 220, borderRight: '1px solid var(--color-border)', background: '#fafafa', overflowY: 'auto', maxHeight: 700 }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.78rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Layers
        </div>
        {sorted.map(({ room, i }) => {
          const hasPos = (room.x ?? 0) > 0 || (room.y ?? 0) > 0;
          if (!hasPos) return null;
          const isSelected = i === selectedIndex;
          const isLocked = lockedIndices.has(i);
          const type = getRoomType(room);
          const color = TYPE_COLORS[type] || '#4b5563';

          return (
            <div
              key={i}
              onClick={() => { if (!isLocked) onSelectRoom(i); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', cursor: isLocked ? 'default' : 'pointer',
                background: isSelected ? '#ede9fe' : 'transparent',
                borderBottom: '1px solid #f0f0f0',
                borderLeft: isSelected ? '3px solid #7c3aed' : '3px solid transparent',
              }}
            >
              {/* Lock toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleLock(i); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', padding: 0, lineHeight: 1 }}
                title={isLocked ? 'Unlock' : 'Lock'}
              >
                {isLocked ? '🔒' : '🔓'}
              </button>

              {/* Type color dot */}
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />

              {/* Room info — double-click to rename */}
              <div
                style={{ flex: 1, minWidth: 0, opacity: isLocked ? 0.5 : 1 }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (room.id !== 'floor') setEditing({ index: i, value: room.label || '' });
                }}
              >
                {editing?.index === i ? (
                  <input
                    autoFocus
                    type="text"
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') finishEditing(); if (e.key === 'Escape') setEditing(null); }}
                    onBlur={finishEditing}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%', padding: '2px 4px', border: '1px solid #7c3aed',
                      borderRadius: 3, fontSize: '0.78rem', fontWeight: 600, outline: 'none',
                    }}
                  />
                ) : (
                  <>
                    <div style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.label || room.id || `Room ${i + 1}`}
                    </div>
                    <div style={{ fontSize: '0.65rem', color, fontWeight: 600 }}>
                      {type}
                    </div>
                  </>
                )}
              </div>

              {/* Layer order buttons */}
              {onReorderRoom && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (i > 0) onReorderRoom(i, i - 1); }}
                    disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: i > 0 ? 'pointer' : 'default', fontSize: '0.6rem', padding: '0 2px', color: i > 0 ? '#666' : '#ccc', lineHeight: 1 }}
                    title="Move layer up (behind)"
                  >▲</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (i < rooms.length - 1) onReorderRoom(i, i + 1); }}
                    disabled={i === rooms.length - 1}
                    style={{ background: 'none', border: 'none', cursor: i < rooms.length - 1 ? 'pointer' : 'default', fontSize: '0.6rem', padding: '0 2px', color: i < rooms.length - 1 ? '#666' : '#ccc', lineHeight: 1 }}
                    title="Move layer down (in front)"
                  >▼</button>
                </div>
              )}
            </div>
          );
        })}
        {rooms.filter(r => (r.x ?? 0) === 0 && (r.y ?? 0) === 0).length > 0 && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.7rem', color: '#999' }}>
            Unplaced: {rooms.filter(r => (r.x ?? 0) === 0 && (r.y ?? 0) === 0).length} room(s)
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ position: 'relative', flex: 1, overflow: 'auto', cursor: longPress ? 'grab' : undefined }}
        onMouseDown={(e) => {
          if (zoom > 1) {
            // Start a long-press timer — if held 300ms without moving, enter scroll-drag mode
            const el = containerRef.current;
            if (el) {
              longPressTimer.current = setTimeout(() => {
                setLongPress(true);
                setScrollDrag({ startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop });
              }, 300);
            }
          }
        }}
        onMouseMove={(e) => {
          if (longPressTimer.current && !scrollDrag) {
            // Cancel long press if mouse moves before timer fires
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          if (scrollDrag && containerRef.current) {
            containerRef.current.scrollLeft = scrollDrag.scrollLeft - (e.clientX - scrollDrag.startX);
            containerRef.current.scrollTop = scrollDrag.scrollTop - (e.clientY - scrollDrag.startY);
          }
        }}
        onMouseUp={() => {
          if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
          setLongPress(false);
          setScrollDrag(null);
        }}
        onMouseLeave={() => {
          if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
          setLongPress(false);
          setScrollDrag(null);
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: `${zoom * 100}%`, display: 'block',
            cursor: placingMode ? 'crosshair' : drawingOutline ? 'crosshair' : dragging ? 'grabbing' : resizing ? HANDLE_CURSORS[resizing.handle] : 'default',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          <image href={imageUrl} x="0" y="0" width={imageDims.width} height={imageDims.height} style={{ pointerEvents: 'none' }} />

          {/* Floor outline polygon (if it has outline points) */}
          {floorOutlinePoints.length >= 3 && (
            <polygon
              points={floorOutlinePoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(74, 32, 128, 0.12)"
              stroke="#7c3aed"
              strokeWidth={strokeW * 1.5}
              strokeDasharray={lockedIndices.has(floorIndex) ? `${strokeW * 3} ${strokeW * 2}` : 'none'}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Outline drawing in progress */}
          {drawingOutline && outlinePoints.length > 0 && (
            <g>
              {/* Completed segments */}
              <polyline
                points={outlinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke="#7c3aed" strokeWidth={strokeW * 2}
              />
              {/* Preview line to cursor */}
              {cursorPos && (
                <line
                  x1={outlinePoints[outlinePoints.length - 1].x}
                  y1={outlinePoints[outlinePoints.length - 1].y}
                  x2={cursorPos.x} y2={cursorPos.y}
                  stroke="#7c3aed" strokeWidth={strokeW} strokeDasharray={`${strokeW * 2} ${strokeW}`} opacity={0.6}
                />
              )}
              {/* Close preview line */}
              {cursorPos && outlinePoints.length >= 3 && (
                <line
                  x1={cursorPos.x} y1={cursorPos.y}
                  x2={outlinePoints[0].x} y2={outlinePoints[0].y}
                  stroke="#7c3aed" strokeWidth={strokeW * 0.5} strokeDasharray={`${strokeW * 2} ${strokeW}`} opacity={0.3}
                />
              )}
              {/* Points */}
              {outlinePoints.map((p, pi) => (
                <circle key={pi} cx={p.x} cy={p.y} r={handleR * 1.2}
                  fill={pi === 0 ? '#22c55e' : '#7c3aed'} stroke="#fff" strokeWidth={strokeW * 0.75}
                />
              ))}
              {/* First point glow (close target) */}
              {outlinePoints.length >= 3 && (
                <circle cx={outlinePoints[0].x} cy={outlinePoints[0].y} r={handleR * 2.5}
                  fill="none" stroke="#22c55e" strokeWidth={strokeW} opacity={0.4}
                />
              )}
            </g>
          )}

          {/* Room overlays (non-floor) */}
          {sorted.map(({ room, i }) => {
            if (room.id === 'floor') return null; // floor rendered as polygon above
            const rx = room.x ?? 0, ry = room.y ?? 0;
            const rw = room.width ?? 100, rh = room.height ?? 100;
            const isSelected = i === selectedIndex;
            const isLocked = lockedIndices.has(i);
            const hasPos = rx > 0 || ry > 0;
            if (!hasPos && !isSelected) return null;

            const isDesk = room.id.startsWith('desk-');
            const fontSize = isDesk
              ? Math.max(8, Math.min(rw / 4, rh / 2, 14))
              : Math.max(14, Math.min(rw / 6, rh / 3, 32));

            const fillColor = isSelected
              ? (isDesk ? 'rgba(37, 99, 235, 0.35)' : 'rgba(74, 32, 128, 0.3)')
              : (isDesk ? 'rgba(37, 99, 235, 0.25)' : 'rgba(0, 0, 0, 0.3)');
            const strokeColor = isSelected
              ? (isDesk ? '#2563eb' : '#7c3aed')
              : isLocked ? '#999' : '#fff';

            return (
              <g key={i} opacity={isLocked ? 0.5 : 1}>
                <rect
                  x={rx} y={ry} width={rw} height={rh}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? strokeW * 1.5 : strokeW * (isDesk ? 0.5 : 1)}
                  strokeDasharray={isLocked ? `${strokeW * 3} ${strokeW * 2}` : 'none'}
                  rx={isDesk ? 2 : 4}
                  style={{ cursor: isLocked ? 'not-allowed' : 'move' }}
                />
                <text
                  x={rx + rw / 2} y={ry + rh / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill="#fff" fontSize={fontSize} fontFamily="Arial, sans-serif" fontWeight="600"
                  style={{ pointerEvents: 'none' }}
                >
                  {room.label || room.id || `Room ${i + 1}`}
                </text>

                {/* 8 resize handles when selected */}
                {isSelected && !isLocked && HANDLES.map(h => {
                  const [hx, hy] = getHandlePos(h, rx, ry, rw, rh);
                  return (
                    <circle
                      key={h}
                      cx={hx} cy={hy} r={handleR}
                      fill="#7c3aed" stroke="#fff" strokeWidth={strokeW * 0.75}
                      style={{ cursor: HANDLE_CURSORS[h] }}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Placed icons */}
          {icons.map((ic, idx) => {
            const r = Math.max(30, (imageDims?.width ?? 1000) * 0.012);
            const fs = Math.max(16, r * 0.7);
            const labelFs = Math.max(12, r * 0.5);
            return (
              <g key={`icon-${idx}`} transform={`translate(${ic.x - r}, ${ic.y - r})`}>
                <circle cx={r} cy={r} r={r} fill="#7c3aed" opacity="0.9" />
                <text x={r} y={r + 1} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={fs} fontFamily="Arial" fontWeight="700" style={{ pointerEvents: 'none' }}>
                  {ic.label.slice(0, 2).toUpperCase()}
                </text>
                <text x={r} y={r * 2 + labelFs + 4} textAnchor="middle" fill="#333" fontSize={labelFs} fontFamily="Arial" fontWeight="600" style={{ pointerEvents: 'none' }}>
                  {ic.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Inline rename input */}
        {editing && (() => {
          const room = rooms[editing.index];
          if (!room || !svgRef.current || !containerRef.current) return null;
          const pt = svgRef.current.createSVGPoint();
          pt.x = (room.x ?? 0) + (room.width ?? 100) / 2;
          pt.y = (room.y ?? 0) + (room.height ?? 100) / 2;
          const ctm = svgRef.current.getScreenCTM();
          if (!ctm) return null;
          const sp = pt.matrixTransform(ctm);
          const cr = containerRef.current.getBoundingClientRect();
          return (
            <div style={{ position: 'absolute', left: sp.x - cr.left, top: sp.y - cr.top, transform: 'translate(-50%, -50%)', zIndex: 10 }}>
              <input
                autoFocus type="text" value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') finishEditing(); if (e.key === 'Escape') setEditing(null); }}
                onBlur={finishEditing}
                style={{
                  padding: '4px 8px', border: '2px solid #7c3aed', borderRadius: 4,
                  fontSize: '0.85rem', fontWeight: 600, width: 180, textAlign: 'center',
                  background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', outline: 'none',
                }}
              />
            </div>
          );
        })()}
      </div>
      </div>{/* end flex wrapper */}
    </div>
  );
}

function getHandlePos(h: Handle, x: number, y: number, w: number, h2: number): [number, number] {
  const mx = x + w / 2, my = y + h2 / 2;
  switch (h) {
    case 'nw': return [x, y];
    case 'n':  return [mx, y];
    case 'ne': return [x + w, y];
    case 'e':  return [x + w, my];
    case 'se': return [x + w, y + h2];
    case 's':  return [mx, y + h2];
    case 'sw': return [x, y + h2];
    case 'w':  return [x, my];
  }
}
