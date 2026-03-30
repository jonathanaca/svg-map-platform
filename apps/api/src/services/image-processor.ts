import sharp from 'sharp';
import type { ImageMetadata } from '@svg-map/types';
import { getUploadPath, getProcessedPath } from './storage.js';

export async function processImage(jobId: string): Promise<ImageMetadata> {
  const input_path = getUploadPath(`${jobId}.jpg`);
  const output_path = getProcessedPath(`${jobId}.jpg`);

  let image = sharp(input_path)
    .rotate()
    .toColorspace('srgb')
    .withMetadata({ orientation: undefined });

  const raw_meta = await image.metadata();
  const orig_width = raw_meta.width ?? 0;
  const orig_height = raw_meta.height ?? 0;

  // Auto-crop: remove title block and whitespace borders
  if (orig_width > 800 && orig_height > 600) {
    const crop = await detectCropRegion(image.clone(), orig_width, orig_height);
    if (crop) {
      console.log(`Auto-crop: ${orig_width}x${orig_height} → ${crop.width}x${crop.height}`);
      image = image.extract(crop);
    }
  }

  const info = await image.jpeg({ quality: 90 }).toFile(output_path);

  return {
    width: info.width,
    height: info.height,
    aspect_ratio: parseFloat((info.width / info.height).toFixed(4)),
    format: 'jpeg',
  };
}

async function detectCropRegion(
  image: sharp.Sharp,
  width: number,
  height: number,
): Promise<{ left: number; top: number; width: number; height: number } | null> {
  // Downsample for fast pixel scanning
  const scale = 8;
  const sw = Math.round(width / scale);
  const sh = Math.round(height / scale);

  const { data } = await image
    .resize(sw, sh, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Scan vertical columns from right to left in the 55-90% range
  // to find the title block divider (a column that's mostly white/light)
  const threshold = 235;
  let crop_col = -1;

  for (let x = Math.round(sw * 0.85); x >= Math.round(sw * 0.55); x--) {
    let white = 0;
    for (let y = 0; y < sh; y++) {
      if (data[y * sw + x] >= threshold) white++;
    }
    // If 80%+ of the column is white, this is likely the divider
    if (white / sh >= 0.8) {
      // Verify the next few columns are also mostly white (gap width)
      let gap = 1;
      for (let dx = 1; dx <= 3; dx++) {
        let adjWhite = 0;
        for (let y = 0; y < sh; y++) {
          if (data[y * sw + (x - dx)] >= threshold) adjWhite++;
        }
        if (adjWhite / sh >= 0.7) gap++;
      }
      if (gap >= 2) {
        crop_col = x - gap;
        break;
      }
    }
  }

  if (crop_col < 0) return null;

  // Convert to original pixel space
  const right = Math.round(crop_col * scale);
  if (right > width * 0.92 || right < width * 0.5) return null;

  // Now find content bounds within the cropped area
  let top = 0, bottom = sh - 1, left = 0;
  const contentThreshold = 220;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < crop_col; x++) {
      if (data[y * sw + x] < contentThreshold) { top = y; y = sh; break; }
    }
  }
  for (let y = sh - 1; y >= 0; y--) {
    for (let x = 0; x < crop_col; x++) {
      if (data[y * sw + x] < contentThreshold) { bottom = y; y = -1; break; }
    }
  }
  for (let x = 0; x < crop_col; x++) {
    for (let y = top; y <= bottom; y++) {
      if (data[y * sw + x] < contentThreshold) { left = x; x = crop_col; break; }
    }
  }

  const pad = 2; // small padding in downsampled coords
  const cropLeft = Math.max(0, (left - pad) * scale);
  const cropTop = Math.max(0, (top - pad) * scale);
  const cropRight = Math.min(width, right);
  const cropBottom = Math.min(height, (bottom + pad) * scale);

  const cropW = cropRight - cropLeft;
  const cropH = cropBottom - cropTop;

  if (cropW < width * 0.4 || cropH < height * 0.4) return null;

  return { left: cropLeft, top: cropTop, width: cropW, height: cropH };
}
