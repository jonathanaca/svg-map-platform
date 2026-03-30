import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeFilename } from '../services/sanitizer.js';

describe('sanitizeString', () => {
  it('strips HTML tags', () => {
    expect(sanitizeString('Hello <b>World</b>')).not.toContain('<b>');
  });

  it('strips script tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).not.toContain('<script>');
  });

  it('strips event handlers', () => {
    expect(sanitizeString('onclick=alert(1)')).not.toContain('onclick');
  });

  it('encodes special characters', () => {
    const result = sanitizeString('a & b < c > d');
    expect(result).toContain('&amp;');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('handles normal strings unchanged (except encoding)', () => {
    expect(sanitizeString('Meeting Room 06.25')).toBe('Meeting Room 06.25');
  });
});

describe('sanitizeFilename', () => {
  it('formats correctly', () => {
    expect(sanitizeFilename('Acme Corp', 'Level 6')).toBe('acme_corp_map_level_6.svg');
  });

  it('handles special characters', () => {
    expect(sanitizeFilename('Test & Co.', 'L-1')).toBe('test__co_map_l-1.svg');
  });

  it('lowercases everything', () => {
    expect(sanitizeFilename('UPPER', 'CASE')).toBe('upper_map_case.svg');
  });

  it('handles multiple spaces', () => {
    expect(sanitizeFilename('My  Client', 'Floor  2')).toBe('my_client_map_floor_2.svg');
  });
});
