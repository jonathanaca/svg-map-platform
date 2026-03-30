/**
 * Strips HTML tags, script content, and event handler attributes from strings
 * used in SVG output to prevent XSS.
 */
export function sanitizeString(input: string): string {
  // First strip dangerous patterns
  let result = input
    .replace(/<script[\s\S]*?<\/script>/gi, '') // Strip script blocks
    .replace(/<[a-zA-Z][^>]*>/g, '') // Strip HTML opening tags
    .replace(/<\/[a-zA-Z][^>]*>/g, '') // Strip HTML closing tags
    .replace(/on\w+\s*=/gi, '') // Strip event handlers
    .replace(/javascript:/gi, ''); // Strip javascript: URIs

  // Then encode remaining special characters
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return result;
}

/**
 * Sanitizes a filename for use as an S3 object key / filesystem path.
 * Converts to lowercase, replaces spaces with underscores, removes unsafe chars.
 */
export function sanitizeFilename(clientName: string, levelName: string): string {
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');

  return `${sanitize(clientName)}_map_${sanitize(levelName)}.svg`;
}
