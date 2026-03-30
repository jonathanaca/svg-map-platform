import { describe, it, expect } from 'vitest';
import {
  validateHexColor,
  validateRoomId,
  validateBrandConfig,
  validateMimeType,
  validateFileSize,
} from '../validators/index.js';
import type { BrandConfig } from '@svg-map/types';

const validConfig: BrandConfig = {
  primaryColor: '#006A9D',
  backgroundColor: '#FFFFFF',
  textColor: '#2D2D2D',
  accentColor: '#00AFD0',
  clientName: 'Test Client',
  levelName: 'Level 6',
  roomIds: [
    { id: 'meeting-06-25', label: 'Meeting 06.25' },
    { id: 'meeting-06-26', label: 'Meeting 06.26' },
  ],
};

describe('validateHexColor', () => {
  it('accepts valid 6-digit hex', () => {
    expect(validateHexColor('#FF0000', 'color')).toBeNull();
  });
  it('accepts valid 3-digit hex', () => {
    expect(validateHexColor('#F00', 'color')).toBeNull();
  });
  it('rejects no hash', () => {
    expect(validateHexColor('FF0000', 'color')).not.toBeNull();
  });
  it('rejects invalid chars', () => {
    expect(validateHexColor('#GGGGGG', 'color')).not.toBeNull();
  });
  it('rejects wrong length', () => {
    expect(validateHexColor('#FF00', 'color')).not.toBeNull();
  });
});

describe('validateRoomId', () => {
  it('accepts valid IDs', () => {
    expect(validateRoomId('meeting-06-25')).toBeNull();
    expect(validateRoomId('focus_area')).toBeNull();
    expect(validateRoomId('A1')).toBeNull();
  });
  it('rejects IDs starting with a number', () => {
    expect(validateRoomId('1meeting')).not.toBeNull();
  });
  it('rejects IDs starting with special character', () => {
    expect(validateRoomId('-meeting')).not.toBeNull();
    expect(validateRoomId('_meeting')).not.toBeNull();
  });
  it('rejects IDs with spaces', () => {
    expect(validateRoomId('meeting room')).not.toBeNull();
  });
});

describe('validateBrandConfig', () => {
  it('accepts valid config', () => {
    expect(validateBrandConfig(validConfig)).toHaveLength(0);
  });

  it('rejects missing required colors', () => {
    const config = { ...validConfig, primaryColor: '' };
    const errors = validateBrandConfig(config);
    expect(errors.some((e) => e.field === 'primaryColor')).toBe(true);
  });

  it('rejects malformed hex colors', () => {
    const config = { ...validConfig, primaryColor: 'not-a-color' };
    const errors = validateBrandConfig(config);
    expect(errors.some((e) => e.field === 'primaryColor')).toBe(true);
  });

  it('rejects duplicate room IDs', () => {
    const config = {
      ...validConfig,
      roomIds: [
        { id: 'room-a', label: 'Room A' },
        { id: 'room-a', label: 'Room A copy' },
      ],
    };
    const errors = validateBrandConfig(config);
    expect(errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('rejects room IDs starting with a number', () => {
    const config = {
      ...validConfig,
      roomIds: [{ id: '1room', label: 'Room 1' }],
    };
    const errors = validateBrandConfig(config);
    expect(errors.some((e) => e.field === 'roomIds.id')).toBe(true);
  });

  it('rejects missing clientName', () => {
    const config = { ...validConfig, clientName: '' };
    const errors = validateBrandConfig(config);
    expect(errors.some((e) => e.field === 'clientName')).toBe(true);
  });

  it('rejects font size < 8', () => {
    const config = {
      ...validConfig,
      typography: { zoneLabel: { fontSize: 6, fontWeight: 400, fill: '#000000' } },
    };
    const errors = validateBrandConfig(config);
    expect(errors.some((e) => e.field.includes('fontSize'))).toBe(true);
  });
});

describe('validateMimeType', () => {
  it('accepts JPEG', () => {
    expect(validateMimeType('image/jpeg')).toBe(true);
  });
  it('rejects PNG', () => {
    expect(validateMimeType('image/png')).toBe(false);
  });
  it('rejects PDF', () => {
    expect(validateMimeType('application/pdf')).toBe(false);
  });
  it('rejects GIF', () => {
    expect(validateMimeType('image/gif')).toBe(false);
  });
});

describe('validateFileSize', () => {
  it('accepts file under 20 MB', () => {
    expect(validateFileSize(10 * 1024 * 1024)).toBe(true);
  });
  it('rejects file over 20 MB', () => {
    expect(validateFileSize(21 * 1024 * 1024)).toBe(false);
  });
  it('accepts file exactly 20 MB', () => {
    expect(validateFileSize(20 * 1024 * 1024)).toBe(true);
  });
});
