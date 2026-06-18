/**
 * PlaceholderDetector — identifies image placeholder elements in artifact HTML.
 *
 * Detection patterns:
 *  1. empty-img: <img> with no valid src (empty, "#", "about:blank", or containing "placeholder")
 *  2. color-block: <div>/<section> with background-color but no background-image
 *  3. placeholder-div: elements with class names containing placeholder-indicating terms
 *  4. svg-rect: large SVG <rect> elements used as image placeholders
 *
 * Exclusion: elements smaller than 32×32 CSS pixels are excluded as decorative accents.
 */

export interface Placeholder {
  /** Unique CSS selector path to locate this element in the HTML */
  selector: string;
  /** What kind of placeholder was detected */
  kind: 'color-block' | 'empty-img' | 'placeholder-div' | 'svg-rect';
  /** The element's sizing context for the replacement image */
  sizing: { width?: string; height?: string; aspectRatio?: string };
  /** Surrounding semantic context for prompt derivation */
  context: {
    altText?: string;
    nearestHeading?: string;
    parentSection?: string;
    siblingText?: string;
    ariaLabel?: string;
    className?: string;
  };
}

// ─── Size Exclusion ──────────────────────────────────────────────────────────

const MIN_SIZE_PX = 32;

/**
 * Parse a CSS dimension value to pixels. Returns null if unparseable.
 * Handles px, rem (assume 16px), em (assume 16px), %, vw, vh — for % and viewport
 * units we can't resolve without layout, so we treat them as "large enough".
 */
function parseDimensionPx(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // percentage and viewport units — assume large enough
  if (trimmed.endsWith('%') || trimmed.endsWith('vw') || trimmed.endsWith('vh')) {
    return MIN_SIZE_PX; // treat as passing the threshold
  }

  const num = parseFloat(trimmed);
  if (isNaN(num)) return null;

  if (trimmed.endsWith('rem') || trimmed.endsWith('em')) {
    return num * 16;
  }
  // px or bare number
  return num;
}

/**
 * Extract width/height from an element's inline style or attributes.
 */
function getElementDimensions(el: Element): { width: number | null; height: number | null } {
  const style = el.getAttribute('style') || '';
  const widthAttr = el.getAttribute('width');
  const heightAttr = el.getAttribute('height');

  let width: number | null = null;
  let height: number | null = null;

  // Try inline style first
  const wMatch = style.match(/(?:^|;)\s*width\s*:\s*([^;]+)/i);
  const hMatch = style.match(/(?:^|;)\s*height\s*:\s*([^;]+)/i);

  if (wMatch) width = parseDimensionPx(wMatch[1]);
  if (hMatch) height = parseDimensionPx(hMatch[1]);

  // Fall back to HTML attributes
  if (width === null && widthAttr) width = parseDimensionPx(widthAttr);
  if (height === null && heightAttr) height = parseDimensionPx(heightAttr);

  return { width, height };
}

/**
 * Returns true if the element is too small (below 32×32) to be a meaningful placeholder.
 * If dimensions can't be determined, we assume it's large enough (don't exclude).
 */
function isTooSmall(el: Element): boolean {
  const { width, height } = getElementDimensions(el);
  // If both dimensions are known and either is below threshold, exclude
  if (width !== null && width < MIN_SIZE_PX) return true;
  if (height !== null && height < MIN_SIZE_PX) return true;
  return false;
}

// ─── Detection Patterns ──────────────────────────────────────────────────────

/**
 * Pattern 1: <img> with no valid src.
 */
function isEmptyImg(el: Element): boolean {
  if (el.tagName !== 'IMG') return false;
  const src = (el.getAttribute('src') || '').trim();
  if (!src) return true;
  if (src === '#') return true;
  if (src === 'about:blank') return true;
  if (src.toLowerCase().includes('placeholder')) return true;
  return false;
}

/**
 * Pattern 2: <div> or <section> with background-color but no background-image.
 */
function isColorBlock(el: Element): boolean {
  const tag = el.tagName;
  if (tag !== 'DIV' && tag !== 'SECTION') return false;
  const style = (el.getAttribute('style') || '').toLowerCase();
  if (!style) return false;
  const hasBgColor = /background-color\s*:/.test(style) || /background\s*:\s*[^;]*(?:#[0-9a-f]{3,8}|rgb|hsl|(?:red|blue|green|yellow|orange|purple|pink|gray|grey|black|white|navy|teal|aqua|maroon|olive|lime|fuchsia|silver)\b)/.test(style);
  if (!hasBgColor) return false;
  const hasBgImage = /background-image\s*:/.test(style) || /background\s*:[^;]*url\s*\(/.test(style);
  return !hasBgImage;
}

/**
 * Pattern 3: Elements with placeholder-indicating class names.
 */
function hasPlaceholderClass(el: Element): boolean {
  const className = el.getAttribute('class') || '';
  if (!className) return false;
  const lower = className.toLowerCase();
  return lower.includes('placeholder') || lower.includes('img-placeholder');
}

/**
 * Pattern 4: Large SVG <rect> elements.
 */
function isLargeSvgRect(el: Element): boolean {
  if (el.tagName !== 'rect') return false;
  // Must be inside an SVG
  if (!el.closest('svg')) return false;
  const w = parseFloat(el.getAttribute('width') || '0');
  const h = parseFloat(el.getAttribute('height') || '0');
  return w >= MIN_SIZE_PX && h >= MIN_SIZE_PX;
}

// ─── Context Extraction ──────────────────────────────────────────────────────

function getNearestHeading(el: Element): string | undefined {
  // Walk backwards through previous siblings and ancestors to find nearest heading
  let current: Element | null = el;
  while (current) {
    // Check previous siblings
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        const text = (sibling.textContent || '').trim();
        if (text) return text;
      }
      // Check if sibling contains a heading
      const headingInSibling = sibling.querySelector('h1, h2, h3, h4, h5, h6');
      if (headingInSibling) {
        const text = (headingInSibling.textContent || '').trim();
        if (text) return text;
      }
      sibling = sibling.previousElementSibling;
    }
    // Move to parent
    current = current.parentElement;
    if (current && /^H[1-6]$/.test(current.tagName)) {
      const text = (current.textContent || '').trim();
      if (text) return text;
    }
  }
  return undefined;
}

