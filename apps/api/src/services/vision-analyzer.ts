import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
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

// Max dimension sent to the vision API (keeps base64 under ~1.5 MB)
const MAX_ANALYSIS_DIM = 2400;

type Point = { x: number; y: number };

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  return Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / mag;
}

function douglasPeucker(pts: Point[], epsilon: number): Point[] {
  if (pts.length < 3) return pts;
  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(pts.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(pts.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

// When a room label matches the PlaceOS floor-number convention (e.g. "12-87"),
// emit the canonical id "area-12.87-free".
function toPlaceOSId(label: string): string | null {
  const match = label.match(/(\d{1,2})-(\d{1,3})/);
  if (match) return `area-${match[1]}.${match[2]}-free`;
  return null;
}

function sanitizeId(raw: string, index: number, seen: Set<string>): string {
  let id = (raw || `room-${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, '-')
    .replace(/^[^a-z]/, 'r$&');
  let unique = id;
  let counter = 1;
  while (seen.has(unique)) unique = `${id}-${counter++}`;
  seen.add(unique);
  return unique;
}

function clusterValues(vals: number[], threshold: number): Map<number, number> {
  const sorted = [...new Set(vals)].sort((a, b) => a - b);
  const result = new Map<number, number>();
  let i = 0;
  while (i < sorted.length) {
    const group = [sorted[i]];
    while (i + 1 < sorted.length && sorted[i + 1] - sorted[i] <= threshold) {
      i++;
      group.push(sorted[i]);
    }
    const median = group[Math.floor(group.length / 2)];
    for (const v of group) result.set(v, median);
    i++;
  }
  return result;
}

function snapRoomEdges(rooms: DetectedRoom[], threshold: number): DetectedRoom[] {
  const xs = rooms.flatMap((r) => [r.x, r.x + r.width]);
  const ys = rooms.flatMap((r) => [r.y, r.y + r.height]);
  const snapX = clusterValues(xs, threshold);
  const snapY = clusterValues(ys, threshold);
  return rooms.map((r) => {
    const x = snapX.get(r.x) ?? r.x;
    const y = snapY.get(r.y) ?? r.y;
    const x2 = snapX.get(r.x + r.width) ?? (r.x + r.width);
    const y2 = snapY.get(r.y + r.height) ?? (r.y + r.height);
    return { ...r, x, y, width: Math.max(20, x2 - x), height: Math.max(20, y2 - y) };
  });
}

export async function analyzeFloorplan(
  imagePath: string,
  imageWidth: number,
  imageHeight: number,
  mode: 'outline' | 'rooms' | 'all' = 'all',
): Promise<AnalysisResult> {
  const api_key = process.env.ANTHROPIC_API_KEY;
  if (!api_key) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required for auto-detection');
  }

  const client = new Anthropic({ apiKey: api_key });

  const scale_factor = Math.min(1, MAX_ANALYSIS_DIM / Math.max(imageWidth, imageHeight));
  const send_width = Math.round(imageWidth * scale_factor);
  const send_height = Math.round(imageHeight * scale_factor);

  console.log(`Preparing image: ${imageWidth}x${imageHeight} → ${send_width}x${send_height}`);

  // Overlay a dense coordinate grid — fine lines every ~100px, labelled every other line
  const spacing = Math.max(50, Math.round(send_width / 20 / 25) * 25);
  const lines: string[] = [];
  const labels: string[] = [];

  let xi = 0;
  for (let x = spacing; x < send_width; x += spacing, xi++) {
    const isMajor = xi % 2 === 1;
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${send_height}" stroke="red" stroke-width="${isMajor ? 1.5 : 0.8}" opacity="${isMajor ? 0.7 : 0.4}"/>`);
    if (isMajor) labels.push(`<text x="${x + 3}" y="14" fill="red" font-size="11" font-family="Arial" font-weight="bold" opacity="0.95">${Math.round(x / scale_factor)}</text>`);
  }
  let yi = 0;
  for (let y = spacing; y < send_height; y += spacing, yi++) {
    const isMajor = yi % 2 === 1;
    lines.push(`<line x1="0" y1="${y}" x2="${send_width}" y2="${y}" stroke="red" stroke-width="${isMajor ? 1.5 : 0.8}" opacity="${isMajor ? 0.7 : 0.4}"/>`);
    if (isMajor) labels.push(`<text x="3" y="${y - 3}" fill="red" font-size="11" font-family="Arial" font-weight="bold" opacity="0.95">${Math.round(y / scale_factor)}</text>`);
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
  console.log(`Image prepared: ${(base64.length / 1024).toFixed(0)} KB base64`);

  const GRID_PREAMBLE = `You are an expert architectural floor plan analyser. A RED COORDINATE GRID is overlaid on this image. Grid labels show ORIGINAL pixel coordinates (the image was scaled down but labels reflect the true dimensions).

The ORIGINAL image is ${imageWidth}px wide × ${imageHeight}px tall. Return ALL coordinates in ORIGINAL image pixels using the red grid as reference.`;

  const OUTLINE_TASK = `
────────────────────────────────────────
TASK — BUILDING OUTLINE
────────────────────────────────────────
Trace the EXTERIOR PERIMETER — the actual physical outer walls of the building floor plate.

Rules:
• TRACE the solid, continuous lines at the very outermost edge of the floor plan drawing.
• The outline must ENCOMPASS every room, desk, and labelled space in the plan.
• Vertices are wall corners — usually 90° angles. Include every notch, setback, and recess in the perimeter.
• DO NOT trace dotted lines, dashed lines, curved scalloped lines, or "OUT OF SCOPE" demarcation curves. These are internal zone boundaries, not outer walls.
• Stop at the last solid wall — do not extend to blank margins, title blocks, or image borders.
• Use as many vertices as needed (10–80) to accurately capture the shape. Do NOT simplify to a box.

Return ONLY valid JSON, no markdown:
{"outline":{"points":[{"x":270,"y":120},{"x":1050,"y":120}],"closed":true},"walls":[],"rooms":[]}`;

  const ROOMS_TASK = `
────────────────────────────────────────
TASK — ROOM DETECTION
────────────────────────────────────────
Identify EVERY labelled space on this floor plan. Use the RED coordinate grid to measure precise pixel positions.

For each space, follow these steps:
1. Read the label text exactly as printed (e.g. "MEETING 3.44", "COLLAB", "FOCUS 3.38")
2. Locate the solid walls that enclose the space
3. Use the red grid lines to read the pixel coordinate at each wall edge
4. Set x,y to the TOP-LEFT corner of the enclosed space (at the inner face of the wall)
5. Set width,height to the interior dimensions of that space

Rules:
• Bounding boxes must align tightly to the room's OWN enclosing walls — stop exactly at each wall line
• Do NOT bleed into adjacent rooms, corridors, or open areas
• Each labelled space gets its own separate bounding box — never merge adjacent rooms

Size guidance (measure wall-to-wall, interior only):
• focus (phone booth / quiet pod / 1-person room): very small enclosed space — width AND height should each be LESS than 8% of the total floor plan width. If you measure larger than this, re-check that you are not including neighbouring space.
• meeting (enclosed meeting room): medium enclosed room — typically 8–25% of floor plan width. Measure ONLY the interior of that one room, stopping at its four walls.
• collaboration / open-plan: larger open zones, can be wide
• facilities / other: varies

Include ALL spaces: meeting rooms, focus rooms, open-plan zones, collaboration areas, phone booths, wellness rooms, print/copy areas, storage, locker rooms, facilities (toilets, showers, lifts, stairs, kitchens, teapoints), reception, lounges, any other named space.
type must be one of: meeting | focus | collaboration | open-plan | facilities | other

Return ONLY valid JSON, no markdown:
{"outline":null,"walls":[],"rooms":[{"id":"meeting-3-44","label":"MEETING 3.44","type":"meeting","x":500,"y":200,"width":180,"height":140}]}`;

  const ALL_TASK = `
────────────────────────────────────────
TASK 1 — BUILDING OUTLINE
────────────────────────────────────────
Trace the EXTERIOR PERIMETER — the actual physical outer walls of the building floor plate.
• TRACE the thick, continuous solid outer wall lines only. Stop at the last wall — do NOT extend to blank margins, title blocks, or image edges.
• DO NOT trace dotted, dashed, or curved scalloped lines (internal zone boundaries).
• Capture every corner, notch and setback. Use as many vertices as needed (10–80).

────────────────────────────────────────
TASK 2 — ROOMS
────────────────────────────────────────
Identify ALL labelled spaces: label text, bounding rect (x, y, width, height), type (meeting|focus|collaboration|open-plan|facilities|other).

Return ONLY valid JSON, no markdown:
{"outline":{"points":[{"x":270,"y":120}],"closed":true},"walls":[],"rooms":[{"id":"meeting-12-89","label":"Meeting 12-89","type":"meeting","x":500,"y":200,"width":300,"height":250}]}`;

  const prompt = `${GRID_PREAMBLE}${mode === 'outline' ? OUTLINE_TASK : mode === 'rooms' ? ROOMS_TASK : ALL_TASK}`;

  console.log('Sending to Claude…');

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 16000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const response_text = response.content.find((b) => b.type === 'text')?.text ?? '';
  if (!response_text) throw new Error('No response from Claude');

  console.log(`Response received: ${response_text.length} chars`);

  const json_str = response_text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

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
    // Minimal Douglas-Peucker — only removes sub-pixel noise, preserves all real corners.
    const epsilon = Math.max(imageWidth, imageHeight) * 0.003;
    const simplified = douglasPeucker(parsed.outline.points, epsilon);
    console.log(`Outline: ${parsed.outline.points.length} pts → ${simplified.length} pts (ε=${epsilon.toFixed(0)})`);
    analysis.outline = {
      id: 'auto-outline',
      points: simplified,
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
    const rawRooms = parsed.rooms.map((r, i) => {
      const placeos_id = toPlaceOSId(r.label ?? '');
      const raw_id = placeos_id ?? r.id ?? `room-${i}`;
      const unique_id = sanitizeId(raw_id, i, seen);
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
    // Snap shared edges: rooms within snapThreshold px of each other get aligned
    const snapThreshold = Math.max(imageWidth, imageHeight) * 0.008;
    analysis.rooms = snapRoomEdges(rawRooms, snapThreshold);
  }

  console.log(`Detected: outline=${analysis.outline ? 'yes' : 'no'}, walls=${analysis.walls.length}, rooms=${analysis.rooms.length}`);
  return analysis;
}
