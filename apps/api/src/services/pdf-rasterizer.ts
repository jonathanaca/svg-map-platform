import { createCanvas } from 'canvas';
import type { Canvas } from 'canvas';

interface CanvasEntry {
  canvas: Canvas;
  context: ReturnType<Canvas['getContext']>;
}

function makeCanvasFactory() {
  return {
    create(width: number, height: number): CanvasEntry {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(entry: CanvasEntry, width: number, height: number): void {
      entry.canvas.width = width;
      entry.canvas.height = height;
    },
    destroy(entry: CanvasEntry): void {
      entry.canvas.width = 0;
      entry.canvas.height = 0;
    },
  };
}

export async function rasterizePdf(
  pdfBuffer: Buffer,
  targetDpi = 150,
): Promise<{ jpeg: Buffer; pageCount: number; width: number; height: number }> {
  const { getDocument, GlobalWorkerOptions } = await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  );

  // Point to the bundled worker so pdfjs-dist can spawn it in Node.js
  if (!GlobalWorkerOptions.workerSrc) {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    GlobalWorkerOptions.workerSrc = workerPath;
  }

  const data = new Uint8Array(pdfBuffer);
  const doc = await getDocument({ data, verbosity: 0, useWorkerFetch: false, isEvalSupported: false }).promise;
  const pageCount = doc.numPages;

  const page = await doc.getPage(1);
  const scale = targetDpi / 72;
  const viewport = page.getViewport({ scale });

  const width = Math.round(viewport.width);
  const height = Math.round(viewport.height);

  const canvasFactory = makeCanvasFactory();
  const { canvas, context } = canvasFactory.create(width, height);

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    canvasFactory,
  }).promise;

  const jpeg = (canvas as Canvas).toBuffer('image/jpeg', { quality: 0.92 });
  return { jpeg, pageCount, width, height };
}
