// ── Job ──────────────────────────────────────────────────────────────────────

export type JobStatus = 'uploading' | 'processing' | 'configuring' | 'generating' | 'complete' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  image_path: string | null;
  config: BrandConfig | null;
  metadata: ImageMetadata | null;
  error: string | null;
  output_path: string | null;
  created_at: string;
  updated_at: string;
}

// ── Image Metadata ───────────────────────────────────────────────────────────

export interface ImageMetadata {
  width: number;
  height: number;
  aspect_ratio: number;
  format: string;
}

// ── Brand Config ─────────────────────────────────────────────────────────────

export interface BrandConfig {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  badgeColor?: string;
  clientName: string;
  levelName: string;
  iconStyle?: IconStyle;
  showShadow?: boolean;
  roomIds: RoomEntry[];
  nonBookableZones?: NonBookableZone[];
  typography?: TypographyConfig;
  furniturePlacements?: FurniturePlacement[];
  iconPlacements?: IconPlacement[];
  tracing?: TracingData;
  embedFloorplanImage?: boolean;
}

export type IconStyle = 'filled' | 'outline';

// ── Room & Zone ──────────────────────────────────────────────────────────────

export interface RoomEntry {
  id: string;
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  opacity?: number;
  icon?: AmenityIcon;
}

export interface IconPlacement {
  id: string;
  icon: AmenityIcon;
  label: string;
  x: number;
  y: number;
}

export type NonBookableZoneType = 'open-plan' | 'collaboration' | 'facilities' | 'lounge' | 'placeholder' | 'wellness';

export interface NonBookableZone {
  id: string;
  label: string;
  type: NonBookableZoneType;
  x: number;
  y: number;
  width: number;
  height: number;
  highlightColor?: string;
}

// ── Typography ───────────────────────────────────────────────────────────────

export interface TypographyRole {
  fontSize: number;
  fontWeight: number;
  fill: string;
}

export interface TypographyConfig {
  zoneLabel?: TypographyRole;
  roomLabel?: TypographyRole;
  deskLabel?: TypographyRole;
  badgeLabel?: TypographyRole;
  sectionLabel?: TypographyRole;
}

// ── Furniture ────────────────────────────────────────────────────────────────

export type FurnitureType =
  | 'desk-single'
  | 'desk-pair'
  | 'desk-pod'
  | 'table-small'
  | 'table-medium'
  | 'table-large'
  | 'table-round'
  | 'bench'
  | 'lounge-chair'
  | 'sofa'
  | 'phone-booth'
  | 'lockers'
  | 'standing-desk';

export interface FurniturePlacement {
  type: FurnitureType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: 0 | 90 | 180 | 270;
  deskId?: string;
}

// ── API Responses ────────────────────────────────────────────────────────────

export interface UploadResponse {
  jobId: string;
  previewUrl: string;
  metadata?: ImageMetadata;
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  error?: string;
  downloadUrl?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ErrorResponse {
  error: string;
  details?: ValidationError[];
}

// ── SVG Layer Names ──────────────────────────────────────────────────────────

export const LAYER_ORDER = [
  'bkd',
  'outline',
  'walls',
  'space-highlights',
  'room-bookings',
  'plants-and-furniture',
  'text',
  'icons',
] as const;

export type LayerName = (typeof LAYER_ORDER)[number];

// ── Icon Types ───────────────────────────────────────────────────────────────

export type AmenityIcon =
  | 'male-restroom'
  | 'female-restroom'
  | 'accessible-restroom'
  | 'staircase'
  | 'elevator'
  | 'fire-exit'
  | 'cafe'
  | 'reception'
  | 'aed'
  | 'lockers'
  | 'presentation';

// ── Vector Tracing ───────────────────────────────────────────────────────────

export interface PathPoint {
  x: number;
  y: number;
}

export interface TracedPath {
  id: string;
  points: PathPoint[];
  closed: boolean;
}

export interface TracedShape {
  id: string;
  label: string;
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface TracingData {
  outlinePaths: TracedPath[];
  wallPaths: TracedPath[];
  spaceHighlights: TracedShape[];
}

// ── SVG Elements ──────────────────────────────────────────────────────────────

export interface SvgElement {
  tag: string;
  attributes: Record<string, string>;
  children: (SvgElement | string)[];
}
