import { describe, it, expect } from 'vitest';
import { getRelativeLuminance, getContrastRatio, validateContrast } from '../services/contrast-checker.js';

describe('getRelativeLuminance', () => {
  it('returns 1 for white', () => {
    expect(getRelativeLuminance('#FFFFFF')).toBeCloseTo(1, 2);
  });

  it('returns 0 for black', () => {
    expect(getRelativeLuminance('#000000')).toBeCloseTo(0, 2);
  });
});

describe('getContrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(getContrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('returns 1 for same color', () => {
    expect(getContrastRatio('#FF0000', '#FF0000')).toBeCloseTo(1, 1);
  });
});

describe('validateContrast', () => {
  it('passes for black on white', () => {
    const result = validateContrast('#000000', '#FFFFFF');
    expect(result.valid).toBe(true);
    expect(result.ratio).toBeGreaterThan(4.5);
  });

  it('fails for light gray on white', () => {
    const result = validateContrast('#CCCCCC', '#FFFFFF');
    expect(result.valid).toBe(false);
    expect(result.ratio).toBeLessThan(4.5);
  });

  it('suggests alternative color when failing', () => {
    const result = validateContrast('#CCCCCC', '#FFFFFF');
    expect(result.valid).toBe(false);
    expect(result.suggestedColor).toBeDefined();
  });
});
