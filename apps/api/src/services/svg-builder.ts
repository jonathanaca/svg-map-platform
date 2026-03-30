import type { SvgElement } from '@svg-map/types';

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

const ESCAPE_RE = /[&<>"']/g;

function escapeXml(value: string): string {
  return value.replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch]);
}

/** Tags whose content should NOT be escaped (CSS, raw CDATA). */
const RAW_TAGS = new Set(['style']);

/** Self-closing tags that never have children. */
const VOID_TAGS = new Set([
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'use',
  'image',
]);

export class SvgBuilder {
  private readonly root: SvgElement;
  private readonly css_rules: string[] = [];
  private readonly defs_children: SvgElement[] = [];

  constructor(width: number, height: number) {
    this.root = {
      tag: 'svg',
      attributes: {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'xMidYMid meet',
        'xmlns:xlink': 'http://www.w3.org/1999/xlink',
        role: 'img',
      },
      children: [],
    };
  }

  // ── Factory helpers ─────────────────────────────────────────────────────────

  createElement(tag: string, attributes: Record<string, string> = {}, children: (SvgElement | string)[] = []): SvgElement {
    return { tag, attributes: { ...attributes }, children: [...children] };
  }

  createGroup(attributes: Record<string, string> = {}, children: (SvgElement | string)[] = []): SvgElement {
    return this.createElement('g', attributes, children);
  }

  createRect(attributes: Record<string, string>): SvgElement {
    return this.createElement('rect', attributes);
  }

  createText(content: string, attributes: Record<string, string> = {}): SvgElement {
    return this.createElement('text', attributes, [content]);
  }

  createCircle(attributes: Record<string, string>): SvgElement {
    return this.createElement('circle', attributes);
  }

  createPath(attributes: Record<string, string>): SvgElement {
    return this.createElement('path', attributes);
  }

  createStyle(css: string): SvgElement {
    return this.createElement('style', { type: 'text/css' }, [css]);
  }

  createDefs(children: SvgElement[] = []): SvgElement {
    return this.createElement('defs', {}, children);
  }

  createSymbol(id: string, viewBox: string, children: SvgElement[] = []): SvgElement {
    return this.createElement('symbol', { id, viewBox }, children);
  }

  createUse(href: string, attributes: Record<string, string> = {}): SvgElement {
    return this.createElement('use', { href, ...attributes });
  }

  // ── Composition helpers ─────────────────────────────────────────────────────

  addCssRule(rule: string): void {
    this.css_rules.push(rule);
  }

  addDef(element: SvgElement): void {
    this.defs_children.push(element);
  }

  addChild(element: SvgElement): void {
    this.root.children.push(element);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  render(): string {
    // Prepend <defs> and <style> to the root children before rendering
    const preamble: SvgElement[] = [];

    if (this.css_rules.length > 0) {
      preamble.push(this.createStyle(this.css_rules.join('\n')));
    }

    if (this.defs_children.length > 0) {
      preamble.push(this.createDefs(this.defs_children));
    }

    const full_root: SvgElement = {
      ...this.root,
      children: [...preamble, ...this.root.children],
    };

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + renderElement(full_root);
  }
}

function renderElement(el: SvgElement | string, depth = 0): string {
  if (typeof el === 'string') {
    return escapeXml(el);
  }

  const indent = '  '.repeat(depth);
  const attrs = renderAttributes(el.attributes);

  if (el.children.length === 0 && VOID_TAGS.has(el.tag)) {
    return `${indent}<${el.tag}${attrs}/>`;
  }

  if (el.children.length === 0) {
    return `${indent}<${el.tag}${attrs}></${el.tag}>`;
  }

  // Single text child — inline
  if (el.children.length === 1 && typeof el.children[0] === 'string') {
    const text = RAW_TAGS.has(el.tag)
      ? (el.children[0] as string)
      : escapeXml(el.children[0] as string);
    return `${indent}<${el.tag}${attrs}>${text}</${el.tag}>`;
  }

  const inner = el.children
    .map((child) => renderElement(child, depth + 1))
    .join('\n');

  return `${indent}<${el.tag}${attrs}>\n${inner}\n${indent}</${el.tag}>`;
}

function renderAttributes(attrs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    parts.push(` ${escapeXml(key)}="${escapeXml(value)}"`);
  }
  return parts.join('');
}
