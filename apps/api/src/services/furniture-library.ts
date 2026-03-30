import type { SvgElement, FurniturePlacement, FurnitureType } from '@svg-map/types';

// ── Symbol definitions ────────────────────────────────────────────────────────

/** Each furniture symbol is drawn in a 100x100 viewBox using flat block colours. */
interface FurnitureDef {
  viewBox: string;
  elements: SvgElement[];
}

function rect(x: number, y: number, w: number, h: number, fill: string, extra: Record<string, string> = {}): SvgElement {
  return {
    tag: 'rect',
    attributes: { x: String(x), y: String(y), width: String(w), height: String(h), fill, rx: '2', ...extra },
    children: [],
  };
}

function circle(cx: number, cy: number, r: number, fill: string): SvgElement {
  return { tag: 'circle', attributes: { cx: String(cx), cy: String(cy), r: String(r), fill }, children: [] };
}

const FURNITURE: Record<FurnitureType, FurnitureDef> = {
  'desk-single': {
    viewBox: '0 0 100 60',
    elements: [
      rect(0, 0, 100, 60, '#C8C8C8'),   // desktop
      rect(5, 5, 30, 20, '#A0A0A0'),     // monitor area
    ],
  },
  'desk-pair': {
    viewBox: '0 0 100 120',
    elements: [
      rect(0, 0, 100, 55, '#C8C8C8'),
      rect(0, 65, 100, 55, '#C8C8C8'),
      rect(40, 50, 20, 20, '#909090'),   // divider
    ],
  },
  'desk-pod': {
    viewBox: '0 0 200 120',
    elements: [
      rect(0, 0, 95, 55, '#C8C8C8'),
      rect(105, 0, 95, 55, '#C8C8C8'),
      rect(0, 65, 95, 55, '#C8C8C8'),
      rect(105, 65, 95, 55, '#C8C8C8'),
      rect(90, 0, 20, 120, '#909090'),   // centre spine
    ],
  },
  'table-small': {
    viewBox: '0 0 80 80',
    elements: [rect(0, 0, 80, 80, '#D2B48C')],
  },
  'table-medium': {
    viewBox: '0 0 140 80',
    elements: [rect(0, 0, 140, 80, '#D2B48C')],
  },
  'table-large': {
    viewBox: '0 0 200 100',
    elements: [rect(0, 0, 200, 100, '#D2B48C')],
  },
  'table-round': {
    viewBox: '0 0 100 100',
    elements: [circle(50, 50, 48, '#D2B48C')],
  },
  bench: {
    viewBox: '0 0 120 30',
    elements: [
      rect(0, 0, 120, 30, '#8B7355'),
      rect(5, 5, 10, 20, '#6B5335'),     // leg
      rect(105, 5, 10, 20, '#6B5335'),   // leg
    ],
  },
  'lounge-chair': {
    viewBox: '0 0 60 70',
    elements: [
      rect(5, 15, 50, 50, '#5B8C5A'),    // seat
      rect(0, 0, 60, 20, '#4A7A49'),     // backrest
      rect(0, 15, 8, 50, '#4A7A49'),     // left arm
      rect(52, 15, 8, 50, '#4A7A49'),    // right arm
    ],
  },
  sofa: {
    viewBox: '0 0 140 60',
    elements: [
      rect(10, 10, 120, 45, '#6A5ACD'),  // seat
      rect(0, 0, 140, 15, '#5A4ABD'),    // backrest
      rect(0, 10, 14, 50, '#5A4ABD'),    // left arm
      rect(126, 10, 14, 50, '#5A4ABD'),  // right arm
    ],
  },
  'phone-booth': {
    viewBox: '0 0 60 60',
    elements: [
      rect(0, 0, 60, 60, '#404040'),     // enclosure
      rect(5, 5, 50, 50, '#606060'),     // interior
      rect(10, 30, 40, 20, '#C8C8C8'),   // desk surface
    ],
  },
  lockers: {
    viewBox: '0 0 80 100',
    elements: [
      rect(0, 0, 80, 100, '#708090'),
      rect(2, 2, 36, 46, '#607080'),
      rect(42, 2, 36, 46, '#607080'),
      rect(2, 52, 36, 46, '#607080'),
      rect(42, 52, 36, 46, '#607080'),
    ],
  },
  'standing-desk': {
    viewBox: '0 0 100 50',
    elements: [
      rect(0, 0, 100, 50, '#B0B0B0'),
      rect(10, 10, 25, 15, '#909090'),   // monitor area
      rect(5, 40, 8, 10, '#707070'),     // leg
      rect(87, 40, 8, 10, '#707070'),    // leg
    ],
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns `<symbol>` definitions for every furniture type.
 */
export function getFurnitureSymbols(): SvgElement[] {
  const symbols: SvgElement[] = [];

  for (const [type, def] of Object.entries(FURNITURE)) {
    symbols.push({
      tag: 'symbol',
      attributes: { id: `furniture-${type}`, viewBox: def.viewBox },
      children: [...def.elements],
    });
  }

  return symbols;
}

export interface FurniturePlacementConfig {
  default_width?: number;
  default_height?: number;
}

/**
 * Creates a `<use>` element that places a furniture symbol at the given position.
 */
export function createFurniturePlacement(
  placement: FurniturePlacement,
  config: FurniturePlacementConfig = {},
): SvgElement {
  const { type, x, y, width, height, rotation = 0, deskId } = placement;
  const { default_width = 60, default_height = 40 } = config;

  const w = width ?? default_width;
  const h = height ?? default_height;

  const attrs: Record<string, string> = {
    href: `#furniture-${type}`,
    x: String(x),
    y: String(y),
    width: String(w),
    height: String(h),
    'data-type': type,
  };

  if (rotation !== 0) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    attrs.transform = `rotate(${rotation}, ${cx}, ${cy})`;
  }

  if (deskId) {
    attrs['data-desk-id'] = deskId;
  }

  return { tag: 'use', attributes: attrs, children: [] };
}
