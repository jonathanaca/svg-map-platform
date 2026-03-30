import OpenAI from 'openai';
import sharp from 'sharp';
import fs from 'fs';
import type { TracedPath } from '@svg-map/types';

export interface DetectedRoom {
  id: string;
  label: string;
  type: 'meeting' | 'focus' | 'collaboration' | 'open-plan' | 'facilities' | 'other';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnalysisResult {
  outline: TracedPath | null;
  walls: TracedPath[];
  rooms: DetectedRoom[];
}

// Max dimension to send to the vision API (keeps base64 under ~1MB)
const MAX_ANALYSIS_DIM = 2048;

export async function analyzeFloorplan(
  imagePath: string,
  imageWidth: number,
  imageHeight: number,
): Promise<AnalysisResult> {
  const api_key = process.env.OPENAI_API_KEY;
  if (!api_key) {
    throw new Error('OPENAI_API_KEY environment variable is required for auto-detection');
  }

  const client = new OpenAI({ apiKey: api_key });

  // Downscale for the API while tracking the scale factor
  const scale_factor = Math.min(1, MAX_ANALYSIS_DIM / Math.max(imageWidth, imageHeight));
  const send_width = Math.round(imageWidth * scale_factor);
  const send_height = Math.round(imageHeight * scale_factor);

  console.log(`Preparing image: ${imageWidth}x${imageHeight} → ${send_width}x${send_height} (scale: ${scale_factor.toFixed(3)})`);

  // Resize and add grid overlay
  const spacing = Math.max(100, Math.round(send_width / 10 / 50) * 50);
  const lines: string[] = [];
  const labels: string[] = [];

  for (let x = spacing; x < send_width; x += spacing) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${send_height}" stroke="red" stroke-width="1" opacity="0.6"/>`);
    labels.push(`<text x="${x + 3}" y="14" fill="red" font-size="13" font-family="Arial" font-weight="bold" opacity="0.9">${Math.round(x / scale_factor)}</text>`);
  }
  for (let y = spacing; y < send_height; y += spacing) {
    lines.push(`<line x1="0" y1="${y}" x2="${send_width}" y2="${y}" stroke="red" stroke-width="1" opacity="0.6"/>`);
    labels.push(`<text x="3" y="${y - 3}" fill="red" font-size="13" font-family="Arial" font-weight="bold" opacity="0.9">${Math.round(y / scale_factor)}</text>`);
  }

  const svg_overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${send_width}" height="${send_height}">${lines.join('')}${labels.join('')}</svg>`
  );

  const image_buffer = await sharp(imagePath)
    .resize(send_width, send_height, { fit: 'fill' })
    .composite([{ input: svg_overlay, top: 0, left: 0 }])
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64 = image_buffer.toString('base64');
  console.log(`Image prepared: ${(base64.length / 1024).toFixed(0)}KB base64`);

  const prompt = `Analyze this architectural floor plan. A RED COORDINATE GRID is overlaid with labels showing the ORIGINAL pixel coordinates (the image has been scaled down but the grid labels show the true coordinates).

The ORIGINAL image is ${imageWidth}px wide × ${imageHeight}px tall. Return all coordinates in ORIGINAL image pixels using the red grid labels as reference.

Identify EVERY space:

1. **Building outline**: outer perimeter polygon vertices.

2. **ALL rooms and spaces** — be thorough:
   - Meeting rooms (labeled "Meeting X.XX")
   - Focus rooms/pods (labeled "Focus X.XX")
   - Phone booths
   - Collaboration / collab areas
   - Project spaces
   - Open plan zones
   - Wellness rooms
   - CEO areas
   - Facilities: restrooms, lifts, stairs, lockers, kitchens, teapoints, print rooms
   - Filing rooms, comms rooms
   - Any other labeled space

   For each: bounding rectangle (x, y = top-left corner, width, height) in ORIGINAL pixels. Read labels from the drawing text.

3. **Walls**: major internal wall segments as polylines in ORIGINAL pixels.

Return ONLY valid JSON, no markdown:
{"outline":{"points":[{"x":270,"y":120}],"closed":true},"walls":[{"points":[{"x":100,"y":500},{"x":100,"y":2000}],"closed":false}],"rooms":[{"id":"meeting-3-01","label":"Meeting 3.01","type":"meeting","x":500,"y":200,"width":300,"height":250}]}`;

  console.log('Sending to GPT-4o...');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 16000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const response_text = response.choices[0]?.message?.content;
  if (!response_text) {
    throw new Error('No response from GPT-4o');
  }

  console.log(`Response received: ${response_text.length} chars`);

  let json_str = response_text.trim();
  if (json_str.startsWith('```')) {
    json_str = json_str.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed: {
    outline?: { points: { x: number; y: number }[]; closed: boolean };
    walls?: { points: { x: number; y: number }[]; closed: boolean }[];
    rooms?: DetectedRoom[];
  };

  try {
    parsed = JSON.parse(json_str);
  } catch {
    console.error('Failed to parse JSON:', json_str.slice(0, 500));
    throw new Error('Vision model returned invalid JSON. Try again.');
  }

  const analysis: AnalysisResult = { outline: null, walls: [], rooms: [] };

  if (parsed.outline?.points?.length) {
    analysis.outline = {
      id: 'auto-outline',
      points: parsed.outline.points,
      closed: parsed.outline.closed ?? true,
    };
  }

  if (parsed.walls?.length) {
    analysis.walls = parsed.walls.map((w, i) => ({
      id: `auto-wall-${i}`,
      points: w.points,
      closed: w.closed ?? false,
    }));
  }

  if (parsed.rooms?.length) {
    const seen = new Set<string>();
    analysis.rooms = parsed.rooms.map((r, i) => {
      let id = r.id || `room-${i}`;
      id = id.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/^[^a-z]/, 'r');
      let unique_id = id;
      let counter = 1;
      while (seen.has(unique_id)) {
        unique_id = `${id}-${counter++}`;
      }
      seen.add(unique_id);

      return {
        id: unique_id,
        label: r.label || `Room ${i + 1}`,
        type: r.type || 'other',
        x: Math.max(0, Math.round(r.x)),
        y: Math.max(0, Math.round(r.y)),
        width: Math.max(20, Math.round(r.width)),
        height: Math.max(20, Math.round(r.height)),
      };
    });
  }

  console.log(`Detected: outline=${analysis.outline ? 'yes' : 'no'}, walls=${analysis.walls.length}, rooms=${analysis.rooms.length}`);
  return analysis;
}
