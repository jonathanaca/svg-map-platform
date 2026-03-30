/**
 * WCAG 2.1 contrast checking utilities.
 */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '');
  if (clean.length !== 6 && clean.length !== 3) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function linearize(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/**
 * Computes relative luminance per WCAG 2.1 definition.
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Returns the contrast ratio between two colours (always >= 1).
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastResult {
  valid: boolean;
  ratio: number;
  suggestedColor?: string;
}

/**
 * Validates that the text/background pair meets the required contrast ratio.
 * If it fails, `suggestedColor` offers either `#000000` or `#FFFFFF` as a
 * replacement text colour, whichever achieves higher contrast against the
 * background.
 */
export function validateContrast(
  textColor: string,
  bgColor: string,
  minRatio = 4.5,
): ContrastResult {
  const ratio = getContrastRatio(textColor, bgColor);

  if (ratio >= minRatio) {
    return { valid: true, ratio };
  }

  // Suggest black or white — whichever has better contrast on the bg
  const ratio_black = getContrastRatio('#000000', bgColor);
  const ratio_white = getContrastRatio('#FFFFFF', bgColor);
  const suggestedColor = ratio_black >= ratio_white ? '#000000' : '#FFFFFF';

  return { valid: false, ratio, suggestedColor };
}
