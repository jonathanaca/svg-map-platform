import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Floorplan, EditorState, MapObject, MapObjectType, EditorLayer, AvailabilityState } from '@svg-map/types';
import {
  getFloorplan,
  getProject,
  saveCanvasState,
  uploadSourceImage,
  listObjects,
  createObject,
  updateObject,
  deleteObject,
  bulkUpsertObjects,
  exportObjectsCsv,
  importObjectsCsv,
} from '../lib/api.js';
import PropertiesPanel from '../components/PropertiesPanel.js';
import LayerPanel, { DEFAULT_LAYERS } from '../components/LayerPanel.js';
import ValidationPanel from '../components/ValidationPanel.js';
import LabellingPanel from '../components/LabellingPanel.js';
import AvailabilityPreview, { getAvailabilityColor } from '../components/AvailabilityPreview.js';

type Tool = 'select' | 'rect' | 'polygon' | 'pen';
type EditorMode = 'design' | 'label' | 'preview';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
  se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
};

const TYPE_COLORS: Record<string, string> = {
  room: '#7c3aed',
  desk: '#2563eb',
  zone: '#059669',
  area: '#0891b2',
  amenity: '#dc2626',
  decorative: '#6b7280',
  parking: '#d97706',
  locker: '#9333ea',
};

const AMENITY_ICONS: { id: string; label: string; emoji: string; svg: string }[] = [
  { id: 'male-restroom', label: 'Male Restroom', emoji: '🚹', svg: '<path d="M12 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm1 2h-2a2 2 0 0 0-2 2v5h2v7h2v-7h2V8a2 2 0 0 0-2-2z"/>' },
  { id: 'female-restroom', label: 'Female Restroom', emoji: '🚺', svg: '<path d="M12 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm2 2h-4l-1 7h2v7h2v-7h2l-1-7z"/>' },
  { id: 'accessible-restroom', label: 'Accessible', emoji: '♿', svg: '<circle cx="12" cy="4" r="2"/><path d="M14 20h-2l-2-6H8l-1-4h5l1 4h3l1 6z"/>' },
  { id: 'staircase', label: 'Staircase', emoji: '🪜', svg: '<path d="M4 20h4v-4h4v-4h4v-4h4V4" stroke-width="2" fill="none" stroke="currentColor"/>' },
  { id: 'elevator', label: 'Elevator', emoji: '🛗', svg: '<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 8l3 4h-6l3-4zm0 8l-3-4h6l-3 4z"/>' },
  { id: 'fire-exit', label: 'Fire Exit', emoji: '🚪', svg: '<path d="M10 3H4v18h6m4-9h6m-3-3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 6l-2 3 2 3" fill="none" stroke="#dc2626" stroke-width="2"/>' },
  { id: 'cafe', label: 'Cafe', emoji: '☕', svg: '<path d="M5 12h10v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-4zm10 2h2a2 2 0 0 0 0-4h-2M7 8c0-2 1-3 3-4m2 0c2 1 3 2 3 4" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
  { id: 'reception', label: 'Reception', emoji: '🛎️', svg: '<path d="M5 18h14M6 14h12a6 6 0 0 0-12 0zm5-6V6m-3 2h6" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
  { id: 'aed', label: 'AED', emoji: '💚', svg: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 9v6m-3-3h6" stroke="#16a34a" stroke-width="2.5"/>' },
  { id: 'first-aid', label: 'First Aid', emoji: '🏥', svg: '<rect x="3" y="5" width="18" height="14" rx="2" fill="#dc2626" fill-opacity="0.15" stroke="#dc2626" stroke-width="1.5"/><path d="M12 9v6m-3-3h6" stroke="#dc2626" stroke-width="2.5"/>' },
  { id: 'lockers', label: 'Lockers', emoji: '🔐', svg: '<rect x="3" y="4" width="7" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="4" width="7" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6.5" cy="12" r="1"/><circle cx="17.5" cy="12" r="1"/>' },
  { id: 'presentation', label: 'Presentation', emoji: '📽️', svg: '<rect x="2" y="4" width="20" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 17v3m-4 0h8" stroke="currentColor" stroke-width="1.5"/>' },
];

const FURNITURE_ASSETS: { id: string; label: string; icon: string; svg: string; w: number; h: number; color: string }[] = [
  // Furniture
  { id: 'desk-single', label: 'Single Desk', icon: 'D', svg: '<rect x="3" y="8" width="18" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 18v3M17 18v3M7 8V5h10v3" fill="none" stroke="currentColor" stroke-width="1.5"/>', w: 30, h: 20, color: '#2563eb' },
  { id: 'desk-pair', label: 'Desk Pair', icon: 'DD', svg: '<rect x="2" y="6" width="9" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="6" width="9" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 13v3M8 13v3M16 13v3M19 13v3" fill="none" stroke="currentColor" stroke-width="1.5"/>', w: 50, h: 20, color: '#2563eb' },
  { id: 'desk-pod', label: 'Desk Pod (4)', icon: '4D', svg: '<rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="13" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="3" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/>', w: 50, h: 40, color: '#2563eb' },
  { id: 'table-small', label: 'Small Table', icon: 'T', svg: '<rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3"/>', w: 30, h: 30, color: '#92400e' },
  { id: 'table-medium', label: 'Medium Table', icon: 'T', svg: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 10h8M8 14h8" stroke="currentColor" stroke-width="1" opacity="0.3"/>', w: 50, h: 30, color: '#92400e' },
  { id: 'table-large', label: 'Large Table', icon: 'T', svg: '<rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 9h10M7 12h10M7 15h10" stroke="currentColor" stroke-width="1" opacity="0.3"/>', w: 80, h: 40, color: '#92400e' },
  { id: 'table-round', label: 'Round Table', icon: 'O', svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.2"/>', w: 30, h: 30, color: '#92400e' },
  { id: 'standing-desk', label: 'Standing Desk', icon: 'SD', svg: '<rect x="4" y="4" width="16" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 12v8M16 12v8M6 20h4M14 20h4" fill="none" stroke="currentColor" stroke-width="1.5"/>', w: 30, h: 15, color: '#4f46e5' },
  // Seating
  { id: 'bench', label: 'Bench', icon: 'B', svg: '<rect x="2" y="10" width="20" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 14v4M19 14v4" fill="none" stroke="currentColor" stroke-width="1.5"/>', w: 50, h: 12, color: '#059669' },
  { id: 'lounge-chair', label: 'Lounge Chair', icon: 'LC', svg: '<path d="M6 8a6 6 0 0 1 12 0v6H6V8z" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="14" width="16" height="4" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 12v4M20 12v4" stroke="currentColor" stroke-width="1.5"/>', w: 25, h: 25, color: '#059669' },
  { id: 'sofa', label: 'Sofa', icon: 'So', svg: '<rect x="2" y="8" width="20" height="8" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 8V6a2 2 0 0 1 4 0v2M15 8V6a2 2 0 0 1 4 0v2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 12h2M20 12h2" stroke="currentColor" stroke-width="1.5"/>', w: 55, h: 22, color: '#059669' },
  { id: 'phone-booth', label: 'Phone Booth', icon: 'PB', svg: '<rect x="5" y="2" width="14" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 6h6M9 2v2M15 2v2" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="14" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/>', w: 25, h: 25, color: '#7c3aed' },
  // Storage & utilities
  { id: 'lockers', label: 'Lockers', icon: 'Lk', svg: '<rect x="2" y="4" width="6" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="4" width="6" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="16" y="4" width="6" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5" cy="12" r="0.8" fill="currentColor"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/><circle cx="19" cy="12" r="0.8" fill="currentColor"/>', w: 40, h: 15, color: '#4b5563' },
  { id: 'filing-cabinet', label: 'Filing Cabinet', icon: 'FC', svg: '<rect x="5" y="2" width="14" height="20" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 8h14M5 14h14" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="5" r="0.8" fill="currentColor"/><circle cx="12" cy="11" r="0.8" fill="currentColor"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/>', w: 15, h: 20, color: '#4b5563' },
  { id: 'bookshelf', label: 'Bookshelf', icon: 'BS', svg: '<rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.3"/><path d="M7 3v6M11 3v6M16 9v6M9 9v6M7 15v6M13 15v6" stroke="currentColor" stroke-width="1" opacity="0.5"/>', w: 40, h: 12, color: '#92400e' },
  { id: 'printer', label: 'Printer', icon: 'Pr', svg: '<rect x="4" y="10" width="16" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="4" width="12" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 18v3h8v-3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 14h8" stroke="currentColor" stroke-width="1" opacity="0.4"/>', w: 20, h: 20, color: '#374151' },
  // Decorative
  { id: 'plant', label: 'Plant', icon: 'Pl', svg: '<path d="M12 20v-8" stroke="currentColor" stroke-width="1.5"/><path d="M8 12c0-4 4-8 4-8s4 4 4 8" fill="none" stroke="#16a34a" stroke-width="1.5"/><path d="M6 14c0-3 3-6 6-6M18 14c0-3-3-6-6-6" fill="none" stroke="#16a34a" stroke-width="1.3" opacity="0.6"/><ellipse cx="12" cy="20" rx="3" ry="2" fill="none" stroke="currentColor" stroke-width="1.3"/>', w: 12, h: 12, color: '#16a34a' },
  { id: 'plant-large', label: 'Large Plant', icon: 'PL', svg: '<path d="M12 22v-10" stroke="currentColor" stroke-width="1.5"/><path d="M6 12c0-5 6-10 6-10s6 5 6 10" fill="none" stroke="#16a34a" stroke-width="1.5"/><path d="M4 14c0-4 4-8 8-8M20 14c0-4-4-8-8-8" fill="none" stroke="#16a34a" stroke-width="1.3" opacity="0.5"/><path d="M9 22h6" stroke="currentColor" stroke-width="1.5"/>', w: 18, h: 18, color: '#16a34a' },
  { id: 'partition', label: 'Partition Wall', icon: '||', svg: '<rect x="2" y="6" width="20" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 12h20" stroke="currentColor" stroke-width="1" opacity="0.3"/>', w: 60, h: 4, color: '#6b7280' },
  { id: 'whiteboard', label: 'Whiteboard', icon: 'WB', svg: '<rect x="2" y="4" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 8h12M6 11h8" stroke="currentColor" stroke-width="1" opacity="0.4"/><path d="M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.3"/>', w: 40, h: 5, color: '#e5e7eb' },
  { id: 'tv-screen', label: 'TV/Screen', icon: 'TV', svg: '<rect x="2" y="4" width="20" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 17v2M16 17v2M6 19h12" stroke="currentColor" stroke-width="1.3"/><path d="M7 8l4 3-4 3" fill="currentColor" opacity="0.3"/>', w: 35, h: 5, color: '#1f2937' },
  { id: 'bin', label: 'Waste Bin', icon: 'Bn', svg: '<path d="M6 6h12l-1 14H7L6 6z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 6h16" stroke="currentColor" stroke-width="1.5"/><path d="M9 3h6v3H9z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10 9v8M14 9v8" stroke="currentColor" stroke-width="1" opacity="0.4"/>', w: 8, h: 8, color: '#6b7280' },
];

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

function layerToObjectType(layerId: string): MapObjectType {
  switch (layerId) {
    case 'rooms': return 'room';
    case 'desks': return 'desk';
    case 'lockers': return 'locker';
    case 'zones': return 'zone';
    case 'areas': return 'area';
    case 'amenities': return 'amenity';
    case 'walls': return 'decorative';
    default: return 'room';
  }
}

const DEFAULT_EDITOR_STATE: EditorState = {
  objects: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedIds: [],
  layers: DEFAULT_LAYERS,
  gridEnabled: true,
  snapEnabled: true,
  gridSize: 20,
};

export default function EditorPage() {
  const { floorplanId } = useParams<{ floorplanId: string }>();
  const navigate = useNavigate();

  const [floorplan, setFloorplan] = useState<Floorplan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [editorState, setEditorState] = useState<EditorState>(DEFAULT_EDITOR_STATE);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Mode state
  const [editorMode, setEditorMode] = useState<EditorMode>('design');

  // Object state (loaded from API)
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Undo/Redo history
  const undoStack = useRef<MapObject[][]>([]);
  const redoStack = useRef<MapObject[][]>([]);
  const lastSnapshot = useRef<string>('');

  const pushUndo = useCallback(() => {
    const snap = JSON.stringify(objects);
    if (snap === lastSnapshot.current) return;
    undoStack.current.push(JSON.parse(lastSnapshot.current || '[]'));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    lastSnapshot.current = snap;
  }, [objects]);

  // Take snapshot after objects change settles (debounced)
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(() => {
      const snap = JSON.stringify(objects);
      if (snap !== lastSnapshot.current && lastSnapshot.current !== '') {
        undoStack.current.push(JSON.parse(lastSnapshot.current));
        if (undoStack.current.length > 50) undoStack.current.shift();
        redoStack.current = [];
      }
      lastSnapshot.current = snap;
    }, 500);
  }, [objects]);

  // Initialize snapshot when objects first load
  useEffect(() => {
    if (objects.length > 0 && lastSnapshot.current === '') {
      lastSnapshot.current = JSON.stringify(objects);
    }
  }, [objects]);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(JSON.parse(lastSnapshot.current));
    lastSnapshot.current = JSON.stringify(prev);
    setObjects(prev);
    setSelectedObjectId(null);
    setDirty(true);
    // Sync to API
    if (floorplanId) {
      bulkUpsertObjects(floorplanId, prev).catch(() => {});
    }
  }, [floorplanId]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(JSON.parse(lastSnapshot.current));
    lastSnapshot.current = JSON.stringify(next);
    setObjects(next);
    setSelectedObjectId(null);
    setDirty(true);
    if (floorplanId) {
      bulkUpsertObjects(floorplanId, next).catch(() => {});
    }
  }, [floorplanId]);

  // Layer state
  const [layers, setLayers] = useState<EditorLayer[]>(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState<string>('rooms');

  // Place tool size state
  const [placeWidth, setPlaceWidth] = useState(80);
  const [placeHeight, setPlaceHeight] = useState(60);

  // Quote requirements popup
  const [quoteReqs, setQuoteReqs] = useState<{ rooms: number; desks: number; lockers: number; carspaces: number } | null>(null);
  const [showReqsPopup, setShowReqsPopup] = useState(false);

  // Availability preview state
  const [availabilityEnabled, setAvailabilityEnabled] = useState(false);
  const [availabilityStates, setAvailabilityStates] = useState<Record<string, AvailabilityState>>({});

  // Amenity placement state
  const [placingAmenity, setPlacingAmenity] = useState<string | null>(null);
  const [showAmenityPicker, setShowAmenityPicker] = useState(false);

  // Furniture placement state
  const [placingFurniture, setPlacingFurniture] = useState<string | null>(null);
  const [showFurniturePicker, setShowFurniturePicker] = useState(false);

  // Bottom panel tab state (for label mode)
  const [bottomTab, setBottomTab] = useState<'labelling' | 'validation'>('labelling');

  // Canvas refs (FloorplanEditor pattern)
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image dimensions for SVG viewBox
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);

  // Zoom (CSS scale on SVG, scroll-to-pan via container overflow)
  const [zoom, setZoom] = useState(1);

  // Interaction state (FloorplanEditor pattern)
  const [dragging, setDragging] = useState<{ objectId: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ objectId: string; handle: Handle; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);
  const [drawing, setDrawing] = useState<{ objectId: string; startX: number; startY: number } | null>(null);
  const [editing, setEditing] = useState<{ objectId: string; value: string } | null>(null);

  // Auto-save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Coordinate conversion (FloorplanEditor pattern) ─────────────────
  function toSvgCoords(clientX: number, clientY: number): { x: number; y: number } {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(svgPt.x), y: Math.round(svgPt.y) };
  }

  // ── Load background image dimensions ────────────────────────────────
  useEffect(() => {
    if (!floorplan?.source_image_path) return;
    const img = new Image();
    img.onload = () => setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = `/api/floorplans/${floorplan.id}/source-preview`;
  }, [floorplan?.source_image_path, floorplan?.id]);

  // Source image upload handler
  const handleUploadSource = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !floorplanId) return;
    try {
      await uploadSourceImage(floorplanId, file);
      const fp = await getFloorplan(floorplanId);
      setFloorplan(fp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [floorplanId]);

  // Load floorplan + objects
  useEffect(() => {
    if (!floorplanId) return;
    setLoading(true);
    Promise.all([getFloorplan(floorplanId), listObjects(floorplanId)])
      .then(async ([fp, objs]) => {
        setFloorplan(fp);
        setObjects(objs);
        // Load quote requirements from project metadata
        try {
          const proj = await getProject(fp.project_id as string);
          const meta = proj.metadata ? JSON.parse(proj.metadata as string) : null;
          if (meta?.source === 'wmquote') {
            const req = meta.requirements || meta;
            const reqs = { rooms: req.rooms ?? req.num_rooms ?? 0, desks: req.desks ?? req.num_desks ?? 0, lockers: req.lockers ?? req.num_lockers ?? 0, carspaces: req.carspaces ?? req.num_carspaces ?? 0 };
            if (reqs.rooms || reqs.desks || reqs.lockers || reqs.carspaces) {
              setQuoteReqs(reqs);
              setShowReqsPopup(true);
            }
          }
        } catch { /* ignore if project fetch fails */ }
        if (fp.canvas_state) {
          setEditorState(fp.canvas_state);
          if (fp.canvas_state.viewport?.zoom) {
            setZoom(fp.canvas_state.viewport.zoom);
          }
          if (fp.canvas_state.layers.length > 0) {
            // Merge any missing default layers into saved state
            const savedIds = new Set(fp.canvas_state.layers.map((l: EditorLayer) => l.id));
            const merged = [...fp.canvas_state.layers];
            for (const def of DEFAULT_LAYERS) {
              if (!savedIds.has(def.id)) merged.push(def);
            }
            setLayers(merged);
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load floorplan'))
      .finally(() => setLoading(false));
  }, [floorplanId]);

  // Sync objects into editorState for saving
  useEffect(() => {
    setEditorState((prev) => ({ ...prev, objects, layers }));
  }, [objects, layers]);

  // Auto-save debounce
  useEffect(() => {
    if (!dirty || !floorplanId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 10000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [dirty, editorState]);

  const handleSave = useCallback(async () => {
    if (!floorplanId) return;
    setSaving(true);
    try {
      const stateToSave: EditorState = {
        ...editorState,
        viewport: { x: 0, y: 0, zoom },
        objects,
        layers,
        selectedIds: selectedObjectId ? [selectedObjectId] : [],
      };
      await saveCanvasState(floorplanId, stateToSave);
      setDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }, [floorplanId, editorState, zoom, objects, layers, selectedObjectId]);

  // ── Object CRUD handlers ───────────────────────────────────────────────

  const handleObjectChange = useCallback(
    async (id: string, updates: Partial<MapObject>) => {
      setObjects((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...updates } : o)),
      );
      setDirty(true);
      try {
        await updateObject(id, updates);
      } catch {
        // revert on failure could be added here
      }
    },
    [],
  );

  const handleObjectDelete = useCallback(
    async (id: string) => {
      setObjects((prev) => prev.filter((o) => o.id !== id));
      if (selectedObjectId === id) setSelectedObjectId(null);
      setDirty(true);
      try {
        await deleteObject(id);
      } catch {
        // could revert
      }
    },
    [selectedObjectId],
  );

  const handleBulkUpdate = useCallback(
    async (ids: string[], updates: Partial<MapObject>) => {
      // If updates is empty, this is a "select by type" signal
      if (Object.keys(updates).length === 0) {
        if (ids.length > 0) setSelectedObjectId(ids[0]);
        return;
      }
      setObjects((prev) =>
        prev.map((o) => (ids.includes(o.id) ? { ...o, ...updates } : o)),
      );
      setDirty(true);
      if (floorplanId) {
        try {
          const bulkObjs = ids.map((id) => ({ id, ...updates }));
          await bulkUpsertObjects(floorplanId, bulkObjs);
        } catch {
          // could revert
        }
      }
    },
    [floorplanId],
  );

  const handleAutoNumber = useCallback(
    (prefix: string, startFrom: number) => {
      // Determine which type to auto-number: use prefix to guess, or selected object's type
      const typeFromPrefix = prefix.replace(/-$/, '').toLowerCase();
      const matchType = selectedObjectId
        ? objects.find((o) => o.id === selectedObjectId)?.object_type
        : ['room', 'desk', 'zone', 'area', 'amenity'].find(t => typeFromPrefix.includes(t)) || 'room';
      if (!matchType) return;

      const sameTypeObjects = objects.filter((o) => o.object_type === matchType);
      const updates: { id: string; svg_id: string; label?: string }[] = sameTypeObjects.map((o, idx) => {
        const newSvgId = `${prefix}${String(startFrom + idx).padStart(3, '0')}`;
        // Only set label if it doesn't already have a meaningful one (just the default "Room X" pattern)
        const defaultPattern = new RegExp(`^${matchType}\\s+\\d+$`, 'i');
        const needsLabel = !o.label || defaultPattern.test(o.label);
        return {
          id: o.id,
          svg_id: newSvgId,
          ...(needsLabel ? { label: `${matchType.charAt(0).toUpperCase() + matchType.slice(1)} ${startFrom + idx}` } : {}),
        };
      });

      setObjects((prev) =>
        prev.map((o) => {
          const u = updates.find((up) => up.id === o.id);
          return u ? { ...o, svg_id: u.svg_id, ...(u.label ? { label: u.label } : {}) } : o;
        }),
      );
      setDirty(true);

      // Persist each update individually
      for (const u of updates) {
        const payload: Record<string, string> = { svg_id: u.svg_id };
        if (u.label) payload.label = u.label;
        updateObject(u.id, payload).catch(() => {});
      }
    },
    [selectedObjectId, objects, floorplanId],
  );

  const handleExportCsv = useCallback(async () => {
    if (!floorplanId) return;
    try {
      const csv = await exportObjectsCsv(floorplanId);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `objects-${floorplanId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  }, [floorplanId]);

  const handleImportCsv = useCallback(
    async (file: File) => {
      if (!floorplanId) return;
      try {
        await importObjectsCsv(floorplanId, file);
        const objs = await listObjects(floorplanId);
        setObjects(objs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import CSV');
      }
    },
    [floorplanId],
  );

  const handleSelectObjectFromValidation = useCallback((objectId: string) => {
    setSelectedObjectId(objectId);
    setEditorMode('design');
    // Scroll to object in the container
    const obj = objects.find((o) => o.id === objectId);
    if (obj && containerRef.current && svgRef.current) {
      const gx = obj.geometry.x ?? 0;
      const gy = obj.geometry.y ?? 0;
      // Approximate scroll position
      const canvasW = imageDims?.width ?? (floorplan?.canvas_width ?? 1000);
      const canvasH = imageDims?.height ?? (floorplan?.canvas_height ?? 800);
      const el = containerRef.current;
      const svgDisplayW = canvasW * zoom;
      const svgDisplayH = canvasH * zoom;
      el.scrollLeft = (gx / canvasW) * svgDisplayW - el.clientWidth / 2;
      el.scrollTop = (gy / canvasH) * svgDisplayH - el.clientHeight / 2;
    }
  }, [objects, zoom, imageDims, floorplan]);

  // ── Layer handlers ─────────────────────────────────────────────────────

  const handleLayerChange = useCallback((updated: EditorLayer[]) => {
    setLayers(updated);
    setDirty(true);
  }, []);

  const handleAddLayer = useCallback(
    (name: string) => {
      const maxOrder = layers.reduce((m, l) => Math.max(m, l.order), 0);
      const newLayer: EditorLayer = {
        id: `layer-${Date.now()}`,
        name,
        visible: true,
        locked: false,
        opacity: 1,
        order: maxOrder + 1,
      };
      setLayers((prev) => [...prev, newLayer]);
      setDirty(true);
    },
    [layers],
  );

  const handleDeleteLayer = useCallback(
    (id: string) => {
      setLayers((prev) => prev.filter((l) => l.id !== id));
      if (activeLayerId === id) {
        setActiveLayerId(layers[0]?.id ?? 'rooms');
      }
      setDirty(true);
    },
    [activeLayerId, layers],
  );

  // ── Availability handlers ──────────────────────────────────────────────

  const handleAvailabilityStateChange = useCallback(
    (objectId: string, state: AvailabilityState) => {
      setAvailabilityStates((prev) => ({ ...prev, [objectId]: state }));
    },
    [],
  );

  // Polygon outline drawing state
  const [outlinePoints, setOutlinePoints] = useState<{ x: number; y: number }[]>([]);
  const [drawingOutline, setDrawingOutline] = useState(false);

  // Rectangle drag-draw state
  const [rectDraw, setRectDraw] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  function startOutlineDrawing() {
    setActiveTool('polygon');
    setDrawingOutline(true);
    setOutlinePoints([]);
    setSelectedObjectId(null);
  }

  // ── Canvas mouse handlers ────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const { x, y } = toSvgCoords(e.clientX, e.clientY);

    // ── Amenity placement mode ──
    if (placingAmenity && floorplanId) {
      const amenityInfo = AMENITY_ICONS.find(a => a.id === placingAmenity);
      const existingAmenities = objects.filter(o => o.object_type === 'amenity').length;
      const label = amenityInfo?.label ?? 'Amenity';
      const svgId = `amenity-${String(existingAmenities + 1).padStart(3, '0')}`;

      createObject(floorplanId, {
        object_type: 'amenity',
        label,
        svg_id: svgId,
        geometry: { type: 'circle', x, y, r: 12 },
        layer: 'amenities',
        fill_color: '#dc2626',
        stroke_color: '#ffffff',
        opacity: 1,
        visible: true,
        locked: false,
        z_index: objects.length,
        metadata: { icon: placingAmenity },
      }).then((newObj) => {
        setObjects((prev) => [...prev, newObj]);
        setDirty(true);
      }).catch(console.error);

      e.preventDefault();
      return;
    }

    // ── Furniture placement mode ──
    if (placingFurniture && floorplanId) {
      const asset = FURNITURE_ASSETS.find(a => a.id === placingFurniture);
      if (asset) {
        const existingFurniture = objects.filter(o => o.object_type === 'decorative').length;
        createObject(floorplanId, {
          object_type: 'decorative',
          label: asset.label,
          svg_id: `furniture-${String(existingFurniture + 1).padStart(3, '0')}`,
          geometry: { type: 'rect', x: x - asset.w / 2, y: y - asset.h / 2, width: asset.w, height: asset.h },
          layer: 'background',
          fill_color: asset.color + '88',
          stroke_color: asset.color,
          opacity: 1,
          visible: true,
          locked: false,
          z_index: objects.length,
          metadata: { furnitureType: asset.id },
        }).then((newObj) => {
          setObjects((prev) => [...prev, newObj]);
          setDirty(true);
        }).catch(console.error);
      }
      e.preventDefault();
      return;
    }

    // ── Polygon tool: click to add points, click green dot to close ──
    if (activeTool === 'polygon') {
      if (outlinePoints.length >= 3) {
        const first = outlinePoints[0];
        const closeThreshold = Math.max((imageDims?.width ?? 1000), (imageDims?.height ?? 1000)) * 0.015;
        if (Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2) < closeThreshold) {
          // Close the polygon — create object from it
          if (floorplanId) {
            const xs = outlinePoints.map(p => p.x);
            const ys = outlinePoints.map(p => p.y);
            const objectType = drawingOutline ? 'area' : layerToObjectType(activeLayerId);
            const existingCount = objects.filter(o => o.object_type === objectType).length;
            const typeName = objectType.charAt(0).toUpperCase() + objectType.slice(1);
            const label = drawingOutline ? 'Floor Outline' : `${typeName} ${existingCount + 1}`;
            const svgId = drawingOutline ? 'floor-outline' : `${objectType}-${String(existingCount + 1).padStart(3, '0')}`;
            const color = drawingOutline ? '#374151' : (TYPE_COLORS[objectType] ?? '#4b5563');

            createObject(floorplanId, {
              object_type: objectType,
              label,
              svg_id: svgId,
              geometry: { type: 'polygon', points: outlinePoints, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) },
              layer: drawingOutline ? 'background' : activeLayerId,
              fill_color: drawingOutline ? 'rgba(107,114,128,0.15)' : color + '55',
              stroke_color: color,
              opacity: 1,
              visible: true,
              locked: false,
              z_index: drawingOutline ? 0 : objects.length,
            }).then((newObj) => {
              setObjects((prev) => [...prev, newObj]);
              setSelectedObjectId(newObj.id);
              setDirty(true);
            }).catch(console.error);
          }
          setDrawingOutline(false);
          setOutlinePoints([]);
          setActiveTool('select');
          e.preventDefault();
          return;
        }
      }
      // Shift key: constrain to horizontal or vertical from last point
      let px = x, py = y;
      if (e.shiftKey && outlinePoints.length > 0) {
        const last = outlinePoints[outlinePoints.length - 1];
        const dx = Math.abs(x - last.x);
        const dy = Math.abs(y - last.y);
        if (dx > dy) {
          py = last.y; // horizontal line
        } else {
          px = last.x; // vertical line
        }
      }
      setOutlinePoints(prev => [...prev, { x: px, y: py }]);
      e.preventDefault();
      return;
    }

    // ── Select tool: try to select/move objects ──
    if (activeTool === 'select') {
      // Check resize handles first
      if (selectedObjectId) {
        const sel = objects.find((o) => o.id === selectedObjectId);
        if (sel && sel.geometry.type === 'rect') {
          const sx = sel.geometry.x ?? 0, sy = sel.geometry.y ?? 0;
          const sw = sel.geometry.width ?? 100, sh = sel.geometry.height ?? 100;
          const canvasSize = Math.max(imageDims?.width ?? 1000, imageDims?.height ?? 1000);
          const hs = Math.max(15, canvasSize * 0.008);
          for (const h of HANDLES) {
            const [hx, hy] = getHandlePos(h, sx, sy, sw, sh);
            if (Math.abs(x - hx) < hs && Math.abs(y - hy) < hs) {
              setResizing({ objectId: selectedObjectId, handle: h, startX: x, startY: y, origX: sx, origY: sy, origW: sw, origH: sh });
              e.preventDefault();
              return;
            }
          }
        }
      }

      // Find object under cursor (supports rect, circle, polygon)
      const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));
      const hits: { id: string; area: number }[] = [];
      for (const obj of objects) {
        if (!obj.visible || !visibleLayerIds.has(obj.layer)) continue;
        const geom = obj.geometry;
        if (geom.type === 'rect') {
          const rx = geom.x ?? 0, ry = geom.y ?? 0;
          const rw = geom.width ?? 100, rh = geom.height ?? 100;
          if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
            hits.push({ id: obj.id, area: rw * rh });
          }
        } else if (geom.type === 'circle') {
          const cx = geom.x ?? 0, cy = geom.y ?? 0, cr = geom.r ?? 12;
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist <= cr + 5) {
            hits.push({ id: obj.id, area: cr * cr * Math.PI });
          }
        } else if (geom.type === 'polygon' && geom.points) {
          const bx = geom.x ?? 0, by = geom.y ?? 0;
          const bw = geom.width ?? 100, bh = geom.height ?? 100;
          if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
            hits.push({ id: obj.id, area: bw * bh });
          }
        }
      }
      if (hits.length > 0) {
        hits.sort((a, b) => a.area - b.area);
        const hitId = hits[0].id;
        const hitObj = objects.find((o) => o.id === hitId)!;
        setSelectedObjectId(hitId);
        setDragging({ objectId: hitId, offsetX: x - (hitObj.geometry.x ?? 0), offsetY: y - (hitObj.geometry.y ?? 0) });
        e.preventDefault();
        return;
      }
      // Click empty space — deselect
      setSelectedObjectId(null);
      return;
    }

    // ── Rect tool: start drag-draw ──
    if (activeTool === 'rect') {
      setRectDraw({ startX: x, startY: y, currentX: x, currentY: y });
      e.preventDefault();
      return;
    }

    // ── Pen tool: click to create object at point ──
    if (activeTool === 'pen' && floorplanId && editorMode === 'design') {
      const objectType = layerToObjectType(activeLayerId);
      const existingCount = objects.filter((o) => o.object_type === objectType).length;
      const typeName = objectType.charAt(0).toUpperCase() + objectType.slice(1);
      const label = `${typeName} ${existingCount + 1}`;
      const svgId = `${objectType}-${String(existingCount + 1).padStart(3, '0')}`;
      const color = TYPE_COLORS[objectType] ?? '#4b5563';

      createObject(floorplanId, {
        object_type: objectType,
        label,
        svg_id: svgId,
        geometry: { type: 'rect', x: x - placeWidth / 2, y: y - placeHeight / 2, width: placeWidth, height: placeHeight },
        layer: activeLayerId,
        fill_color: color + '55',
        stroke_color: color,
        opacity: 1,
        visible: true,
        locked: false,
        z_index: objects.length,
      }).then((newObj) => {
        setObjects((prev) => [...prev, newObj]);
        setSelectedObjectId(newObj.id);
        setDirty(true);
      }).catch(console.error);
      e.preventDefault();
      return;
    }
  }, [activeTool, drawingOutline, outlinePoints, selectedObjectId, objects, layers, floorplanId, editorMode, activeLayerId, imageDims, placeWidth, placeHeight]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const { x, y } = toSvgCoords(e.clientX, e.clientY);

    if (dragging) {
      const obj = objects.find((o) => o.id === dragging.objectId);
      if (!obj) return;
      const newX = Math.max(0, x - dragging.offsetX);
      const newY = Math.max(0, y - dragging.offsetY);
      setObjects((prev) =>
        prev.map((o) =>
          o.id === dragging.objectId
            ? { ...o, geometry: { ...o.geometry, x: newX, y: newY } }
            : o,
        ),
      );
    } else if (resizing) {
      const { handle, origX, origY, origW, origH } = resizing;
      let nx = origX, ny = origY, nw = origW, nh = origH;

      if (handle.includes('w')) { nx = Math.min(x, origX + origW - 20); nw = origX + origW - nx; }
      if (handle.includes('e')) { nw = Math.max(20, x - origX); }
      if (handle.includes('n')) { ny = Math.min(y, origY + origH - 20); nh = origY + origH - ny; }
      if (handle.includes('s')) { nh = Math.max(20, y - origY); }

      setObjects((prev) =>
        prev.map((o) =>
          o.id === resizing.objectId
            ? { ...o, geometry: { ...o.geometry, x: nx, y: ny, width: nw, height: nh } }
            : o,
        ),
      );
    } else if (drawing) {
      const w = Math.abs(x - drawing.startX);
      const h = Math.abs(y - drawing.startY);
      const nx = Math.min(x, drawing.startX);
      const ny = Math.min(y, drawing.startY);
      setObjects((prev) =>
        prev.map((o) =>
          o.id === drawing.objectId
            ? { ...o, geometry: { ...o.geometry, x: nx, y: ny, width: Math.max(20, w), height: Math.max(20, h) } }
            : o,
        ),
      );
    } else if (rectDraw) {
      setRectDraw(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
    }
  }, [dragging, resizing, drawing, rectDraw, objects]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      // Persist the move
      const obj = objects.find((o) => o.id === dragging.objectId);
      if (obj) {
        updateObject(dragging.objectId, { geometry: obj.geometry }).catch(() => {});
        setDirty(true);
      }
      setDragging(null);
    }
    if (resizing) {
      const obj = objects.find((o) => o.id === resizing.objectId);
      if (obj) {
        updateObject(resizing.objectId, { geometry: obj.geometry }).catch(() => {});
        setDirty(true);
      }
      setResizing(null);
    }
    if (drawing) {
      const obj = objects.find((o) => o.id === drawing.objectId);
      if (obj) {
        updateObject(drawing.objectId, { geometry: obj.geometry }).catch(() => {});
        setDirty(true);
      }
      setDrawing(null);
    }
    if (rectDraw && floorplanId) {
      const rx = Math.min(rectDraw.startX, rectDraw.currentX);
      const ry = Math.min(rectDraw.startY, rectDraw.currentY);
      const rw = Math.abs(rectDraw.currentX - rectDraw.startX);
      const rh = Math.abs(rectDraw.currentY - rectDraw.startY);

      if (rw > 10 && rh > 10) {
        const objectType = layerToObjectType(activeLayerId);
        const existingCount = objects.filter((o) => o.object_type === objectType).length;
        const typeName = objectType.charAt(0).toUpperCase() + objectType.slice(1);
        const label = `${typeName} ${existingCount + 1}`;
        const svgId = `${objectType}-${String(existingCount + 1).padStart(3, '0')}`;
        const color = TYPE_COLORS[objectType] ?? '#4b5563';

        createObject(floorplanId, {
          object_type: objectType,
          label,
          svg_id: svgId,
          geometry: { type: 'rect', x: rx, y: ry, width: rw, height: rh },
          layer: activeLayerId,
          fill_color: color + '55',
          stroke_color: color,
          opacity: 1,
          visible: true,
          locked: false,
          z_index: objects.length,
        }).then((newObj) => {
          setObjects((prev) => [...prev, newObj]);
          setSelectedObjectId(newObj.id);
          setDirty(true);
        }).catch(console.error);
      }
      setRectDraw(null);
    }
  }, [dragging, resizing, drawing, rectDraw, objects, floorplanId, activeLayerId]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const { x, y } = toSvgCoords(e.clientX, e.clientY);
    const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));
    const hits: { id: string; area: number }[] = [];
    for (const obj of objects) {
      if (!obj.visible || !visibleLayerIds.has(obj.layer)) continue;
      if (obj.geometry.type !== 'rect') continue;
      const rx = obj.geometry.x ?? 0, ry = obj.geometry.y ?? 0;
      const rw = obj.geometry.width ?? 100, rh = obj.geometry.height ?? 100;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        hits.push({ id: obj.id, area: rw * rh });
      }
    }
    if (hits.length > 0) {
      hits.sort((a, b) => a.area - b.area);
      const hitId = hits[0].id;
      const hitObj = objects.find((o) => o.id === hitId);
      setSelectedObjectId(hitId);
      setEditing({ objectId: hitId, value: hitObj?.label || '' });
      e.preventDefault();
    }
  }, [objects, layers]);

  // Inline rename finish
  const finishEditing = useCallback(() => {
    if (!editing) return;
    const newLabel = editing.value || 'Untitled';
    handleObjectChange(editing.objectId, { label: newLabel });
    setEditing(null);
  }, [editing, handleObjectChange]);

  // Keyboard handler for delete + escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editing) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        setSelectedObjectId(null);
        setPlacingAmenity(null);
        setPlacingFurniture(null);
        setDrawingOutline(false);
        setOutlinePoints([]);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        e.preventDefault();
        handleObjectDelete(selectedObjectId);
      }
      // Ctrl+Z = Undo, Ctrl+Shift+Z or Ctrl+Y = Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedObjectId, editing, handleObjectDelete, handleUndo, handleRedo]);

  // Close dropdowns on click outside
  useEffect(() => {
    if (!showAmenityPicker && !showFurniturePicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setShowAmenityPicker(false);
        setShowFurniturePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAmenityPicker, showFurniturePicker]);

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (dirty && !saving) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dirty, saving, handleSave]);

  // Zoom: Ctrl+scroll = zoom, regular scroll = native scroll (pan via overflow:auto)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.min(Math.max(prev * delta, 0.2), 10));
      setDirty(true);
    }
    // Regular scroll is handled natively by the container overflow:auto
  }, []);

  // Grid/snap toggles
  const toggleGrid = () => {
    setEditorState((prev) => ({ ...prev, gridEnabled: !prev.gridEnabled }));
    setDirty(true);
  };
  const toggleSnap = () => {
    setEditorState((prev) => ({ ...prev, snapEnabled: !prev.snapEnabled }));
    setDirty(true);
  };

  // ── Derived data ───────────────────────────────────────────────────────

  const selectedObject = selectedObjectId
    ? objects.find((o) => o.id === selectedObjectId) ?? null
    : null;

  const selectedObjects = selectedObject ? [selectedObject] : [];

  const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  const visibleObjects = objects.filter(
    (o) => o.visible && visibleLayerIds.has(o.layer),
  );

  // Canvas dimensions
  const canvasW = Math.max(100, imageDims?.width ?? (floorplan?.canvas_width ?? 1000));
  const canvasH = Math.max(100, imageDims?.height ?? (floorplan?.canvas_height ?? 800));
  const zoomPercent = Math.round(zoom * 100);
  const objectCount = objects.length;

  // Stroke/handle sizing based on canvas
  const strokeW = Math.max(2, Math.min(canvasW / 500, 6));
  const handleR = Math.max(6, strokeW * 2);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="status-container" style={{ marginTop: 80 }}>
        <div className="spinner" />
        <p className="status-label">Loading editor...</p>
      </div>
    );
  }

  if (!floorplan) {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto' }}>
        <div className="alert alert-error">{error ?? 'Floorplan not found'}</div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        height: '100vh',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: 'var(--color-surface)',
      }}
    >
      {/* Quote requirements popup */}
      {showReqsPopup && quoteReqs && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowReqsPopup(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>What to Map</h3>
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 8, background: '#e8f0fb', color: '#4a90d9', fontWeight: 600 }}>from Quote</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Upload floor plan image', desc: 'Use Upload Image button' },
                { label: 'Draw the floor outline', desc: 'Use Draw Outline tool' },
                { label: 'Select each layer and draw', desc: 'Use Rect or Place tool — auto-labelled, click name to rename' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#4a90d9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.label}</div>
                    <div style={{ color: '#888', fontSize: '0.78rem' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 14px', background: '#f8f9fa', borderRadius: 10, marginBottom: 18 }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8 }}>To place on this floor:</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {quoteReqs.rooms > 0 && <span style={{ padding: '4px 12px', background: '#f3f0ff', borderRadius: 6, fontSize: '0.82rem' }}><strong>{quoteReqs.rooms}</strong> rooms</span>}
                {quoteReqs.desks > 0 && <span style={{ padding: '4px 12px', background: '#eff6ff', borderRadius: 6, fontSize: '0.82rem' }}><strong>{quoteReqs.desks}</strong> desks</span>}
                {quoteReqs.lockers > 0 && <span style={{ padding: '4px 12px', background: '#faf5ff', borderRadius: 6, fontSize: '0.82rem' }}><strong>{quoteReqs.lockers}</strong> lockers</span>}
                {quoteReqs.carspaces > 0 && <span style={{ padding: '4px 12px', background: '#ecfdf5', borderRadius: 6, fontSize: '0.82rem' }}><strong>{quoteReqs.carspaces}</strong> car spaces</span>}
              </div>
            </div>
            <button onClick={() => setShowReqsPopup(false)} style={{ width: '100%', padding: '12px', background: '#171c2f', color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>Got it</button>
          </div>
        </div>
      )}
      {/* Error toast */}
      {error && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid #fecaca',
          padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontWeight: 700, fontSize: '1rem', lineHeight: 1, padding: 0 }}
          >
            x
          </button>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="dc-toolbar" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', position: 'sticky', top: 0, zIndex: 10 }}>
        {/* Back + Breadcrumb */}
        <button
          className="dc-tool-btn"
          onClick={() => navigate(`/project/${floorplan.project_id}`)}
          title="Back to project"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', marginRight: 4 }}>Floor Plan Studio</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>/ {floorplan.floor_name}</span>
        <span className="dc-toolbar-sep" />

        {/* Mode switcher */}
        <div className="dc-toolbar-group" style={{ background: 'var(--color-bg)', borderRadius: 6, padding: 2 }}>
          {([
            { mode: 'design' as EditorMode, label: 'Design' },
            { mode: 'label' as EditorMode, label: 'Label' },
            { mode: 'preview' as EditorMode, label: 'Preview' },
          ]).map(({ mode, label }) => (
            <button
              key={mode}
              className="dc-tool-btn"
              style={{
                background: editorMode === mode ? 'var(--color-primary)' : 'transparent',
                color: editorMode === mode ? '#fff' : 'var(--color-text)',
                borderRadius: 4,
                padding: '4px 12px',
                fontWeight: editorMode === mode ? 600 : 400,
                fontSize: '0.78rem',
                transition: 'all 150ms ease',
              }}
              onClick={() => {
                setEditorMode(mode);
                setSelectedObjectId(null);
                if (mode === 'preview') setAvailabilityEnabled(true);
                else setAvailabilityEnabled(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="dc-toolbar-sep" />

        {/* Drawing tools (design mode only) */}
        {editorMode === 'design' && (
          <>
            <div className="dc-toolbar-group">
              {([
                { tool: 'select' as Tool, label: 'Select', hint: '(V)', svgIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg> },
                { tool: 'rect' as Tool, label: 'Rect', hint: '(R)', svgIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
                { tool: 'polygon' as Tool, label: 'Polygon', hint: '(P)', svgIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 18 20 6 20 2 8.5"/></svg> },
                { tool: 'pen' as Tool, label: 'Place', hint: '(Click)', svgIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> },
              ]).map(({ tool, label, hint, svgIcon }) => (
                <button
                  key={tool}
                  className={`dc-tool-btn ${activeTool === tool && !placingAmenity && !drawingOutline ? 'dc-tool-btn--active' : ''}`}
                  onClick={() => { setActiveTool(tool); setOutlinePoints([]); setDrawingOutline(false); setRectDraw(null); setPlacingAmenity(null); setShowAmenityPicker(false); setPlacingFurniture(null); setShowFurniturePicker(false); }}
                  title={`${label} ${hint}`}
                >
                  {svgIcon}
                  <span className="dc-tool-label">{label}</span>
                </button>
              ))}
            </div>
            {/* Place tool size controls */}
            {activeTool === 'pen' && !placingAmenity && !drawingOutline && (
              <div className="dc-toolbar-group" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>W</label>
                <input
                  type="text"
                  defaultValue={placeWidth}
                  key={'pw-' + placeWidth}
                  onBlur={(e) => { const v = parseInt(e.target.value) || 80; setPlaceWidth(Math.max(10, v)); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                  style={{ width: 48, padding: '3px 4px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', textAlign: 'center' }}
                  title="Place width (px)"
                />
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>H</label>
                <input
                  type="text"
                  defaultValue={placeHeight}
                  key={'ph-' + placeHeight}
                  onBlur={(e) => { const v = parseInt(e.target.value) || 60; setPlaceHeight(Math.max(10, v)); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                  style={{ width: 48, padding: '3px 4px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', textAlign: 'center' }}
                  title="Place height (px)"
                />
              </div>
            )}
            <button
              className={`dc-tool-btn ${drawingOutline ? 'dc-tool-btn--active' : ''}`}
              onClick={startOutlineDrawing}
              title="Draw floor outline (click points, click green dot to close)"
              style={drawingOutline ? { background: '#ede9fe', color: '#7c3aed', borderColor: '#7c3aed' } : undefined}
            >
              <span className="dc-tool-label">{drawingOutline ? `Drawing... (${outlinePoints.length} pts)` : 'Draw Outline'}</span>
            </button>
            {/* Amenity picker */}
            <div style={{ position: 'relative' }} data-dropdown>
              <button
                className={`dc-tool-btn ${placingAmenity ? 'dc-tool-btn--active' : ''}`}
                onClick={() => { setShowAmenityPicker(!showAmenityPicker); setShowFurniturePicker(false); }}
                title="Place amenity icon"
                style={placingAmenity ? { background: '#fde8e8', color: '#dc2626', borderColor: '#dc2626' } : undefined}
              >
                <span className="dc-tool-label">{placingAmenity ? AMENITY_ICONS.find(a => a.id === placingAmenity)?.label : 'Amenities'}</span>
              </button>
              {showAmenityPicker && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 100,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 4,
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, minWidth: 200,
                }}>
                  {AMENITY_ICONS.map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setPlacingAmenity(a.id); setShowAmenityPicker(false); setActiveTool('select'); setDrawingOutline(false); setOutlinePoints([]); setRectDraw(null); }}
                      style={{
                        padding: '6px 8px', border: 'none', borderRadius: 4,
                        background: placingAmenity === a.id ? '#fde8e8' : 'transparent',
                        cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500,
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fde8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" strokeWidth="0" dangerouslySetInnerHTML={{ __html: a.svg }} />
                      </span>
                      {a.label}
                    </button>
                  ))}
                  {placingAmenity && (
                    <button
                      onClick={() => { setPlacingAmenity(null); setShowAmenityPicker(false); }}
                      style={{ gridColumn: '1 / -1', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-bg)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, marginTop: 2 }}
                    >
                      Stop Placing
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Furniture/Assets picker */}
            <div style={{ position: 'relative' }} data-dropdown>
              <button
                className={`dc-tool-btn ${placingFurniture ? 'dc-tool-btn--active' : ''}`}
                onClick={() => { setShowFurniturePicker(!showFurniturePicker); setShowAmenityPicker(false); }}
                title="Place furniture & assets"
                style={placingFurniture ? { background: '#f0fdf4', color: '#16a34a', borderColor: '#16a34a' } : undefined}
              >
                <span className="dc-tool-label">{placingFurniture ? FURNITURE_ASSETS.find(a => a.id === placingFurniture)?.label : 'Assets'}</span>
              </button>
              {showFurniturePicker && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 100,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 4,
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, minWidth: 240,
                  maxHeight: 350, overflowY: 'auto',
                }}>
                  <div style={{ gridColumn: '1/-1', padding: '4px 8px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Furniture</div>
                  {FURNITURE_ASSETS.slice(0, 8).map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setPlacingFurniture(a.id); setShowFurniturePicker(false); setPlacingAmenity(null); setActiveTool('select'); setDrawingOutline(false); }}
                      style={{
                        padding: '5px 8px', border: 'none', borderRadius: 4,
                        background: placingFurniture === a.id ? '#f0fdf4' : 'transparent',
                        cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500,
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span style={{ width: 22, height: 22, borderRadius: 4, background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="0" dangerouslySetInnerHTML={{ __html: a.svg }} />
                      </span>
                      {a.label}
                    </button>
                  ))}
                  <div style={{ gridColumn: '1/-1', padding: '4px 8px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid var(--color-border)', marginTop: 2 }}>Seating</div>
                  {FURNITURE_ASSETS.slice(8, 12).map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setPlacingFurniture(a.id); setShowFurniturePicker(false); setPlacingAmenity(null); setActiveTool('select'); setDrawingOutline(false); }}
                      style={{
                        padding: '5px 8px', border: 'none', borderRadius: 4,
                        background: placingFurniture === a.id ? '#f0fdf4' : 'transparent',
                        cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500,
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span style={{ width: 22, height: 22, borderRadius: 4, background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="0" dangerouslySetInnerHTML={{ __html: a.svg }} />
                      </span>
                      {a.label}
                    </button>
                  ))}
                  <div style={{ gridColumn: '1/-1', padding: '4px 8px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid var(--color-border)', marginTop: 2 }}>Utilities & Decor</div>
                  {FURNITURE_ASSETS.slice(12).map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setPlacingFurniture(a.id); setShowFurniturePicker(false); setPlacingAmenity(null); setActiveTool('select'); setDrawingOutline(false); }}
                      style={{
                        padding: '5px 8px', border: 'none', borderRadius: 4,
                        background: placingFurniture === a.id ? '#f0fdf4' : 'transparent',
                        cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500,
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span style={{ width: 22, height: 22, borderRadius: 4, background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="0" dangerouslySetInnerHTML={{ __html: a.svg }} />
                      </span>
                      {a.label}
                    </button>
                  ))}
                  {placingFurniture && (
                    <button
                      onClick={() => { setPlacingFurniture(null); setShowFurniturePicker(false); }}
                      style={{ gridColumn: '1 / -1', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-bg)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, marginTop: 2 }}
                    >
                      Stop Placing
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="dc-toolbar-sep" />
          </>
        )}

        {/* Actions (hidden in preview) */}
        {editorMode !== 'preview' && (
        <div className="dc-toolbar-group">
          <button
            className={`dc-tool-btn ${dirty ? 'dc-tool-btn--active' : ''}`}
            onClick={handleSave}
            disabled={saving || !dirty}
            title={saving ? 'Saving...' : dirty ? 'Save changes (Ctrl+S)' : 'No unsaved changes'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span className="dc-tool-label">{saving ? 'Saving...' : 'Save'}</span>
          </button>
          <button className="dc-tool-btn" disabled={undoStack.current.length === 0} title="Undo (Ctrl+Z)" onClick={handleUndo}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span className="dc-tool-label">Undo</span>
          </button>
          <button className="dc-tool-btn" disabled={redoStack.current.length === 0} title="Redo (Ctrl+Shift+Z)" onClick={handleRedo}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
            <span className="dc-tool-label">Redo</span>
          </button>
          <button
            className="dc-tool-btn"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/jpeg,image/png,.jpg,.jpeg,.png';
              input.onchange = (evt) => {
                const target = evt.target as HTMLInputElement;
                const file = target.files?.[0];
                if (file && floorplanId) {
                  uploadSourceImage(floorplanId, file)
                    .then(() => getFloorplan(floorplanId))
                    .then((fp) => setFloorplan(fp))
                    .catch((err) => setError(err instanceof Error ? err.message : 'Upload failed'));
                }
              };
              input.click();
            }}
            title="Upload background image"
          >
            <span className="dc-tool-label">Upload Image</span>
          </button>
        </div>
        )}

        {quoteReqs && (
          <button
            className="dc-tool-btn"
            onClick={() => setShowReqsPopup(true)}
            title="View quote requirements"
            style={{ background: '#e8f0fb', color: '#4a90d9', borderColor: '#4a90d9' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
            <span className="dc-tool-label">Requirements</span>
          </button>
        )}

        <span className="dc-toolbar-sep" />

        {/* View controls */}
        <div className="dc-toolbar-group">
          <button
            className={`dc-tool-btn ${editorState.gridEnabled ? 'dc-tool-btn--active' : ''}`}
            onClick={toggleGrid}
            title={`Toggle grid (${editorState.gridEnabled ? 'On' : 'Off'})`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            <span className="dc-tool-label">Grid</span>
          </button>
          <button
            className={`dc-tool-btn ${editorState.snapEnabled ? 'dc-tool-btn--active' : ''}`}
            onClick={toggleSnap}
            title={`Snap to grid (${editorState.snapEnabled ? 'On' : 'Off'})`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="5 12 12 5 19 12"/><line x1="12" y1="5" x2="12" y2="19"/></svg>
            <span className="dc-tool-label">Snap</span>
          </button>
          <button className="dc-tool-btn" onClick={() => setZoom((z) => Math.min(10, z * 1.2))} title="Zoom in (Ctrl+Scroll up)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <span className="dc-zoom-label">{zoomPercent}%</span>
          <button className="dc-tool-btn" onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))} title="Zoom out (Ctrl+Scroll down)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button className="dc-tool-btn" onClick={() => { setZoom(1); if (containerRef.current) { containerRef.current.scrollLeft = 0; containerRef.current.scrollTop = 0; } }} title="Reset zoom to 100%">Fit</button>
        </div>

        {/* Spacer + floor name */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            {floorplan.floor_name}
          </span>
          {dirty && (
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              Unsaved
            </span>
          )}
          {lastSaved && !dirty && (
            <span style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>
              Saved
            </span>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            editorMode === 'preview'
              ? '1fr 240px'
              : editorMode === 'label'
                ? '1fr'
                : '180px 1fr 220px',
          gridTemplateRows: editorMode === 'label' ? '1fr auto' : '1fr',
          overflow: 'hidden',
        }}
      >
        {/* Left sidebar: Layers (design mode only) */}
        {editorMode === 'design' && (
          <div
            style={{
              background: 'var(--color-surface)',
              borderRight: '1px solid var(--color-border)',
              overflowY: 'auto',
            }}
          >
            <LayerPanel
              layers={layers}
              activeLayer={activeLayerId}
              onLayerChange={handleLayerChange}
              onActiveLayerChange={setActiveLayerId}
              onAddLayer={handleAddLayer}
              onDeleteLayer={handleDeleteLayer}
            />
          </div>
        )}

        {/* Center: SVG Canvas (FloorplanEditor pattern - container with overflow:auto, SVG with CSS scale) */}
        <div
          ref={containerRef}
          style={{
            background: '#e8e8e8',
            overflow: 'auto',
            position: 'relative',
            gridColumn: editorMode === 'label' ? '1 / -1' : undefined,
            gridRow: editorMode === 'label' ? '1' : undefined,
            minHeight: 0,
          }}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasW} ${canvasH}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: `${zoom * 100}%`,
              display: 'block',
              cursor: dragging ? 'grabbing' : resizing ? HANDLE_CURSORS[resizing.handle] : 'default',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
          >
            {/* Grid pattern definition */}
            {editorState.gridEnabled && (
              <defs>
                <pattern
                  id="editor-grid"
                  width={editorState.gridSize}
                  height={editorState.gridSize}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${editorState.gridSize} 0 L 0 0 0 ${editorState.gridSize}`}
                    fill="none"
                    stroke="rgba(0,0,0,0.08)"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
            )}

            {/* White canvas background */}
            <rect
              x={0} y={0}
              width={canvasW} height={canvasH}
              fill="white"
              stroke="var(--color-border)"
              strokeWidth="1"
              strokeDasharray="4 4"
              style={{ pointerEvents: 'none' }}
            />

            {/* Background image */}
            {floorplan.source_image_path && (
              <image
                href={`/api/floorplans/${floorplan.id}/source-preview`}
                x={0} y={0}
                width={canvasW} height={canvasH}
                opacity={floorplan.background_opacity ?? 1}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Grid on top of image (re-render so it's visible over the image) */}
            {editorState.gridEnabled && (
              <rect
                data-ui-only="true"
                x={0} y={0} width={canvasW} height={canvasH}
                fill="url(#editor-grid)"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Render map objects as colored rectangles with labels */}
            {visibleObjects.map((obj) => {
              const geom = obj.geometry;
              if (geom.type !== 'rect' && geom.type !== 'circle' && geom.type !== 'polygon' && geom.type !== 'path') return null;

              const isSelected = obj.id === selectedObjectId;
              const availColor =
                availabilityEnabled && availabilityStates[obj.id]
                  ? getAvailabilityColor(availabilityStates[obj.id])
                  : undefined;

              const typeColor = TYPE_COLORS[obj.object_type] ?? '#4b5563';
              const objFill = obj.fill_color || typeColor + '55';
              const objStroke = obj.stroke_color || typeColor;
              const fillColor = availColor ?? (isSelected ? objFill : objFill);
              const strokeColor = isSelected ? '#f59e0b' : objStroke;
              const sw = isSelected ? strokeW * 1.5 : strokeW;

              if (geom.type === 'rect') {
                const rx = geom.x ?? 0, ry = geom.y ?? 0;
                const rw = geom.width ?? 50, rh = geom.height ?? 50;
                const fontSize = Math.max(8, Math.min(rw / 6, rh / 3, 24));

                return (
                  <g key={obj.id} opacity={obj.opacity}>
                    <rect
                      x={rx} y={ry} width={rw} height={rh}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={sw}
                      rx={4}
                      style={{ cursor: 'move' }}
                      transform={
                        geom.rotation
                          ? `rotate(${geom.rotation} ${rx + rw / 2} ${ry + rh / 2})`
                          : undefined
                      }
                    />
                    {/* Label text */}
                    {obj.label && (
                      <text
                        x={rx + rw / 2} y={ry + rh / 2}
                        textAnchor="middle" dominantBaseline="central"
                        fill="#fff" fontSize={fontSize}
                        fontFamily="Arial, sans-serif" fontWeight="600"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {obj.label}
                      </text>
                    )}

                    {/* 8-directional resize handles when selected */}
                    {isSelected && HANDLES.map((h) => {
                      const [hx, hy] = getHandlePos(h, rx, ry, rw, rh);
                      return (
                        <circle
                          key={h}
                          data-ui-only="true"
                          cx={hx} cy={hy} r={handleR}
                          fill="#f59e0b" stroke="#fff" strokeWidth={strokeW * 0.75}
                          style={{ cursor: HANDLE_CURSORS[h] }}
                        />
                      );
                    })}
                  </g>
                );
              }

              if (geom.type === 'circle') {
                const cx = geom.x ?? 0, cy = geom.y ?? 0, cr = geom.r ?? 12;
                const iconId = (obj.metadata as Record<string, unknown>)?.icon as string | undefined;
                const amenityInfo = iconId ? AMENITY_ICONS.find(a => a.id === iconId) : null;
                return (
                  <g key={obj.id} data-object-id={obj.id} style={{ cursor: activeTool === 'select' ? 'pointer' : 'crosshair' }}
                    onClick={(ev) => { if (activeTool === 'select') { ev.stopPropagation(); setSelectedObjectId(obj.id); } }}>
                    <circle cx={cx} cy={cy} r={cr}
                      fill={fillColor} stroke={strokeColor} strokeWidth={sw} opacity={obj.opacity} />
                    {amenityInfo && (
                      <g transform={`translate(${cx - cr * 0.6}, ${cy - cr * 0.6}) scale(${cr * 1.2 / 24})`}
                        style={{ pointerEvents: 'none' }}
                        dangerouslySetInnerHTML={{ __html: amenityInfo.svg.replace(/currentColor/g, 'white').replace(/fill="none"/g, 'fill="none"').replace(/fill="#[^"]+"/g, (m) => m.replace(/#[^"]+/, 'white')) }} />
                    )}
                    {obj.label && (
                      <text x={cx} y={cy + cr + 10} textAnchor="middle"
                        fontSize={8} fontWeight={500} fill={strokeColor}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {obj.label}
                      </text>
                    )}
                  </g>
                );
              }

              if (geom.type === 'polygon' && geom.points) {
                const pts = geom.points.map((p) => `${p.x},${p.y}`).join(' ');
                return (
                  <polygon
                    key={obj.id} points={pts}
                    fill={fillColor} stroke={strokeColor} strokeWidth={sw}
                    opacity={obj.opacity}
                    style={{ cursor: 'pointer' }}
                  />
                );
              }

              if (geom.type === 'path' && geom.d) {
                return (
                  <path
                    key={obj.id} d={geom.d}
                    fill={availColor ?? obj.fill_color ?? 'none'}
                    stroke={strokeColor} strokeWidth={sw}
                    opacity={obj.opacity}
                    style={{ cursor: 'pointer' }}
                  />
                );
              }

              return null;
            })}

            {/* Selection dashed outline */}
            {selectedObject && selectedObject.geometry.type === 'rect' && (
              <rect
                data-ui-only="true"
                x={(selectedObject.geometry.x ?? 0) - 2}
                y={(selectedObject.geometry.y ?? 0) - 2}
                width={(selectedObject.geometry.width ?? 50) + 4}
                height={(selectedObject.geometry.height ?? 50) + 4}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="4 2"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Rect drag preview */}
            {rectDraw && (
              <rect
                data-ui-only="true"
                x={Math.min(rectDraw.startX, rectDraw.currentX)}
                y={Math.min(rectDraw.startY, rectDraw.currentY)}
                width={Math.abs(rectDraw.currentX - rectDraw.startX)}
                height={Math.abs(rectDraw.currentY - rectDraw.startY)}
                fill="rgba(59,130,246,0.15)"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="6 3"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Polygon outline drawing preview */}
            {activeTool === 'polygon' && outlinePoints.length > 0 && (
              <g data-ui-only="true" style={{ pointerEvents: 'none' }}>
                <polyline
                  points={outlinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                />
                {outlinePoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={4} fill={i === 0 ? '#22c55e' : '#7c3aed'} stroke="white" strokeWidth={1} />
                ))}
                {outlinePoints.length >= 3 && (
                  <circle cx={outlinePoints[0].x} cy={outlinePoints[0].y} r={8} fill="rgba(34,197,94,0.3)" stroke="#22c55e" strokeWidth={2} style={{ cursor: 'pointer', pointerEvents: 'auto' }} />
                )}
              </g>
            )}
          </svg>

          {/* Inline rename input (positioned over SVG using screen coordinates) */}
          {editing && (() => {
            const obj = objects.find((o) => o.id === editing.objectId);
            if (!obj || !svgRef.current || !containerRef.current) return null;
            const pt = svgRef.current.createSVGPoint();
            pt.x = (obj.geometry.x ?? 0) + (obj.geometry.width ?? 100) / 2;
            pt.y = (obj.geometry.y ?? 0) + (obj.geometry.height ?? 100) / 2;
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
                    padding: '4px 8px', border: '2px solid #f59e0b', borderRadius: 4,
                    fontSize: '0.85rem', fontWeight: 600, width: 180, textAlign: 'center',
                    background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', outline: 'none',
                  }}
                />
              </div>
            );
          })()}
        </div>

        {/* Right sidebar: Properties Panel (design mode) */}
        {editorMode === 'design' && (
          <div
            style={{
              background: 'var(--color-surface)',
              borderLeft: '1px solid var(--color-border)',
              overflowY: 'auto',
            }}
          >
            <PropertiesPanel
              object={selectedObject}
              onChange={handleObjectChange}
              onDelete={handleObjectDelete}
            />
          </div>
        )}

        {/* Right sidebar: Availability Preview + Export (preview mode) */}
        {editorMode === 'preview' && (
          <div
            style={{
              background: 'var(--color-surface)',
              borderLeft: '1px solid var(--color-border)',
              overflowY: 'auto',
              padding: 0,
            }}
          >
            {/* Export SVG section */}
            <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12 }}>Export</h3>
              <button
                onClick={() => {
                  if (!svgRef.current || !floorplan) return;
                  // Clone the SVG and clean it up for export
                  const svgEl = svgRef.current;
                  const clone = svgEl.cloneNode(true) as SVGSVGElement;

                  // Set proper dimensions
                  const w = canvasW;
                  const h = canvasH;
                  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
                  clone.setAttribute('width', String(w));
                  clone.setAttribute('height', String(h));
                  clone.removeAttribute('style');

                  // Remove selection highlights, grid, resize handles, and other UI elements
                  clone.querySelectorAll('[data-ui-only]').forEach(el => el.remove());
                  // Remove grid pattern defs
                  clone.querySelectorAll('defs').forEach(el => el.remove());

                  const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                    new XMLSerializer().serializeToString(clone);

                  const blob = new Blob([svgString], { type: 'image/svg+xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${floorplan.floor_name?.replace(/\s+/g, '-') || 'floorplan'}.svg`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  width: '100%', padding: '10px 16px', border: 'none', borderRadius: 8,
                  background: 'var(--color-primary)', color: 'white', fontWeight: 600,
                  fontSize: '0.82rem', cursor: 'pointer', marginBottom: 8,
                }}
              >
                Download SVG
              </button>
              <button
                onClick={() => {
                  if (!svgRef.current || !floorplan) return;
                  const svgEl = svgRef.current;
                  const clone = svgEl.cloneNode(true) as SVGSVGElement;
                  const w = canvasW;
                  const h = canvasH;
                  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
                  clone.setAttribute('width', String(w));
                  clone.setAttribute('height', String(h));
                  clone.removeAttribute('style');
                  clone.querySelectorAll('[data-ui-only]').forEach(el => el.remove());
                  clone.querySelectorAll('defs').forEach(el => el.remove());

                  const svgString = new XMLSerializer().serializeToString(clone);
                  // Convert to PNG via canvas
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = w * 2;
                    canvas.height = h * 2;
                    const ctx = canvas.getContext('2d')!;
                    ctx.scale(2, 2);
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => {
                      if (!blob) return;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${floorplan.floor_name?.replace(/\s+/g, '-') || 'floorplan'}.png`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }, 'image/png');
                  };
                  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
                }}
                style={{
                  width: '100%', padding: '10px 16px', border: '1px solid var(--color-border)', borderRadius: 8,
                  background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600,
                  fontSize: '0.82rem', cursor: 'pointer',
                }}
              >
                Download PNG
              </button>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
                Objects: {objects.length} | Floor: {floorplan?.floor_name}
              </p>
            </div>

            <AvailabilityPreview
              objects={objects}
              onStateChange={handleAvailabilityStateChange}
              enabled={availabilityEnabled}
              onToggle={setAvailabilityEnabled}
            />
          </div>
        )}

        {/* Bottom panel: Labelling + Validation (label mode) */}
        {editorMode === 'label' && (
          <div
            style={{
              gridColumn: '1 / -1',
              gridRow: '2',
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 340,
              overflow: 'hidden',
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--color-border)',
                padding: '0 12px',
                gap: 0,
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setBottomTab('labelling')}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: bottomTab === 'labelling' ? 600 : 400,
                  color: bottomTab === 'labelling' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  background: 'none',
                  border: 'none',
                  borderBottomWidth: 2,
                  borderBottomStyle: 'solid',
                  borderBottomColor: bottomTab === 'labelling' ? 'var(--color-primary)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                Data Labelling
              </button>
              <button
                onClick={() => setBottomTab('validation')}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: bottomTab === 'validation' ? 600 : 400,
                  color: bottomTab === 'validation' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  background: 'none',
                  border: 'none',
                  borderBottomWidth: 2,
                  borderBottomStyle: 'solid',
                  borderBottomColor: bottomTab === 'validation' ? 'var(--color-primary)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                Validation
              </button>
            </div>

            {/* Panel content */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {bottomTab === 'labelling' && (
                <LabellingPanel
                  selectedObjects={selectedObjects}
                  allObjects={objects}
                  onBulkUpdate={handleBulkUpdate}
                  onAutoNumber={handleAutoNumber}
                  onExportCsv={handleExportCsv}
                  onImportCsv={handleImportCsv}
                />
              )}
              {bottomTab === 'validation' && floorplanId && (
                <ValidationPanel
                  floorplanId={floorplanId}
                  onSelectObject={handleSelectObjectFromValidation}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '6px 16px',
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.72rem',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span>{zoomPercent}% zoom</span>
        <span style={{ width: 1, height: 12, background: 'var(--color-border)' }} />
        <span>{objectCount} object{objectCount !== 1 ? 's' : ''}</span>
        <span style={{ width: 1, height: 12, background: 'var(--color-border)' }} />
        <span>Grid: {editorState.gridSize}px {editorState.gridEnabled ? '' : '(off)'}</span>
        <span style={{ width: 1, height: 12, background: 'var(--color-border)' }} />
        <span>Snap: {editorState.snapEnabled ? 'On' : 'Off'}</span>
        {selectedObject && (
          <>
            <span style={{ width: 1, height: 12, background: 'var(--color-border)' }} />
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
              {selectedObject.label || selectedObject.svg_id || selectedObject.id.slice(0, 8)}
              <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: 4 }}>
                ({selectedObject.object_type}) {Math.round(selectedObject.geometry.width ?? 0)}x{Math.round(selectedObject.geometry.height ?? 0)}
              </span>
            </span>
          </>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ textTransform: 'capitalize' }}>{editorMode} mode</span>
          <span style={{ width: 1, height: 12, background: 'var(--color-border)' }} />
          <span>{floorplan.floor_name} v{floorplan.version}</span>
          {dirty && <span style={{ color: '#d97706', fontWeight: 600 }}>Unsaved</span>}
          {!dirty && lastSaved && <span style={{ color: 'var(--color-success)' }}>Saved</span>}
        </span>
      </div>
    </div>
  );
}
