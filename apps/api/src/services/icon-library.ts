import type { SvgElement, AmenityIcon, BrandConfig } from '@svg-map/types';

// ── Icon path data ────────────────────────────────────────────────────────────

interface IconDef {
  viewBox: string;
  filled: string;
  outline: string;
}

const ICON_DEFS: Record<AmenityIcon, IconDef> = {
  'male-restroom': {
    viewBox: '0 0 24 24',
    filled: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-3 8a1 1 0 0 0-1 1v5h2v7h4v-7h2v-5a1 1 0 0 0-1-1z',
    outline: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-3 6a1 1 0 0 0-1 1v5h2v7h4v-7h2v-5a1 1 0 0 0-1-1z',
  },
  'female-restroom': {
    viewBox: '0 0 24 24',
    filled: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-4 8l3 7h-2v5h6v-5h-2l3-7z',
    outline: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-4 6l3 7h-2v5h6v-5h-2l3-7z',
  },
  'accessible-restroom': {
    viewBox: '0 0 24 24',
    filled: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-1 8v4h-2l3 8h1l1-4h1a5 5 0 0 0 5-5h-2a3 3 0 0 1-3 3h-1V10z',
    outline: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-1 6v4h-2l3 8h1l1-4h1a5 5 0 0 0 5-5h-2a3 3 0 0 1-3 3h-1V10z',
  },
  staircase: {
    viewBox: '0 0 24 24',
    filled: 'M2 22h4v-6h4v-4h4v-4h4V4h4V2h-6v4h-4v4h-4v4H6v6H2z',
    outline: 'M2 22h4v-6h4v-4h4v-4h4V4h4V2h-6v4h-4v4h-4v4H6v6H2z',
  },
  elevator: {
    viewBox: '0 0 24 24',
    filled: 'M3 3h18v18H3zm4 9l5-6 5 6h-3v5h-4v-5z',
    outline: 'M3 3v18h18V3zm16 16H5V5h14zM12 6l5 6h-3v5h-4v-5H7z',
  },
  'fire-exit': {
    viewBox: '0 0 24 24',
    filled: 'M10 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 7l-3 5h3v10h4V12h2l3-3-2-2zm10 1h4v2h-2v8h-2z',
    outline: 'M10 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM7 7l-3 5h3v10h4V12h2l3-3-2-2zm10 1h4v2h-2v8h-2z',
  },
  cafe: {
    viewBox: '0 0 24 24',
    filled: 'M2 6h14v2h2a3 3 0 0 1 0 6h-2v2H2zm14 6h2a1 1 0 0 0 0-2h-2zM2 18h14v2H2z',
    outline: 'M2 6h14v2h2a3 3 0 0 1 0 6h-2v2H2zm2 2v6h10v-6zm12 2h2a1 1 0 0 0 0-2h-2zM2 18h14v2H2z',
  },
  reception: {
    viewBox: '0 0 24 24',
    filled: 'M2 16h20v4H2zm3-6a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm2 4h10a1 1 0 0 1 1 1v1H6v-1a1 1 0 0 1 1-1z',
    outline: 'M2 16h20v4H2zm2 2v0zm1-8a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-3 5h10a1 1 0 0 1 1 1v1H6v-1a1 1 0 0 1 1-1z',
  },
  aed: {
    viewBox: '0 0 24 24',
    filled: 'M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm5 6v2h2v4h2v-4h2V9h-2V7h-2v2z',
    outline: 'M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v14h16V5zm4 4h2V7h2v2h2v2h-2v4h-2v-4H8z',
  },
  lockers: {
    viewBox: '0 0 24 24',
    filled: 'M3 2h7v20H3zm1 2v7h5V4zm0 9v7h5v-7zm11-11h7v20h-7zm1 2v7h5V4zm0 9v7h5v-7z',
    outline: 'M3 2h7v20H3zm2 2v7h3V4zm0 9v7h3v-7zm8-11h7v20h-7zm2 2v7h3V4zm0 9v7h3v-7z',
  },
  presentation: {
    viewBox: '0 0 24 24',
    filled: 'M2 3h20v14H2zm9 16h2v2h4v2H7v-2h4zm1-14l-4 5h3v5h2v-5h3z',
    outline: 'M2 3h20v14H2zm2 2v10h16V5zm7 14h2v2h4v2H7v-2h4zm1-12l-4 5h3v5h2v-5h3z',
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns `<symbol>` definitions for all amenity icons in the given style.
 */
export function getIconSymbols(style: 'filled' | 'outline'): SvgElement[] {
  const symbols: SvgElement[] = [];

  for (const [name, def] of Object.entries(ICON_DEFS)) {
    const path_data = style === 'filled' ? def.filled : def.outline;
    symbols.push({
      tag: 'symbol',
      attributes: { id: `icon-${name}`, viewBox: def.viewBox },
      children: [
        {
          tag: 'path',
          attributes: { d: path_data, fill: 'currentColor' },
          children: [],
        },
      ],
    });
  }

  return symbols;
}

export interface IconBadgeConfig {
  badge_color: string;
  icon_size?: number;
  label_font_size?: number;
}

/**
 * Creates a circular badge group with an icon and optional text label.
 */
export function createIconBadge(
  iconType: AmenityIcon,
  x: number,
  y: number,
  label: string,
  config: IconBadgeConfig,
): SvgElement {
  const { badge_color, icon_size = 32, label_font_size = 10 } = config;
  const radius = icon_size / 2;

  const children: SvgElement[] = [
    // Background circle
    {
      tag: 'circle',
      attributes: {
        cx: String(radius),
        cy: String(radius),
        r: String(radius),
        fill: badge_color,
      },
      children: [],
    },
    // Icon (white on coloured badge)
    {
      tag: 'use',
      attributes: {
        href: `#icon-${iconType}`,
        x: String(radius * 0.3),
        y: String(radius * 0.3),
        width: String(icon_size * 0.7),
        height: String(icon_size * 0.7),
        fill: '#FFFFFF',
        color: '#FFFFFF',
      },
      children: [],
    },
  ];

  // Text label below the badge
  if (label) {
    children.push({
      tag: 'text',
      attributes: {
        x: String(radius),
        y: String(icon_size + label_font_size + 2),
        'text-anchor': 'middle',
        'font-family': 'Arial, sans-serif',
        'font-size': String(label_font_size),
        fill: badge_color,
      },
      children: [label],
    });
  }

  return {
    tag: 'g',
    attributes: {
      transform: `translate(${x}, ${y})`,
      'data-icon': iconType,
      role: 'img',
      'aria-label': label || iconType,
    },
    children,
  };
}
