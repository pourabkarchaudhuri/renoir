/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Placeholder } from '../src/lib/image-placeholders';
import {
  deriveImagePrompt,
  deriveImagePrompts,
  inferSizeFromPlaceholder,
  isHeroSection,
  sanitize,
  type ImagePromptRequest,
  type DesignSystemSummary,
  type VisualDirection,
} from '../src/lib/image-prompts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlaceholder(overrides: Partial<Placeholder> = {}): Placeholder {
  return {
    selector: 'body > div > img:nth-of-type(1)',
    kind: 'empty-img',
    sizing: { width: '200px', height: '150px' },
    context: { altText: 'A sunset over mountains' },
    ...overrides,
  };
}

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe('deriveImagePrompt', () => {
  describe('prompt derivation from context', () => {
    it('uses alt text as primary subject when non-generic', () => {
      const placeholder = makePlaceholder({ context: { altText: 'Team photo at office' } });
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt).toContain('Team photo at office');
    });

    it('uses labelText from ph-img when alt text is absent', () => {
      const placeholder = makePlaceholder({
        kind: 'placeholder-div',
        context: { className: 'ph-img wide', labelText: 'Hero visual' },
        sizing: { aspectRatio: '16 / 9' },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt).toContain('Hero visual');
    });

    it('ignores generic alt text like "placeholder"', () => {
      const placeholder = makePlaceholder({ context: { altText: 'placeholder' } });
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt).not.toContain('"placeholder"');
    });

    it('ignores generic alt text like "image"', () => {
      const placeholder = makePlaceholder({ context: { altText: 'image' } });
      const result = deriveImagePrompt({ placeholder });
      // Should use fallback inference instead
      expect(result.prompt.length).toBeGreaterThan(0);
    });

    it('incorporates nearest heading', () => {
      const placeholder = makePlaceholder({
        context: { altText: 'Product shot', nearestHeading: 'Our Products' },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt).toContain('Our Products');
    });

    it('uses parent section when no heading available', () => {
      const placeholder = makePlaceholder({
        context: { altText: 'Hero image', parentSection: 'section#about' },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt).toContain('section#about');
    });

    it('does not use parent section when heading is available', () => {
      const placeholder = makePlaceholder({
        context: {
          altText: 'Hero image',
          nearestHeading: 'About Us',
          parentSection: 'section#about',
        },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt).toContain('About Us');
      expect(result.prompt).not.toContain('section#about');
    });

    it('falls back to role inference when no alt text or heading', () => {
      const placeholder = makePlaceholder({
        kind: 'color-block',
        context: { className: 'bg-block' },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt.length).toBeGreaterThan(0);
    });

    it('always appends quality suffix', () => {
      const placeholder = makePlaceholder();
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt).toContain('Professional quality, clean composition, no text overlays or watermarks.');
    });
  });

  describe('aspect-ratio-based size selection', () => {
    it('always uses 1024x1024 regardless of landscape sizing', () => {
      const placeholder = makePlaceholder({ sizing: { width: '500px', height: '300px' } });
      const result = deriveImagePrompt({ placeholder });
      expect(result.size).toBe('1024x1024');
    });

    it('always uses 1024x1024 regardless of portrait sizing', () => {
      const placeholder = makePlaceholder({ sizing: { width: '300px', height: '500px' } });
      const result = deriveImagePrompt({ placeholder });
      expect(result.size).toBe('1024x1024');
    });

    it('selects 1024x1024 for square', () => {
      const placeholder = makePlaceholder({ sizing: { width: '300px', height: '300px' } });
      const result = deriveImagePrompt({ placeholder });
      expect(result.size).toBe('1024x1024');
    });

    it('selects 1024x1024 when dimensions are unknown', () => {
      const placeholder = makePlaceholder({ sizing: {} });
      const result = deriveImagePrompt({ placeholder });
      expect(result.size).toBe('1024x1024');
    });

    it('uses 1024x1024 when only aspect-ratio is set', () => {
      const placeholder = makePlaceholder({ sizing: { aspectRatio: '16/9' } });
      const result = deriveImagePrompt({ placeholder });
      expect(result.size).toBe('1024x1024');
    });
  });

  describe('design system / visual direction style suffix', () => {
    it('appends visual direction vibe and tagline', () => {
      const placeholder = makePlaceholder();
      const direction: VisualDirection = { vibe: 'Modern minimalist', tagline: 'Clean and bold' };
      const result = deriveImagePrompt({ placeholder, direction });
      expect(result.prompt).toContain('Style: Modern minimalist, Clean and bold');
    });

    it('appends design system vibe when no direction', () => {
      const placeholder = makePlaceholder();
      const designSystem: DesignSystemSummary = { vibe: 'Corporate professional' };
      const result = deriveImagePrompt({ placeholder, designSystem });
      expect(result.prompt).toContain('Style: Corporate professional');
    });

    it('prefers direction over design system', () => {
      const placeholder = makePlaceholder();
      const direction: VisualDirection = { vibe: 'Playful', tagline: 'Fun and colorful' };
      const designSystem: DesignSystemSummary = { vibe: 'Corporate' };
      const result = deriveImagePrompt({ placeholder, direction, designSystem });
      expect(result.prompt).toContain('Style: Playful, Fun and colorful');
      expect(result.prompt).not.toContain('Corporate');
    });
  });

  describe('prompt sanitization', () => {
    it('strips HTML tags from alt text', () => {
      const placeholder = makePlaceholder({
        context: { altText: 'A <b>bold</b> image <script>alert("xss")</script>' },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt).not.toContain('<b>');
      expect(result.prompt).not.toContain('</b>');
      expect(result.prompt).not.toContain('<script>');
      expect(result.prompt).not.toContain('alert');
    });

    it('strips script content from heading', () => {
      const placeholder = makePlaceholder({
        context: {
          altText: 'Photo',
          nearestHeading: 'Title <script>document.cookie</script> Section',
        },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.prompt).not.toContain('<script>');
      expect(result.prompt).not.toContain('document.cookie');
    });

    it('truncates alt text to 500 characters', () => {
      const longAlt = 'A'.repeat(600);
      const placeholder = makePlaceholder({ context: { altText: longAlt } });
      const result = deriveImagePrompt({ placeholder });
      // The alt text portion should be at most 500 chars
      // The full prompt includes other parts, but the alt text contribution is capped
      expect(result.prompt.length).toBeLessThanOrEqual(4000);
    });
  });

  describe('prompt length capping', () => {
    it('caps prompt at 4000 characters', () => {
      const longAlt = 'A'.repeat(500);
      const longHeading = 'B'.repeat(500);
      const longSection = 'C'.repeat(3500);
      const placeholder = makePlaceholder({
        context: {
          altText: longAlt,
          nearestHeading: longHeading,
          siblingText: longSection,
        },
      });
      const direction: VisualDirection = { vibe: 'D'.repeat(200), tagline: 'E'.repeat(200) };
      const result = deriveImagePrompt({ placeholder, direction, projectName: 'F'.repeat(200) });
      expect(result.prompt.length).toBeLessThanOrEqual(4000);
    });
  });

  describe('hero section detection', () => {
    it('sets quality to high for hero section (class)', () => {
      const placeholder = makePlaceholder({
        context: { altText: 'Hero banner', className: 'hero-image' },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.quality).toBe('high');
    });

    it('sets quality to high for hero section (selector)', () => {
      const placeholder = makePlaceholder({
        selector: 'body > section.hero > img',
        context: { altText: 'Banner' },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.quality).toBe('high');
    });

    it('sets quality to high for hero section (parent section)', () => {
      const placeholder = makePlaceholder({
        context: { altText: 'Banner', parentSection: 'section.hero-section' },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.quality).toBe('high');
    });

    it('sets quality to medium for non-hero sections', () => {
      const placeholder = makePlaceholder({
        context: { altText: 'Team photo', className: 'team-image' },
      });
      const result = deriveImagePrompt({ placeholder });
      expect(result.quality).toBe('medium');
    });
  });

  describe('placeholderSelector', () => {
    it('returns the placeholder selector in the result', () => {
      const placeholder = makePlaceholder({ selector: 'body > div > img:nth-of-type(2)' });
      const result = deriveImagePrompt({ placeholder });
      expect(result.placeholderSelector).toBe('body > div > img:nth-of-type(2)');
    });
  });
});

describe('deriveImagePrompts', () => {
  it('derives prompts for multiple placeholders', () => {
    const placeholders: Placeholder[] = [
      makePlaceholder({ selector: 'sel1', context: { altText: 'First image' } }),
      makePlaceholder({ selector: 'sel2', context: { altText: 'Second image' } }),
    ];
    const results = deriveImagePrompts(placeholders, {});
    expect(results).toHaveLength(2);
    expect(results[0].placeholderSelector).toBe('sel1');
    expect(results[1].placeholderSelector).toBe('sel2');
  });

  it('keeps duplicate prompts (both entries preserved)', () => {
    const placeholders: Placeholder[] = [
      makePlaceholder({ selector: 'sel1', context: { altText: 'Card image' }, sizing: { width: '200px', height: '200px' } }),
      makePlaceholder({ selector: 'sel2', context: { altText: 'Card image' }, sizing: { width: '200px', height: '200px' } }),
    ];
    const results = deriveImagePrompts(placeholders, {});
    expect(results).toHaveLength(2);
    expect(results[0].prompt).toBe(results[1].prompt);
    expect(results[0].placeholderSelector).toBe('sel1');
    expect(results[1].placeholderSelector).toBe('sel2');
  });

  it('passes design system and direction to each prompt', () => {
    const placeholders: Placeholder[] = [
      makePlaceholder({ selector: 'sel1', context: { altText: 'Photo' } }),
    ];
    const direction: VisualDirection = { vibe: 'Elegant', tagline: 'Refined taste' };
    const results = deriveImagePrompts(placeholders, { direction });
    expect(results[0].prompt).toContain('Style: Elegant, Refined taste');
  });
});

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('Hello <b>world</b>')).toBe('Hello world');
  });

  it('strips script tags and content', () => {
    expect(sanitize('Before <script>alert("xss")</script> After')).toBe('Before After');
  });

  it('handles empty input', () => {
    expect(sanitize('')).toBe('');
  });

  it('collapses whitespace', () => {
    expect(sanitize('  hello   world  ')).toBe('hello world');
  });
});

describe('inferSizeFromPlaceholder', () => {
  it('always returns 1024x1024 (max 1024 per axis)', () => {
    expect(inferSizeFromPlaceholder(makePlaceholder({ sizing: { width: '600px', height: '400px' } }))).toBe('1024x1024');
    expect(inferSizeFromPlaceholder(makePlaceholder({ sizing: { width: '400px', height: '600px' } }))).toBe('1024x1024');
    expect(inferSizeFromPlaceholder(makePlaceholder({ sizing: { aspectRatio: '16 / 9' } }))).toBe('1024x1024');
  });
});

describe('isHeroSection', () => {
  it('detects hero from class name', () => {
    const p = makePlaceholder({ context: { className: 'hero-banner' } });
    expect(isHeroSection(p)).toBe(true);
  });

  it('detects hero from selector', () => {
    const p = makePlaceholder({ selector: 'body > .hero > img' });
    expect(isHeroSection(p)).toBe(true);
  });

  it('detects hero from parent section', () => {
    const p = makePlaceholder({ context: { parentSection: 'section.hero-area' } });
    expect(isHeroSection(p)).toBe(true);
  });

  it('returns false for non-hero', () => {
    const p = makePlaceholder({ context: { className: 'team-photo' } });
    expect(isHeroSection(p)).toBe(false);
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('deriveImagePrompt — property-based tests', () => {
  // Arbitrary generators
  const kindArb = fc.constantFrom('empty-img', 'color-block', 'placeholder-div', 'svg-rect') as fc.Arbitrary<Placeholder['kind']>;

  const sizingArb = fc.record({
    width: fc.oneof(
      fc.integer({ min: 32, max: 2000 }).map((n) => `${n}px`),
      fc.constant(undefined)
    ),
    height: fc.oneof(
      fc.integer({ min: 32, max: 2000 }).map((n) => `${n}px`),
      fc.constant(undefined)
    ),
    aspectRatio: fc.oneof(
      fc.tuple(fc.integer({ min: 1, max: 32 }), fc.integer({ min: 1, max: 32 })).map(([w, h]) => `${w}/${h}`),
      fc.constant(undefined)
    ),
  });

  const contextArb = fc.record({
    altText: fc.oneof(fc.string({ minLength: 0, maxLength: 600 }), fc.constant(undefined)),
    nearestHeading: fc.oneof(fc.string({ minLength: 0, maxLength: 200 }), fc.constant(undefined)),
    parentSection: fc.oneof(fc.string({ minLength: 0, maxLength: 200 }), fc.constant(undefined)),
    siblingText: fc.oneof(fc.string({ minLength: 0, maxLength: 500 }), fc.constant(undefined)),
    ariaLabel: fc.oneof(fc.string({ minLength: 0, maxLength: 200 }), fc.constant(undefined)),
    className: fc.oneof(fc.string({ minLength: 0, maxLength: 100 }), fc.constant(undefined)),
  });

  const placeholderArb: fc.Arbitrary<Placeholder> = fc.record({
    selector: fc.string({ minLength: 1, maxLength: 100 }).map((s) => `body > div > ${s}`),
    kind: kindArb,
    sizing: sizingArb,
    context: contextArb,
  });

  const designSystemArb: fc.Arbitrary<DesignSystemSummary | undefined> = fc.oneof(
    fc.record({
      vibe: fc.string({ minLength: 1, maxLength: 100 }),
      swatches: fc.oneof(fc.array(fc.string({ minLength: 1, maxLength: 7 }), { maxLength: 5 }), fc.constant(undefined)),
    }),
    fc.constant(undefined)
  );

  const directionArb: fc.Arbitrary<VisualDirection | undefined> = fc.oneof(
    fc.record({
      vibe: fc.string({ minLength: 1, maxLength: 100 }),
      tagline: fc.string({ minLength: 1, maxLength: 100 }),
    }),
    fc.constant(undefined)
  );

  /**
   * **Validates: Requirements 2.5**
   * Property 3: Prompt length bound — prompts ≤ 4000 chars regardless of input.
   */
  it('Property 3: prompt length is always ≤ 4000 characters', () => {
    fc.assert(
      fc.property(
        placeholderArb,
        designSystemArb,
        directionArb,
        fc.oneof(fc.string({ minLength: 0, maxLength: 200 }), fc.constant(undefined)),
        (placeholder, designSystem, direction, projectName) => {
          const result = deriveImagePrompt({ placeholder, designSystem, direction, projectName });
          expect(result.prompt.length).toBeLessThanOrEqual(4000);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 2.6, 2.7, 2.8**
   * Property 4: Aspect-ratio-based size selection correctness.
   */
  it('Property 4: size selection is always 1024x1024 (max 1024 per axis)', () => {
    const dimensionedSizingArb = fc.record({
      width: fc.integer({ min: 32, max: 2000 }).map((n) => `${n}px`),
      height: fc.integer({ min: 32, max: 2000 }).map((n) => `${n}px`),
    });

    fc.assert(
      fc.property(dimensionedSizingArb, ({ width, height }) => {
        const placeholder = makePlaceholder({ sizing: { width, height } });
        const result = deriveImagePrompt({ placeholder });
        expect(result.size).toBe('1024x1024');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * Property 5: Prompt incorporates available context (alt text, heading).
   */
  it('Property 5: prompt incorporates non-generic alt text and heading when available', () => {
    const nonGenericAltArb = fc.string({ minLength: 5, maxLength: 100 }).filter(
      (s) => !['placeholder', 'image', 'img', 'photo', 'picture'].includes(s.toLowerCase().trim())
        && !s.includes('<') && !s.includes('>')
        && s.trim().length > 0
    );

    const headingArb = fc.string({ minLength: 3, maxLength: 100 }).filter(
      (s) => !s.includes('<') && !s.includes('>') && s.trim().length > 0
    );

    fc.assert(
      fc.property(nonGenericAltArb, headingArb, (altText, heading) => {
        // Test alt text incorporation (sanitize collapses whitespace)
        const p1 = makePlaceholder({ context: { altText } });
        const r1 = deriveImagePrompt({ placeholder: p1 });
        expect(r1.prompt).toContain(sanitize(altText));

        // Test heading incorporation
        const p2 = makePlaceholder({ context: { altText: 'Some subject', nearestHeading: heading } });
        const r2 = deriveImagePrompt({ placeholder: p2 });
        expect(r2.prompt).toContain(sanitize(heading));
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5b: prompt is non-empty even with no alt text or heading', () => {
    fc.assert(
      fc.property(kindArb, (kind) => {
        const placeholder = makePlaceholder({ kind, context: {} });
        const result = deriveImagePrompt({ placeholder });
        expect(result.prompt.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 2.10**
   * Property 6: Prompt sanitization — no HTML tags or script content in output.
   */
  it('Property 6: prompt contains no HTML tags or script content', () => {
    const htmlInjectionArb = fc.oneof(
      fc.string({ minLength: 1, maxLength: 50 }).map((s) => `<b>${s}</b>`),
      fc.string({ minLength: 1, maxLength: 50 }).map((s) => `<script>${s}</script>`),
      fc.string({ minLength: 1, maxLength: 50 }).map((s) => `<div class="x">${s}</div>`),
      fc.string({ minLength: 1, maxLength: 50 }).map((s) => `<img src="x" onerror="${s}">`),
      fc.string({ minLength: 1, maxLength: 200 }),
    );

    fc.assert(
      fc.property(htmlInjectionArb, htmlInjectionArb, (altText, heading) => {
        const placeholder = makePlaceholder({
          context: { altText, nearestHeading: heading },
        });
        const result = deriveImagePrompt({ placeholder });

        // No HTML tags in output
        expect(result.prompt).not.toMatch(/<[^>]+>/);
        // No script content
        expect(result.prompt).not.toMatch(/<script/i);
        expect(result.prompt).not.toMatch(/<\/script/i);
      }),
      { numRuns: 200 }
    );
  });
});
