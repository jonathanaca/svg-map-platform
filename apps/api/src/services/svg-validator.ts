import { LAYER_ORDER } from '@svg-map/types';
import type { ValidationError } from '@svg-map/types';

interface ValidatorOptions {
  expectedRoomIds: string[];
}

export function validateSvgOutput(svgString: string, options: ValidatorOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check viewBox is present with 4 numeric values
  const viewbox_match = svgString.match(/viewBox="([^"]*)"/);
  if (!viewbox_match) {
    errors.push({ field: 'viewBox', message: 'viewBox attribute is missing from root svg element' });
  } else {
    const parts = viewbox_match[1].split(/\s+/);
    if (parts.length !== 4 || parts.some((p) => isNaN(Number(p)))) {
      errors.push({ field: 'viewBox', message: 'viewBox must have exactly 4 numeric values' });
    }
  }

  // Check no fixed width/height on root svg
  const root_svg_match = svgString.match(/<svg[^>]*>/);
  if (root_svg_match) {
    const root = root_svg_match[0];
    // Check for width/height that are NOT inside viewBox
    const without_viewbox = root.replace(/viewBox="[^"]*"/, '');
    if (/\bwidth="/.test(without_viewbox)) {
      errors.push({ field: 'svg', message: 'Root svg element must not have a fixed width attribute' });
    }
    if (/\bheight="/.test(without_viewbox)) {
      errors.push({ field: 'svg', message: 'Root svg element must not have a fixed height attribute' });
    }
  }

  // Check all layer group IDs are present
  for (const layer of LAYER_ORDER) {
    const layer_regex = new RegExp(`<g[^>]*\\bid="${escapeRegex(layer)}"`, 'g');
    if (!layer_regex.test(svgString)) {
      errors.push({ field: 'layers', message: `Missing required layer group: "${layer}"` });
    }
  }

  // Check all room IDs from config are present exactly once
  for (const room_id of options.expectedRoomIds) {
    const id_regex = new RegExp(`\\bid="${escapeRegex(room_id)}"`, 'g');
    const matches = svgString.match(id_regex);
    if (!matches) {
      errors.push({ field: 'roomIds', message: `Room ID "${room_id}" is missing from SVG output` });
    } else if (matches.length > 1) {
      errors.push({ field: 'roomIds', message: `Room ID "${room_id}" appears ${matches.length} times (must be unique)` });
    }
  }

  // Check for duplicate id attributes
  const all_ids = [...svgString.matchAll(/\bid="([^"]*)"/g)].map((m) => m[1]);
  const seen = new Set<string>();
  for (const id of all_ids) {
    if (seen.has(id)) {
      errors.push({ field: 'ids', message: `Duplicate id attribute: "${id}"` });
    }
    seen.add(id);
  }

  // No gradients allowed
  if (/<linearGradient/.test(svgString) || /<radialGradient/.test(svgString)) {
    errors.push({ field: 'gradients', message: 'SVG must not contain any gradient elements' });
  }

  // Security: no script elements
  if (/<script/i.test(svgString)) {
    errors.push({ field: 'security', message: 'SVG must not contain <script> elements' });
  }

  // Security: no event handler attributes
  const event_handlers = /\bon(click|load|error|mouseover|mouseout|focus|blur|keydown|keyup|submit)=/i;
  if (event_handlers.test(svgString)) {
    errors.push({ field: 'security', message: 'SVG must not contain event handler attributes' });
  }

  // Security: no external resource references (allow embedded base64 images)
  if (/href="https?:\/\//i.test(svgString)) {
    errors.push({ field: 'security', message: 'SVG must not contain external URL references' });
  }
  // Block data: URIs except for embedded base64 images
  const data_uris = [...svgString.matchAll(/href="(data:[^"]+)"/gi)];
  for (const match of data_uris) {
    if (!/^data:image\/(jpeg|png|webp);base64,/i.test(match[1])) {
      errors.push({ field: 'security', message: 'SVG contains a disallowed data: URI (only base64 images permitted)' });
    }
  }

  return errors;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
