import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Floorplan, EditorState, MapObject, MapObjectType, EditorLayer, AvailabilityState } from '@svg-map/types';
import {
  getFloorplan,
  getProject,
  saveCanvasState,
  updateFloorplan,
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
import ObjectListPanel from '../components/ObjectListPanel.js';
import { useToast, ToastContainer } from '../components/Toast.js';
import LayerPanel, { DEFAULT_LAYERS } from '../components/LayerPanel.js';
import ValidationPanel from '../components/ValidationPanel.js';
import LabellingPanel from '../components/LabellingPanel.js';
import AvailabilityPreview, { getAvailabilityColor, STATE_COLORS, ALL_STATES, getStatesForType, cycleState } from '../components/AvailabilityPreview.js';
import Minimap from '../components/Minimap.js';
import { exportIsometricSvg } from '../lib/isometricSvgExport.js';
import {
  getPlaceOSConfig,
  setPlaceOSConfig,
  testPlaceOSConnection,
  getPlaceOSZones,
  getPlaceOSSystems,
  updatePlaceOSZone,
  updatePlaceOSSystem,
  uploadSvgToPlaceOS,
  type PlaceOSZone,
  type PlaceOSSystem,
} from '../lib/api.js';

type Tool = 'select' | 'rect' | 'polygon' | 'pen' | 'wall';
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
  { id: 'door', label: 'Door', emoji: '🚪', svg: '<rect x="7" y="2" width="10" height="20" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="15" cy="13" r="1" fill="currentColor"/>' },
  { id: 'window', label: 'Window', emoji: '🪟', svg: '<rect x="3" y="6" width="18" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v12M3 12h18" stroke="currentColor" stroke-width="1"/><path d="M3 6h18" stroke="#60a5fa" stroke-width="2"/>' },
  { id: 'water-fountain', label: 'Water Fountain', emoji: '🚰', svg: '<path d="M8 18h8M12 18v-4" stroke="currentColor" stroke-width="1.5"/><path d="M8 14c0-3 2-5 4-7 2 2 4 4 4 7" fill="none" stroke="#0ea5e9" stroke-width="1.5"/><path d="M10 11c0-1 1-2 2-3 1 1 2 2 2 3" fill="#0ea5e9" opacity="0.2"/>' },
  { id: 'kitchen', label: 'Kitchen', emoji: '🍳', svg: '<rect x="3" y="6" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="13" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="16" cy="13" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="10" r="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3 8h18" stroke="currentColor" stroke-width="1"/>' },
  { id: 'vending', label: 'Vending Machine', emoji: '🥤', svg: '<rect x="5" y="2" width="14" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="4" width="10" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><rect x="8" y="14" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.2"/><circle cx="16" cy="15.5" r="1" fill="none" stroke="currentColor" stroke-width="1"/>' },
  { id: 'wifi', label: 'WiFi Access Point', emoji: '📶', svg: '<circle cx="12" cy="18" r="1.5" fill="currentColor"/><path d="M8 14c2.2-2.2 5.8-2.2 8 0" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 11c3.9-3.9 10.1-3.9 14 0" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 8c5.5-5.5 14.5-5.5 20 0" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
  { id: 'security-camera', label: 'Security Camera', emoji: '📹', svg: '<circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 11v3M8 14h8M12 14v4" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="18" width="6" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="8" r="1" fill="currentColor"/>' },
  { id: 'parking-spot', label: 'Parking Spot', emoji: '🅿️', svg: '<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'bike-rack', label: 'Bike Rack', emoji: '🚲', svg: '<circle cx="7" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="17" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 15l5-8 5 8M9 7h4" fill="none" stroke="currentColor" stroke-width="1.3"/>' },
  { id: 'charging', label: 'Charging Station', emoji: '🔌', svg: '<rect x="6" y="4" width="12" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9l-2 3h4l-2 3" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/><path d="M9 4V2M15 4V2" stroke="currentColor" stroke-width="1.5"/>' },
  { id: 'mail', label: 'Mailroom', emoji: '📬', svg: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 8l9 5 9-5" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
  { id: 'shower', label: 'Shower', emoji: '🚿', svg: '<circle cx="12" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 8l-1 4M16 8l1 4M9 12l3 9M15 12l-3 9" fill="none" stroke="#0ea5e9" stroke-width="1.2"/><path d="M10 16h4" stroke="#0ea5e9" stroke-width="1"/>' },
  { id: 'smoking', label: 'Smoking Area', emoji: '🚬', svg: '<rect x="3" y="12" width="14" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M17 12v-3c0-2 2-3 2-5M20 12v-3c0-2 2-3 2-5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="3" y="13.5" width="6" height="1" fill="#f97316" opacity="0.5"/>' },
];

const FURNITURE_ASSETS: { id: string; label: string; icon: string; svg: string; w: number; h: number; color: string }[] = [
  // Furniture
  { id: 'desk-single', label: 'Single Desk', icon: 'D', svg: '<rect x="2" y="3" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="6" y="6" width="12" height="4" rx="1" fill="currentColor" opacity="0.12"/><rect x="9" y="11" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.12"/><circle cx="12" cy="20" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/>', w: 30, h: 20, color: '#2563eb' },
  { id: 'desk-pair', label: 'Desk Pair', icon: 'DD', svg: '<rect x="1" y="3" width="10" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="13" y="3" width="10" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="3" y="6" width="6" height="3" rx="0.8" fill="currentColor" opacity="0.12"/><rect x="15" y="6" width="6" height="3" rx="0.8" fill="currentColor" opacity="0.12"/><circle cx="6" cy="20" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="18" cy="20" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/>', w: 50, h: 20, color: '#2563eb' },
  { id: 'desk-pod', label: 'Desk Pod (4)', icon: '4D', svg: '<rect x="2" y="2" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="13" y="2" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="13" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="13" y="13" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="4" y="4" width="5" height="2.5" rx="0.5" fill="currentColor" opacity="0.12"/><rect x="15" y="4" width="5" height="2.5" rx="0.5" fill="currentColor" opacity="0.12"/><rect x="4" y="15" width="5" height="2.5" rx="0.5" fill="currentColor" opacity="0.12"/><rect x="15" y="15" width="5" height="2.5" rx="0.5" fill="currentColor" opacity="0.12"/>', w: 50, h: 40, color: '#2563eb' },
  { id: 'table-small', label: 'Small Table', icon: 'T', svg: '<rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3"/>', w: 30, h: 30, color: '#92400e' },
  { id: 'table-medium', label: 'Medium Table', icon: 'T', svg: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 10h8M8 14h8" stroke="currentColor" stroke-width="1" opacity="0.3"/>', w: 50, h: 30, color: '#92400e' },
  { id: 'table-large', label: 'Large Table', icon: 'T', svg: '<rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 9h10M7 12h10M7 15h10" stroke="currentColor" stroke-width="1" opacity="0.3"/>', w: 80, h: 40, color: '#92400e' },
  { id: 'table-round', label: 'Round Table', icon: 'O', svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.2"/>', w: 30, h: 30, color: '#92400e' },
  { id: 'standing-desk', label: 'Standing Desk', icon: 'SD', svg: '<rect x="3" y="3" width="18" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="6" y="5" width="12" height="4" rx="1" fill="currentColor" opacity="0.12"/><path d="M8 14v6M16 14v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 20h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>', w: 30, h: 15, color: '#4f46e5' },
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
  // Meeting & collaboration
  { id: 'conference-table', label: 'Conference Table', icon: 'CT', svg: '<ellipse cx="12" cy="12" rx="10" ry="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 9h12M6 15h12" stroke="currentColor" stroke-width="0.8" opacity="0.3"/>', w: 80, h: 50, color: '#78350f' },
  { id: 'monitor-arm', label: 'Monitor Arm', icon: 'MA', svg: '<rect x="6" y="4" width="12" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 12v4M8 16h8" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="5" width="10" height="6" rx="0.5" fill="#3b82f6" opacity="0.15"/>', w: 15, h: 10, color: '#1e293b' },
  { id: 'chair-office', label: 'Office Chair', icon: 'Ch', svg: '<circle cx="12" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M12 15v-3" stroke="currentColor" stroke-width="1.5"/><path d="M7 8c0-2.8 2.2-5 5-5s5 2.2 5 5v4H7V8z" fill="none" stroke="currentColor" stroke-width="1.5"/>', w: 12, h: 12, color: '#1e293b' },
  { id: 'recycling', label: 'Recycling Bin', icon: 'Rc', svg: '<path d="M6 6h12l-1 14H7L6 6z" fill="none" stroke="#16a34a" stroke-width="1.5"/><path d="M4 6h16" stroke="#16a34a" stroke-width="1.5"/><path d="M9 10l3 2-3 2M15 10l-3 2 3 2" stroke="#16a34a" stroke-width="1" opacity="0.5"/>', w: 8, h: 8, color: '#16a34a' },
  { id: 'coat-rack', label: 'Coat Rack', icon: 'CR', svg: '<circle cx="12" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v14M8 20h8" stroke="currentColor" stroke-width="1.5"/><path d="M7 9l5 2 5-2" fill="none" stroke="currentColor" stroke-width="1.5"/>', w: 8, h: 8, color: '#78716c' },
  { id: 'umbrella-stand', label: 'Umbrella Stand', icon: 'US', svg: '<path d="M12 4c-5 0-8 4-8 8h16c0-4-3-8-8-8z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 4v12M12 16c0 2-2 3-3 2" fill="none" stroke="currentColor" stroke-width="1.5"/>', w: 8, h: 8, color: '#6b7280' },
  { id: 'water-cooler', label: 'Water Cooler', icon: 'WC', svg: '<rect x="7" y="8" width="10" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 8V5c0-1 1-2 3-2s3 1 3 2v3" fill="none" stroke="#0ea5e9" stroke-width="1.3"/><circle cx="12" cy="15" r="1.5" fill="#0ea5e9" opacity="0.3"/><rect x="9" y="10" width="6" height="3" rx="0.5" fill="#0ea5e9" opacity="0.15"/>', w: 10, h: 10, color: '#0ea5e9' },
  { id: 'fire-extinguisher', label: 'Fire Extinguisher', icon: 'FE', svg: '<rect x="8" y="6" width="8" height="14" rx="3" fill="none" stroke="#dc2626" stroke-width="1.5"/><path d="M10 6V4h4v2" fill="none" stroke="#dc2626" stroke-width="1.3"/><path d="M12 4l3-2" fill="none" stroke="#dc2626" stroke-width="1.3"/><rect x="10" y="9" width="4" height="2" rx="0.5" fill="#dc2626" opacity="0.2"/>', w: 6, h: 6, color: '#dc2626' },
  { id: 'locker-unit', label: 'Locker Unit', icon: 'LU', svg: '<rect x="2" y="3" width="5" height="9" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="12" width="5" height="9" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="9.5" y="3" width="5" height="9" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="9.5" y="12" width="5" height="9" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="17" y="3" width="5" height="9" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="17" y="12" width="5" height="9" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="5.5" cy="7.5" r="0.6" fill="currentColor"/><circle cx="5.5" cy="16.5" r="0.6" fill="currentColor"/><circle cx="13" cy="7.5" r="0.6" fill="currentColor"/><circle cx="13" cy="16.5" r="0.6" fill="currentColor"/><circle cx="20.5" cy="7.5" r="0.6" fill="currentColor"/><circle cx="20.5" cy="16.5" r="0.6" fill="currentColor"/>', w: 45, h: 20, color: '#64748b' },
];

// Conjoined desk layouts — each defines a grid of desks placed as a group
const DESK_LAYOUTS: { id: string; label: string; cols: number; rows: number; deskW: number; deskH: number; gap: number }[] = [
  { id: 'row-2', label: 'Row of 2', cols: 2, rows: 1, deskW: 30, deskH: 20, gap: 1 },
  { id: 'row-4', label: 'Row of 4', cols: 4, rows: 1, deskW: 30, deskH: 20, gap: 1 },
  { id: 'row-6', label: 'Row of 6', cols: 6, rows: 1, deskW: 30, deskH: 20, gap: 1 },
  { id: 'face-4', label: 'Face to Face (4)', cols: 2, rows: 2, deskW: 30, deskH: 20, gap: 1 },
  { id: 'face-6', label: 'Face to Face (6)', cols: 3, rows: 2, deskW: 30, deskH: 20, gap: 1 },
  { id: 'face-8', label: 'Face to Face (8)', cols: 4, rows: 2, deskW: 30, deskH: 20, gap: 1 },
  { id: 'pod-6', label: 'Pod of 6', cols: 3, rows: 2, deskW: 28, deskH: 22, gap: 1 },
  { id: 'bench-8', label: 'Bench (8)', cols: 8, rows: 1, deskW: 24, deskH: 18, gap: 0 },
  { id: 'vface-6', label: 'Vertical Face to Face (6)', cols: 2, rows: 3, deskW: 30, deskH: 20, gap: 1 },
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

function computeSnap(
  draggedRect: { x: number; y: number; w: number; h: number },
  otherRects: { x: number; y: number; w: number; h: number }[],
  threshold: number = 5,
): { snappedX: number; snappedY: number; guides: { type: 'h' | 'v'; pos: number }[] } {
  let snappedX = draggedRect.x;
  let snappedY = draggedRect.y;
  const guides: { type: 'h' | 'v'; pos: number }[] = [];

  const dragCx = draggedRect.x + draggedRect.w / 2;
  const dragCy = draggedRect.y + draggedRect.h / 2;
  const dragRight = draggedRect.x + draggedRect.w;
  const dragBottom = draggedRect.y + draggedRect.h;

  let bestDx = threshold + 1;
  let bestDy = threshold + 1;

  for (const other of otherRects) {
    const otherCx = other.x + other.w / 2;
    const otherCy = other.y + other.h / 2;
    const otherRight = other.x + other.w;
    const otherBottom = other.y + other.h;

    // Vertical alignment checks (x-axis snapping)
    const vChecks = [
      { dragVal: draggedRect.x, otherVal: other.x },
      { dragVal: draggedRect.x, otherVal: otherRight },
      { dragVal: dragRight, otherVal: other.x },
      { dragVal: dragRight, otherVal: otherRight },
      { dragVal: dragCx, otherVal: otherCx },
    ];

    for (const { dragVal, otherVal } of vChecks) {
      const diff = Math.abs(dragVal - otherVal);
      if (diff < threshold && diff < bestDx) {
        bestDx = diff;
        snappedX = draggedRect.x + (otherVal - dragVal);
        const existingV = guides.filter(g => g.type !== 'v');
        guides.length = 0;
        guides.push(...existingV, { type: 'v', pos: otherVal });
      }
    }

    // Horizontal alignment checks (y-axis snapping)
    const hChecks = [
      { dragVal: draggedRect.y, otherVal: other.y },
      { dragVal: draggedRect.y, otherVal: otherBottom },
      { dragVal: dragBottom, otherVal: other.y },
      { dragVal: dragBottom, otherVal: otherBottom },
      { dragVal: dragCy, otherVal: otherCy },
    ];

    for (const { dragVal, otherVal } of hChecks) {
      const diff = Math.abs(dragVal - otherVal);
      if (diff < threshold && diff < bestDy) {
        bestDy = diff;
        snappedY = draggedRect.y + (otherVal - dragVal);
        const existingH = guides.filter(g => g.type !== 'h');
        guides.length = 0;
        guides.push(...existingH, { type: 'h', pos: otherVal });
      }
    }
  }

  return { snappedX, snappedY, guides };
}

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
  // Place tool size state
  const [placeWidth, setPlaceWidth] = useState(80);
  const [placeHeight, setPlaceHeight] = useState(60);

  const [activeLayerId, setActiveLayerId_] = useState<string>('rooms');
  const setActiveLayerId = useCallback((id: string) => {
    setActiveLayerId_(id);
    if (id === 'desks') {
      setPlaceWidth(30);
      setPlaceHeight(20);
    } else if (id === 'rooms') {
      setPlaceWidth(80);
      setPlaceHeight(60);
    }
  }, []);

  // Quote requirements popup
  const [quoteReqs, setQuoteReqs] = useState<{ rooms: number; desks: number; lockers: number; carspaces: number } | null>(null);
  const [showReqsPopup, setShowReqsPopup] = useState(false);

  // Availability preview state
  const [availabilityEnabled, setAvailabilityEnabled] = useState(false);
  const [availabilityStates, setAvailabilityStates] = useState<Record<string, AvailabilityState>>({});
  const [statePopup, setStatePopup] = useState<{ objectId: string; x: number; y: number } | null>(null);

  // Amenity placement state
  const [placingAmenity, setPlacingAmenity] = useState<string | null>(null);
  const [showAmenityPicker, setShowAmenityPicker] = useState(false);

  // Furniture placement state
  const [placingFurniture, setPlacingFurniture] = useState<string | null>(null);
  const [showFurniturePicker, setShowFurniturePicker] = useState(false);

  // Desk layout placement state
  const [placingDeskLayout, setPlacingDeskLayout] = useState<string | null>(null);
  const [showDeskLayoutPicker, setShowDeskLayoutPicker] = useState(false);

  // Bottom panel tab state (for label mode)
  const [bottomTab, setBottomTab] = useState<'labelling' | 'validation'>('labelling');
  const [leftSidebarTab, setLeftSidebarTab] = useState<'layers' | 'objects'>('layers');
  const [rightSidebarTab, setRightSidebarTab] = useState<'properties' | 'label'>('properties');
  const [importedLabelIds, setImportedLabelIds] = useState<{ id: string; label?: string; assigned?: boolean }[]>([]);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');

  // Editor search
  const [editorSearchQuery, setEditorSearchQuery] = useState('');
  const [editorSearchOpen, setEditorSearchOpen] = useState(false);

  // Toast notifications
  const { toasts, showToast } = useToast();

  // Clipboard for copy/paste
  const clipboardRef = useRef<MapObject | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; objectId: string } | null>(null);

  // Search highlight flash
  const [highlightObjectId, setHighlightObjectId] = useState<string | null>(null);

  // Keyboard shortcuts help
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Wall drawing state — use ref for wallStart to avoid stale closure in useCallback
  const wallStartRef = useRef<{ x: number; y: number } | null>(null);
  const [wallStart, setWallStart_] = useState<{ x: number; y: number } | null>(null);
  const setWallStart = (v: { x: number; y: number } | null) => { wallStartRef.current = v; setWallStart_(v); };
  const [wallPreview, setWallPreview] = useState<{ x: number; y: number } | null>(null);
  const [wallThickness, setWallThickness] = useState(6);

  // PlaceOS integration state
  const [placeosConnected, setPlaceosConnected] = useState(false);
  const [placeosBuildings, setPlaceosBuildings] = useState<PlaceOSZone[]>([]);
  const [placeosLevels, setPlaceosLevels] = useState<PlaceOSZone[]>([]);
  const [placeosSystems, setPlaceosSystems] = useState<PlaceOSSystem[]>([]);
  const [selectedPlaceosBuilding, setSelectedPlaceosBuilding] = useState('');
  const [selectedPlaceosLevel, setSelectedPlaceosLevel] = useState('');
  const [placeosPublishing, setPlaceosPublishing] = useState(false);
  const [placeosStatus, setPlaceosStatus] = useState('');

  // Check PlaceOS connection on mount
  useEffect(() => {
    getPlaceOSConfig().then(cfg => {
      if (cfg.configured) {
        testPlaceOSConnection().then(r => {
          if (r.ok) {
            setPlaceosConnected(true);
            getPlaceOSZones('building').then(setPlaceosBuildings).catch(() => {});
          }
        });
      }
    }).catch(() => {});
  }, []);

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
  const [snapGuides, setSnapGuides] = useState<{ type: 'h' | 'v'; pos: number }[]>([]);

  // Space-bar pan state
  const spaceHeldRef = useRef<boolean>(false);
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef<{x: number; y: number; scrollLeft: number; scrollTop: number} | null>(null);

  // Cursor coordinates for status bar
  const [cursorCoords, setCursorCoords] = useState<{x: number; y: number} | null>(null);

  // Rotation handle state
  const [rotating, setRotating] = useState<{objectId: string; centerX: number; centerY: number; startAngle: number; startRotation: number} | null>(null);

  // Auto-save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Coordinate conversion (FloorplanEditor pattern) ─────────────────
  function toSvgCoords(clientX: number, clientY: number): { x: number; y: number } {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const vb = svgRef.current.viewBox.baseVal;
    // SVG has no explicit height so aspect ratio is preserved: scale = rect.width / vb.width
    const scale = rect.width / vb.width;
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    return { x: Math.round(x), y: Math.round(y) };
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
          if (fp.canvas_state.layers && fp.canvas_state.layers.length > 0) {
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
      showToast('Changes saved', 'success');
    } catch (err) {
      console.error('Save failed:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
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
      const obj = objects.find(o => o.id === id);
      setObjects((prev) => prev.filter((o) => o.id !== id));
      if (selectedObjectId === id) setSelectedObjectId(null);
      setDirty(true);
      showToast(`Deleted ${obj?.label || 'object'}`, 'info');
      try {
        await deleteObject(id);
      } catch {
        // could revert
      }
    },
    [selectedObjectId, objects, showToast],
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

    // ── Space-bar pan ──
    if (spaceHeldRef.current) {
      setPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, scrollLeft: containerRef.current?.scrollLeft ?? 0, scrollTop: containerRef.current?.scrollTop ?? 0 };
      e.preventDefault();
      return;
    }

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

    // ── Desk layout placement mode ──
    if (placingDeskLayout && floorplanId) {
      const layout = DESK_LAYOUTS.find(l => l.id === placingDeskLayout);
      if (layout) {
        const groupId = `deskgroup-${Date.now()}`;
        const totalW = layout.cols * layout.deskW + (layout.cols - 1) * layout.gap;
        const totalH = layout.rows * layout.deskH + (layout.rows - 1) * layout.gap;
        const startX = x - totalW / 2;
        const startY = y - totalH / 2;
        const existingDesks = objects.filter(o => o.object_type === 'desk').length;
        const newDesks = [];

        for (let row = 0; row < layout.rows; row++) {
          for (let col = 0; col < layout.cols; col++) {
            const idx = existingDesks + row * layout.cols + col + 1;
            const dx = startX + col * (layout.deskW + layout.gap);
            const dy = startY + row * (layout.deskH + layout.gap);
            newDesks.push({
              object_type: 'desk' as const,
              label: `Desk ${idx}`,
              svg_id: `desk-${String(idx).padStart(3, '0')}`,
              geometry: { type: 'rect' as const, x: dx, y: dy, width: layout.deskW, height: layout.deskH },
              layer: 'desks',
              fill_color: '#2563eb55',
              stroke_color: '#2563eb',
              opacity: 1,
              visible: true,
              locked: false,
              z_index: objects.length + row * layout.cols + col,
              metadata: { furnitureType: 'desk-single', groupId },
              group_id: groupId,
            });
          }
        }

        // Bulk create all desks, then clear placement mode
        setPlacingDeskLayout(null);
        Promise.all(newDesks.map(d => createObject(floorplanId, d)))
          .then((created) => {
            setObjects(prev => [...prev, ...created]);
            setDirty(true);
          })
          .catch(console.error);
      }
      e.preventDefault();
      return;
    }

    // ── Wall drawing tool ──
    if (activeTool === 'wall' && floorplanId) {
      let wx = x, wy = y;
      // Shift = constrain to horizontal or vertical
      if (e.shiftKey && wallStartRef.current) {
        const dx = Math.abs(x - wallStartRef.current.x);
        const dy = Math.abs(y - wallStartRef.current.y);
        if (dx > dy) wy = wallStartRef.current.y;
        else wx = wallStartRef.current.x;
      }
      // Snap to grid
      if (editorState.snapEnabled && editorState.gridSize) {
        const gs = editorState.gridSize;
        wx = Math.round(wx / gs) * gs;
        wy = Math.round(wy / gs) * gs;
      }
      // Snap to existing wall endpoints and room corners
      const snapThreshold = 10;
      let snapped = false;
      // Check wall endpoints
      for (const obj of objects) {
        if (obj.object_type === 'decorative' && obj.layer === 'walls' && obj.geometry.type === 'polygon' && obj.geometry.points) {
          for (const pt of obj.geometry.points) {
            if (Math.abs(pt.x - wx) < snapThreshold && Math.abs(pt.y - wy) < snapThreshold) {
              wx = pt.x; wy = pt.y; snapped = true; break;
            }
          }
          if (snapped) break;
        }
      }
      // Check room corners
      if (!snapped) {
        for (const obj of objects) {
          if ((obj.object_type === 'room' || obj.object_type === 'area') && obj.geometry.type === 'rect') {
            const g = obj.geometry;
            const rx = g.x ?? 0, ry = g.y ?? 0, rw = g.width ?? 0, rh = g.height ?? 0;
            const corners = [
              { x: rx, y: ry }, { x: rx + rw, y: ry },
              { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh },
            ];
            for (const c of corners) {
              if (Math.abs(c.x - wx) < snapThreshold && Math.abs(c.y - wy) < snapThreshold) {
                wx = c.x; wy = c.y; snapped = true; break;
              }
            }
            // Also snap to room edges (midpoints)
            if (!snapped) {
              const midpoints = [
                { x: rx + rw / 2, y: ry }, { x: rx + rw, y: ry + rh / 2 },
                { x: rx + rw / 2, y: ry + rh }, { x: rx, y: ry + rh / 2 },
              ];
              for (const m of midpoints) {
                if (Math.abs(m.x - wx) < snapThreshold && Math.abs(m.y - wy) < snapThreshold) {
                  wx = m.x; wy = m.y; snapped = true; break;
                }
              }
            }
            if (snapped) break;
          }
        }
      }
      if (!wallStartRef.current) {
        // First click — set start point
        setWallStart({ x: wx, y: wy });
      } else {
        // Second click — create wall as a polygon (4 corners)
        const ws = wallStartRef.current!;
        const dx = wx - ws.x;
        const dy = wy - ws.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 5) {
          // Perpendicular offset for wall thickness
          const half = wallThickness / 2;
          const nx = -dy / len * half;
          const ny = dx / len * half;

          const points = [
            { x: ws.x + nx, y: ws.y + ny },
            { x: wx + nx, y: wy + ny },
            { x: wx - nx, y: wy - ny },
            { x: ws.x - nx, y: ws.y - ny },
          ];

          const minX = Math.min(...points.map(p => p.x));
          const minY = Math.min(...points.map(p => p.y));
          const maxX = Math.max(...points.map(p => p.x));
          const maxY = Math.max(...points.map(p => p.y));

          const existingWalls = objects.filter(o => o.object_type === 'decorative' && o.layer === 'walls').length;

          createObject(floorplanId, {
            object_type: 'decorative',
            label: `Wall ${existingWalls + 1}`,
            svg_id: `wall-${String(existingWalls + 1).padStart(3, '0')}`,
            geometry: {
              type: 'polygon',
              points,
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            },
            layer: 'walls',
            fill_color: '#374151',
            stroke_color: '#1f2937',
            opacity: 1,
            visible: true,
            locked: false,
            z_index: objects.length,
          }).then((newObj) => {
            setObjects(prev => [...prev, newObj]);
            setDirty(true);
          }).catch(console.error);
        }
        // Reset — wall segment complete, next click starts a new wall
        setWallStart(null);
        setWallPreview(null);
      }
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

      // Find object under cursor — prioritize active layer, then fall through to other unlocked layers
      const selectableLayerIds = new Set(layers.filter((l) => l.visible && !l.locked).map((l) => l.id));
      const hits: { id: string; area: number; onActiveLayer: boolean }[] = [];
      for (const obj of objects) {
        if (!obj.visible || !selectableLayerIds.has(obj.layer)) continue;
        const geom = obj.geometry;
        const isActive = obj.layer === activeLayerId;
        if (geom.type === 'rect') {
          const rx = geom.x ?? 0, ry = geom.y ?? 0;
          const rw = geom.width ?? 100, rh = geom.height ?? 100;
          if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
            hits.push({ id: obj.id, area: rw * rh, onActiveLayer: isActive });
          }
        } else if (geom.type === 'circle') {
          const cx = geom.x ?? 0, cy = geom.y ?? 0, cr = geom.r ?? 12;
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist <= cr + 5) {
            hits.push({ id: obj.id, area: cr * cr * Math.PI, onActiveLayer: isActive });
          }
        } else if (geom.type === 'polygon' && geom.points) {
          const bx = geom.x ?? 0, by = geom.y ?? 0;
          const bw = geom.width ?? 100, bh = geom.height ?? 100;
          if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
            hits.push({ id: obj.id, area: bw * bh, onActiveLayer: isActive });
          }
        }
      }
      if (hits.length > 0) {
        // Prefer objects on the active layer, then smallest area
        const activeHits = hits.filter(h => h.onActiveLayer);
        const bestHits = activeHits.length > 0 ? activeHits : hits;
        bestHits.sort((a, b) => a.area - b.area);
        const hitId = bestHits[0].id;
        const hitObj = objects.find((o) => o.id === hitId)!;
        setSelectedObjectId(hitId);
        // Only allow dragging if the object's layer is not locked and object is not locked
        if (!hitObj.locked) {
          setDragging({ objectId: hitId, offsetX: x - (hitObj.geometry.x ?? 0), offsetY: y - (hitObj.geometry.y ?? 0) });
        }
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
    if (activeTool === 'pen' && floorplanId && editorMode === 'design' && !layers.find(l => l.id === activeLayerId)?.locked) {
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
        ...(objectType === 'desk' ? { metadata: { furnitureType: 'desk-single' } } : {}),
      }).then((newObj) => {
        setObjects((prev) => [...prev, newObj]);
        setSelectedObjectId(newObj.id);
        setDirty(true);
      }).catch(console.error);
      e.preventDefault();
      return;
    }
  }, [activeTool, drawingOutline, outlinePoints, selectedObjectId, objects, layers, floorplanId, editorMode, activeLayerId, imageDims, placeWidth, placeHeight, placingDeskLayout, wallThickness, placingAmenity, placingFurniture]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // ── Space-bar panning ──
    if (panning && panStartRef.current && containerRef.current) {
      containerRef.current.scrollLeft = panStartRef.current.scrollLeft - (e.clientX - panStartRef.current.x);
      containerRef.current.scrollTop = panStartRef.current.scrollTop - (e.clientY - panStartRef.current.y);
      return;
    }

    const { x, y } = toSvgCoords(e.clientX, e.clientY);

    // ── Rotation handle dragging ──
    if (rotating) {
      const angle = Math.atan2(y - rotating.centerY, x - rotating.centerX) * 180 / Math.PI;
      let newRotation = rotating.startRotation + (angle - rotating.startAngle);
      // Snap to 15-degree increments when holding Shift
      if (e.shiftKey) newRotation = Math.round(newRotation / 15) * 15;
      // Normalize to 0-360
      newRotation = ((newRotation % 360) + 360) % 360;
      handleObjectChange(rotating.objectId, { geometry: { ...objects.find(o => o.id === rotating.objectId)!.geometry, rotation: newRotation } });
      setCursorCoords({ x: Math.round(x), y: Math.round(y) });
      return;
    }

    if (dragging) {
      const obj = objects.find((o) => o.id === dragging.objectId);
      if (!obj) return;
      const rawX = Math.max(0, x - dragging.offsetX);
      const rawY = Math.max(0, y - dragging.offsetY);
      const w = obj.geometry.width ?? 0;
      const h = obj.geometry.height ?? 0;

      const otherRects = objects
        .filter((o) => o.id !== dragging.objectId && o.visible)
        .map((o) => ({
          x: o.geometry.x ?? 0,
          y: o.geometry.y ?? 0,
          w: o.geometry.width ?? 0,
          h: o.geometry.height ?? 0,
        }));

      const { snappedX, snappedY, guides } = computeSnap(
        { x: rawX, y: rawY, w, h },
        otherRects,
      );
      setSnapGuides(guides);

      setObjects((prev) =>
        prev.map((o) =>
          o.id === dragging.objectId
            ? { ...o, geometry: { ...o.geometry, x: snappedX, y: snappedY } }
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

    // Wall preview
    if (activeTool === 'wall' && wallStart) {
      let wx = x, wy = y;
      if (e.shiftKey) {
        const dx = Math.abs(x - wallStart.x);
        const dy = Math.abs(y - wallStart.y);
        if (dx > dy) wy = wallStart.y;
        else wx = wallStart.x;
      }
      if (editorState.snapEnabled && editorState.gridSize) {
        const gs = editorState.gridSize;
        wx = Math.round(wx / gs) * gs;
        wy = Math.round(wy / gs) * gs;
      }
      // Snap preview to wall endpoints and room corners
      const st = 10;
      let didSnap = false;
      for (const obj of objects) {
        if (didSnap) break;
        if (obj.object_type === 'decorative' && obj.layer === 'walls' && obj.geometry.type === 'polygon' && obj.geometry.points) {
          for (const pt of obj.geometry.points) {
            if (Math.abs(pt.x - wx) < st && Math.abs(pt.y - wy) < st) { wx = pt.x; wy = pt.y; didSnap = true; break; }
          }
        }
        if (!didSnap && (obj.object_type === 'room' || obj.object_type === 'area') && obj.geometry.type === 'rect') {
          const g = obj.geometry;
          const rx = g.x ?? 0, ry = g.y ?? 0, rw = g.width ?? 0, rh = g.height ?? 0;
          for (const c of [{x:rx,y:ry},{x:rx+rw,y:ry},{x:rx+rw,y:ry+rh},{x:rx,y:ry+rh},{x:rx+rw/2,y:ry},{x:rx+rw,y:ry+rh/2},{x:rx+rw/2,y:ry+rh},{x:rx,y:ry+rh/2}]) {
            if (Math.abs(c.x - wx) < st && Math.abs(c.y - wy) < st) { wx = c.x; wy = c.y; didSnap = true; break; }
          }
        }
      }
      setWallPreview({ x: wx, y: wy });
    }

    // Update cursor coordinates for status bar
    setCursorCoords({ x: Math.round(x), y: Math.round(y) });
  }, [dragging, resizing, drawing, rectDraw, objects, activeTool, wallStart, editorState.snapEnabled, editorState.gridSize, panning, rotating, handleObjectChange]);

  const handleMouseUp = useCallback(() => {
    if (panning) { setPanning(false); panStartRef.current = null; return; }
    if (rotating) { setRotating(null); return; }
    if (dragging) {
      // Persist the move
      const obj = objects.find((o) => o.id === dragging.objectId);
      if (obj) {
        updateObject(dragging.objectId, { geometry: obj.geometry }).catch(() => {});
        setDirty(true);
      }
      setDragging(null);
      setSnapGuides([]);
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

      const activeLayerObj = layers.find(l => l.id === activeLayerId);
      if (rw > 10 && rh > 10 && activeLayerObj && !activeLayerObj.locked) {
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
          ...(objectType === 'desk' ? { metadata: { furnitureType: 'desk-single' } } : {}),
        }).then((newObj) => {
          setObjects((prev) => [...prev, newObj]);
          setSelectedObjectId(newObj.id);
          setDirty(true);
        }).catch(console.error);
      }
      setRectDraw(null);
    }
  }, [dragging, resizing, drawing, rectDraw, objects, floorplanId, activeLayerId, panning, rotating]);

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
        setPlacingDeskLayout(null);
        setDrawingOutline(false);
        setOutlinePoints([]);
        setWallStart(null);
        setWallPreview(null);
        setContextMenu(null);
        setShowShortcutsHelp(false);
        if (activeTool === 'wall') setActiveTool('select');
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        e.preventDefault();
        handleObjectDelete(selectedObjectId);
      }

      // Copy (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedObjectId) {
        const obj = objects.find(o => o.id === selectedObjectId);
        if (obj) {
          clipboardRef.current = JSON.parse(JSON.stringify(obj));
          showToast(`Copied ${obj.label || 'object'}`, 'info');
        }
      }
      // Paste (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardRef.current && floorplanId) {
        e.preventDefault();
        const src = clipboardRef.current;
        const newGeom = { ...src.geometry };
        if (newGeom.x != null) newGeom.x += 20;
        if (newGeom.y != null) newGeom.y += 20;
        const existingCount = objects.filter(o => o.object_type === src.object_type).length;
        createObject(floorplanId, {
          ...src,
          id: undefined as unknown as string,
          label: `${src.label || src.object_type} (copy)`,
          svg_id: `${src.object_type}-${String(existingCount + 1).padStart(3, '0')}`,
          geometry: newGeom,
          z_index: objects.length,
        }).then((newObj) => {
          setObjects(prev => [...prev, newObj]);
          setSelectedObjectId(newObj.id);
          setDirty(true);
          showToast(`Pasted ${newObj.label || 'object'}`, 'success');
        }).catch(() => showToast('Paste failed', 'error'));
      }
      // Duplicate (Ctrl+D)
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedObjectId && floorplanId) {
        e.preventDefault();
        const src = objects.find(o => o.id === selectedObjectId);
        if (src) {
          const newGeom = { ...src.geometry };
          if (newGeom.x != null) newGeom.x += 20;
          if (newGeom.y != null) newGeom.y += 20;
          const existingCount = objects.filter(o => o.object_type === src.object_type).length;
          createObject(floorplanId, {
            ...src,
            id: undefined as unknown as string,
            label: `${src.label || src.object_type} (copy)`,
            svg_id: `${src.object_type}-${String(existingCount + 1).padStart(3, '0')}`,
            geometry: newGeom,
            z_index: objects.length,
          }).then((newObj) => {
            setObjects(prev => [...prev, newObj]);
            setSelectedObjectId(newObj.id);
            setDirty(true);
            showToast(`Duplicated ${src.label || 'object'}`, 'success');
          }).catch(() => showToast('Duplicate failed', 'error'));
        }
      }

      // Keyboard shortcuts help (?)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setShowShortcutsHelp(prev => !prev);
      }

      // Tool shortcuts (single key, no modifier)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v': setActiveTool('select'); setPlacingAmenity(null); setPlacingFurniture(null); setPlacingDeskLayout(null); setWallStart(null); setWallPreview(null); break;
          case 'r': setActiveTool('rect'); setWallStart(null); setWallPreview(null); break;
          case 'p': setActiveTool('pen'); setWallStart(null); setWallPreview(null); break;
          case 'w': setActiveTool('wall'); setPlacingAmenity(null); setPlacingFurniture(null); setPlacingDeskLayout(null); break;
          case 'g': setEditorState(prev => ({ ...prev, gridEnabled: !prev.gridEnabled })); break;
        }
      }
      // Ctrl+F = Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('.editor-search-input') as HTMLInputElement;
        if (searchInput) searchInput.focus();
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
  }, [selectedObjectId, editing, handleObjectDelete, handleUndo, handleRedo, objects, floorplanId, showToast]);

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

  // Space-bar pan tracking
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        spaceHeldRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        setPanning(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

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
  const layerOpacity = new Map(layers.map(l => [l.id, l.opacity]));
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

      {/* PlaceOS Navigation Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
        background: 'linear-gradient(135deg, #002147 0%, #001a3a 100%)',
        borderBottom: '1px solid #001530',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(`/project/${floorplan.project_id}`)}
            style={{ border: 'none', background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.3px' }}>PlaceOS</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', fontWeight: 500 }}>/ Floor Plan Studio</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>/ {floorplan.floor_name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {([
            { mode: 'design' as EditorMode, label: 'Design' },
            { mode: 'preview' as EditorMode, label: 'Preview' },
          ]).map(({ mode, label }) => (
            <button
              key={mode}
              style={{
                padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 700,
                background: editorMode === mode ? '#fff' : 'rgba(255,255,255,0.12)',
                color: editorMode === mode ? '#002147' : 'rgba(255,255,255,0.85)',
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
      </div>

      {/* Top Toolbar */}
      <div className="dc-toolbar" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', position: 'sticky', top: 0, zIndex: 10 }}>
        {/* Tools (design mode only) */}
        {editorMode === 'design' && (
          <>
            {/* Select */}
            <div className="dc-toolbar-group">
              <button
                className={`dc-tool-btn ${activeTool === 'select' && !placingAmenity && !drawingOutline ? 'dc-tool-btn--active' : ''}`}
                onClick={() => { setActiveTool('select'); setOutlinePoints([]); setDrawingOutline(false); setRectDraw(null); setPlacingAmenity(null); setShowAmenityPicker(false); setPlacingFurniture(null); setShowFurniturePicker(false); setWallStart(null); setWallPreview(null); setPlacingDeskLayout(null); }}
                title="Select (V)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                <span className="dc-tool-label">Select</span>
              </button>
            </div>
            <span className="dc-toolbar-sep" />

            {/* Shapes: Rect + Polygon + Place */}
            <div className="dc-toolbar-group">
              <button
                className={`dc-tool-btn ${activeTool === 'rect' && !placingAmenity && !drawingOutline ? 'dc-tool-btn--active' : ''}`}
                onClick={() => { setActiveTool('rect'); setOutlinePoints([]); setDrawingOutline(false); setRectDraw(null); setPlacingAmenity(null); setShowAmenityPicker(false); setPlacingFurniture(null); setShowFurniturePicker(false); setWallStart(null); setWallPreview(null); setPlacingDeskLayout(null); }}
                title="Rect (R)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                <span className="dc-tool-label">Rect</span>
              </button>
              <button
                className={`dc-tool-btn ${activeTool === 'polygon' && !placingAmenity && !drawingOutline ? 'dc-tool-btn--active' : ''}`}
                onClick={() => { setActiveTool('polygon'); setOutlinePoints([]); setDrawingOutline(false); setRectDraw(null); setPlacingAmenity(null); setShowAmenityPicker(false); setPlacingFurniture(null); setShowFurniturePicker(false); setWallStart(null); setWallPreview(null); setPlacingDeskLayout(null); }}
                title="Polygon (P)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 18 20 6 20 2 8.5"/></svg>
                <span className="dc-tool-label">Poly</span>
              </button>
              <button
                className={`dc-tool-btn ${activeTool === 'pen' && !placingAmenity && !drawingOutline ? 'dc-tool-btn--active' : ''}`}
                onClick={() => { setActiveTool('pen'); setOutlinePoints([]); setDrawingOutline(false); setRectDraw(null); setPlacingAmenity(null); setShowAmenityPicker(false); setPlacingFurniture(null); setShowFurniturePicker(false); setWallStart(null); setWallPreview(null); setPlacingDeskLayout(null); }}
                title="Place (C)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                <span className="dc-tool-label">Place</span>
              </button>
            </div>
            {/* Place size controls */}
            {activeTool === 'pen' && !placingAmenity && !drawingOutline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>W</label>
                <input
                  type="text"
                  defaultValue={placeWidth}
                  key={'pw-' + placeWidth}
                  onBlur={(e) => { const v = parseInt(e.target.value) || 80; setPlaceWidth(Math.max(10, v)); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                  style={{ width: 40, padding: '2px 3px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', textAlign: 'center' }}
                  title="Place width (px)"
                />
                <label style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>H</label>
                <input
                  type="text"
                  defaultValue={placeHeight}
                  key={'ph-' + placeHeight}
                  onBlur={(e) => { const v = parseInt(e.target.value) || 60; setPlaceHeight(Math.max(10, v)); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                  style={{ width: 40, padding: '2px 3px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', textAlign: 'center' }}
                  title="Place height (px)"
                />
              </div>
            )}
            <span className="dc-toolbar-sep" />

            {/* Drawing: Outline + Wall */}
            <div className="dc-toolbar-group">
              <button
                className={`dc-tool-btn ${drawingOutline ? 'dc-tool-btn--active' : ''}`}
                onClick={startOutlineDrawing}
                title="Draw floor outline (click points, click green dot to close)"
                style={drawingOutline ? { background: '#ede9fe', color: '#7c3aed', borderColor: '#7c3aed' } : {}}
              >
                <span className="dc-tool-label" style={{ fontSize: '0.68rem' }}>{drawingOutline ? `Drawing... (${outlinePoints.length})` : 'Outline'}</span>
              </button>
              <button
                className={`dc-tool-btn ${activeTool === 'wall' && !placingAmenity && !drawingOutline ? 'dc-tool-btn--active' : ''}`}
                onClick={() => { setActiveTool('wall'); setOutlinePoints([]); setDrawingOutline(false); setRectDraw(null); setPlacingAmenity(null); setShowAmenityPicker(false); setPlacingFurniture(null); setShowFurniturePicker(false); setWallStart(null); setWallPreview(null); setPlacingDeskLayout(null); }}
                title="Wall (W)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="20" x2="20" y2="4"/></svg>
                <span className="dc-tool-label">Wall</span>
              </button>
            </div>
            {/* Wall thickness control */}
            {activeTool === 'wall' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Thickness</label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={wallThickness}
                  onChange={e => setWallThickness(Number(e.target.value))}
                  style={{ width: 60 }}
                  title={`Wall thickness: ${wallThickness}px`}
                />
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', minWidth: 18 }}>{wallThickness}</span>
              </div>
            )}
            <span className="dc-toolbar-sep" />

            {/* Assets & Amenities */}
            <div className="dc-toolbar-group">
              {/* Desk Layouts picker */}
              <div style={{ position: 'relative' }} data-dropdown>
                <button
                  className={`dc-tool-btn ${placingDeskLayout ? 'dc-tool-btn--active' : ''}`}
                  onClick={() => { setShowDeskLayoutPicker(!showDeskLayoutPicker); setShowFurniturePicker(false); setShowAmenityPicker(false); }}
                  title="Place conjoined desk layouts"
                  style={placingDeskLayout
                    ? { background: '#eff6ff', color: '#2563eb', borderColor: '#2563eb' }
                    : {}}
                >
                  <span className="dc-tool-label">{placingDeskLayout ? DESK_LAYOUTS.find(l => l.id === placingDeskLayout)?.label : 'Desk Layouts'}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {showDeskLayoutPicker && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 100,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 4,
                    minWidth: 200,
                  }}>
                    <div style={{ padding: '4px 8px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rows</div>
                    {DESK_LAYOUTS.filter(l => l.rows === 1).map(l => (
                      <button
                        key={l.id}
                        onClick={() => { setPlacingDeskLayout(l.id); setShowDeskLayoutPicker(false); setPlacingFurniture(null); setPlacingAmenity(null); setActiveTool('select'); }}
                        style={{
                          display: 'block', width: '100%', padding: '6px 10px', border: 'none', borderRadius: 4,
                          background: placingDeskLayout === l.id ? '#eff6ff' : 'transparent',
                          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, textAlign: 'left',
                          color: 'var(--color-text)',
                        }}
                      >
                        <span style={{ display: 'inline-flex', gap: 1, marginRight: 8, verticalAlign: 'middle' }}>
                          {Array.from({ length: l.cols }).map((_, i) => (
                            <span key={i} style={{ width: 8, height: 6, background: '#2563eb', borderRadius: 1, display: 'inline-block' }} />
                          ))}
                        </span>
                        {l.label}
                      </button>
                    ))}
                    <div style={{ padding: '4px 8px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid var(--color-border)', marginTop: 2 }}>Face to Face</div>
                    {DESK_LAYOUTS.filter(l => l.rows >= 2).map(l => (
                      <button
                        key={l.id}
                        onClick={() => { setPlacingDeskLayout(l.id); setShowDeskLayoutPicker(false); setPlacingFurniture(null); setPlacingAmenity(null); setActiveTool('select'); }}
                        style={{
                          display: 'block', width: '100%', padding: '6px 10px', border: 'none', borderRadius: 4,
                          background: placingDeskLayout === l.id ? '#eff6ff' : 'transparent',
                          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, textAlign: 'left',
                          color: 'var(--color-text)',
                        }}
                      >
                        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, marginRight: 8, verticalAlign: 'middle' }}>
                          <span style={{ display: 'flex', gap: 1 }}>
                            {Array.from({ length: l.cols }).map((_, i) => (
                              <span key={i} style={{ width: 8, height: 6, background: '#2563eb', borderRadius: 1 }} />
                            ))}
                          </span>
                          <span style={{ display: 'flex', gap: 1 }}>
                            {Array.from({ length: l.cols }).map((_, i) => (
                              <span key={i} style={{ width: 8, height: 6, background: '#93c5fd', borderRadius: 1 }} />
                            ))}
                          </span>
                        </span>
                        {l.label}
                      </button>
                    ))}
                    {placingDeskLayout && (
                      <button
                        onClick={() => { setPlacingDeskLayout(null); setShowDeskLayoutPicker(false); }}
                        style={{
                          display: 'block', width: '100%', padding: '6px 10px', border: 'none', borderRadius: 4,
                          background: '#fef2f2', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                          color: '#dc2626', textAlign: 'center', marginTop: 4,
                        }}
                      >
                        Stop Placing
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Amenity picker */}
              <div style={{ position: 'relative' }} data-dropdown>
                <button
                  className={`dc-tool-btn ${placingAmenity ? 'dc-tool-btn--active' : ''}`}
                  onClick={() => { setShowAmenityPicker(!showAmenityPicker); setShowFurniturePicker(false); }}
                  title="Place amenity icon"
                  style={placingAmenity
                    ? { background: '#fde8e8', color: '#dc2626', borderColor: '#dc2626' }
                    : {}}
                >
                  <span className="dc-tool-label">{placingAmenity ? AMENITY_ICONS.find(a => a.id === placingAmenity)?.label : 'Amenities'}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
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
                  style={placingFurniture
                    ? { background: '#f0fdf4', color: '#16a34a', borderColor: '#16a34a' }
                    : {}}
                >
                  <span className="dc-tool-label">{placingFurniture ? FURNITURE_ASSETS.find(a => a.id === placingFurniture)?.label : 'Furniture'}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
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
              input.accept = 'image/jpeg,image/png,image/svg+xml,application/pdf,.jpg,.jpeg,.png,.svg,.pdf';
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
            title="Upload floor plan (PNG, JPEG, PDF, SVG)"
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
          {editorState.gridEnabled && (
            <input
              type="number"
              min={5}
              max={100}
              step={5}
              value={editorState.gridSize}
              onChange={(e) => {
                const v = Math.max(5, Math.min(100, Number(e.target.value) || 20));
                setEditorState((prev) => ({ ...prev, gridSize: v }));
                setDirty(true);
              }}
              title="Grid size (px)"
              style={{ width: 40, padding: '2px 4px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', textAlign: 'center' }}
            />
          )}
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
          <div className="dc-toolbar-sep" />
          {/* Background color */}
          <label className="dc-tool-btn" title="Floor plan background color" style={{ cursor: 'pointer', gap: 4 }}>
            <input
              type="color"
              value={(floorplan as any).background_color || '#ffffff'}
              onChange={async (e) => {
                const color = e.target.value;
                try {
                  const updated = await updateFloorplan(floorplanId!, { background_color: color });
                  setFloorplan(updated);
                  showToast('Background color updated', 'success');
                } catch { showToast('Failed to update color', 'error'); }
              }}
              style={{ width: 20, height: 20, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }}
            />
            <span className="dc-tool-label">BG</span>
          </label>
        </div>

        {/* Alignment tools - visible when an object is selected */}
        {selectedObjectId && (
          <>
            <span className="dc-toolbar-sep" />
            <div className="dc-toolbar-group">
              {([
                {
                  label: 'Align Left', title: 'Align to left edge',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="2" x2="4" y2="22"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>,
                  action: () => {
                    const obj = objects.find(o => o.id === selectedObjectId);
                    if (!obj) return;
                    handleObjectChange(selectedObjectId, { geometry: { ...obj.geometry, x: 0 } });
                    showToast('Aligned left', 'info');
                  },
                },
                {
                  label: 'Center H', title: 'Center horizontally on canvas',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22"/><rect x="6" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>,
                  action: () => {
                    const obj = objects.find(o => o.id === selectedObjectId);
                    if (!obj) return;
                    const w = obj.geometry.width ?? 100;
                    handleObjectChange(selectedObjectId, { geometry: { ...obj.geometry, x: (canvasW - w) / 2 } });
                    showToast('Centered horizontally', 'info');
                  },
                },
                {
                  label: 'Align Right', title: 'Align to right edge',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="20" y1="2" x2="20" y2="22"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>,
                  action: () => {
                    const obj = objects.find(o => o.id === selectedObjectId);
                    if (!obj) return;
                    const w = obj.geometry.width ?? 100;
                    handleObjectChange(selectedObjectId, { geometry: { ...obj.geometry, x: canvasW - w } });
                    showToast('Aligned right', 'info');
                  },
                },
                {
                  label: 'Align Top', title: 'Align to top edge',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="4" x2="22" y2="4"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/></svg>,
                  action: () => {
                    const obj = objects.find(o => o.id === selectedObjectId);
                    if (!obj) return;
                    handleObjectChange(selectedObjectId, { geometry: { ...obj.geometry, y: 0 } });
                    showToast('Aligned top', 'info');
                  },
                },
                {
                  label: 'Center V', title: 'Center vertically on canvas',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="22" y2="12"/><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="6" width="4" height="12" rx="1"/></svg>,
                  action: () => {
                    const obj = objects.find(o => o.id === selectedObjectId);
                    if (!obj) return;
                    const h = obj.geometry.height ?? 100;
                    handleObjectChange(selectedObjectId, { geometry: { ...obj.geometry, y: (canvasH - h) / 2 } });
                    showToast('Centered vertically', 'info');
                  },
                },
                {
                  label: 'Align Bottom', title: 'Align to bottom edge',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="20" x2="22" y2="20"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/></svg>,
                  action: () => {
                    const obj = objects.find(o => o.id === selectedObjectId);
                    if (!obj) return;
                    const h = obj.geometry.height ?? 100;
                    handleObjectChange(selectedObjectId, { geometry: { ...obj.geometry, y: canvasH - h } });
                    showToast('Aligned bottom', 'info');
                  },
                },
              ]).map(({ label, title, icon, action }) => (
                <button
                  key={label}
                  className="dc-tool-btn"
                  onClick={action}
                  title={title}
                >
                  {icon}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Spacer + search + floor name */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="editor-search-input"
              placeholder="Search (Ctrl+F)"
              value={editorSearchQuery}
              onChange={e => setEditorSearchQuery(e.target.value)}
              onFocus={() => setEditorSearchOpen(true)}
              onBlur={() => setTimeout(() => setEditorSearchOpen(false), 200)}
              style={{
                width: 160, padding: '4px 8px', fontSize: '0.75rem',
                border: '1px solid var(--color-border)', borderRadius: 4,
                background: 'var(--color-surface)', color: 'var(--color-text)',
              }}
            />
            {editorSearchOpen && editorSearchQuery && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 200,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: 220, maxHeight: 200, overflowY: 'auto',
              }}>
                {objects
                  .filter(o => (o.object_type === 'room' || o.object_type === 'desk') && o.label?.toLowerCase().includes(editorSearchQuery.toLowerCase()))
                  .slice(0, 8)
                  .map(o => (
                    <div
                      key={o.id}
                      style={{
                        padding: '6px 10px', borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                      onMouseDown={() => {
                        setSelectedObjectId(o.id);
                        setEditorSearchQuery('');
                        // Scroll to the object and flash highlight
                        if (containerRef.current && o.geometry.x != null && o.geometry.y != null) {
                          const cx = o.geometry.x * zoom;
                          const cy = o.geometry.y * zoom;
                          containerRef.current.scrollTo({
                            left: cx - containerRef.current.clientWidth / 2,
                            top: cy - containerRef.current.clientHeight / 2,
                            behavior: 'smooth',
                          });
                        }
                        setHighlightObjectId(o.id);
                        setTimeout(() => setHighlightObjectId(null), 1500);
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLORS[o.object_type] ?? '#6b7280', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{o.label}</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase' }}>{o.object_type}</span>
                    </div>
                  ))}
                {objects.filter(o => (o.object_type === 'room' || o.object_type === 'desk') && o.label?.toLowerCase().includes(editorSearchQuery.toLowerCase())).length === 0 && (
                  <div style={{ padding: '8px 10px', fontSize: '0.72rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>No results</div>
                )}
              </div>
            )}
          </div>
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
                : '180px 1fr 300px',
          gridTemplateRows: editorMode === 'label' ? '1fr auto' : '1fr',
          overflow: 'hidden',
        }}
      >
        {/* Left sidebar: Layers/Objects (design mode only) */}
        {editorMode === 'design' && (
          <div
            style={{
              background: 'var(--color-surface)',
              borderRight: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Tab switcher */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
            }}>
              {(['layers', 'objects'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setLeftSidebarTab(tab)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    border: 'none',
                    background: leftSidebarTab === tab ? 'var(--color-surface)' : 'transparent',
                    borderBottom: leftSidebarTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: leftSidebarTab === tab ? 700 : 500,
                    color: leftSidebarTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {leftSidebarTab === 'layers' && (
                <LayerPanel
                  layers={layers}
                  activeLayer={activeLayerId}
                  onLayerChange={handleLayerChange}
                  onActiveLayerChange={setActiveLayerId}
                  onAddLayer={handleAddLayer}
                  onDeleteLayer={handleDeleteLayer}
                />
              )}
              {leftSidebarTab === 'objects' && (
                <ObjectListPanel
                  objects={objects}
                  selectedObjectId={selectedObjectId}
                  onSelect={setSelectedObjectId}
                  onScrollTo={(obj) => {
                    if (containerRef.current && obj.geometry.x != null && obj.geometry.y != null) {
                      const cx = obj.geometry.x * zoom;
                      const cy = obj.geometry.y * zoom;
                      containerRef.current.scrollTo({
                        left: cx - containerRef.current.clientWidth / 2,
                        top: cy - containerRef.current.clientHeight / 2,
                        behavior: 'smooth',
                      });
                    }
                    setHighlightObjectId(obj.id);
                    setTimeout(() => setHighlightObjectId(null), 1500);
                  }}
                />
              )}
            </div>
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
          onContextMenu={(e) => {
            e.preventDefault();
            if (editorMode !== 'design') return;
            const { x, y } = toSvgCoords(e.clientX, e.clientY);
            // Hit test objects in reverse order (top-most first)
            for (let i = visibleObjects.length - 1; i >= 0; i--) {
              const obj = visibleObjects[i];
              const g = obj.geometry;
              if (g.type === 'rect') {
                const rx = g.x ?? 0, ry = g.y ?? 0, rw = g.width ?? 0, rh = g.height ?? 0;
                if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
                  setSelectedObjectId(obj.id);
                  setContextMenu({ x: e.clientX, y: e.clientY, objectId: obj.id });
                  return;
                }
              }
              if (g.type === 'circle') {
                const dx = x - (g.x ?? 0), dy = y - (g.y ?? 0);
                if (dx * dx + dy * dy <= ((g.r ?? 12) * (g.r ?? 12))) {
                  setSelectedObjectId(obj.id);
                  setContextMenu({ x: e.clientX, y: e.clientY, objectId: obj.id });
                  return;
                }
              }
            }
            setContextMenu(null);
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasW} ${canvasH}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: `${zoom * 100}%`,
              display: 'block',
              cursor: panning ? 'grabbing' : spaceHeldRef.current ? 'grab' : dragging ? 'grabbing' : resizing ? HANDLE_CURSORS[resizing.handle] : 'default',
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

            {/* Canvas background */}
            <rect
              x={0} y={0}
              width={canvasW} height={canvasH}
              fill="white"
              stroke="var(--color-border)"
              strokeWidth="1"
              strokeDasharray="4 4"
              style={{ pointerEvents: 'none' }}
            />

            {/* Guide layer — the uploaded floor plan image */}
            {floorplan.source_image_path && (() => {
              const guideLayer = layers.find(l => l.id === 'guide');
              const guideVisible = guideLayer?.visible ?? true;
              const guideOpacity = guideLayer?.opacity ?? 0.5;
              if (!guideVisible) return null;
              return (
                <image
                  href={`/api/floorplans/${floorplan.id}/source-preview`}
                  x={0} y={0}
                  width={canvasW} height={canvasH}
                  opacity={guideOpacity}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })()}

            {/* Grid on top of image (re-render so it's visible over the image) */}
            {editorState.gridEnabled && (
              <rect
                data-ui-only="true"
                x={0} y={0} width={canvasW} height={canvasH}
                fill="url(#editor-grid)"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Wall outlines around rooms — rendered first so they appear beneath room fills */}
            {visibleObjects
              .filter(o => o.object_type === 'room' && o.geometry)
              .map(obj => {
                const geom = obj.geometry;
                const wallW = Math.max(3, strokeW * 2.5);
                if (geom.type === 'rect') {
                  return (
                    <rect
                      key={`wall-${obj.id}`}
                      x={(geom.x ?? 0)} y={(geom.y ?? 0)}
                      width={geom.width ?? 50} height={geom.height ?? 50}
                      fill="none"
                      stroke="#1a1a1a"
                      strokeWidth={wallW}
                      strokeLinejoin="miter"
                      rx={0}
                      style={{ pointerEvents: 'none' }}
                    />
                  );
                }
                if (geom.type === 'polygon' && geom.points) {
                  const pts = geom.points.map(p => `${p.x},${p.y}`).join(' ');
                  return (
                    <polygon
                      key={`wall-${obj.id}`}
                      points={pts}
                      fill="none"
                      stroke="#1a1a1a"
                      strokeWidth={wallW}
                      strokeLinejoin="miter"
                      style={{ pointerEvents: 'none' }}
                    />
                  );
                }
                return null;
              })}

            {/* Render map objects as colored rectangles with labels */}
            {visibleObjects.map((obj) => {
              const geom = obj.geometry;
              if (geom.type !== 'rect' && geom.type !== 'circle' && geom.type !== 'polygon' && geom.type !== 'path') return null;

              const effectiveOpacity = obj.opacity * (layerOpacity.get(obj.layer) ?? 1);
              const isSelected = obj.id === selectedObjectId;
              const isHighlighted = obj.id === highlightObjectId;
              const availColor =
                availabilityEnabled && availabilityStates[obj.id]
                  ? getAvailabilityColor(availabilityStates[obj.id])
                  : undefined;

              const typeColor = TYPE_COLORS[obj.object_type] ?? '#4b5563';
              // Floor outline uses the floorplan background color
              const objFill = obj.svg_id === 'floor-outline'
                ? ((floorplan as any).background_color || obj.fill_color || 'rgba(107,114,128,0.15)')
                : (obj.fill_color || typeColor + '55');
              const objStroke = obj.stroke_color || typeColor;
              const fillColor = availColor ?? (isSelected ? objFill : objFill);
              const strokeColor = isSelected ? '#f59e0b' : objStroke;
              const sw = isSelected ? strokeW * 1.5 : strokeW;

              if (geom.type === 'rect') {
                const rx = geom.x ?? 0, ry = geom.y ?? 0;
                const rw = geom.width ?? 50, rh = geom.height ?? 50;
                const fontSize = Math.max(8, Math.min(rw / 6, rh / 3, 24));

                // Look up furniture SVG asset if this object has one
                const furnitureType = (obj.metadata as Record<string, unknown>)?.furnitureType as string | undefined;
                const furnitureAsset = furnitureType ? FURNITURE_ASSETS.find(a => a.id === furnitureType) : null;

                return (
                  <g key={obj.id} data-object-id={obj.id} opacity={effectiveOpacity}
                    onClick={(ev) => {
                      if (editorMode === 'preview' && (obj.object_type === 'room' || obj.object_type === 'desk')) {
                        ev.stopPropagation();
                        setSelectedObjectId(obj.id);
                        setStatePopup({ objectId: obj.id, x: ev.clientX, y: ev.clientY });
                      }
                    }}
                    transform={
                      geom.rotation
                        ? `rotate(${geom.rotation} ${rx + rw / 2} ${ry + rh / 2})`
                        : undefined
                    }
                  >
                    {/* Background rect — always present for hit area + selection */}
                    <rect
                      x={rx} y={ry} width={rw} height={rh}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={sw}
                      rx={4}
                      style={{ cursor: editorMode === 'preview' ? 'pointer' : 'move' }}
                    />
                    {/* Furniture SVG artwork overlay */}
                    {furnitureAsset && (
                      <g
                        transform={`translate(${rx}, ${ry}) scale(${rw / 24}, ${rh / 24})`}
                        style={{ pointerEvents: 'none' }}
                        dangerouslySetInnerHTML={{
                          __html: furnitureAsset.svg.replace(/currentColor/g, objStroke),
                        }}
                      />
                    )}
                    {/* Desk icon — show a small monitor/keyboard hint inside */}
                    {!furnitureAsset && obj.object_type === 'desk' && rw >= 16 && rh >= 16 && (
                      <g style={{ pointerEvents: 'none' }}>
                        <rect
                          x={rx + rw * 0.2} y={ry + rh * 0.2}
                          width={rw * 0.6} height={rh * 0.3}
                          rx={1} fill="none" stroke="#fff" strokeWidth={sw * 0.8} opacity={0.6}
                        />
                        <rect
                          x={rx + rw * 0.3} y={ry + rh * 0.58}
                          width={rw * 0.4} height={rh * 0.15}
                          rx={0.5} fill="none" stroke="#fff" strokeWidth={sw * 0.6} opacity={0.4}
                        />
                      </g>
                    )}
                    {/* Label text */}
                    {obj.label && (
                      <text
                        x={rx + rw / 2} y={ry + rh / 2 - (availabilityEnabled && availabilityStates[obj.id] ? fontSize * 0.4 : 0)}
                        textAnchor="middle" dominantBaseline="central"
                        fill="#fff" fontSize={fontSize}
                        fontFamily="Arial, sans-serif" fontWeight="600"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {obj.label}
                      </text>
                    )}
                    {/* State badge in preview mode */}
                    {availabilityEnabled && availabilityStates[obj.id] && (
                      <text
                        x={rx + rw / 2} y={ry + rh / 2 + fontSize * 0.55}
                        textAnchor="middle" dominantBaseline="central"
                        fill="#fff" fontSize={fontSize * 0.7}
                        fontFamily="Arial, sans-serif" fontWeight="700"
                        opacity={0.9}
                        style={{ pointerEvents: 'none', userSelect: 'none', textTransform: 'uppercase' as const }}
                      >
                        {availabilityStates[obj.id].replace(/-/g, ' ').toUpperCase()}
                      </text>
                    )}

                    {/* Search highlight flash */}
                    {isHighlighted && (
                      <rect
                        data-ui-only="true"
                        x={rx - 3} y={ry - 3} width={rw + 6} height={rh + 6}
                        fill="none" stroke="#f59e0b" strokeWidth={strokeW * 2.5}
                        rx={6}
                        style={{ pointerEvents: 'none', animation: 'search-flash 0.5s ease-in-out 3' }}
                      />
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
                    {/* Rotation handle */}
                    {isSelected && geom.type === 'rect' && (
                      <g>
                        <line
                          data-ui-only="true"
                          x1={rx + rw / 2} y1={ry}
                          x2={rx + rw / 2} y2={ry - 25 / (strokeW / 2)}
                          stroke="#f59e0b" strokeWidth={strokeW * 0.5}
                          style={{ pointerEvents: 'none' }}
                        />
                        <circle
                          data-ui-only="true"
                          cx={rx + rw / 2} cy={ry - 25 / (strokeW / 2)}
                          r={handleR * 0.8}
                          fill="#f59e0b" stroke="#fff" strokeWidth={strokeW * 0.5}
                          style={{ cursor: 'grab' }}
                          onMouseDown={(ev) => {
                            ev.stopPropagation();
                            const centerX = rx + rw / 2;
                            const centerY = ry + rh / 2;
                            const handleY = ry - 25 / (strokeW / 2);
                            const startAngle = Math.atan2(
                              handleY - centerY,
                              (rx + rw / 2) - centerX
                            ) * 180 / Math.PI;
                            setRotating({
                              objectId: obj.id,
                              centerX,
                              centerY,
                              startAngle,
                              startRotation: geom.rotation ?? 0,
                            });
                          }}
                        />
                      </g>
                    )}
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
                      fill={fillColor} stroke={strokeColor} strokeWidth={sw} opacity={effectiveOpacity} />
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
                    opacity={effectiveOpacity}
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
                    opacity={effectiveOpacity}
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
            {/* Wall drawing preview */}
            {wallStart && wallPreview && activeTool === 'wall' && (
              <g data-ui-only="true" style={{ pointerEvents: 'none' }}>
                {/* Preview line */}
                <line
                  x1={wallStart.x} y1={wallStart.y}
                  x2={wallPreview.x} y2={wallPreview.y}
                  stroke="#374151" strokeWidth={wallThickness}
                  strokeLinecap="round" opacity={0.6}
                />
                {/* Start dot */}
                <circle cx={wallStart.x} cy={wallStart.y} r={4} fill="#374151" />
                {/* End dot */}
                <circle cx={wallPreview.x} cy={wallPreview.y} r={4} fill="#374151" stroke="#fff" strokeWidth={1} />
                {/* Length and angle label */}
                {(() => {
                  const dx = wallPreview.x - wallStart.x;
                  const dy = wallPreview.y - wallStart.y;
                  const len = Math.round(Math.sqrt(dx * dx + dy * dy));
                  const angle = Math.round(Math.atan2(-dy, dx) * 180 / Math.PI);
                  const mx = (wallStart.x + wallPreview.x) / 2;
                  const my = (wallStart.y + wallPreview.y) / 2 - 12;
                  return (
                    <g>
                      <rect x={mx - 35} y={my - 9} width={70} height={18} rx={4} fill="rgba(55,65,81,0.9)" />
                      <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="central" fontSize={9} fill="#fff"
                        fontFamily="Arial" fontWeight="600" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {len}px &middot; {angle}&deg;
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}
            {/* Wall start marker when tool active but no preview yet */}
            {wallStart && !wallPreview && activeTool === 'wall' && (
              <circle data-ui-only="true" cx={wallStart.x} cy={wallStart.y} r={5} fill="#374151" stroke="#fff" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
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

            {/* Snap alignment guides */}
            {snapGuides.map((guide, i) => (
              guide.type === 'v' ? (
                <line key={`snap-${i}`} data-ui-only="true"
                  x1={guide.pos} y1={0} x2={guide.pos} y2={canvasH}
                  stroke="#ff3366" strokeWidth={1} strokeDasharray="4 4"
                  style={{ pointerEvents: 'none' }} />
              ) : (
                <line key={`snap-${i}`} data-ui-only="true"
                  x1={0} y1={guide.pos} x2={canvasW} y2={guide.pos}
                  stroke="#ff3366" strokeWidth={1} strokeDasharray="4 4"
                  style={{ pointerEvents: 'none' }} />
              )
            ))}
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

          {/* Label assignment popup on canvas */}
          {rightSidebarTab === 'label' && selectedObject && importedLabelIds.length > 0 && (() => {
            if (!svgRef.current || !containerRef.current) return null;
            const obj = selectedObject;
            const pt = svgRef.current.createSVGPoint();
            pt.x = (obj.geometry.x ?? 0) + (obj.geometry.width ?? 100);
            pt.y = (obj.geometry.y ?? 0);
            const ctm = svgRef.current.getScreenCTM();
            if (!ctm) return null;
            const sp = pt.matrixTransform(ctm);
            const cr = containerRef.current.getBoundingClientRect();
            const q = labelSearchQuery.toLowerCase();
            const filtered = labelSearchQuery.length >= 1
              ? importedLabelIds.filter(i => !i.assigned && (i.id.toLowerCase().includes(q) || (i.label && i.label.toLowerCase().includes(q))))
              : importedLabelIds.filter(i => !i.assigned);

            return (
              <div style={{
                position: 'absolute',
                left: Math.min(sp.x - cr.left + 12, cr.width - 260),
                top: Math.max(sp.y - cr.top - 10, 10),
                zIndex: 20,
                width: 240,
                background: '#fff',
                borderRadius: 10,
                boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}>
                {/* Header with object name */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {obj.label || obj.svg_id || 'Unnamed'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {obj.object_type} &middot; {obj.svg_id || 'no ID'}
                  </div>
                </div>
                {/* Search */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>
                  <input
                    type="text"
                    value={labelSearchQuery}
                    onChange={e => setLabelSearchQuery(e.target.value)}
                    placeholder="Search IDs to assign..."
                    autoFocus
                    style={{
                      width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)',
                      borderRadius: 6, fontSize: '0.82rem', background: 'var(--color-bg)', outline: 'none',
                    }}
                  />
                </div>
                {/* ID list */}
                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {filtered.slice(0, 10).map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        handleObjectChange(obj.id, { svg_id: item.id, label: item.label || item.id });
                        setImportedLabelIds(prev => prev.map(i => i.id === item.id ? { ...i, assigned: true } : i));
                        showToast(`Assigned "${item.id}" to ${obj.label || 'object'}`, 'success');
                      }}
                      style={{
                        padding: '7px 12px', cursor: 'pointer', fontSize: '0.82rem',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{item.id}</span>
                      {item.label && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>{item.label}</span>}
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div style={{ padding: 12, textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                      {labelSearchQuery ? 'No matching IDs' : 'All IDs assigned'}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Minimap — fixed position over canvas area */}
        {editorMode === 'design' && (
          <Minimap
            objects={objects}
            canvasW={canvasW}
            canvasH={canvasH}
            containerRef={containerRef}
            zoom={zoom}
            floorplanId={floorplanId ?? undefined}
          />
        )}

        {/* Right sidebar: Properties + Label (design mode) */}
        {editorMode === 'design' && (
          <div
            style={{
              background: 'var(--color-surface)',
              borderLeft: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Tab switcher */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              flexShrink: 0,
            }}>
              {(['properties', 'label'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRightSidebarTab(tab)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    border: 'none',
                    background: rightSidebarTab === tab ? 'var(--color-surface)' : 'transparent',
                    borderBottom: rightSidebarTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: rightSidebarTab === tab ? 700 : 500,
                    color: rightSidebarTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab === 'label' ? 'Labelling' : 'Properties'}
                </button>
              ))}
            </div>
            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {rightSidebarTab === 'properties' && (
                <PropertiesPanel
                  object={selectedObject}
                  onChange={handleObjectChange}
                  onDelete={handleObjectDelete}
                  backgroundColor={(floorplan as any).background_color || '#ffffff'}
                  onBackgroundColorChange={async (color) => {
                    try {
                      const updated = await updateFloorplan(floorplanId!, { background_color: color });
                      setFloorplan(updated);
                    } catch { /* ignore */ }
                  }}
                />
              )}
              {rightSidebarTab === 'label' && (
                <LabellingPanel
                  selectedObjects={selectedObjects}
                  allObjects={objects}
                  onBulkUpdate={handleBulkUpdate}
                  onAutoNumber={handleAutoNumber}
                  onExportCsv={handleExportCsv}
                  onImportCsv={handleImportCsv}
                  importedIds={importedLabelIds}
                  onImportedIdsChange={setImportedLabelIds}
                />
              )}
            </div>
          </div>
        )}

        {/* State picker popup */}
        {statePopup && (() => {
          const popupObj = objects.find(o => o.id === statePopup.objectId);
          if (!popupObj) return null;
          const validStates = getStatesForType(popupObj.object_type);
          return (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={() => setStatePopup(null)}
              />
              <div
                className="ss-state-popup"
                style={{
                  position: 'fixed',
                  left: statePopup.x,
                  top: statePopup.y,
                  zIndex: 9999,
                  transform: 'translate(-50%, 8px)',
                }}
              >
                <div className="ss-popup-title">
                  {popupObj.label || popupObj.svg_id || popupObj.id.slice(0, 8)}
                </div>
                {validStates.map((state) => {
                  const isActive = availabilityStates[statePopup.objectId] === state;
                  return (
                    <button
                      key={state}
                      className={`ss-popup-option ${isActive ? 'ss-popup-option--active' : ''}`}
                      onClick={() => {
                        setAvailabilityStates(prev => ({ ...prev, [statePopup.objectId]: state }));
                        setStatePopup(null);
                      }}
                    >
                      <span className="ss-legend-swatch" style={{ backgroundColor: STATE_COLORS[state] }} />
                      {state.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}

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
                onClick={async () => {
                  if (!floorplan) return;
                  const w = canvasW;
                  const h = canvasH;

                  // Build a clean SVG from scratch instead of cloning the canvas
                  const lines: string[] = [];
                  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
                  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`);

                  // Background
                  const bgColor = (floorplan as any).background_color || '#ffffff';
                  lines.push(`  <rect x="0" y="0" width="${w}" height="${h}" fill="${bgColor}" />`);

                  // No background image in export — clean canvas with objects only

                  // Helper: convert any color to rgba with specific opacity
                  const toFillOpacity = (hex: string, opacity: number): string => {
                    const clean = hex.replace('#', '').slice(0, 6);
                    const r = parseInt(clean.slice(0, 2), 16) || 0;
                    const g = parseInt(clean.slice(2, 4), 16) || 0;
                    const b = parseInt(clean.slice(4, 6), 16) || 0;
                    return `rgba(${r},${g},${b},${opacity})`;
                  };

                  // Export fill/stroke per type (clean, consistent look)
                  const getExportFill = (obj: MapObject): string => {
                    const baseColor = TYPE_COLORS[obj.object_type] ?? '#4b5563';
                    switch (obj.object_type) {
                      case 'room': return toFillOpacity(obj.fill_color || baseColor, 0.45);
                      case 'desk': return toFillOpacity(obj.fill_color || baseColor, 0.55);
                      case 'zone': case 'area': return toFillOpacity(obj.fill_color || baseColor, 0.2);
                      case 'amenity': return toFillOpacity(obj.fill_color || baseColor, 0.5);
                      case 'decorative': return obj.layer === 'walls' ? '#374151' : toFillOpacity(baseColor, 0.3);
                      default: return toFillOpacity(baseColor, 0.3);
                    }
                  };
                  const getExportStroke = (obj: MapObject): string => {
                    if (obj.object_type === 'room') return '#374151';
                    if (obj.object_type === 'desk') return TYPE_COLORS.desk ?? '#22c55e';
                    if (obj.object_type === 'decorative' && obj.layer === 'walls') return '#1f2937';
                    return obj.stroke_color || (TYPE_COLORS[obj.object_type] ?? '#6b7280');
                  };
                  const getExportStrokeWidth = (obj: MapObject): string => {
                    if (obj.object_type === 'room') return '1.5';
                    if (obj.object_type === 'desk') return '0.8';
                    if (obj.object_type === 'decorative' && obj.layer === 'walls') return '1';
                    return '1';
                  };

                  // Render each object by type
                  const typeOrder = ['decorative', 'zone', 'area', 'room', 'desk', 'locker', 'parking', 'amenity'];
                  for (const objType of typeOrder) {
                    const typeObjs = objects.filter(o => o.object_type === objType && o.visible);
                    if (typeObjs.length === 0) continue;

                    lines.push(`  <g id="${objType}s">`);
                    for (const obj of typeObjs) {
                      const g = obj.geometry;
                      const fill = getExportFill(obj);
                      const stroke = getExportStroke(obj);
                      const sw = getExportStrokeWidth(obj);
                      const label = obj.label || '';
                      const svgId = obj.svg_id || obj.id;
                      const rotation = g.rotation ? ` transform="rotate(${g.rotation} ${(g.x ?? 0) + (g.width ?? 0) / 2} ${(g.y ?? 0) + (g.height ?? 0) / 2})"` : '';

                      if (g.type === 'rect') {
                        const rx = g.x ?? 0, ry = g.y ?? 0, rw = g.width ?? 50, rh = g.height ?? 50;
                        lines.push(`    <g id="${svgId}"${rotation}>`);
                        lines.push(`      <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="2" data-type="${obj.object_type}" data-label="${label}" />`);
                        if (label && obj.object_type !== 'decorative') {
                          const fontSize = Math.max(8, Math.min(rw / 6, rh / 3, 16));
                          const textFill = '#ffffff';
                          lines.push(`      <text x="${rx + rw / 2}" y="${ry + rh / 2}" text-anchor="middle" dominant-baseline="central" fill="${textFill}" font-size="${fontSize}" font-weight="600" font-family="Arial, sans-serif">${label}</text>`);
                        }
                        lines.push(`    </g>`);
                      } else if (g.type === 'polygon' && g.points) {
                        const pts = g.points.map(p => `${p.x},${p.y}`).join(' ');
                        const cx = g.points.reduce((s, p) => s + p.x, 0) / g.points.length;
                        const cy = g.points.reduce((s, p) => s + p.y, 0) / g.points.length;
                        lines.push(`    <g id="${svgId}">`);
                        lines.push(`      <polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" data-type="${obj.object_type}" data-label="${label}" />`);
                        if (label) {
                          lines.push(`      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="10" font-weight="600" font-family="Arial, sans-serif">${label}</text>`);
                        }
                        lines.push(`    </g>`);
                      } else if (g.type === 'circle') {
                        const cx = g.x ?? 0, cy = g.y ?? 0, cr = g.r ?? 10;
                        lines.push(`    <g id="${svgId}">`);
                        lines.push(`      <circle cx="${cx}" cy="${cy}" r="${cr}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" data-type="${obj.object_type}" data-label="${label}" />`);
                        if (label) {
                          lines.push(`      <text x="${cx}" y="${cy + cr + 10}" text-anchor="middle" dominant-baseline="central" fill="${stroke}" font-size="8" font-weight="600" font-family="Arial, sans-serif">${label}</text>`);
                        }
                        lines.push(`    </g>`);
                      }
                    }
                    lines.push(`  </g>`);
                  }

                  lines.push(`</svg>`);

                  const svgString = lines.join('\n');
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
                  // Set background color on the first rect
                  const bgRect = clone.querySelector('rect');
                  if (bgRect) bgRect.setAttribute('fill', (floorplan as any).background_color || '#ffffff');

                  const svgString = new XMLSerializer().serializeToString(clone);
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = w * 2;
                    canvas.height = h * 2;
                    const ctx = canvas.getContext('2d')!;
                    ctx.scale(2, 2);
                    // Fill background color first
                    ctx.fillStyle = (floorplan as any).background_color || '#ffffff';
                    ctx.fillRect(0, 0, w, h);
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
              <button
                onClick={() => {
                  if (!floorplan) return;
                  window.open(`/kiosk/${floorplan.project_id}/${floorplan.id}`, '_blank');
                }}
                style={{
                  width: '100%', padding: '10px 16px', border: '1px solid var(--color-border)', borderRadius: 8,
                  background: '#ffffff', color: '#3b82f6', fontWeight: 600,
                  fontSize: '0.82rem', cursor: 'pointer', marginTop: 8,
                }}
              >
                3D View
              </button>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
                Objects: {objects.length} | Floor: {floorplan?.floor_name}
              </p>
            </div>

            {/* Publish to PlaceOS section */}
            <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                Publish to PlaceOS
              </h3>

              {/* Validation checklist */}
              {(() => {
                const bookable = objects.filter(o => o.object_type === 'room' || o.object_type === 'desk');
                const PLACEOS_ID_RE = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;
                const checks = [
                  {
                    label: 'All IDs start with a letter',
                    pass: bookable.every(o => /^[a-zA-Z]/.test(o.svg_id || o.id)),
                    detail: bookable.filter(o => !/^[a-zA-Z]/.test(o.svg_id || o.id)).map(o => o.svg_id || o.id).join(', '),
                  },
                  {
                    label: 'No duplicate IDs',
                    pass: new Set(bookable.map(o => o.svg_id || o.id)).size === bookable.length,
                    detail: (() => {
                      const seen = new Map<string, number>();
                      for (const o of bookable) {
                        const sid = o.svg_id || o.id;
                        seen.set(sid, (seen.get(sid) || 0) + 1);
                      }
                      return [...seen.entries()].filter(([, c]) => c > 1).map(([id, c]) => `${id} (×${c})`).join(', ');
                    })(),
                  },
                  {
                    label: 'All bookable spaces have labels',
                    pass: bookable.every(o => o.label && o.label.trim().length > 0),
                    detail: bookable.filter(o => !o.label || o.label.trim().length === 0).map(o => o.svg_id || o.id).join(', '),
                  },
                  {
                    label: 'Valid ID format (letters, digits, hyphens, dots)',
                    pass: bookable.every(o => PLACEOS_ID_RE.test(o.svg_id || o.id)),
                    detail: bookable.filter(o => !PLACEOS_ID_RE.test(o.svg_id || o.id)).map(o => o.svg_id || o.id).join(', '),
                  },
                  {
                    label: `Bookable spaces found (${bookable.length})`,
                    pass: bookable.length > 0,
                    detail: '',
                  },
                ];
                const allPass = checks.every(c => c.pass);

                return (
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      {checks.map((check, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '4px 0', fontSize: '0.78rem',
                          color: check.pass ? 'var(--color-success)' : '#dc2626',
                        }}>
                          <span style={{ flexShrink: 0, marginTop: 1 }}>{check.pass ? '\u2713' : '\u2717'}</span>
                          <div>
                            <span>{check.label}</span>
                            {!check.pass && check.detail && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                                {check.detail}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Auto-fix IDs button */}
                    {!checks[3].pass && (
                      <button
                        onClick={async () => {
                          for (const obj of bookable) {
                            const currentId = obj.svg_id || obj.id;
                            if (PLACEOS_ID_RE.test(currentId)) continue;
                            // Fix: lowercase, replace spaces with hyphens, remove invalid chars
                            const fixed = currentId
                              .toLowerCase()
                              .replace(/\s+/g, '-')
                              .replace(/[^a-z0-9_.-]/g, '')
                              .replace(/^[^a-z]+/, 'area-');
                            if (fixed !== currentId && fixed.length > 0) {
                              await handleObjectChange(obj.id, { svg_id: fixed });
                            }
                          }
                        }}
                        style={{
                          width: '100%', padding: '8px 12px', border: '1px solid #d97706',
                          borderRadius: 8, background: '#fffbeb', color: '#92400e',
                          fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                          marginBottom: 10,
                        }}
                      >
                        Auto-fix IDs (replace spaces with hyphens)
                      </button>
                    )}

                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
                      Exports with <strong>no fill</strong> overlays on bookable spaces. IDs formatted as <code style={{ fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>area-&#123;mapId&#125;-status</code> to match PlaceOS control system map IDs. Includes CSS status classes: <code style={{ fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>free</code>, <code style={{ fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>available</code>, <code style={{ fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>booked</code>, <code style={{ fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>occupied</code>, <code style={{ fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>out-of-service</code>, <code style={{ fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>restricted</code>, <code style={{ fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>unavailable</code>.
                    </div>

                    <button
                      onClick={async () => {
                        if (!floorplan) return;
                        const w = canvasW;
                        const h = canvasH;

                        // Fetch source floorplan image and convert to base64 for embedding
                        let bgDataUri = '';
                        let bgType = 'image/svg+xml';
                        try {
                          const bgResp = await fetch(`/api/floorplans/${floorplan.id}/source-preview`);
                          if (bgResp.ok) {
                            const contentType = bgResp.headers.get('content-type') || 'image/svg+xml';
                            bgType = contentType;
                            if (contentType.includes('svg')) {
                              // Embed SVG as data URI
                              const svgText = await bgResp.text();
                              bgDataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
                            } else {
                              // Raster image — convert blob to data URI
                              const blob = await bgResp.blob();
                              bgDataUri = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                              });
                            }
                          }
                        } catch { /* continue without background */ }

                        // Build SVG from scratch with proper PlaceOS structure
                        const nonBookable = objects.filter(o => o.object_type !== 'room' && o.object_type !== 'desk');
                        const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

                        // Helper to render geometry as SVG element string
                        const renderShape = (obj: typeof objects[0], attrs: string) => {
                          const geom = obj.geometry;
                          if (geom.type === 'rect') {
                            return `<rect x="${geom.x ?? 0}" y="${geom.y ?? 0}" width="${geom.width ?? 50}" height="${geom.height ?? 50}" rx="3" ${attrs}${geom.rotation ? ` transform="rotate(${geom.rotation} ${(geom.x ?? 0) + (geom.width ?? 50) / 2} ${(geom.y ?? 0) + (geom.height ?? 50) / 2})"` : ''}/>`;
                          } else if (geom.type === 'polygon' && geom.points) {
                            return `<polygon points="${geom.points.map((p: {x:number;y:number}) => `${p.x},${p.y}`).join(' ')}" ${attrs}/>`;
                          } else if (geom.type === 'circle') {
                            return `<circle cx="${geom.x ?? 0}" cy="${geom.y ?? 0}" r="${geom.r ?? 12}" ${attrs}/>`;
                          } else if (geom.type === 'path' && geom.d) {
                            return `<path d="${escXml(geom.d)}" ${attrs}/>`;
                          }
                          return '';
                        };

                        let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
                        svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`;
                        svg += `<!-- PlaceOS SVG Map | Bookable spaces: ${bookable.length} | Generated: ${new Date().toISOString()} -->\n`;

                        // Internal CSS — PlaceOS status classes + no-fill defaults
                        svg += `<style>\n`;
                        svg += `  .st4, .st5 { fill: none; pointer-events: all; }\n`;
                        svg += `  .free, .available { fill: #4CAF50; fill-opacity: 0.4; pointer-events: all; }\n`;
                        svg += `  .booked, .pending { fill: #FF9800; fill-opacity: 0.4; pointer-events: all; }\n`;
                        svg += `  .occupied { fill: #F44336; fill-opacity: 0.4; pointer-events: all; }\n`;
                        svg += `  .checked-in { fill: #2196F3; fill-opacity: 0.4; pointer-events: all; }\n`;
                        svg += `  .out-of-service, .unavailable { fill: #9E9E9E; fill-opacity: 0.4; pointer-events: all; }\n`;
                        svg += `  .restricted { fill: #795548; fill-opacity: 0.4; pointer-events: all; }\n`;
                        svg += `  .roomLabel { font-family: Arial, sans-serif; font-weight: 600; fill: #333; text-anchor: middle; dominant-baseline: central; }\n`;
                        svg += `  .deskLabel { font-family: Arial, sans-serif; font-weight: 400; fill: #333; text-anchor: middle; dominant-baseline: central; }\n`;
                        svg += `</style>\n`;

                        // Layer: bkd (background floorplan image)
                        if (bgDataUri) {
                          svg += `<g id="bkd">\n`;
                          svg += `  <image href="${bgDataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>\n`;
                          svg += `</g>\n`;
                        }

                        // Layer: outline (area/zone objects)
                        const outlines = nonBookable.filter(o => o.object_type === 'area' || o.object_type === 'zone');
                        if (outlines.length > 0) {
                          svg += `<g id="outline">\n`;
                          for (const obj of outlines) {
                            const fill = obj.fill_color || 'none';
                            const stroke = obj.stroke_color || '#6b7280';
                            svg += `  ${renderShape(obj, `fill="${fill}" stroke="${stroke}" stroke-width="2"`)}\n`;
                          }
                          svg += `</g>\n`;
                        }

                        // Layer: space-highlights (decorative, parking, locker)
                        const highlights = nonBookable.filter(o => ['decorative', 'parking', 'locker'].includes(o.object_type));
                        if (highlights.length > 0) {
                          svg += `<g id="space-highlights">\n`;
                          for (const obj of highlights) {
                            const fill = obj.fill_color || '#6b728055';
                            const stroke = obj.stroke_color || '#6b7280';
                            svg += `  ${renderShape(obj, `fill="${fill}" stroke="${stroke}" stroke-width="1"`)}\n`;
                          }
                          svg += `</g>\n`;
                        }

                        // Layer: room-bookings (bookable overlays — no fill, PlaceOS ID convention)
                        svg += `<g id="room-bookings">\n`;
                        for (const obj of bookable) {
                          const mapId = obj.svg_id || obj.id;
                          const placeosId = mapId.startsWith('area-') ? `${mapId}-status` : `area-${mapId}-status`;
                          const cls = obj.object_type === 'desk' ? 'st5' : 'st4';
                          svg += `  ${renderShape(obj, `id="${escXml(placeosId)}" class="${cls}"`)}\n`;
                        }
                        svg += `</g>\n`;

                        // Layer: text (labels for all bookable objects)
                        svg += `<g id="text">\n`;
                        for (const obj of bookable) {
                          if (!obj.label) continue;
                          const geom = obj.geometry;
                          const cx = (geom.x ?? 0) + (geom.width ?? 50) / 2;
                          const cy = (geom.y ?? 0) + (geom.height ?? 50) / 2;
                          const fontSize = Math.max(8, Math.min((geom.width ?? 50) / 6, (geom.height ?? 50) / 3, 24));
                          const cls = obj.object_type === 'desk' ? 'deskLabel' : 'roomLabel';
                          svg += `  <text x="${cx}" y="${cy}" class="${cls}" font-size="${fontSize}">${escXml(obj.label)}</text>\n`;
                        }
                        svg += `</g>\n`;

                        // Layer: icons (amenity objects)
                        const amenities = nonBookable.filter(o => o.object_type === 'amenity');
                        if (amenities.length > 0) {
                          svg += `<g id="icons">\n`;
                          for (const obj of amenities) {
                            const fill = obj.fill_color || '#dc2626';
                            svg += `  ${renderShape(obj, `fill="${fill}" stroke="none"`)}\n`;
                          }
                          svg += `</g>\n`;
                        }

                        svg += `</svg>\n`;

                        const blob = new Blob([svg], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${floorplan.floor_name?.replace(/\s+/g, '-') || 'floorplan'}-placeos.svg`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      disabled={!allPass}
                      style={{
                        width: '100%', padding: '10px 16px', border: 'none', borderRadius: 8,
                        background: allPass ? '#059669' : '#9ca3af', color: 'white', fontWeight: 600,
                        fontSize: '0.82rem', cursor: allPass ? 'pointer' : 'not-allowed', marginBottom: 8,
                      }}
                    >
                      Publish SVG for PlaceOS
                    </button>

                    <button
                      onClick={async () => {
                        if (!floorplan) return;
                        const w = canvasW;
                        const h = canvasH;

                        let bgDataUri = '';
                        try {
                          const bgResp = await fetch(`/api/floorplans/${floorplan.id}/source-preview`);
                          if (bgResp.ok) {
                            const ct = bgResp.headers.get('content-type') || '';
                            if (ct.includes('svg')) {
                              bgDataUri = `data:image/svg+xml;base64,${btoa(await bgResp.text())}`;
                            } else {
                              const blob = await bgResp.blob();
                              bgDataUri = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                              });
                            }
                          }
                        } catch { /* continue without background */ }

                        const bookableObjs = objects.filter(o => o.object_type === 'room' || o.object_type === 'desk');
                        const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

                        const renderShapePreview = (obj: typeof objects[0], attrs: string) => {
                          const geom = obj.geometry;
                          if (geom.type === 'rect') {
                            return `<rect x="${geom.x ?? 0}" y="${geom.y ?? 0}" width="${geom.width ?? 50}" height="${geom.height ?? 50}" rx="3" ${attrs}${geom.rotation ? ` transform="rotate(${geom.rotation} ${(geom.x ?? 0) + (geom.width ?? 50) / 2} ${(geom.y ?? 0) + (geom.height ?? 50) / 2})"` : ''}/>`;
                          } else if (geom.type === 'polygon' && geom.points) {
                            return `<polygon points="${geom.points.map((p: {x:number;y:number}) => `${p.x},${p.y}`).join(' ')}" ${attrs}/>`;
                          } else if (geom.type === 'circle') {
                            return `<circle cx="${geom.x ?? 0}" cy="${geom.y ?? 0}" r="${geom.r ?? 12}" ${attrs}/>`;
                          } else if (geom.type === 'path' && geom.d) {
                            return `<path d="${escXml(geom.d)}" ${attrs}/>`;
                          }
                          return '';
                        };

                        // Build overlay elements data for the preview
                        const overlayData = bookableObjs.map(obj => {
                          const mapId = obj.svg_id || obj.id;
                          const placeosId = mapId.startsWith('area-') ? `${mapId}-status` : `area-${mapId}-status`;
                          const cls = obj.object_type === 'desk' ? 'st5' : 'st4';
                          const type = obj.object_type;
                          return { placeosId, cls, type, shape: renderShapePreview(obj, `id="${escXml(placeosId)}" class="${cls}" data-type="${type}"`) };
                        });

                        const states = ['free', 'available', 'booked', 'pending', 'occupied', 'checked-in', 'out-of-service', 'unavailable', 'restricted'];
                        const stateColors: Record<string, string> = { free: '#4CAF50', available: '#4CAF50', booked: '#FF9800', pending: '#FF9800', occupied: '#F44336', 'checked-in': '#2196F3', 'out-of-service': '#9E9E9E', unavailable: '#9E9E9E', restricted: '#795548' };

                        const previewHtml = `<!DOCTYPE html>
<html><head><title>PlaceOS Export Preview</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; display: flex; height: 100vh; }
  .sidebar { width: 280px; background: #fff; border-right: 1px solid #e2e8f0; overflow-y: auto; padding: 16px; flex-shrink: 0; }
  .sidebar h2 { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #1e293b; }
  .sidebar h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin: 16px 0 8px; letter-spacing: 0.5px; }
  .state-btn { display: inline-block; padding: 4px 10px; border-radius: 99px; border: 2px solid transparent; font-size: 11px; font-weight: 600; cursor: pointer; margin: 2px; color: #fff; transition: all 0.15s; }
  .state-btn:hover { opacity: 0.85; transform: scale(1.05); }
  .state-btn.active { border-color: #1e293b; box-shadow: 0 0 0 2px rgba(30,41,59,0.2); }
  .bulk-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
  .map-area { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; }
  .map-area svg { max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); background: #fff; }
  .overlay-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; margin-bottom: 2px; cursor: pointer; transition: background 0.1s; }
  .overlay-item:hover { background: #f1f5f9; }
  .overlay-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.1); }
  .overlay-id { font-size: 11px; font-weight: 500; color: #334155; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .overlay-state { font-size: 10px; color: #64748b; }
  .info { font-size: 11px; color: #64748b; line-height: 1.5; margin-bottom: 12px; padding: 8px; background: #f8fafc; border-radius: 6px; }
</style></head>
<body>
<div class="sidebar">
  <h2>PlaceOS Export Preview</h2>
  <div class="info">Click a state below to apply it to all overlays, or click individual spaces on the map to cycle their state.</div>
  <h3>Set All States</h3>
  <div class="bulk-row">
    <button class="state-btn" style="background:#94a3b8" onclick="setAll('none')">Clear</button>
    ${states.map(s => `<button class="state-btn" style="background:${stateColors[s]}" onclick="setAll('${s}')">${s.replace(/-/g, ' ')}</button>`).join('\n    ')}
  </div>
  <h3>Spaces (${bookableObjs.length})</h3>
  <div id="space-list"></div>
</div>
<div class="map-area">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <style>
      .st4, .st5 { fill: none; pointer-events: all; cursor: pointer; }
      .free, .available { fill: #4CAF50; fill-opacity: 0.4; pointer-events: all; cursor: pointer; }
      .booked, .pending { fill: #FF9800; fill-opacity: 0.4; pointer-events: all; cursor: pointer; }
      .occupied { fill: #F44336; fill-opacity: 0.4; pointer-events: all; cursor: pointer; }
      .checked-in { fill: #2196F3; fill-opacity: 0.4; pointer-events: all; cursor: pointer; }
      .out-of-service, .unavailable { fill: #9E9E9E; fill-opacity: 0.4; pointer-events: all; cursor: pointer; }
      .restricted { fill: #795548; fill-opacity: 0.4; pointer-events: all; cursor: pointer; }
    </style>
    ${bgDataUri ? `<g id="bkd"><image href="${bgDataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></g>` : ''}
    <g id="room-bookings">
      ${overlayData.map(o => o.shape).join('\n      ')}
    </g>
  </svg>
</div>
<script>
  const states = ${JSON.stringify(states)};
  const stateColors = ${JSON.stringify(stateColors)};
  const overlays = ${JSON.stringify(overlayData.map(o => ({ id: o.placeosId, cls: o.cls, type: o.type })))};
  const currentStates = {};

  function setAll(state) {
    overlays.forEach(o => {
      setState(o.id, state === 'none' ? o.cls : state);
    });
    renderList();
  }

  function setState(id, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    const overlay = overlays.find(o => o.id === id);
    el.setAttribute('class', cls);
    currentStates[id] = cls;
  }

  function cycleState(id) {
    const overlay = overlays.find(o => o.id === id);
    if (!overlay) return;
    const cur = currentStates[id] || overlay.cls;
    const validStates = overlay.type === 'desk'
      ? ['available', 'booked', 'occupied', 'restricted', 'unavailable']
      : ['free', 'checked-in', 'pending', 'booked', 'out-of-service'];
    const allOptions = [overlay.cls, ...validStates];
    const idx = allOptions.indexOf(cur);
    const next = allOptions[(idx + 1) % allOptions.length];
    setState(id, next);
    renderList();
  }

  // Click on SVG overlays
  document.querySelectorAll('#room-bookings > *').forEach(el => {
    el.addEventListener('click', () => cycleState(el.id));
  });

  function renderList() {
    const list = document.getElementById('space-list');
    list.innerHTML = overlays.map(o => {
      const cur = currentStates[o.id] || o.cls;
      const isStatus = states.includes(cur);
      const color = isStatus ? stateColors[cur] : '#94a3b8';
      const label = isStatus ? cur.replace(/-/g, ' ') : 'no state';
      return '<div class="overlay-item" onclick="cycleState(\\'' + o.id + '\\')">' +
        '<span class="overlay-dot" style="background:' + color + '"></span>' +
        '<span class="overlay-id">' + o.id.replace('area-','').replace('-status','') + '</span>' +
        '<span class="overlay-state">' + label + '</span></div>';
    }).join('');
  }
  renderList();
</script>
</body></html>`;

                        const previewBlob = new Blob([previewHtml], { type: 'text/html' });
                        const previewUrl = URL.createObjectURL(previewBlob);
                        window.open(previewUrl, '_blank');
                      }}
                      disabled={!allPass}
                      style={{
                        width: '100%', padding: '10px 16px', border: '2px solid #059669', borderRadius: 8,
                        background: 'transparent', color: '#059669', fontWeight: 600,
                        fontSize: '0.82rem', cursor: allPass ? 'pointer' : 'not-allowed', marginBottom: 8,
                        opacity: allPass ? 1 : 0.5,
                      }}
                    >
                      Preview Export
                    </button>

                    <button
                      onClick={async () => {
                        if (!floorplan) return;
                        const w = canvasW;
                        const h = canvasH;

                        let bgDataUri = '';
                        try {
                          const bgResp = await fetch(`/api/floorplans/${floorplan.id}/source-preview`);
                          if (bgResp.ok) {
                            const ct = bgResp.headers.get('content-type') || '';
                            if (ct.includes('svg')) {
                              bgDataUri = `data:image/svg+xml;base64,${btoa(await bgResp.text())}`;
                            } else {
                              const blob = await bgResp.blob();
                              bgDataUri = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                              });
                            }
                          }
                        } catch { /* continue */ }

                        const svg = exportIsometricSvg(objects, w, h, bgDataUri);
                        const blob = new Blob([svg], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${floorplan.floor_name?.replace(/\s+/g, '-') || 'floorplan'}-isometric-placeos.svg`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      disabled={!allPass}
                      style={{
                        width: '100%', padding: '10px 16px', border: '2px solid #3b82f6', borderRadius: 8,
                        background: 'transparent', color: '#3b82f6', fontWeight: 600,
                        fontSize: '0.82rem', cursor: allPass ? 'pointer' : 'not-allowed', marginBottom: 8,
                        opacity: allPass ? 1 : 0.5,
                      }}
                    >
                      Export Isometric SVG
                    </button>

                    {!allPass && (
                      <p style={{ fontSize: '0.7rem', color: '#dc2626' }}>
                        Fix the issues above before publishing.
                      </p>
                    )}

                    {/* PlaceOS Direct Publish */}
                    {placeosConnected && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
                          Publish to PlaceOS
                        </div>
                        <select
                          value={selectedPlaceosBuilding}
                          onChange={async (e) => {
                            setSelectedPlaceosBuilding(e.target.value);
                            setSelectedPlaceosLevel('');
                            setPlaceosSystems([]);
                            if (e.target.value) {
                              const lvls = await getPlaceOSZones('level', e.target.value);
                              setPlaceosLevels(lvls);
                            } else {
                              setPlaceosLevels([]);
                            }
                          }}
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: '0.75rem', marginBottom: 6, background: 'var(--color-surface)' }}
                        >
                          <option value="">Select building...</option>
                          {placeosBuildings.map(b => (
                            <option key={b.id} value={b.id}>{b.display_name || b.name}</option>
                          ))}
                        </select>
                        {selectedPlaceosBuilding && (
                          <select
                            value={selectedPlaceosLevel}
                            onChange={async (e) => {
                              setSelectedPlaceosLevel(e.target.value);
                              if (e.target.value) {
                                const syss = await getPlaceOSSystems(e.target.value);
                                setPlaceosSystems(syss);
                              } else {
                                setPlaceosSystems([]);
                              }
                            }}
                            style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: '0.75rem', marginBottom: 6, background: 'var(--color-surface)' }}
                          >
                            <option value="">Select level...</option>
                            {placeosLevels.map(l => (
                              <option key={l.id} value={l.id}>{l.display_name || l.name}</option>
                            ))}
                          </select>
                        )}

                        {/* System-to-room mapping */}
                        {selectedPlaceosLevel && placeosSystems.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                              Map Systems to Rooms ({placeosSystems.filter(s => s.bookable).length} bookable)
                            </div>
                            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 4 }}>
                              {placeosSystems.filter(s => s.bookable).map(sys => {
                                const matched = bookable.find(o => (o.svg_id || o.id) === sys.map_id);
                                return (
                                  <div key={sys.id} style={{
                                    padding: '4px 8px', borderBottom: '1px solid var(--color-border)',
                                    display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem',
                                  }}>
                                    <span style={{
                                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                      background: matched ? '#22c55e' : '#f59e0b',
                                    }} />
                                    <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {sys.display_name || sys.name}
                                    </span>
                                    <select
                                      value={sys.map_id}
                                      onChange={async (e) => {
                                        try {
                                          await updatePlaceOSSystem(sys.id, { map_id: e.target.value });
                                          setPlaceosSystems(prev => prev.map(s => s.id === sys.id ? { ...s, map_id: e.target.value } : s));
                                        } catch { /* ignore */ }
                                      }}
                                      style={{ maxWidth: 120, padding: '2px 4px', fontSize: '0.65rem', border: '1px solid var(--color-border)', borderRadius: 3 }}
                                    >
                                      <option value="">Unlinked</option>
                                      {bookable.map(o => (
                                        <option key={o.id} value={o.svg_id || o.id}>{o.label || o.svg_id || o.id.slice(0, 8)}</option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <button
                          disabled={!allPass || !selectedPlaceosLevel || placeosPublishing}
                          onClick={async () => {
                            if (!floorplan || !selectedPlaceosLevel) return;
                            setPlaceosPublishing(true);
                            setPlaceosStatus('Building SVG...');
                            try {
                              // Build the same PlaceOS SVG as the download button
                              const w = canvasW;
                              const h = canvasH;
                              let bgDataUri = '';
                              try {
                                const bgResp = await fetch(`/api/floorplans/${floorplan.id}/source-preview`);
                                if (bgResp.ok) {
                                  const ct = bgResp.headers.get('content-type') || '';
                                  if (ct.includes('svg')) {
                                    bgDataUri = `data:image/svg+xml;base64,${btoa(await bgResp.text())}`;
                                  } else {
                                    const blob = await bgResp.blob();
                                    bgDataUri = await new Promise<string>((resolve) => {
                                      const reader = new FileReader();
                                      reader.onloadend = () => resolve(reader.result as string);
                                      reader.readAsDataURL(blob);
                                    });
                                  }
                                }
                              } catch { /* continue */ }

                              const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                              const renderShape = (obj: typeof objects[0], attrs: string) => {
                                const geom = obj.geometry;
                                if (geom.type === 'rect') return `<rect x="${geom.x ?? 0}" y="${geom.y ?? 0}" width="${geom.width ?? 50}" height="${geom.height ?? 50}" rx="3" ${attrs}/>`;
                                if (geom.type === 'polygon' && geom.points) return `<polygon points="${geom.points.map((p: {x:number;y:number}) => `${p.x},${p.y}`).join(' ')}" ${attrs}/>`;
                                if (geom.type === 'circle') return `<circle cx="${geom.x ?? 0}" cy="${geom.y ?? 0}" r="${geom.r ?? 12}" ${attrs}/>`;
                                if (geom.type === 'path' && geom.d) return `<path d="${escXml(geom.d)}" ${attrs}/>`;
                                return '';
                              };

                              let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`;
                              svg += `<style>\n  .st4, .st5 { fill: none; pointer-events: all; }\n  .free, .available { fill: #4CAF50; fill-opacity: 0.4; }\n  .booked, .pending { fill: #FF9800; fill-opacity: 0.4; }\n  .occupied { fill: #F44336; fill-opacity: 0.4; }\n  .checked-in { fill: #2196F3; fill-opacity: 0.4; }\n  .out-of-service, .unavailable { fill: #9E9E9E; fill-opacity: 0.4; }\n  .restricted { fill: #795548; fill-opacity: 0.4; }\n</style>\n`;
                              if (bgDataUri) svg += `<g id="bkd"><image href="${bgDataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></g>\n`;
                              svg += `<g id="room-bookings">\n`;
                              for (const obj of bookable) {
                                const mapId = obj.svg_id || obj.id;
                                const placeosId = mapId.startsWith('area-') ? `${mapId}-status` : `area-${mapId}-status`;
                                const cls = obj.object_type === 'desk' ? 'st5' : 'st4';
                                svg += `  ${renderShape(obj, `id="${escXml(placeosId)}" class="${cls}"`)}\n`;
                              }
                              svg += `</g>\n</svg>\n`;

                              setPlaceosStatus('Uploading to PlaceOS...');
                              const filename = `${floorplan.floor_name?.replace(/\s+/g, '-') || 'floorplan'}.svg`;
                              const result = await uploadSvgToPlaceOS(svg, filename);

                              setPlaceosStatus('Updating zone map...');
                              await updatePlaceOSZone(selectedPlaceosLevel, { map_id: result.file_url } as any);

                              setPlaceosStatus('Published!');
                              setTimeout(() => setPlaceosStatus(''), 3000);
                            } catch (err) {
                              setPlaceosStatus(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
                            } finally {
                              setPlaceosPublishing(false);
                            }
                          }}
                          style={{
                            width: '100%', padding: '8px 14px', border: 'none', borderRadius: 6,
                            background: allPass && selectedPlaceosLevel && !placeosPublishing ? '#3b82f6' : '#9ca3af',
                            color: 'white', fontWeight: 600, fontSize: '0.78rem',
                            cursor: allPass && selectedPlaceosLevel ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {placeosPublishing ? placeosStatus : 'Upload & Publish to PlaceOS'}
                        </button>
                        {placeosStatus && !placeosPublishing && (
                          <p style={{ fontSize: '0.7rem', color: placeosStatus.startsWith('Error') ? '#dc2626' : '#22c55e', marginTop: 4 }}>
                            {placeosStatus}
                          </p>
                        )}
                      </div>
                    )}
                    {!placeosConnected && (
                      <p style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
                        Connect to PlaceOS on the project page to enable direct publishing.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* State Legend */}
            <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)' }}>
              <div className="ss-legend" style={{ margin: 0 }}>
                <div className="ss-legend-title">State Legend</div>
                <div className="ss-legend-grid">
                  {ALL_STATES.map((state) => {
                    const count = objects.filter((o) =>
                      (o.object_type === 'room' || o.object_type === 'desk') &&
                      availabilityStates[o.id] === state
                    ).length;
                    return (
                      <div key={state} className="ss-legend-item">
                        <span className="ss-legend-swatch" style={{ backgroundColor: STATE_COLORS[state] }} />
                        <span className="ss-legend-label">{state.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                        {count > 0 && <span className="ss-legend-count">{count}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
              <div className="ss-bulk-actions" style={{ marginBottom: 0 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const newStates: Record<string, AvailabilityState> = {};
                    for (const obj of objects) {
                      if (obj.object_type !== 'room' && obj.object_type !== 'desk') continue;
                      const states = getStatesForType(obj.object_type);
                      newStates[obj.id] = states[Math.floor(Math.random() * states.length)];
                    }
                    setAvailabilityStates(newStates);
                  }}
                >Randomize</button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const cleared: Record<string, AvailabilityState> = {};
                    for (const obj of objects) {
                      if (obj.object_type === 'room') cleared[obj.id] = 'free';
                      else if (obj.object_type === 'desk') cleared[obj.id] = 'available';
                    }
                    setAvailabilityStates(cleared);
                  }}
                >Clear All</button>
                <label className="ss-set-all">
                  Set All:
                  <select
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const state = e.target.value as AvailabilityState;
                      const updated: Record<string, AvailabilityState> = {};
                      for (const obj of objects) {
                        if (obj.object_type !== 'room' && obj.object_type !== 'desk') continue;
                        const valid = getStatesForType(obj.object_type);
                        updated[obj.id] = valid.includes(state) ? state : valid[0];
                      }
                      setAvailabilityStates(updated);
                      e.target.value = '';
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Choose...</option>
                    {ALL_STATES.map((s) => (
                      <option key={s} value={s}>{s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Bookable Objects List */}
            <div className="ss-object-list" style={{ width: '100%', maxHeight: 'none', flex: 1, border: 'none', borderRadius: 0 }}>
              <div className="ss-list-title">
                Bookable Spaces ({objects.filter(o => o.object_type === 'room' || o.object_type === 'desk').length})
              </div>
              {objects.filter(o => o.object_type === 'room' || o.object_type === 'desk').map((obj) => {
                const state = availabilityStates[obj.id];
                const color = state ? STATE_COLORS[state] : '#ccc';
                const validStates = getStatesForType(obj.object_type);
                const isSelected = obj.id === selectedObjectId;
                return (
                  <div
                    key={obj.id}
                    className={`ss-object-row ${isSelected ? 'ss-object-row--selected' : ''}`}
                    onClick={() => setSelectedObjectId(obj.id)}
                  >
                    <span className="ss-object-dot" style={{ backgroundColor: color }} />
                    <div className="ss-object-info">
                      <span className="ss-object-label">{obj.label || obj.svg_id || obj.id.slice(0, 8)}</span>
                      <span className="ss-object-type">{obj.object_type}</span>
                    </div>
                    <select
                      className="ss-state-select"
                      value={state || ''}
                      onChange={(e) => {
                        handleAvailabilityStateChange(obj.id, e.target.value as AvailabilityState);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="" disabled>--</option>
                      {validStates.map((s) => (
                        <option key={s} value={s}>{s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
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
                  importedIds={importedLabelIds}
                  onImportedIdsChange={setImportedLabelIds}
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
        {cursorCoords && (
          <>
            <span style={{ width: 1, height: 12, background: 'var(--color-border)' }} />
            <span>X: {cursorCoords.x} Y: {cursorCoords.y}</span>
          </>
        )}
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
          <span style={{ width: 1, height: 12, background: 'var(--color-border)' }} />
          <button
            onClick={() => setShowShortcutsHelp(true)}
            style={{ border: '1px solid var(--color-border)', background: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Keyboard shortcuts (?)"
          >?</button>
        </span>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setContextMenu(null)} />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button className="context-menu-item" onClick={() => {
              const obj = objects.find(o => o.id === contextMenu.objectId);
              if (obj) { clipboardRef.current = JSON.parse(JSON.stringify(obj)); showToast(`Copied ${obj.label || 'object'}`, 'info'); }
              setContextMenu(null);
            }}>
              <span>Copy</span><span className="context-menu-shortcut">{'\u2318'}C</span>
            </button>
            <button className="context-menu-item" onClick={() => {
              const src = objects.find(o => o.id === contextMenu.objectId);
              if (src && floorplanId) {
                const newGeom = { ...src.geometry };
                if (newGeom.x != null) newGeom.x += 20;
                if (newGeom.y != null) newGeom.y += 20;
                const cnt = objects.filter(o => o.object_type === src.object_type).length;
                createObject(floorplanId, { ...src, id: undefined as unknown as string, label: `${src.label || src.object_type} (copy)`, svg_id: `${src.object_type}-${String(cnt + 1).padStart(3, '0')}`, geometry: newGeom, z_index: objects.length })
                  .then(n => { setObjects(prev => [...prev, n]); setSelectedObjectId(n.id); setDirty(true); showToast(`Duplicated ${src.label || 'object'}`, 'success'); });
              }
              setContextMenu(null);
            }}>
              <span>Duplicate</span><span className="context-menu-shortcut">{'\u2318'}D</span>
            </button>
            <div className="context-menu-sep" />
            <button className="context-menu-item" onClick={() => {
              const obj = objects.find(o => o.id === contextMenu.objectId);
              if (obj) {
                const maxZ = Math.max(...objects.map(o => o.z_index ?? 0));
                handleObjectChange(contextMenu.objectId, { z_index: maxZ + 1 });
                showToast('Brought to front', 'info');
              }
              setContextMenu(null);
            }}>
              <span>Bring to Front</span>
            </button>
            <button className="context-menu-item" onClick={() => {
              const obj = objects.find(o => o.id === contextMenu.objectId);
              if (obj) {
                const minZ = Math.min(...objects.map(o => o.z_index ?? 0));
                handleObjectChange(contextMenu.objectId, { z_index: minZ - 1 });
                showToast('Sent to back', 'info');
              }
              setContextMenu(null);
            }}>
              <span>Send to Back</span>
            </button>
            <div className="context-menu-sep" />
            <button className="context-menu-item" onClick={() => {
              const obj = objects.find(o => o.id === contextMenu.objectId);
              if (obj) handleObjectChange(contextMenu.objectId, { locked: !obj.locked });
              setContextMenu(null);
            }}>
              <span>{objects.find(o => o.id === contextMenu.objectId)?.locked ? 'Unlock' : 'Lock'}</span>
            </button>
            <button className="context-menu-item context-menu-item--danger" onClick={() => {
              handleObjectDelete(contextMenu.objectId);
              setContextMenu(null);
            }}>
              <span>Delete</span><span className="context-menu-shortcut">Del</span>
            </button>
          </div>
        </>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="shortcuts-backdrop" onClick={() => setShowShortcutsHelp(false)}>
          <div className="shortcuts-panel" onClick={e => e.stopPropagation()}>
            <div className="shortcuts-title">
              <h2>Keyboard Shortcuts</h2>
              <button className="shortcuts-close" onClick={() => setShowShortcutsHelp(false)}>&times;</button>
            </div>

            <div className="shortcuts-group">
              <div className="shortcuts-group-title">Tools</div>
              {[['V', 'Select'], ['R', 'Rectangle'], ['P', 'Polygon'], ['W', 'Wall'], ['G', 'Toggle Grid']].map(([key, label]) => (
                <div key={key} className="shortcut-row">
                  <span>{label}</span>
                  <div className="shortcut-keys"><kbd>{key}</kbd></div>
                </div>
              ))}
            </div>

            <div className="shortcuts-group">
              <div className="shortcuts-group-title">Actions</div>
              {[
                ['\u2318 S', 'Save'],
                ['\u2318 Z', 'Undo'],
                ['\u2318 \u21E7 Z', 'Redo'],
                ['Del', 'Delete selected'],
              ].map(([key, label]) => (
                <div key={key} className="shortcut-row">
                  <span>{label}</span>
                  <div className="shortcut-keys"><kbd>{key}</kbd></div>
                </div>
              ))}
            </div>

            <div className="shortcuts-group">
              <div className="shortcuts-group-title">Clipboard</div>
              {[
                ['\u2318 C', 'Copy'],
                ['\u2318 V', 'Paste'],
                ['\u2318 D', 'Duplicate'],
              ].map(([key, label]) => (
                <div key={key} className="shortcut-row">
                  <span>{label}</span>
                  <div className="shortcut-keys"><kbd>{key}</kbd></div>
                </div>
              ))}
            </div>

            <div className="shortcuts-group">
              <div className="shortcuts-group-title">View</div>
              {[
                ['\u2318 F', 'Search'],
                ['Esc', 'Deselect / Cancel'],
                ['\u2318 Scroll', 'Zoom'],
                ['Shift', 'Straight lines (wall)'],
                ['?', 'This help panel'],
              ].map(([key, label]) => (
                <div key={key} className="shortcut-row">
                  <span>{label}</span>
                  <div className="shortcut-keys"><kbd>{key}</kbd></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
