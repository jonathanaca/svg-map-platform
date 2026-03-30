import { describe, it, expect } from 'vitest';
import { validateSvgOutput } from '../services/svg-validator.js';

const validSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet">
  <g id="bkd"></g>
  <g id="outline"></g>
  <g id="walls"></g>
  <g id="space-highlights"></g>
  <g id="room-bookings">
    <rect id="meeting-06-25" data-label="Meeting 06.25" />
    <rect id="meeting-06-26" data-label="Meeting 06.26" />
  </g>
  <g id="plants-and-furniture"></g>
  <g id="text"></g>
  <g id="icons"></g>
</svg>`;

describe('validateSvgOutput', () => {
  it('passes for valid SVG', () => {
    const errors = validateSvgOutput(validSvg, {
      expectedRoomIds: ['meeting-06-25', 'meeting-06-26'],
    });
    expect(errors).toHaveLength(0);
  });

  it('fails when viewBox is missing', () => {
    const svg = validSvg.replace('viewBox="0 0 1920 1080"', '');
    const errors = validateSvgOutput(svg, { expectedRoomIds: [] });
    expect(errors.some((e) => e.field === 'viewBox')).toBe(true);
  });

  it('fails when a layer group is missing', () => {
    const svg = validSvg.replace('<g id="bkd"></g>', '');
    const errors = validateSvgOutput(svg, { expectedRoomIds: ['meeting-06-25', 'meeting-06-26'] });
    expect(errors.some((e) => e.message.includes('bkd'))).toBe(true);
  });

  it('fails when a room ID is missing', () => {
    const errors = validateSvgOutput(validSvg, {
      expectedRoomIds: ['meeting-06-25', 'meeting-06-26', 'missing-room'],
    });
    expect(errors.some((e) => e.message.includes('missing-room'))).toBe(true);
  });

  it('fails when SVG contains a gradient', () => {
    const svg = validSvg + '<linearGradient id="grad1"></linearGradient>';
    const errors = validateSvgOutput(svg, { expectedRoomIds: ['meeting-06-25', 'meeting-06-26'] });
    expect(errors.some((e) => e.field === 'gradients')).toBe(true);
  });

  it('fails when SVG contains a script element', () => {
    const svg = validSvg.replace('</svg>', '<script>alert("xss")</script></svg>');
    const errors = validateSvgOutput(svg, { expectedRoomIds: ['meeting-06-25', 'meeting-06-26'] });
    expect(errors.some((e) => e.field === 'security')).toBe(true);
  });

  it('fails when SVG contains event handlers', () => {
    const svg = validSvg.replace('<rect id="meeting-06-25"', '<rect onclick="alert(1)" id="meeting-06-25"');
    const errors = validateSvgOutput(svg, { expectedRoomIds: ['meeting-06-25', 'meeting-06-26'] });
    expect(errors.some((e) => e.field === 'security')).toBe(true);
  });

  it('fails when root svg has fixed width/height', () => {
    const svg = validSvg.replace('<svg ', '<svg width="1920" height="1080" ');
    const errors = validateSvgOutput(svg, { expectedRoomIds: ['meeting-06-25', 'meeting-06-26'] });
    expect(errors.some((e) => e.message.includes('width'))).toBe(true);
  });

  it('detects duplicate id attributes', () => {
    const svg = validSvg.replace(
      '<g id="text"></g>',
      '<g id="text"><text id="meeting-06-25">dup</text></g>',
    );
    const errors = validateSvgOutput(svg, { expectedRoomIds: ['meeting-06-25', 'meeting-06-26'] });
    expect(errors.some((e) => e.field === 'ids' || e.field === 'roomIds')).toBe(true);
  });
});
