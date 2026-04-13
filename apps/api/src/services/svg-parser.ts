import { JSDOM } from 'jsdom';

export interface ParsedLayer {
  id: string;
  label: string;
  elementCount: number;
}

export interface ParsedObject {
  svgId: string;
  tag: string;
  suggestedType: string;
  label: string | null;
  geometry: {
    type: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    points?: { x: number; y: number }[];
    d?: string;
    r?: number;
    cx?: number;
    cy?: number;
    rx?: number;
    ry?: number;
  };
  layer: string | null;
  attributes: Record<string, string>;
}

export interface SvgAnalysis {
  width: number;
  height: number;
  viewBox: string | null;
  layers: ParsedLayer[];
  objects: ParsedObject[];
  issues: string[];
}

const INTERACTIVE_TAGS = new Set(['rect', 'polygon', 'circle', 'path', 'ellipse', 'polyline']);

const TYPE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /^(room|meeting|conf|boardroom)/i, type: 'room' },
  { pattern: /^(desk|workstation|ws)/i, type: 'desk' },
  { pattern: /^(locker)/i, type: 'locker' },
  { pattern: /^(zone|neighbourhood|neighborhood)/i, type: 'zone' },
  { pattern: /^(amenity|toilet|kitchen|lift|elevator|bathroom|restroom|stairs|lobby)/i, type: 'amenity' },
];

// Second pass: check if the full ID (after prefix like "area-04.") contains room-like keywords
const ROOM_KEYWORDS = /office|training|board|exec|meeting|conf|parent|first.aid|interview|quiet|focus|breakout|huddle|collab|library|lounge|prayer|wellness|mother/i;
const AMENITY_KEYWORDS = /kitchen|toilet|bathroom|restroom|shower|wc|water|services|comms|server|store|clean|utility|print|mail/i;

function suggestObjectType(id: string): string {
  // Strip common prefixes/suffixes and check against patterns
  const normalized = id.replace(/[-_]/g, '-');
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(normalized)) {
      return type;
    }
  }

  // For "area-" prefixed IDs, check the name portion for room/amenity keywords
  if (/^area[-_.]/i.test(id)) {
    const namePart = id.replace(/^area[-_.]\d+[-_.]/i, '');
    if (ROOM_KEYWORDS.test(namePart)) return 'room';
    if (AMENITY_KEYWORDS.test(namePart)) return 'amenity';
    return 'zone'; // default for area-* is zone (neighbourhood zones, etc.)
  }

  return 'decorative';
}

function parseNumber(value: string | null): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

