/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { replacePlaceholders, type ReplacementResult } from '../src/lib/image-replacer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a small valid data URI for testing */
function makeDataUrl(size: 'small' | 'large' = 'small'): string {
  if (size === 'large') {
    // Create a data URI > 512KB (524288 chars)
    const base64 = 'A'.repeat(524300);
    return `data:image/png;base64,${base64}`;
  }
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

/** Count elements in an HTML string using DOMParser */
function countElements(html: string): number {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.querySelectorAll('*').length;
}

/** Get the nesting structure of an HTML string as a serialized tree */
function getStructure(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function walk(el: Element, depth: number): string {
    const children = Array.from(el.children);
    const childStr = children.map((c) => walk(c, depth + 1)).join(',');
    return `${el.tagName}(${childStr})`;
  }

  return walk(doc.body, 0);
}

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe('replacePlaceholders', () => {
  describe('img element replacement', () => {
    it('sets src to data URI for img elements', () => {
      const html = '<div><img src="" style="width:200px;height:150px" alt="hero"></div>';
      const results = new Map([
        ['body > div > img', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.html).toContain('src="data:image/png;base64,');
    });

    it('sets src to renoir-asset:// path when data URI exceeds 512KB', () => {
      const html = '<div><img src="" style="width:200px;height:150px"></div>';
      const results = new Map([
        ['body > div > img', { dataUrl: makeDataUrl('large'), savedPath: 'images/hero.png' }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(1);
      expect(result.html).toContain('src="renoir-asset://images/hero.png"');
      expect(result.html).not.toContain('data:image/png;base64,');
    });

    it('uses data URI even when large if no savedPath available', () => {
      const html = '<div><img src="" style="width:200px;height:150px"></div>';
      const largeDataUrl = makeDataUrl('large');
      const results = new Map([
        ['body > div > img', { dataUrl: largeDataUrl }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(1);
      expect(result.html).toContain('data:image/png;base64,');
    });

    it('preserves width and height attributes on img via frame aspect-ratio', () => {
      const html = '<div><img src="" width="300" height="200" alt="test"></div>';
      const results = new Map([
        ['body > div > img', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('frame-img');
      expect(result.html).toContain('aspect-ratio:300 / 200');
      expect(result.html).toContain('src="data:image/png;base64,');
    });

    it('preserves inline style dimensions on img via the frame', () => {
      const html = '<div><img src="" style="width:400px;height:300px"></div>';
      const results = new Map([
        ['body > div > img', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('width:400px');
      expect(result.html).toContain('height:300px');
      expect(result.html).toContain('frame-img');
    });

    it('wraps bare imgs in a frame-img figure', () => {
      const html = '<div><img src="" alt="hero"></div>';
      const results = new Map([
        ['body > div > img', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toMatch(/<figure[^>]*class="[^"]*frame-img/);
      expect(result.html).toContain('object-fit:cover');
      expect(result.html).toContain('object-position:center center');
      expect(result.html).toContain('renoir-image-frame-styles');
    });

    it('keeps imgs already inside slide-visual without double-wrapping', () => {
      const html = '<div class="slide-visual"><img src="" class="slide-image" width="960" height="540" alt="scene"></div>';
      const results = new Map([
        ['body > div > img', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('slide-visual');
      expect(result.html).not.toMatch(/<figure[^>]*frame-img/);
      expect(result.html).toContain('object-fit:cover');
    });
  });

  describe('color-block div replacement', () => {
    it('promotes color blocks to framed images', () => {
      const html = '<div style="background-color: #ff0000; width: 200px; height: 150px;"></div>';
      const results = new Map([
        ['body > div', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(1);
      expect(result.html).toContain('renoir-img-frame');
      expect(result.html).toContain('<img');
      expect(result.html).toContain('object-fit:cover');
      expect(result.html).toContain('src="data:image/png;base64,');
    });

    it('preserves width and height in style', () => {
      const html = '<div style="background-color: #ff0000; width: 200px; height: 150px;"></div>';
      const results = new Map([
        ['body > div', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('width: 200px');
      expect(result.html).toContain('height: 150px');
    });

    it('works with section elements', () => {
      const html = '<section style="background-color: rgb(100,200,50); width: 400px; height: 300px;"></section>';
      const results = new Map([
        ['body > section', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(1);
      expect(result.html).toContain('<img');
      expect(result.html).toContain('renoir-img-frame');
    });

    it('uses renoir-asset:// for large images in color blocks', () => {
      const html = '<div style="background-color: #ccc; width: 800px; height: 600px;"></div>';
      const results = new Map([
        ['body > div', { dataUrl: makeDataUrl('large'), savedPath: 'images/bg.png' }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('renoir-asset://images/bg.png');
    });
  });

  describe('layout dimension preservation', () => {
    it('does not alter frame dimensions during replacement', () => {
      const html = '<div><img src="" style="width:400px;height:300px;margin:10px" alt="test"></div>';
      const results = new Map([
        ['body > div > img', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('width:400px');
      expect(result.html).toContain('height:300px');
      expect(result.html).toContain('frame-img');
    });

    it('preserves other style properties on color-block divs', () => {
      const html = '<div style="background-color:#f00; width:200px; height:150px; border-radius:8px; margin:16px;"></div>';
      const results = new Map([
        ['body > div', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('width:200px');
      expect(result.html).toContain('height:150px');
      expect(result.html).toContain('border-radius:8px');
      expect(result.html).toContain('margin:16px');
      expect(result.html).toContain('<img');
    });
  });

  describe('graceful handling of missing selectors', () => {
    it('increments failed count when selector not found', () => {
      const html = '<div><img src="" style="width:100px;height:100px"></div>';
      const results = new Map([
        ['body > div > .nonexistent', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Selector not found');
    });

    it('continues processing after a failed selector', () => {
      const html = '<div><img src="" style="width:100px;height:100px"><img src="#" style="width:100px;height:100px"></div>';
      const results = new Map([
        ['body > div > .nonexistent', { dataUrl: makeDataUrl() }],
        ['body > div > img:nth-of-type(1)', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('handles invalid CSS selectors gracefully', () => {
      const html = '<div><img src="" style="width:100px;height:100px"></div>';
      const results = new Map([
        ['[invalid selector!!!', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('reports correct counts with mixed success and failure', () => {
      const html = `
        <div>
          <img src="" style="width:100px;height:100px">
          <div style="background-color:#ccc;width:200px;height:200px;"></div>
        </div>
      `;
      const results = new Map([
        ['body > div > img', { dataUrl: makeDataUrl() }],
        ['body > div > .missing', { dataUrl: makeDataUrl() }],
        ['body > div > div', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.replaced + result.failed).toBe(results.size);
    });
  });

  describe('512KB threshold', () => {
    it('uses inline data URI when below threshold', () => {
      const html = '<div><img src="" style="width:100px;height:100px"></div>';
      const smallDataUrl = makeDataUrl('small');
      const results = new Map([
        ['body > div > img', { dataUrl: smallDataUrl, savedPath: 'images/small.png' }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain(smallDataUrl);
      expect(result.html).not.toContain('renoir-asset://');
    });

    it('uses renoir-asset:// when above threshold with savedPath', () => {
      const html = '<div><img src="" style="width:100px;height:100px"></div>';
      const results = new Map([
        ['body > div > img', { dataUrl: makeDataUrl('large'), savedPath: 'images/large.png' }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('renoir-asset://images/large.png');
    });

    it('falls back to inline data URI when above threshold but no savedPath', () => {
      const html = '<div><img src="" style="width:100px;height:100px"></div>';
      const largeDataUrl = makeDataUrl('large');
      const results = new Map([
        ['body > div > img', { dataUrl: largeDataUrl }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('data:image/png;base64,');
    });
  });

  describe('edge cases', () => {
    it('returns original HTML when results map is empty', () => {
      const html = '<div><p>Hello</p></div>';
      const results = new Map<string, { dataUrl: string; savedPath?: string }>();

      const result = replacePlaceholders(html, results);
      expect(result.html).toBe(html);
      expect(result.replaced).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('returns empty string for empty HTML input', () => {
      const results = new Map([
        ['body > img', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders('', results);
      expect(result.html).toBe('');
      expect(result.replaced).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('handles multiple replacements in same document', () => {
      const html = `
        <div>
          <img src="" style="width:100px;height:100px" alt="first">
          <img src="" style="width:200px;height:200px" alt="second">
          <div style="background-color:#ccc;width:300px;height:300px;"></div>
        </div>
      `;
      const results = new Map([
        ['body > div > img:nth-of-type(1)', { dataUrl: makeDataUrl() }],
        ['body > div > img:nth-of-type(2)', { dataUrl: makeDataUrl() }],
        ['body > div > div', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('does not modify elements not in the results map', () => {
      const html = `
        <div>
          <img src="" style="width:100px;height:100px" alt="target">
          <img src="real.png" style="width:100px;height:100px" alt="keep">
          <p>Some text</p>
        </div>
      `;
      const results = new Map([
        ['body > div > img:nth-of-type(1)', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.html).toContain('src="real.png"');
      expect(result.html).toContain('Some text');
    });

    it('handles placeholder-div elements (non-img, non-color-block)', () => {
      const html = '<div class="img-placeholder" style="width:300px;height:200px"></div>';
      const results = new Map([
        ['body > div', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(1);
      expect(result.html).toContain('<img');
      expect(result.html).toContain('renoir-img-frame');
      expect(result.html).toContain('object-fit:cover');
    });

    it('clears ph-img label text when filling image boxes', () => {
      const html = '<div class="ph-img wide" style="width:400px;height:225px">[ Hero visual · 16:9 ]</div>';
      const results = new Map([
        ['body > div', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(1);
      expect(result.html).toContain('<img');
      expect(result.html).toContain('object-fit:cover');
      expect(result.html).not.toContain('[ Hero visual');
      expect(result.html).toContain('alt="Hero visual"');
      expect(result.html).toContain('color: transparent');
    });

    it('preserves full HTML documents when replacing placeholders', () => {
      const html = `<!doctype html>
<html><head><style>.ph-img { background: linear-gradient(red, blue); }</style></head>
<body><div class="ph-img wide" style="width:400px;height:225px">[ Hero ]</div></body></html>`;
      const results = new Map([
        ['body > div', { dataUrl: makeDataUrl() }],
      ]);

      const result = replacePlaceholders(html, results);
      expect(result.replaced).toBe(1);
      expect(result.html).toMatch(/^<!doctype html>/i);
      expect(result.html).toContain('<html');
      expect(result.html).toContain('<head>');
      expect(result.html).toContain('<style>.ph-img');
      expect(result.html).toContain('<img');
      expect(result.html).toContain('renoir-image-frame-styles');
    });
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('replacePlaceholders — property-based tests', () => {
  /**
   * **Validates: Requirements 3.5, 3.6**
   * Property 7: Replacement preserves structure — replacePlaceholders(h, m).html
   * parses to a DOM tree with the same element count and nesting structure as h,
   * and replaced + failed equals the size of m.
   */
  it('Property 7: replacement preserves structure and count correctness', () => {
    // Generate HTML with a known number of img placeholders
    const placeholderCountArb = fc.integer({ min: 1, max: 5 });

    // Generate a simple HTML structure with img placeholders
    const htmlWithPlaceholdersArb = placeholderCountArb.chain((count) => {
      return fc.tuple(
        fc.constant(count),
        fc.array(
          fc.record({
            width: fc.integer({ min: 50, max: 800 }),
            height: fc.integer({ min: 50, max: 800 }),
            alt: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('"') && !s.includes('<') && !s.includes('>')),
          }),
          { minLength: count, maxLength: count }
        ),
        // How many selectors will be "missing" (point to non-existent elements)
        fc.integer({ min: 0, max: 2 })
      );
    });

    fc.assert(
      fc.property(htmlWithPlaceholdersArb, ([count, specs, missingCount]) => {
        // Build HTML with known img placeholders
        const imgElements = specs.map(
          (spec, i) => `<img src="" alt="${spec.alt}" style="width:${spec.width}px;height:${spec.height}px">`
        );
        const html = `<div><h1>Title</h1>${imgElements.join('\n')}<p>Footer</p></div>`;

        // Build results map: some valid selectors, some missing
        const results = new Map<string, { dataUrl: string; savedPath?: string }>();

        for (let i = 0; i < count; i++) {
          const selector = `body > div > img:nth-of-type(${i + 1})`;
          results.set(selector, { dataUrl: makeDataUrl() });
        }

        // Add missing selectors
        for (let i = 0; i < missingCount; i++) {
          results.set(`body > div > .nonexistent-${i}`, { dataUrl: makeDataUrl() });
        }

        const result = replacePlaceholders(html, results);

        // Property: replaced + failed === results.size
        expect(result.replaced + result.failed).toBe(results.size);

        // Property: each bare img gains a figure.frame-img wrapper (+1 element)
        const originalCount = countElements(html);
        const resultCount = countElements(result.html);
        expect(resultCount).toBe(originalCount + result.replaced);

        const parser = new DOMParser();
        const doc = parser.parseFromString(result.html, 'text/html');
        expect(doc.querySelectorAll('figure.frame-img > img').length).toBe(result.replaced);

        // Property: replaced count matches the number of valid selectors
        expect(result.replaced).toBe(count);
        expect(result.failed).toBe(missingCount);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7b: color-block divs gain a framed img child', () => {
    const htmlWithColorBlocksArb = fc.tuple(
      fc.array(
        fc.record({
          r: fc.integer({ min: 0, max: 255 }),
          g: fc.integer({ min: 0, max: 255 }),
          b: fc.integer({ min: 0, max: 255 }),
          width: fc.integer({ min: 50, max: 800 }),
          height: fc.integer({ min: 50, max: 800 }),
        }),
        { minLength: 1, maxLength: 4 }
      ),
      fc.integer({ min: 0, max: 2 })
    );

    fc.assert(
      fc.property(htmlWithColorBlocksArb, ([specs, missingCount]) => {
        // Build HTML with color-block divs
        const divElements = specs.map(
          (spec) => `<div style="background-color:rgb(${spec.r},${spec.g},${spec.b});width:${spec.width}px;height:${spec.height}px;"></div>`
        );
        const html = `<section><h2>Gallery</h2>${divElements.join('\n')}</section>`;

        // Build results map
        const results = new Map<string, { dataUrl: string; savedPath?: string }>();

        for (let i = 0; i < specs.length; i++) {
          const selector = specs.length === 1
            ? 'body > section > div'
            : `body > section > div:nth-of-type(${i + 1})`;
          results.set(selector, { dataUrl: makeDataUrl() });
        }

        // Add missing selectors
        for (let i = 0; i < missingCount; i++) {
          results.set(`body > section > .missing-${i}`, { dataUrl: makeDataUrl() });
        }

        const result = replacePlaceholders(html, results);

        // Property: replaced + failed === results.size
        expect(result.replaced + result.failed).toBe(results.size);

        // Property: each color block gains one img child (+1 element)
        const originalCount = countElements(html);
        const resultCount = countElements(result.html);
        expect(resultCount).toBe(originalCount + result.replaced);

        const parser = new DOMParser();
        const doc = parser.parseFromString(result.html, 'text/html');
        expect(doc.querySelectorAll('img.renoir-framed-img').length).toBe(result.replaced);
        expect(result.replaced).toBe(specs.length);
        expect(result.failed).toBe(missingCount);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7c: mixed element types gain frames without losing count integrity', () => {
    const mixedHtmlArb = fc.tuple(
      fc.integer({ min: 1, max: 3 }), // img count
      fc.integer({ min: 1, max: 3 }), // color-block count
      fc.integer({ min: 0, max: 2 })  // missing selectors
    );

    fc.assert(
      fc.property(mixedHtmlArb, ([imgCount, divCount, missingCount]) => {
        // Build mixed HTML
        const imgs = Array.from({ length: imgCount }, (_, i) =>
          `<img src="" alt="img${i}" style="width:${100 + i * 50}px;height:${100 + i * 50}px">`
        );
        const divs = Array.from({ length: divCount }, (_, i) =>
          `<div style="background-color:#${(i + 1).toString(16).padStart(2, '0')}0000;width:${200 + i * 50}px;height:${150 + i * 50}px;"></div>`
        );
        const html = `<main><header><h1>Page</h1></header><article>${imgs.join('')}${divs.join('')}</article><footer><p>End</p></footer></main>`;

        // Build results map
        const results = new Map<string, { dataUrl: string; savedPath?: string }>();

        for (let i = 0; i < imgCount; i++) {
          const selector = imgCount === 1
            ? 'body > main > article > img'
            : `body > main > article > img:nth-of-type(${i + 1})`;
          results.set(selector, { dataUrl: makeDataUrl() });
        }

        for (let i = 0; i < divCount; i++) {
          const selector = divCount === 1
            ? 'body > main > article > div'
            : `body > main > article > div:nth-of-type(${i + 1})`;
          results.set(selector, { dataUrl: makeDataUrl() });
        }

        for (let i = 0; i < missingCount; i++) {
          results.set(`body > main > .ghost-${i}`, { dataUrl: makeDataUrl() });
        }

        const result = replacePlaceholders(html, results);

        // Property: replaced + failed === results.size
        expect(result.replaced + result.failed).toBe(results.size);

        // Property: imgs add a figure wrapper; color blocks add an img child
        const originalCount = countElements(html);
        const resultCount = countElements(result.html);
        expect(resultCount).toBe(originalCount + result.replaced);

        const parser = new DOMParser();
        const doc = parser.parseFromString(result.html, 'text/html');
        expect(doc.querySelectorAll('img.renoir-framed-img').length).toBe(result.replaced);
        expect(result.replaced).toBe(imgCount + divCount);
        expect(result.failed).toBe(missingCount);
      }),
      { numRuns: 100 }
    );
  });
});
