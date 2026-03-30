import type { BrandConfig, ValidationError, RoomEntry } from '@svg-map/types';

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ROOM_ID_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const ROOM_ID_PATTERN_REGEX = /^[a-zA-Z]+-\d+\.\d+-?\w*$/;

export function validateHexColor(value: string, field: string): ValidationError | null {
  if (!HEX_REGEX.test(value)) {
    return { field, message: `Invalid hex color: ${value}`, value };
  }
  return null;
}

export function validateRoomId(id: string): ValidationError | null {
  if (!ROOM_ID_REGEX.test(id)) {
    return {
      field: 'roomIds.id',
      message: `Room ID must start with a letter and contain only letters, numbers, hyphens, underscores: "${id}"`,
      value: id,
    };
  }
  return null;
}

export function validateBrandConfig(config: BrandConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required color fields
  const colorFields = ['primaryColor', 'backgroundColor', 'textColor', 'accentColor'] as const;
  for (const field of colorFields) {
    if (!config[field]) {
      errors.push({ field, message: `${field} is required` });
    } else {
      const err = validateHexColor(config[field], field);
      if (err) errors.push(err);
    }
  }

  // Optional badgeColor
  if (config.badgeColor) {
    const err = validateHexColor(config.badgeColor, 'badgeColor');
    if (err) errors.push(err);
  }

  // Required string fields
  if (!config.clientName?.trim()) {
    errors.push({ field: 'clientName', message: 'clientName is required' });
  }
  if (!config.levelName?.trim()) {
    errors.push({ field: 'levelName', message: 'levelName is required' });
  }

  // iconStyle enum
  if (config.iconStyle && !['filled', 'outline'].includes(config.iconStyle)) {
    errors.push({ field: 'iconStyle', message: 'iconStyle must be "filled" or "outline"', value: config.iconStyle });
  }

  // Room IDs
  if (!config.roomIds || !Array.isArray(config.roomIds)) {
    errors.push({ field: 'roomIds', message: 'roomIds must be an array' });
  } else {
    const seen_ids = new Set<string>();
    for (const room of config.roomIds) {
      if (!room.id) {
        errors.push({ field: 'roomIds.id', message: 'Each room must have an id' });
        continue;
      }
      if (!room.label) {
        errors.push({ field: 'roomIds.label', message: `Room "${room.id}" must have a label` });
      }
      const id_error = validateRoomId(room.id);
      if (id_error) errors.push(id_error);
      if (seen_ids.has(room.id)) {
        errors.push({ field: 'roomIds.id', message: `Duplicate room ID: "${room.id}"`, value: room.id });
      }
      seen_ids.add(room.id);
    }
  }

  // Non-bookable zones
  if (config.nonBookableZones) {
    const valid_types = ['open-plan', 'collaboration', 'facilities', 'lounge', 'placeholder', 'wellness'];
    for (const zone of config.nonBookableZones) {
      if (!valid_types.includes(zone.type)) {
        errors.push({ field: 'nonBookableZones.type', message: `Invalid zone type: "${zone.type}"`, value: zone.type });
      }
      if (zone.highlightColor) {
        const err = validateHexColor(zone.highlightColor, 'nonBookableZones.highlightColor');
        if (err) errors.push(err);
      }
    }
  }

  // Typography roles
  if (config.typography) {
    const roles = ['zoneLabel', 'roomLabel', 'deskLabel', 'badgeLabel', 'sectionLabel'] as const;
    for (const role of roles) {
      const t = config.typography[role];
      if (t) {
        if (t.fontSize < 8) {
          errors.push({ field: `typography.${role}.fontSize`, message: `Font size must be >= 8px`, value: t.fontSize });
        }
        if (t.fill) {
          const err = validateHexColor(t.fill, `typography.${role}.fill`);
          if (err) errors.push(err);
        }
      }
    }
  }

  return errors;
}

export function validateMimeType(mimeType: string): boolean {
  return mimeType === 'image/jpeg';
}

export function validateFileSize(size: number, max_mb: number = 20): boolean {
  return size <= max_mb * 1024 * 1024;
}