function getParentSection(el: Element): string | undefined {
  const section = el.closest('section, article, main, aside, header, footer, nav');
  if (!section) return undefined;
  // Get the section's tag name as context
  const tag = section.tagName.toLowerCase();
  const id = section.getAttribute('id');
  const cls = section.getAttribute('class');
  if (id) return `${tag}#${id}`;
  if (cls) return `${tag}.${cls.split(/\s+/)[0]}`;
  return tag;
}

function getSiblingText(el: Element): string | undefined {
  const texts: string[] = [];
  const prev = el.previousElementSibling;
  const next = el.nextElementSibling;
  if (prev) {
    const t = (prev.textContent || '').trim().slice(0, 200);
    if (t) texts.push(t);
  }
  if (next) {
    const t = (next.textContent || '').trim().slice(0, 200);
    if (t) texts.push(t);
  }
  return texts.length > 0 ? texts.join(' ') : undefined;
}

function extractContext(el: Element): Placeholder['context'] {
  const ctx: Placeholder['context'] = {};

  // Alt text (for img elements)
  const alt = el.getAttribute('alt');
  if (alt && alt.trim()) ctx.altText = alt.trim();

  // Aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) ctx.ariaLabel = ariaLabel.trim();

  // Class name
  const className = el.getAttribute('class');
  if (className && className.trim()) ctx.className = className.trim();

  // Nearest heading
  const heading = getNearestHeading(el);
  if (heading) ctx.nearestHeading = heading;

  // Parent section
  const section = getParentSection(el);
  if (section) ctx.parentSection = section;

  // Sibling text
  const siblingText = getSiblingText(el);
  if (siblingText) ctx.siblingText = siblingText;

  // Ensure at least one field is populated — use tag name as fallback
  if (Object.keys(ctx).length === 0) {
    ctx.className = el.tagName.toLowerCase();
  }

  return ctx;
}

// ─── Sizing Extraction ───────────────────────────────────────────────────────

function extractSizing(el: Element): Placeholder['sizing'] {
  const sizing: Placeholder['sizing'] = {};
  const style = el.getAttribute('style') || '';

  // Width
  const wMatch = style.match(/(?:^|;)\s*width\s*:\s*([^;]+)/i);
  const widthAttr = el.getAttribute('width');
  if (wMatch) sizing.width = wMatch[1].trim();
  else if (widthAttr) sizing.width = widthAttr.includes('px') || widthAttr.includes('%') ? widthAttr : `${widthAttr}px`;

  // Height
  const hMatch = style.match(/(?:^|;)\s*height\s*:\s*([^;]+)/i);
  const heightAttr = el.getAttribute('height');
  if (hMatch) sizing.height = hMatch[1].trim();
  else if (heightAttr) sizing.height = heightAttr.includes('px') || heightAttr.includes('%') ? heightAttr : `${heightAttr}px`;

  // Aspect ratio
  const arMatch = style.match(/(?:^|;)\s*aspect-ratio\s*:\s*([^;]+)/i);
  if (arMatch) sizing.aspectRatio = arMatch[1].trim();

  return sizing;
}

// ─── Unique Selector Generation ──────────────────────────────────────────────

/**
 * Generate a unique CSS selector for an element within the document.
 * Uses nth-of-type to ensure uniqueness.
 */
function generateSelector(el: Element, doc: Document): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== doc.body && current !== doc.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add id if available (makes it unique immediately)
    const id = current.getAttribute('id');
    if (id) {
      // CSS.escape may not be available in all environments (e.g., jsdom)
      const escaped = typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(id)
        : id.replace(/([^\w-])/g, '\\$1');
      parts.unshift(`#${escaped}`);
      break;
    }

    // Add nth-of-type for uniqueness among siblings
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  // Prepend body if we didn't hit an id
  if (parts.length > 0 && !parts[0].startsWith('#')) {
    parts.unshift('body');
  }

  return parts.join(' > ');
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Parse artifact HTML and extract all image placeholder elements.
 *
 * Returns placeholders in document order with unique selectors.
 * Elements smaller than 32×32 CSS pixels are excluded.
 */
export function extractPlaceholders(html: string): Placeholder[] {
  if (!html || !html.trim()) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const results: Placeholder[] = [];
  const seenSelectors = new Set<string>();

  // Walk all elements depth-first (document order)
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.nextNode();

  while (node) {
    const el = node as Element;

    // Determine placeholder kind
    let kind: Placeholder['kind'] | null = null;

    if (isEmptyImg(el)) {
      kind = 'empty-img';
    } else if (isColorBlock(el)) {
      kind = 'color-block';
    } else if (hasPlaceholderClass(el)) {
      kind = 'placeholder-div';
    } else if (isLargeSvgRect(el)) {
      kind = 'svg-rect';
    }

    if (kind) {
      // Apply size exclusion filter
      if (!isTooSmall(el)) {
        const selector = generateSelector(el, doc);

        // Ensure uniqueness
        if (!seenSelectors.has(selector)) {
          seenSelectors.add(selector);
          results.push({
            selector,
            kind,
            sizing: extractSizing(el),
            context: extractContext(el),
          });
        }
      }
    }

    node = walker.nextNode();
  }

  return results;
}
