/**
 * ImageReplacer — takes artifact HTML and a map of selector → generated image data,
 * and produces a new HTML string with placeholders replaced by real images.
 *
 * Responsibilities:
 *  - Parse HTML, locate elements by selector
 *  - Place every generated image inside a design-system image frame
 *    (.ph-img / .img-slot / .frame-img / .slide-visual / .renoir-img-frame)
 *  - Preserve original layout dimensions and aspect ratio (no layout shift)
 *  - Center images with object-fit: cover (no stretch)
 *  - When data URI exceeds 512KB, use renoir-asset:// path instead
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ReplacementResult {
  html: string;
  replaced: number;
  failed: number;
  errors: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** 512KB threshold in bytes for switching from inline data URI to renoir-asset:// path */
const DATA_URI_SIZE_THRESHOLD = 512 * 1024; // 524288 bytes

const FRAME_CLASS_TOKENS = new Set([
  'ph-img',
  'img-slot',
  'frame-img',
  'renoir-img-frame',
  'slide-visual',
]);

/** Injected once so framed images stay sharp, centered, and responsive. */
const FRAME_STYLE_ID = 'renoir-image-frame-styles';
const FRAME_STYLE_CSS = `
.ph-img,
.img-slot,
.frame-img,
.renoir-img-frame,
.slide-visual {
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  max-width: 100%;
}
.ph-img:has(> img),
.img-slot:has(> img),
.frame-img:has(> img),
.renoir-img-frame:has(> img) {
  display: block;
  padding: 0;
  color: transparent;
  background-image: none;
}
.ph-img > img,
.img-slot > img,
.frame-img > img,
.renoir-img-frame > img,
.slide-visual > img,
img.slide-image,
img.renoir-framed-img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  object-fit: cover;
  object-position: center center;
  display: block;
  border: 0;
}
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Determine the image reference to use based on size threshold.
 * If the data URI exceeds 512KB and a savedPath is available, use renoir-asset:// path.
 */
function getImageReference(dataUrl: string, savedPath?: string): string {
  if (dataUrl.length > DATA_URI_SIZE_THRESHOLD && savedPath) {
    return `renoir-asset://${savedPath}`;
  }
  return dataUrl;
}

/**
 * Check if an element is an <img> tag.
 */
function isImgElement(el: Element): boolean {
  return el.tagName === 'IMG';
}

/**
 * True when the element is (or acts as) a design-system image frame.
 */
export function isImageFrameElement(el: Element | null | undefined): boolean {
  if (!el) return false;
  const tokens = (el.getAttribute('class') || '').toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.some((t) => FRAME_CLASS_TOKENS.has(t));
}

/**
 * Apply object-fit / sizing styles so the bitmap fills the frame without stretching.
 */
