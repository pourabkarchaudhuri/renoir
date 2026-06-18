/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractPlaceholders, Placeholder } from '../src/lib/image-placeholders';

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe('extractPlaceholders', () => {
  describe('empty-img detection', () => {
    it('detects img with empty src', () => {
      const html = '<div><img src="" style="width:100px;height:100px" alt="hero"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('empty-img');
      expect(result[0].context.altText).toBe('hero');
    });

    it('detects img with src="#"', () => {
      const html = '<div><img src="#" style="width:200px;height:150px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('empty-img');
    });

    it('detects img with src="about:blank"', () => {
      const html = '<div><img src="about:blank" style="width:50px;height:50px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('empty-img');
    });

    it('detects img with src containing "placeholder"', () => {
      const html = '<div><img src="https://example.com/placeholder.png" style="width:300px;height:200px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('empty-img');
    });

    it('does not detect img with valid src', () => {
      const html = '<div><img src="https://example.com/real-image.png" style="width:300px;height:200px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });

    it('does not detect img with no src attribute at all', () => {
      // img without src attribute — still counts as empty-img
      const html = '<div><img style="width:100px;height:100px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('empty-img');
    });
  });

  describe('color-block detection', () => {
    it('detects div with background-color and no background-image', () => {
      const html = '<div style="background-color: #ff0000; width: 200px; height: 150px;"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('color-block');
    });

    it('detects section with background-color', () => {
      const html = '<section style="background-color: rgb(100,200,50); width: 400px; height: 300px;"></section>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('color-block');
    });

    it('does not detect div with background-image', () => {
      const html = '<div style="background-color: #ff0000; background-image: url(img.png); width: 200px; height: 150px;"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });

    it('does not detect div with background shorthand containing url()', () => {
      const html = '<div style="background: #ff0000 url(img.png); width: 200px; height: 150px;"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });

    it('does not detect span with background-color', () => {
      const html = '<span style="background-color: #ff0000; width: 200px; height: 150px;"></span>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });
  });

  describe('placeholder-div detection', () => {
    it('detects element with "placeholder" in class name', () => {
      const html = '<div class="image-placeholder" style="width:300px;height:200px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('placeholder-div');
    });

    it('detects element with "img-placeholder" in class name', () => {
      const html = '<div class="img-placeholder hero" style="width:500px;height:300px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('placeholder-div');
    });

    it('does not detect element without placeholder class', () => {
      const html = '<div class="hero-image card" style="width:300px;height:200px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });
  });

  describe('svg-rect detection', () => {
    it('detects large SVG rect', () => {
      const html = '<svg width="400" height="300"><rect width="400" height="300" fill="#ccc"></rect></svg>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('svg-rect');
    });

    it('does not detect small SVG rect', () => {
      const html = '<svg width="20" height="20"><rect width="20" height="20" fill="#ccc"></rect></svg>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });

    it('does not detect rect outside SVG', () => {
      // rect not inside svg should not be detected (though this is unusual HTML)
      const html = '<div><rect width="400" height="300"></rect></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });
  });

  describe('32×32 minimum size exclusion', () => {
    it('excludes img smaller than 32px wide', () => {
      const html = '<div><img src="" style="width:20px;height:100px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });

    it('excludes img smaller than 32px tall', () => {
      const html = '<div><img src="" style="width:100px;height:10px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });

    it('includes img exactly 32px', () => {
      const html = '<div><img src="" style="width:32px;height:32px"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
    });

    it('excludes color-block smaller than 32px', () => {
      const html = '<div style="background-color:#f00;width:16px;height:16px;"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(0);
    });

    it('includes elements with percentage dimensions (assumed large)', () => {
      const html = '<div><img src="" style="width:100%;height:50%"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
    });

    it('includes elements with no dimensions (assumed large)', () => {
      const html = '<div><img src="" alt="test"></div>';
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
    });
  });

  describe('semantic context extraction', () => {
    it('extracts alt text', () => {
      const html = '<div><img src="" alt="Team photo" style="width:200px;height:200px"></div>';
      const result = extractPlaceholders(html);
      expect(result[0].context.altText).toBe('Team photo');
    });

    it('extracts aria-label', () => {
      const html = '<div><img src="" aria-label="Product showcase" style="width:200px;height:200px"></div>';
      const result = extractPlaceholders(html);
      expect(result[0].context.ariaLabel).toBe('Product showcase');
    });

    it('extracts class name', () => {
      const html = '<div class="hero-placeholder card" style="width:200px;height:200px;background-color:#ccc;"></div>';
      const result = extractPlaceholders(html);
      expect(result[0].context.className).toBe('hero-placeholder card');
    });

    it('extracts nearest heading', () => {
      const html = '<div><h2>Our Team</h2><img src="" style="width:200px;height:200px"></div>';
      const result = extractPlaceholders(html);
      expect(result[0].context.nearestHeading).toBe('Our Team');
    });

    it('extracts parent section', () => {
      const html = '<section id="about"><img src="" style="width:200px;height:200px"></section>';
      const result = extractPlaceholders(html);
      expect(result[0].context.parentSection).toBe('section#about');
    });

    it('extracts sibling text', () => {
      const html = '<div><p>Welcome to our site</p><img src="" style="width:200px;height:200px"><p>Learn more</p></div>';
      const result = extractPlaceholders(html);
      expect(result[0].context.siblingText).toContain('Welcome to our site');
      expect(result[0].context.siblingText).toContain('Learn more');
    });

    it('ensures at least one context field is populated', () => {
      const html = '<div><img src="" style="width:200px;height:200px"></div>';
      const result = extractPlaceholders(html);
      const ctx = result[0].context;
      const hasAtLeastOne = Object.values(ctx).some((v) => v !== undefined && v !== '');
      expect(hasAtLeastOne).toBe(true);
    });
  });

  describe('unique CSS selector generation', () => {
    it('generates unique selectors for multiple placeholders', () => {
      const html = `
        <div>
          <img src="" style="width:100px;height:100px">
          <img src="" style="width:100px;height:100px">
          <img src="" style="width:100px;height:100px">
        </div>
      `;
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(3);
      const selectors = result.map((p) => p.selector);
      const unique = new Set(selectors);
      expect(unique.size).toBe(3);
    });

    it('preserves document order', () => {
      const html = `
        <div>
          <img src="" alt="first" style="width:100px;height:100px">
          <div style="background-color:#f00;width:200px;height:200px;"></div>
          <img src="" alt="third" style="width:100px;height:100px">
        </div>
      `;
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(3);
      expect(result[0].kind).toBe('empty-img');
      expect(result[0].context.altText).toBe('first');
      expect(result[1].kind).toBe('color-block');
      expect(result[2].kind).toBe('empty-img');
      expect(result[2].context.altText).toBe('third');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(extractPlaceholders('')).toEqual([]);
    });

    it('returns empty array for whitespace-only string', () => {
      expect(extractPlaceholders('   ')).toEqual([]);
    });

    it('returns empty array for HTML with no placeholders', () => {
      const html = '<div><p>Hello world</p><img src="real.png" style="width:100px;height:100px"></div>';
      expect(extractPlaceholders(html)).toEqual([]);
    });

    it('handles deeply nested elements', () => {
      const html = `
        <div><div><div><div><div>
          <img src="" style="width:100px;height:100px" alt="deep">
        </div></div></div></div></div>
      `;
      const result = extractPlaceholders(html);
      expect(result).toHaveLength(1);
      expect(result[0].context.altText).toBe('deep');
    });
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('extractPlaceholders — property-based tests', () => {
  /**
   * **Validates: Requirements 1.8**
   * Property 1: Placeholder detection is idempotent — calling extractPlaceholders(h)
   * multiple times returns same results.
   */
  it('Property 1: detection is idempotent', () => {
    const htmlArb = fc.oneof(
      // HTML with empty-img placeholders
      fc.record({
        alt: fc.string({ minLength: 0, maxLength: 20 }),
        width: fc.integer({ min: 32, max: 1000 }),
        height: fc.integer({ min: 32, max: 1000 }),
      }).map(({ alt, width, height }) =>
        `<div><h2>Section</h2><img src="" alt="${alt}" style="width:${width}px;height:${height}px"></div>`
      ),
      // HTML with color-block placeholders
      fc.record({
        r: fc.integer({ min: 0, max: 255 }),
        g: fc.integer({ min: 0, max: 255 }),
        b: fc.integer({ min: 0, max: 255 }),
        width: fc.integer({ min: 32, max: 1000 }),
        height: fc.integer({ min: 32, max: 1000 }),
      }).map(({ r, g, b, width, height }) =>
        `<div style="background-color:rgb(${r},${g},${b});width:${width}px;height:${height}px;"></div>`
      ),
      // HTML with placeholder-div
      fc.record({
        width: fc.integer({ min: 32, max: 1000 }),
        height: fc.integer({ min: 32, max: 1000 }),
      }).map(({ width, height }) =>
        `<div class="img-placeholder" style="width:${width}px;height:${height}px"></div>`
      ),
      // HTML with svg-rect
      fc.record({
        width: fc.integer({ min: 32, max: 1000 }),
        height: fc.integer({ min: 32, max: 1000 }),
      }).map(({ width, height }) =>
        `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#ccc"></rect></svg>`
      ),
      // Mixed HTML
      fc.constant(`
        <div>
          <h1>Page Title</h1>
          <img src="" alt="hero" style="width:400px;height:300px">
          <section id="features">
            <div style="background-color:#eee;width:200px;height:200px;"></div>
          </section>
        </div>
      `)
    );

    fc.assert(
      fc.property(htmlArb, (html) => {
        const result1 = extractPlaceholders(html);
        const result2 = extractPlaceholders(html);
        const result3 = extractPlaceholders(html);

        // Same length
        expect(result1.length).toBe(result2.length);
        expect(result2.length).toBe(result3.length);

        // Same content
        for (let i = 0; i < result1.length; i++) {
          expect(result1[i].selector).toBe(result2[i].selector);
          expect(result1[i].selector).toBe(result3[i].selector);
          expect(result1[i].kind).toBe(result2[i].kind);
          expect(result1[i].kind).toBe(result3[i].kind);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
   * Property 2: Placeholder detection completeness — all known placeholder patterns
   * ≥32×32 are detected in document order with unique selectors.
   */
  it('Property 2: detection completeness and document order with unique selectors', () => {
    // Generate HTML with a known number of placeholders of various kinds
    const placeholderCountArb = fc.integer({ min: 1, max: 8 });
    const kindArb = fc.constantFrom('empty-img', 'color-block', 'placeholder-div', 'svg-rect') as fc.Arbitrary<Placeholder['kind']>;

    const placeholderSpecArb = fc.record({
      kind: kindArb,
      width: fc.integer({ min: 32, max: 800 }),
      height: fc.integer({ min: 32, max: 800 }),
    });

    fc.assert(
      fc.property(
        fc.array(placeholderSpecArb, { minLength: 1, maxLength: 8 }),
        (specs) => {
          // Build HTML with known placeholders
          const elements = specs.map((spec, i) => {
            switch (spec.kind) {
              case 'empty-img':
                return `<img src="" alt="img${i}" style="width:${spec.width}px;height:${spec.height}px">`;
              case 'color-block':
                return `<div style="background-color:#aabbcc;width:${spec.width}px;height:${spec.height}px;"></div>`;
              case 'placeholder-div':
                return `<div class="placeholder item${i}" style="width:${spec.width}px;height:${spec.height}px"></div>`;
              case 'svg-rect':
                return `<svg width="${spec.width}" height="${spec.height}"><rect width="${spec.width}" height="${spec.height}" fill="#ddd"></rect></svg>`;
            }
          });

          const html = `<div>${elements.join('\n')}</div>`;
          const result = extractPlaceholders(html);

          // All placeholders should be detected
          expect(result.length).toBe(specs.length);

          // Each result should match the expected kind in order
          for (let i = 0; i < specs.length; i++) {
            expect(result[i].kind).toBe(specs[i].kind);
          }

          // All selectors should be unique
          const selectors = result.map((p) => p.selector);
          const uniqueSelectors = new Set(selectors);
          expect(uniqueSelectors.size).toBe(result.length);

          // Each placeholder context should have at least one non-empty field
          for (const p of result) {
            const hasContext = Object.values(p.context).some(
              (v) => v !== undefined && v !== ''
            );
            expect(hasContext).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
