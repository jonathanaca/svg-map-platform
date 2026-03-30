import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Performance SLAs from spec
const SLA = {
  IMAGE_PROCESSING_MS: 2000,
  SVG_GENERATION_MS: 3000,
  SVGO_OPTIMIZATION_MS: 1000,
};

describe('Performance Benchmarks', () => {
  it(`image pre-processing completes within ${SLA.IMAGE_PROCESSING_MS}ms`, async () => {
    // Create a test image in memory (~5MB equivalent)
    const image = sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 200, g: 200, b: 200 },
      },
    });

    const start = performance.now();

    await image
      .rotate()
      .toColorspace('srgb')
      .jpeg({ quality: 90 })
      .toBuffer();

    const elapsed = performance.now() - start;
    console.log(`Image processing: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(SLA.IMAGE_PROCESSING_MS);
  });

  it(`SVG generation completes within ${SLA.SVG_GENERATION_MS}ms for 50 rooms`, async () => {
    // Dynamically import to avoid circular deps
    const { LayerManager } = await import('../services/layer-manager.js');
    const { SvgBuilder } = await import('../services/svg-builder.js');

    const rooms = Array.from({ length: 50 }, (_, i) => ({
      id: `room-${String(i).padStart(3, '0')}`,
      label: `Room ${i}`,
      x: (i % 10) * 100,
      y: Math.floor(i / 10) * 80,
      width: 90,
      height: 70,
    }));

    const config = {
      primaryColor: '#006A9D',
      backgroundColor: '#FFFFFF',
      textColor: '#2D2D2D',
      accentColor: '#00AFD0',
      clientName: 'Benchmark Corp',
      levelName: 'Level 1',
      roomIds: rooms,
      showShadow: false,
    };

    const metadata = { width: 1920, height: 1080, aspect_ratio: 1.7778, format: 'jpeg' };

    const start = performance.now();

    const manager = new LayerManager(config, metadata);
    const layers = manager.generateLayers();
    const builder = new SvgBuilder(metadata.width, metadata.height);
    for (const layer of layers) {
      builder.addChild(layer);
    }
    builder.render();

    const elapsed = performance.now() - start;
    console.log(`SVG generation (50 rooms): ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(SLA.SVG_GENERATION_MS);
  });

  it(`SVGO optimization completes within ${SLA.SVGO_OPTIMIZATION_MS}ms`, async () => {
    const { optimizeSvg } = await import('../services/svg-optimizer.js');

    // Generate a reasonably large SVG string
    const elements = Array.from({ length: 200 }, (_, i) =>
      `<rect id="el-${i}" x="${i * 10}" y="${i * 5}" width="100.12345" height="50.67890" fill="#FF0000" />`
    ).join('\n');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1000">
      <g id="bkd"></g><g id="outline"></g><g id="walls"></g>
      <g id="space-highlights"></g><g id="room-bookings">${elements}</g>
      <g id="plants-and-furniture"></g><g id="text"></g><g id="icons"></g>
    </svg>`;

    const start = performance.now();
    optimizeSvg(svg);
    const elapsed = performance.now() - start;

    console.log(`SVGO optimization: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(SLA.SVGO_OPTIMIZATION_MS);
  });
});
