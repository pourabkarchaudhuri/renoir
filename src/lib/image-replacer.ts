/**
 * ImageReplacer — takes artifact HTML and a map of selector → generated image data,
 * and produces a new HTML string with placeholders replaced by real images.
 *
 * Responsibilities:
 *  - Parse HTML, locate elements by selector
 *  - For <img> tags: set src to data URI or renoir-asset:// path
 *  - For color-block divs: replace background-color with background-image: url(...)
 *  - Preserve original layout dimensions (no layout shift)
 *  - Return count of successful/failed replacements
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
 * Check if an element is a color-block div/section (has background-color in style).
 */
function isColorBlockElement(el: Element): boolean {
  const tag = el.tagName;
  if (tag !== 'DIV' && tag !== 'SECTION') return false;
  const style = (el.getAttribute('style') || '').toLowerCase();
  return /background-color\s*:/.test(style) || /background\s*:\s*[^;]*(?:#[0-9a-f]{3,8}|rgb|hsl)/.test(style);
}

/**
 * Preserve layout dimensions on an element by ensuring width/height are set.
 * If the element already has explicit dimensions, they are preserved.
 * If not, we don't add them (to avoid overriding CSS class-based sizing).
 */
function preserveLayoutDimensions(el: Element): void {
  const style = el.getAttribute('style') || '';

  // For img elements, ensure width and height attributes are preserved
  if (el.tagName === 'IMG') {
    const widthAttr = el.getAttribute('width');
    const heightAttr = el.getAttribute('height');

    // If inline style has width/height, those are already preserved
    const hasStyleWidth = /width\s*:/i.test(style);
    const hasStyleHeight = /height\s*:/i.test(style);

    // If element has width/height attributes but no inline style dimensions,
    // the attributes will naturally be preserved since we don't remove them
    if (!hasStyleWidth && widthAttr) {
      // Attribute is already on the element, no action needed
    }
    if (!hasStyleHeight && heightAttr) {
      // Attribute is already on the element, no action needed
    }
  }

  // For div/section elements, dimensions come from inline style or CSS classes
  // We don't modify dimensions — they are preserved by not touching them
}

/**
 * Replace a color-block element's background-color with background-image.
 * Preserves all other styles including dimensions.
 */
function replaceBackgroundColor(el: Element, imageRef: string): void {
  const style = el.getAttribute('style') || '';

  // Replace background-color with background-image, preserving other properties
  let newStyle = style;

  // Remove background-color property
  newStyle = newStyle.replace(/background-color\s*:\s*[^;]+;?/gi, '');

  // Also handle shorthand background that's just a color (no url)
  // Only replace if it doesn't already have a url()
  if (/background\s*:\s*[^;]*(?:#[0-9a-f]{3,8}|rgb|hsl)/i.test(newStyle) &&
      !/url\s*\(/i.test(newStyle)) {
    newStyle = newStyle.replace(/background\s*:\s*[^;]+;?/gi, '');
  }

  // Add background-image and background-size for proper display
  const bgImage = `background-image: url(${imageRef}); background-size: cover; background-position: center;`;

  // Clean up any trailing/leading semicolons and whitespace
  newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*/, '').trim();

  if (newStyle && !newStyle.endsWith(';')) {
    newStyle += '; ';
  } else if (newStyle) {
    newStyle += ' ';
  }

  newStyle += bgImage;

  el.setAttribute('style', newStyle.trim());
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Replace placeholders in HTML with generated images.
 *
 * For each entry in the results map:
 *  - If the selector matches an <img> element: set src to the image reference
 *  - If the selector matches a color-block div/section: replace background-color with background-image
 *  - If the selector doesn't match: increment failed count and continue
 *
 * The 512KB threshold determines whether to use inline data URI or renoir-asset:// path.
 *
 * @param html - The original artifact HTML string
 * @param results - Map of CSS selector → { dataUrl, savedPath? }
 * @returns ReplacementResult with the modified HTML and counts
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

  for (const [selector, imageData] of results) {
    try {
      const el = doc.querySelector(selector);

      if (!el) {
        failed++;
        errors.push(`Selector not found: ${selector}`);
        continue;
      }

      const imageRef = getImageReference(imageData.dataUrl, imageData.savedPath);

      // Preserve layout dimensions before making changes
      preserveLayoutDimensions(el);

      if (isImgElement(el)) {
        // For <img> elements: set src attribute
        el.setAttribute('src', imageRef);
        replaced++;
      } else if (isColorBlockElement(el)) {
        // For color-block divs/sections: replace background-color with background-image
        replaceBackgroundColor(el, imageRef);
        replaced++;
      } else {
        // For other elements (placeholder-div, svg-rect, etc.): try setting as background-image
        // or if it can hold an img child, handle accordingly
        const style = el.getAttribute('style') || '';
        let newStyle = style;
        if (newStyle && !newStyle.endsWith(';')) {
          newStyle += '; ';
        } else if (newStyle) {
          newStyle += ' ';
        } else {
          newStyle = '';
        }
        newStyle += `background-image: url(${imageRef}); background-size: cover; background-position: center;`;
        el.setAttribute('style', newStyle.trim());
        replaced++;
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Error replacing selector "${selector}": ${message}`);
    }
  }

  // Serialize back to HTML string
  // Use the body's innerHTML to get the content without the wrapping <html><head><body> tags
  const serialized = doc.body.innerHTML;

  return {
    html: serialized,
    replaced,
    failed,
    errors,
  };
}
