import type {
  BrandConfig,
  ImageMetadata,
  SvgElement,
  RoomEntry,
  TypographyRole,
  LayerName,
  TracedPath,
} from '@svg-map/types';
import { LAYER_ORDER } from '@svg-map/types';
import { getIconSymbols, createIconBadge } from './icon-library.js';
import { getFurnitureSymbols, createFurniturePlacement } from './furniture-library.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const ROOM_ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

function darkenHex(hex: string, amount = 0.25): string {
  const clean = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function defaultTypography(role: keyof NonNullable<BrandConfig['typography']>, textColor: string): TypographyRole {
  const defaults: Record<string, TypographyRole> = {
    zoneLabel: { fontSize: 16, fontWeight: 700, fill: textColor },
    roomLabel: { fontSize: 12, fontWeight: 600, fill: textColor },
    deskLabel: { fontSize: 8, fontWeight: 400, fill: textColor },
    badgeLabel: { fontSize: 10, fontWeight: 500, fill: textColor },
    sectionLabel: { fontSize: 14, fontWeight: 700, fill: textColor },
  };
  return defaults[role];
}

// ── Layer Manager ───────────────────────────────────────────────────────────

export class LayerManager {
  private readonly config: BrandConfig;
  private readonly metadata: ImageMetadata;
  private readonly publishMode: boolean;

  constructor(config: BrandConfig, metadata: ImageMetadata, publishMode = false) {
    this.config = config;
    this.metadata = metadata;
    this.publishMode = publishMode;
    this.validateRoomIds();
  }

  /**
   * Returns an array of `<g>` elements, one per layer, in z-order.
   */
  generateLayers(): SvgElement[] {
    const builders: Record<LayerName, () => SvgElement[]> = {
      bkd: () => this.buildBackground(),
      outline: () => this.buildOutline(),
      walls: () => this.buildWalls(),
      'space-highlights': () => this.buildSpaceHighlights(),
      'room-bookings': () => this.buildRoomBookings(),
      'plants-and-furniture': () => this.buildFurniture(),
      text: () => this.buildText(),
      icons: () => this.buildIcons(),
    };

    return LAYER_ORDER.map((name) => ({
      tag: 'g',
      attributes: { id: name },
      children: builders[name](),
    }));
  }

  /**
   * Returns symbol definitions (icons + furniture) to be placed in `<defs>`.
   */
  getSymbolDefs(): SvgElement[] {
    const icon_style = this.config.iconStyle ?? 'filled';
    return [...getIconSymbols(icon_style), ...getFurnitureSymbols()];
  }

  /**
   * Returns CSS rules for typography.
   */
  getCssRules(): string[] {
    const rules: string[] = [];
    const typo = this.config.typography ?? {};
    const roles: (keyof NonNullable<BrandConfig['typography']>)[] = [
      'zoneLabel',
      'roomLabel',
      'deskLabel',
      'badgeLabel',
      'sectionLabel',
    ];

    for (const role of roles) {
      const t = typo[role] ?? defaultTypography(role, this.config.textColor);
      rules.push(
        `.${role} { font-family: Arial, sans-serif; font-size: ${Math.max(t.fontSize, 8)}px; font-weight: ${t.fontWeight}; fill: ${t.fill}; }`,
      );
    }

    if (this.publishMode) {
      rules.push('.st4, .st5 { fill: none; pointer-events: all; }');
      rules.push('.free, .available { fill: #4CAF50; fill-opacity: 0.4; pointer-events: all; }');
      rules.push('.booked, .pending { fill: #FF9800; fill-opacity: 0.4; pointer-events: all; }');
      rules.push('.occupied { fill: #F44336; fill-opacity: 0.4; pointer-events: all; }');
      rules.push('.checked-in { fill: #2196F3; fill-opacity: 0.4; pointer-events: all; }');
      rules.push('.out-of-service, .unavailable { fill: #9E9E9E; fill-opacity: 0.4; pointer-events: all; }');
      rules.push('.restricted { fill: #795548; fill-opacity: 0.4; pointer-events: all; }');
    }

    return rules;
  }

  // ── Private layer builders ────────────────────────────────────────────────

  private buildBackground(): SvgElement[] {
    if (!this.config.showShadow) return [];

    const offset = 5;
    return [
      {
        tag: 'rect',
        attributes: {
          x: String(offset),
          y: String(offset),
          width: String(this.metadata.width),
          height: String(this.metadata.height),
          fill: darkenHex(this.config.primaryColor, 0.35),
          rx: '4',
        },
        children: [],
      },
    ];
  }

  private buildOutline(): SvgElement[] {
    const tracing = this.config.tracing;
    if (!tracing?.outlinePaths?.length) return [];

    return tracing.outlinePaths.map((path) => ({
      tag: 'path',
      attributes: {
        d: this.pathToSvgD(path),
        fill: this.config.primaryColor,
        stroke: 'none',
      },
      children: [],
    }));
  }

  private buildWalls(): SvgElement[] {
    const tracing = this.config.tracing;
    if (!tracing?.wallPaths?.length) return [];

    return tracing.wallPaths.map((path) => ({
      tag: 'path',
      attributes: {
        d: this.pathToSvgD(path),
        fill: 'none',
        stroke: '#333333',
        'stroke-width': '3',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      children: [],
    }));
  }

  private pathToSvgD(path: TracedPath): string {
    if (path.points.length === 0) return '';
    const [first, ...rest] = path.points;
    let d = `M${first.x},${first.y}`;
    for (const pt of rest) {
      d += ` L${pt.x},${pt.y}`;
    }
    if (path.closed) d += ' Z';
    return d;
  }

  private buildSpaceHighlights(): SvgElement[] {
    const elements: SvgElement[] = [];

    // Traced space highlights (from the drawing canvas)
    const traced_highlights = this.config.tracing?.spaceHighlights ?? [];
    for (const shape of traced_highlights) {
      elements.push({
        tag: 'rect',
        attributes: {
          x: String(shape.x),
          y: String(shape.y),
          width: String(shape.width),
          height: String(shape.height),
          fill: shape.color || hexToRgba(this.config.accentColor, 0.3),
          'data-label': shape.label,
          id: shape.id,
        },
        children: [],
      });
    }

    // Non-bookable zones from config
    const zones = this.config.nonBookableZones ?? [];
    for (const zone of zones) {
      elements.push({
        tag: 'rect',
        attributes: {
          x: String(zone.x),
          y: String(zone.y),
          width: String(zone.width),
          height: String(zone.height),
          fill: hexToRgba(zone.highlightColor ?? this.config.accentColor, 0.3),
          'data-zone-type': zone.type,
          'data-label': zone.label,
          id: zone.id,
        },
        children: [],
      });
    }

    return elements;
  }

  private buildRoomBookings(): SvgElement[] {
    const elements: SvgElement[] = [];

    for (const room of this.config.roomIds) {
      // Skip unplaced rooms (default position with default size)
      const rx = room.x ?? 0;
      const ry = room.y ?? 0;
      const rw = room.width ?? 0;
      const rh = room.height ?? 0;
      if (rx === 0 && ry === 0 && rw <= 200 && rh <= 150) continue;

      // Floor outline: render as polygon if it has outline points
      if (room.id === 'floor') {
        const outlinePoints = (room as unknown as Record<string, unknown>)._outlinePoints;
        if (Array.isArray(outlinePoints) && outlinePoints.length >= 3) {
          const points = (outlinePoints as { x: number; y: number }[])
            .map(p => `${p.x},${p.y}`)
            .join(' ');
          elements.push({
            tag: 'polygon',
            attributes: {
              id: 'floor',
              points,
              fill: hexToRgba(this.config.primaryColor, 0.08),
              stroke: this.config.primaryColor,
              'stroke-width': '3',
              'data-label': 'Floor',
            },
            children: [],
          });
        } else {
          // Fallback: render as rect
          elements.push({
            tag: 'rect',
            attributes: {
              id: 'floor', x: String(rx), y: String(ry),
              width: String(rw), height: String(rh),
              fill: hexToRgba(this.config.primaryColor, 0.08),
              stroke: this.config.primaryColor, 'stroke-width': '3',
              'data-label': 'Floor',
            },
            children: [],
          });
        }
        continue;
      }

      // Regular room or desk
      const is_desk = room.id.startsWith('desk-');

      if (this.publishMode) {
        // PlaceOS mode: no-fill overlay, ID format area-{mapId}-status
        const mapId = room.id;
        const placeosId = mapId.startsWith('area-') ? `${mapId}-status` : `area-${mapId}-status`;
        elements.push({
          tag: 'rect',
          attributes: {
            id: placeosId,
            class: is_desk ? 'st5' : 'st4',
            x: String(rx), y: String(ry),
            width: String(rw), height: String(rh),
          },
          children: [],
        });
      } else {
        const opacity = room.opacity ?? (is_desk ? 0.3 : 0.45);
        const fill_color = is_desk ? '#2563eb' : '#4A4A4A';
        elements.push({
          tag: 'rect',
          attributes: {
            id: room.id,
            x: String(rx), y: String(ry),
            width: String(rw), height: String(rh),
            fill: hexToRgba(fill_color, opacity),
            stroke: is_desk ? '#93c5fd' : '#FFFFFF',
            'stroke-width': is_desk ? '1' : '1.5',
            rx: is_desk ? '2' : '3',
            'data-label': room.label,
            'aria-label': room.label,
            'data-type': is_desk ? 'desk' : 'room',
          },
          children: [],
        });
      }
    }

    return elements;
  }

  private buildFurniture(): SvgElement[] {
    const placements = this.config.furniturePlacements ?? [];
    return placements.map((p) => createFurniturePlacement(p));
  }

  private buildText(): SvgElement[] {
    const elements: SvgElement[] = [];
    const typo = this.config.typography ?? {};

    // Client / level header
    const section = typo.sectionLabel ?? defaultTypography('sectionLabel', this.config.textColor);
    elements.push({
      tag: 'text',
      attributes: {
        x: '20',
        y: String(Math.max(section.fontSize, 8) + 10),
        class: 'sectionLabel',
      },
      children: [`${this.config.clientName} - ${this.config.levelName}`],
    });

    // Room labels (skip floor and unplaced rooms)
    for (const room of this.config.roomIds) {
      if (room.id === 'floor') continue;
      const rx = room.x ?? 0;
      const ry = room.y ?? 0;
      const rw = room.width ?? 0;
      const rh = room.height ?? 0;
      if (rx === 0 && ry === 0 && rw <= 200 && rh <= 150) continue;

      const fontSize = Math.max(10, Math.min(rw / 6, rh / 3, 28));
      elements.push({
        tag: 'text',
        attributes: {
          x: String(rx + rw / 2),
          y: String(ry + rh / 2),
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          fill: '#FFFFFF',
          'font-family': 'Arial, sans-serif',
          'font-size': String(fontSize),
          'font-weight': '600',
        },
        children: [room.label],
      });
    }

    // Non-bookable zone labels
    for (const zone of this.config.nonBookableZones ?? []) {
      elements.push({
        tag: 'text',
        attributes: {
          x: String(zone.x + zone.width / 2),
          y: String(zone.y + zone.height / 2),
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          class: 'zoneLabel',
        },
        children: [zone.label],
      });
    }

    // Desk labels
    for (const p of this.config.furniturePlacements ?? []) {
      if (!p.deskId) continue;
      const w = p.width ?? 60;
      const h = p.height ?? 40;
      elements.push({
        tag: 'text',
        attributes: {
          x: String(p.x + w / 2),
          y: String(p.y + h / 2),
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          class: 'deskLabel',
        },
        children: [p.deskId],
      });
    }

    return elements;
  }

  private buildIcons(): SvgElement[] {
    const placements = this.config.iconPlacements ?? [];
    if (placements.length === 0) return [];

    const badge_color = this.config.badgeColor ?? this.config.primaryColor;

    const icon_size = Math.max(48, Math.round(this.metadata.width * 0.02));
    return placements.map((p) =>
      createIconBadge(p.icon, p.x - icon_size / 2, p.y - icon_size / 2, p.label, {
        badge_color,
        icon_size,
        label_font_size: Math.max(12, Math.round(icon_size * 0.35)),
      })
    );
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private validateRoomIds(): void {
    const seen = new Set<string>();

    for (const room of this.config.roomIds) {
      if (!ROOM_ID_RE.test(room.id)) {
        throw new Error(
          `Invalid room ID "${room.id}": must start with a letter and contain only letters, digits, hyphens, or underscores.`,
        );
      }
      if (seen.has(room.id)) {
        throw new Error(`Duplicate room ID "${room.id}".`);
      }
      seen.add(room.id);
    }
  }
}