function parsePoints(pointsStr: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const pairs = pointsStr.trim().split(/[\s,]+/);
  for (let i = 0; i < pairs.length - 1; i += 2) {
    const x = parseFloat(pairs[i]);
    const y = parseFloat(pairs[i + 1]);
    if (!isNaN(x) && !isNaN(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

function extractGeometry(el: Element): ParsedObject['geometry'] {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'rect':
      return {
        type: 'rect',
        x: parseNumber(el.getAttribute('x')) ?? 0,
        y: parseNumber(el.getAttribute('y')) ?? 0,
        width: parseNumber(el.getAttribute('width')),
        height: parseNumber(el.getAttribute('height')),
      };
    case 'circle':
      return {
        type: 'circle',
        cx: parseNumber(el.getAttribute('cx')),
        cy: parseNumber(el.getAttribute('cy')),
        r: parseNumber(el.getAttribute('r')),
      };
    case 'ellipse':
      return {
        type: 'ellipse',
        cx: parseNumber(el.getAttribute('cx')),
        cy: parseNumber(el.getAttribute('cy')),
        rx: parseNumber(el.getAttribute('rx')),
        ry: parseNumber(el.getAttribute('ry')),
      };
    case 'polygon':
    case 'polyline': {
      const pointsAttr = el.getAttribute('points');
      return {
        type: tag,
        points: pointsAttr ? parsePoints(pointsAttr) : [],
      };
    }
    case 'path':
      return {
        type: 'path',
        d: el.getAttribute('d') ?? undefined,
      };
    default:
      return { type: tag };
  }
}

function extractAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

// Map SVG group names to our editor layer IDs
const LAYER_NAME_MAP: Record<string, string> = {
  bookings: 'rooms',
  rooms: 'rooms',
  desks: 'desks',
  furniture: 'background',
  lockers: 'lockers',
  highlights: 'zones',
  neighbourhood: 'zones',
  base: 'background',
  blanks: 'background',
  skeleton: 'walls',
  walls: 'walls',
  labels: 'labels',
  signage: 'labels',
  amenities: 'amenities',
  icons: 'amenities',
};

function mapLayerName(groupId: string): string {
  const lower = groupId.toLowerCase();
  return LAYER_NAME_MAP[lower] ?? 'rooms';
}

function findParentLayer(el: Element): string | null {
  let current = el.parentElement;
  while (current) {
    if (current.tagName.toLowerCase() === 'g' && current.getAttribute('id')) {
      const groupId = current.getAttribute('id')!;
      return mapLayerName(groupId);
    }
    current = current.parentElement;
  }
  return null;
}

function extractLabel(el: Element): string | null {
  // Check for inkscape:label, aria-label, title child, or data-label
  const inkscapeLabel = el.getAttribute('inkscape:label');
  if (inkscapeLabel) return inkscapeLabel;

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const dataLabel = el.getAttribute('data-label');
  if (dataLabel) return dataLabel;

  const dataName = el.getAttribute('data-name');
  if (dataName) return dataName;

  // Check for <title> child element
  const titleEl = el.querySelector('title');
  if (titleEl && titleEl.textContent) return titleEl.textContent.trim();

  return null;
}

function isGeometryValid(geometry: ParsedObject['geometry']): boolean {
  switch (geometry.type) {
    case 'rect':
      return geometry.width !== undefined && geometry.height !== undefined && geometry.width > 0 && geometry.height > 0;
    case 'circle':
      return geometry.r !== undefined && geometry.r > 0;
    case 'ellipse':
      return geometry.rx !== undefined && geometry.ry !== undefined && geometry.rx > 0 && geometry.ry > 0;
    case 'polygon':
    case 'polyline':
      return (geometry.points?.length ?? 0) >= 3;
    case 'path':
      return !!geometry.d && geometry.d.length > 0;
    default:
      return false;
  }
}

export function analyzeSvg(svgContent: string): SvgAnalysis {
  const issues: string[] = [];
  const dom = new JSDOM(svgContent, { contentType: 'image/svg+xml' });
  const doc = dom.window.document;
  const svgEl = doc.querySelector('svg');

  if (!svgEl) {
    return {
      width: 0,
      height: 0,
      viewBox: null,
      layers: [],
      objects: [],
      issues: ['No <svg> root element found'],
    };
  }

  // Extract dimensions
  const viewBox = svgEl.getAttribute('viewBox');
  let width = parseNumber(svgEl.getAttribute('width')) ?? 0;
  let height = parseNumber(svgEl.getAttribute('height')) ?? 0;

  // Fall back to viewBox dimensions if width/height not set
  if ((!width || !height) && viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      width = width || parts[2];
      height = height || parts[3];
    }
  }

  if (!width || !height) {
    issues.push('SVG has no explicit width/height and no viewBox; dimensions unknown');
  }

  // Extract layers: <g> elements that look like layers
  const layers: ParsedLayer[] = [];
  const allGroups = svgEl.querySelectorAll('g');

  for (const g of allGroups) {
    const gId = g.getAttribute('id');
    const inkscapeLabel = g.getAttribute('inkscape:label');
    const inkscapeGroupmode = g.getAttribute('inkscape:groupmode');
    const isDirectChild = g.parentElement === (svgEl as unknown as HTMLElement);

    // Consider it a layer if it has inkscape:groupmode="layer", or has an id and is a direct child of svg
    const isLayer = inkscapeGroupmode === 'layer' || (gId && isDirectChild);

    if (isLayer) {
      const rawLabel = inkscapeLabel || gId || 'unnamed';
      const mappedId = gId ? mapLayerName(gId) : `layer-${layers.length}`;
      // Use a readable label: capitalize the mapped layer name
      const displayLabel = mappedId.charAt(0).toUpperCase() + mappedId.slice(1);
      const childElements = g.querySelectorAll('rect, polygon, circle, path, ellipse, polyline, line, text, image');
      layers.push({
        id: mappedId,
        label: `${displayLabel} (${rawLabel})`,
        elementCount: childElements.length,
      });
    }
  }

  if (layers.length === 0) {
    issues.push('No layer groups detected; all objects will be treated as top-level');
  }

  // Extract interactive objects
  const objects: ParsedObject[] = [];
  const tagSelector = Array.from(INTERACTIVE_TAGS).join(', ');
  const elements = svgEl.querySelectorAll(tagSelector);
  let elementsWithoutId = 0;

  for (const el of elements) {
    const elId = el.getAttribute('id');

    if (!elId) {
      elementsWithoutId++;
      continue;
    }

    const tag = el.tagName.toLowerCase();
    const geometry = extractGeometry(el);
    const label = extractLabel(el);
    const layer = findParentLayer(el);
    const suggestedType = suggestObjectType(elId);
    const attributes = extractAttributes(el);

    if (!isGeometryValid(geometry)) {
      issues.push(`Element #${elId} (${tag}) has invalid or incomplete geometry`);
    }

    objects.push({
      svgId: elId,
      tag,
      suggestedType,
      label,
      geometry,
      layer,
      attributes,
    });
  }

  if (elementsWithoutId > 0) {
    issues.push(`${elementsWithoutId} shape element(s) have no id attribute and were skipped`);
  }

  return {
    width,
    height,
    viewBox,
    layers,
    objects,
    issues,
  };
}