function applyFramedImgStyles(img: Element): void {
  const existing = (img.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  if (!existing.includes('renoir-framed-img')) {
    existing.push('renoir-framed-img');
    img.setAttribute('class', existing.join(' '));
  }

  let style = img.getAttribute('style') || '';
  // Strip conflicting sizing that would stretch or break the frame
  style = style
    .replace(/(?:^|;)\s*object-fit\s*:[^;]*/gi, '')
    .replace(/(?:^|;)\s*object-position\s*:[^;]*/gi, '')
    .replace(/(?:^|;)\s*max-width\s*:[^;]*/gi, '')
    .replace(/;\s*;/g, ';')
    .trim();

  const framed =
    'width:100%;height:100%;max-width:100%;object-fit:cover;object-position:center center;display:block;';
  if (style && !style.endsWith(';')) style += ';';
  style = `${style}${style ? ' ' : ''}${framed}`.trim();
  img.setAttribute('style', style);
}

/**
 * Ensure a frame container keeps aspect ratio and clips overflow without layout shift.
 */
function ensureFrameContainerStyles(frame: Element): void {
  let style = frame.getAttribute('style') || '';
  const hasOverflow = /overflow\s*:/i.test(style);
  const hasPosition = /position\s*:/i.test(style);
  const hasMaxWidth = /max-width\s*:/i.test(style);
  const hasBoxSizing = /box-sizing\s*:/i.test(style);

  const additions: string[] = [];
  if (!hasOverflow) additions.push('overflow:hidden');
  if (!hasPosition) additions.push('position:relative');
  if (!hasMaxWidth) additions.push('max-width:100%');
  if (!hasBoxSizing) additions.push('box-sizing:border-box');

  if (additions.length === 0) return;

  if (style && !style.endsWith(';')) style += ';';
  style = `${style}${style ? ' ' : ''}${additions.join('; ')};`.trim();
  frame.setAttribute('style', style);
}

/**
 * Clear placeholder label text and decorative background so the photo shows cleanly.
 */
function prepareFrameForImage(frame: Element): void {
  // Keep child structure only if it already has a single img; otherwise clear labels
  const existingImg = frame.querySelector(':scope > img');
  if (!existingImg) {
    frame.textContent = '';
  }

  let style = (frame.getAttribute('style') || '')
    .replace(/background(?:-image|-size|-position|-repeat|-color)?\s*:[^;]+;?/gi, '')
    .replace(/;\s*;/g, ';')
    .trim();

  if (style && !style.endsWith(';')) style += ';';
  if (!/color\s*:/i.test(style)) {
    style += `${style ? ' ' : ''}color: transparent;`;
  }
  frame.setAttribute('style', style.trim());
  ensureFrameContainerStyles(frame);
}

/**
 * Fill a frame element with a single centered <img>.
 */
function fillFrameWithImage(frame: Element, imageRef: string, altText = ''): void {
  prepareFrameForImage(frame);

  let img = frame.querySelector(':scope > img');
  if (!img) {
    img = frame.ownerDocument!.createElement('img');
    frame.appendChild(img);
  }

  img.setAttribute('src', imageRef);
  if (altText && !img.getAttribute('alt')) {
    img.setAttribute('alt', altText);
  } else if (!img.getAttribute('alt')) {
    img.setAttribute('alt', '');
  }
  applyFramedImgStyles(img);
}

/**
 * Wrap a bare <img> in a figure.frame-img so it participates in the frame system.
 * Preserves width/height attributes as aspect-ratio on the frame.
 */
function wrapImgInFrame(img: Element, imageRef: string): Element {
  const doc = img.ownerDocument!;
  const parent = img.parentElement;
  if (!parent) {
    img.setAttribute('src', imageRef);
    applyFramedImgStyles(img);
    return img;
  }

  // Already inside a frame — just style the img
  if (isImageFrameElement(parent)) {
    img.setAttribute('src', imageRef);
    applyFramedImgStyles(img);
    ensureFrameContainerStyles(parent);
    return parent;
  }

  const frame = doc.createElement('figure');
  frame.setAttribute('class', 'frame-img renoir-img-frame');

  const widthAttr = img.getAttribute('width');
  const heightAttr = img.getAttribute('height');
  const style = img.getAttribute('style') || '';
  const styleW = style.match(/(?:^|;)\s*width\s*:\s*([^;]+)/i)?.[1]?.trim();
  const styleH = style.match(/(?:^|;)\s*height\s*:\s*([^;]+)/i)?.[1]?.trim();

  const frameStyles: string[] = ['width:100%', 'max-width:100%', 'margin:0', 'overflow:hidden', 'position:relative', 'box-sizing:border-box'];

  if (widthAttr && heightAttr) {
    frameStyles.push(`aspect-ratio:${widthAttr} / ${heightAttr}`);
  } else if (styleW && styleH && !styleW.includes('%') && !styleH.includes('%')) {
    frameStyles.push(`aspect-ratio:auto`);
    // Keep explicit pixel box on the frame to avoid layout shift
    frameStyles.push(`width:${styleW}`, `height:${styleH}`);
  } else {
    frameStyles.push('aspect-ratio:16 / 10');
  }

  frame.setAttribute('style', frameStyles.join('; ') + ';');

  parent.insertBefore(frame, img);
  frame.appendChild(img);

  img.setAttribute('src', imageRef);
  // Remove fixed width/height from img so the frame owns the box
  img.removeAttribute('width');
  img.removeAttribute('height');
  applyFramedImgStyles(img);

  return frame;
}

/**
 * Resolve alt text from the placeholder element context.
 */
function resolveAltText(el: Element): string {
  if (isImgElement(el)) {
    return (el.getAttribute('alt') || '').trim();
  }
  const aria = (el.getAttribute('aria-label') || '').trim();
  if (aria) return aria;
  const text = (el.textContent || '').replace(/[\[\]]/g, '').replace(/·.*$/, '').trim();
  return text.slice(0, 200);
}

/**
 * Inject shared frame CSS once into the document <head>.
 */
function ensureFrameStyles(doc: Document): void {
  if (doc.getElementById(FRAME_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = FRAME_STYLE_ID;
  style.textContent = FRAME_STYLE_CSS;
  const head = doc.head || doc.getElementsByTagName('head')[0];
  if (head) {
    head.appendChild(style);
  } else {
    doc.documentElement.insertBefore(style, doc.documentElement.firstChild);
  }
}

/**
 * Preserve layout dimensions on an element by ensuring width/height are set.
 * If the element already has explicit dimensions, they are preserved.
 */
function preserveLayoutDimensions(el: Element): void {
  // Dimensions come from inline style, attributes, or CSS classes (aspect-ratio).
  // We intentionally do not rewrite them — avoiding layout shift.
  void el;
}

/**
 * Serialize the parsed document back to HTML, preserving full documents when the input had one.
 */
function serializeDocument(doc: Document, originalHtml: string): string {
  const hadFullDocument = /<html[\s>]/i.test(originalHtml);
  if (!hadFullDocument) {
    // Style was injected into <head>; include it so fragment consumers still get frame CSS.
    const styleEl = doc.getElementById(FRAME_STYLE_ID);
    const styleHtml = styleEl ? styleEl.outerHTML : '';
    return `${styleHtml}${doc.body.innerHTML}`;
  }
  const doctype = originalHtml.match(/<!doctype[^>]*>/i)?.[0] ?? '<!doctype html>';
  return `${doctype}\n${doc.documentElement.outerHTML}`;
}

/**
 * Place a generated image into the matched element using the frame component pattern.
 */
function placeImageInFrame(el: Element, imageRef: string): void {
  const alt = resolveAltText(el);

  if (isImgElement(el)) {
    wrapImgInFrame(el, imageRef);
    return;
  }

  if (isImageFrameElement(el)) {
    fillFrameWithImage(el, imageRef, alt);
    return;
  }

  // Color-block / generic placeholder: promote to a frame and insert <img>
  const className = (el.getAttribute('class') || '').trim();
  const tokens = className ? className.split(/\s+/) : [];
  if (!tokens.includes('renoir-img-frame')) {
    tokens.push('renoir-img-frame');
    el.setAttribute('class', tokens.join(' '));
  }
  fillFrameWithImage(el, imageRef, alt);
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Replace placeholders in HTML with generated images inside image frames.
 *
 * For each entry in the results map:
 *  - Frame elements (.ph-img, .img-slot, .frame-img, …): insert a framed <img>
 *  - Bare <img> placeholders: wrap in figure.frame-img when not already framed
 *  - Other placeholders: promote to renoir-img-frame and insert <img>
 *
 * The 512KB threshold determines whether to use inline data URI or renoir-asset:// path.
 */
export function replacePlaceholders(
  html: string,
  results: Map<string, { dataUrl: string; savedPath?: string }>
): ReplacementResult {
  if (!html || !html.trim() || results.size === 0) {
    return {
      html: html || '',
      replaced: 0,
      failed: 0,
      errors: [],
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let replaced = 0;
  let failed = 0;
  const errors: string[] = [];
  const jobs: { el: Element; imageRef: string }[] = [];

  // Resolve all selectors before mutating — wrapping imgs in frames must not
  // invalidate later nth-of-type / sibling selectors.
  for (const [selector, imageData] of results) {
    try {
      const el = doc.querySelector(selector);

      if (!el) {
        failed++;
        errors.push(`Selector not found: ${selector}`);
        continue;
      }

      jobs.push({
        el,
        imageRef: getImageReference(imageData.dataUrl, imageData.savedPath),
      });
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Error resolving selector "${selector}": ${message}`);
    }
  }

  for (const job of jobs) {
    try {
      preserveLayoutDimensions(job.el);
      placeImageInFrame(job.el, job.imageRef);
      replaced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Error placing image: ${message}`);
    }
  }

  if (replaced > 0) {
    ensureFrameStyles(doc);
  }

  const serialized = serializeDocument(doc, html);

  return {
    html: serialized,
    replaced,
    failed,
    errors,
  };
}
