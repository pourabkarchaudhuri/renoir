/**
 * PromptGenerator — converts placeholder context into effective image generation prompts.
 *
 * Responsibilities:
 *  - Build descriptive prompts from alt text, headings, and section content
 *  - Append style suffixes from the active design system / visual direction
 *  - Choose appropriate image size based on placeholder aspect ratio
 *  - Deduplicate near-identical prompts for repeated layouts
 *  - Cap prompt length to Azure API limits (4000 chars)
 *  - Sanitize prompts (strip HTML tags, script content)
 */

import type { Placeholder } from './image-placeholders';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface DesignSystemSummary {
  vibe: string;
  swatches?: string[];
}

export interface VisualDirection {
  vibe: string;
  tagline: string;
}

export interface ImagePromptRequest {
  placeholder: Placeholder;
  designSystem?: DesignSystemSummary;
  direction?: VisualDirection;
  projectName?: string;
}

export interface DerivedImageRequest {
  prompt: string;
  size: '1024x1024' | '1024x1536' | '1536x1024';
  quality: 'low' | 'medium' | 'high';
  placeholderSelector: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 4000;
const MAX_ALT_TEXT_LENGTH = 500;
const QUALITY_SUFFIX = 'Professional quality, clean composition, no text overlays or watermarks.';
const GENERIC_ALT_TEXTS = new Set(['placeholder', 'image', 'img', 'photo', 'picture']);

// ─── Sanitization ────────────────────────────────────────────────────────────

/**
 * Strip HTML tags and script content from a string.
 */
export function sanitize(input: string): string {
  if (!input) return '';
  // Remove script tags and their content first
  let cleaned = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Truncate alt text to MAX_ALT_TEXT_LENGTH characters.
 */
function truncateAltText(altText: string): string {
  if (altText.length <= MAX_ALT_TEXT_LENGTH) return altText;
  return altText.slice(0, MAX_ALT_TEXT_LENGTH);
}

// ─── Size Selection ──────────────────────────────────────────────────────────

/**
 * Parse a CSS dimension value to a numeric pixel value.
 * Returns null if unparseable.
 */
function parseDimension(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const num = parseFloat(trimmed);
  if (isNaN(num)) return null;

  if (trimmed.endsWith('rem') || trimmed.endsWith('em')) {
    return num * 16;
  }
  // px or bare number
  return num;
}

/**
 * Determine image size based on placeholder aspect ratio.
 * All generated images use 1024×1024 (max 1024 on each axis per API constraint).
 */
export function inferSizeFromPlaceholder(_placeholder: Placeholder): DerivedImageRequest['size'] {
  return '1024x1024';
}

// ─── Hero Section Detection ──────────────────────────────────────────────────

/**
 * Detect if a placeholder is in a hero section.
 * Hero detection: check if placeholder selector or context indicates a hero section
 * (class/id containing "hero", or is the first large placeholder).
 */
export function isHeroSection(placeholder: Placeholder): boolean {
  const { selector, context } = placeholder;

  // Check selector for hero indicators
  if (selector.toLowerCase().includes('hero')) return true;

  // Check class name for hero indicators
  if (context.className && context.className.toLowerCase().includes('hero')) return true;

  // Check parent section for hero indicators
  if (context.parentSection && context.parentSection.toLowerCase().includes('hero')) return true;

  return false;
}

// ─── Subject Inference ───────────────────────────────────────────────────────

/**
 * Infer a subject from the placeholder's role/kind when no alt text or heading is available.
 */
function inferSubjectFromRole(placeholder: Placeholder): string {
  const { kind, context } = placeholder;

  // Try to infer from class name
  if (context.className) {
    const lower = context.className.toLowerCase();
    if (lower.includes('ph-img') || lower.includes('img-slot')) {
      const modifiers = lower
        .replace(/\bph-img\b/g, '')
        .replace(/\bimg-slot\b/g, '')
        .replace(/\br-\d+x\d+\b/g, '')
        .replace(/[-_]/g, ' ')
        .trim();
      if (modifiers && modifiers.length > 2) {
        return `Image related to: ${modifiers}`;
      }
      return 'A content image for the page layout';
    }

    const cleaned = context.className
      .replace(/placeholder/gi, '')
      .replace(/img-/gi, '')
      .replace(/image-/gi, '')
      .replace(/[-_]/g, ' ')
      .trim();
    if (cleaned && cleaned.length > 2) {
      return `Image related to: ${cleaned}`;
    }
  }

  // Try to infer from sibling text
  if (context.siblingText) {
    const snippet = sanitize(context.siblingText).slice(0, 200);
    if (snippet) {
      return `Image illustrating: ${snippet}`;
    }
  }

  // Try to infer from aria-label
  if (context.ariaLabel) {
    return sanitize(context.ariaLabel).slice(0, 200);
  }

  // Try label text from image box inner content
  if (context.labelText) {
    const snippet = sanitize(context.labelText).slice(0, 200);
    if (snippet) {
      return snippet;
    }
  }

  // Fallback based on kind
  switch (kind) {
    case 'empty-img':
      return 'A professional photograph or illustration';
    case 'color-block':
      return 'A decorative background image';
    case 'placeholder-div':
      return 'A content image';
    case 'svg-rect':
      return 'A graphic illustration';
    default:
      return 'A professional image';
  }
}

// ─── Main Functions ──────────────────────────────────────────────────────────

/**
 * Derive an image generation prompt from a single placeholder's context.
 */
export function deriveImagePrompt(req: ImagePromptRequest): DerivedImageRequest {
  const { placeholder, designSystem, direction, projectName } = req;
  const ctx = placeholder.context;
  const parts: string[] = [];

  // 1. Primary subject from alt text (if not generic)
  if (ctx.altText) {
    const sanitizedAlt = sanitize(truncateAltText(ctx.altText));
    if (sanitizedAlt && !GENERIC_ALT_TEXTS.has(sanitizedAlt.toLowerCase())) {
      parts.push(sanitizedAlt);
    }
  }

  // 1b. Label text from image boxes (ph-img, img-slot) when no alt text
  if (parts.length === 0 && ctx.labelText) {
    const sanitizedLabel = sanitize(ctx.labelText);
    if (sanitizedLabel && !GENERIC_ALT_TEXTS.has(sanitizedLabel.toLowerCase())) {
      parts.push(sanitizedLabel);
    }
  }

  // 2. Context from nearest heading
  if (ctx.nearestHeading) {
    const sanitizedHeading = sanitize(ctx.nearestHeading);
    if (sanitizedHeading) {
      parts.push(`for a section about "${sanitizedHeading}"`);
    }
  }

  // 3. Context from parent section (if no heading)
  if (ctx.parentSection && !ctx.nearestHeading) {
    const sanitizedSection = sanitize(ctx.parentSection).slice(0, 200);
    if (sanitizedSection) {
      parts.push(`in the context of: ${sanitizedSection}`);
    }
  }

  // 4. Fallback: infer subject from element role/kind
  if (parts.length === 0) {
    parts.push(inferSubjectFromRole(placeholder));
  }

  // 5. Project name context
  if (projectName) {
    parts.push(`for the project "${sanitize(projectName)}"`);
  }

  // 6. Style suffix from design system / visual direction
  if (direction) {
    const vibe = sanitize(direction.vibe);
    const tagline = sanitize(direction.tagline);
    if (vibe && tagline) {
      parts.push(`Style: ${vibe}, ${tagline}`);
    } else if (vibe) {
      parts.push(`Style: ${vibe}`);
    }
  } else if (designSystem) {
    const vibe = sanitize(designSystem.vibe);
    if (vibe) {
      parts.push(`Style: ${vibe}`);
    }
  }

  // 7. Always append quality suffix
  parts.push(QUALITY_SUFFIX);

  // Join and cap at MAX_PROMPT_LENGTH
  let prompt = parts.join('. ');
  if (prompt.length > MAX_PROMPT_LENGTH) {
    prompt = prompt.slice(0, MAX_PROMPT_LENGTH);
  }

  const size = inferSizeFromPlaceholder(placeholder);
  const quality = isHeroSection(placeholder) ? 'high' as const : 'medium' as const;

  return {
    prompt,
    size,
    quality,
    placeholderSelector: placeholder.selector,
  };
}

/**
 * Derive image generation prompts for multiple placeholders.
 * Deduplicates near-identical prompts for repeated layouts.
 */
export function deriveImagePrompts(
  placeholders: Placeholder[],
  opts: { designSystem?: DesignSystemSummary; direction?: VisualDirection; projectName?: string }
): DerivedImageRequest[] {
  const results: DerivedImageRequest[] = [];
  const seenPrompts = new Map<string, number>(); // prompt text → index of first occurrence

  for (const placeholder of placeholders) {
    const derived = deriveImagePrompt({
      placeholder,
      designSystem: opts.designSystem,
      direction: opts.direction,
      projectName: opts.projectName,
    });

    // Deduplication: if two prompts are identical, keep both but they can share generation
    // We still include them in results (each with their own selector) but track duplicates
    const existingIndex = seenPrompts.get(derived.prompt);
    if (existingIndex === undefined) {
      seenPrompts.set(derived.prompt, results.length);
    }
    // Always push — deduplication is informational, both entries are kept
    results.push(derived);
  }

  return results;
}
