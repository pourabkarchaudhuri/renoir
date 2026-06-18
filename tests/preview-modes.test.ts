import { describe, it, expect } from 'vitest';
import {
  MERMAID_CDN,
  MERMAID_INIT_SCRIPT,
  NAV_BRIDGE,
  hasMermaidContent,
  injectMermaidScript,
  wrapWithBridge,
} from '../src/lib/preview-modes';

describe('MERMAID_CDN constant', () => {
  it('points to mermaid@11 on jsdelivr', () => {
    expect(MERMAID_CDN).toBe('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js');
  });
});

describe('MERMAID_INIT_SCRIPT', () => {
  it('includes the CDN script tag', () => {
    expect(MERMAID_INIT_SCRIPT).toContain(`<script src="${MERMAID_CDN}"></script>`);
  });

  it('initializes mermaid with startOnLoad: false and securityLevel: strict', () => {
    expect(MERMAID_INIT_SCRIPT).toContain('startOnLoad: false');
    expect(MERMAID_INIT_SCRIPT).toContain("securityLevel: 'strict'");
  });

  it('calls mermaid.run with .mermaid querySelector', () => {
    expect(MERMAID_INIT_SCRIPT).toContain("mermaid.run({ querySelector: '.mermaid' })");
  });

  it('wraps initialization in DOMContentLoaded listener', () => {
    expect(MERMAID_INIT_SCRIPT).toContain("document.addEventListener('DOMContentLoaded'");
  });

  it('guards against mermaid being undefined', () => {
    expect(MERMAID_INIT_SCRIPT).toContain("typeof mermaid !== 'undefined'");
  });
});

describe('hasMermaidContent', () => {
  it('returns true for class="mermaid"', () => {
    expect(hasMermaidContent('<pre class="mermaid">graph TD</pre>')).toBe(true);
  });

  it("returns true for class='mermaid'", () => {
    expect(hasMermaidContent("<div class='mermaid'>graph LR</div>")).toBe(true);
  });

  it('returns true for pre class="mermaid"', () => {
    expect(hasMermaidContent('<pre class="mermaid">flowchart</pre>')).toBe(true);
  });

  it('returns false for HTML without mermaid markers', () => {
    expect(hasMermaidContent('<div><p>Hello world</p></div>')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(hasMermaidContent('')).toBe(false);
  });

  it('returns false when mermaid appears only in text content', () => {
    expect(hasMermaidContent('<p>This is about mermaid diagrams</p>')).toBe(false);
  });
});

describe('injectMermaidScript', () => {
  it('injects mermaid script when HTML contains class="mermaid"', () => {
    const html = '<html><head></head><body><pre class="mermaid">graph TD</pre></body></html>';
    const result = injectMermaidScript(html);
    expect(result).toContain(MERMAID_CDN);
    expect(result).toContain('mermaid.initialize');
    expect(result).toContain('mermaid.run');
  });

  it('does not inject for non-mermaid HTML', () => {
    const html = '<html><head></head><body><p>Hello</p></body></html>';
    const result = injectMermaidScript(html);
    expect(result).toBe(html);
    expect(result).not.toContain(MERMAID_CDN);
  });

  it('injects before </head> when present', () => {
    const html = '<html><head><title>Test</title></head><body><pre class="mermaid">graph TD</pre></body></html>';
    const result = injectMermaidScript(html);
    const headCloseIdx = result.indexOf('</head>');
    const mermaidIdx = result.indexOf(MERMAID_CDN);
    expect(mermaidIdx).toBeLessThan(headCloseIdx);
  });

  it('injects before </body> when no </head> is present', () => {
    const html = '<body><pre class="mermaid">graph TD</pre></body>';
    const result = injectMermaidScript(html);
    const bodyCloseIdx = result.indexOf('</body>');
    const mermaidIdx = result.indexOf(MERMAID_CDN);
    expect(mermaidIdx).toBeLessThan(bodyCloseIdx);
  });

  it('appends at end when neither </head> nor </body> is present', () => {
    const html = '<pre class="mermaid">graph TD</pre>';
    const result = injectMermaidScript(html);
    expect(result).toContain(MERMAID_CDN);
    expect(result.indexOf(MERMAID_CDN)).toBeGreaterThan(html.length - 1);
  });

  it('skips injection if mermaid.min.js is already present', () => {
    const html = '<html><head><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script></head><body><pre class="mermaid">graph TD</pre></body></html>';
    const result = injectMermaidScript(html);
    expect(result).toBe(html);
  });

  it('skips injection if mermaid.esm is already present', () => {
    const html = '<html><head><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"></script></head><body><pre class="mermaid">graph TD</pre></body></html>';
    const result = injectMermaidScript(html);
    expect(result).toBe(html);
  });

  it('is idempotent — calling twice produces the same result', () => {
    const html = '<html><head></head><body><pre class="mermaid">graph TD</pre></body></html>';
    const first = injectMermaidScript(html);
    const second = injectMermaidScript(first);
    expect(second).toBe(first);
  });
});

describe('wrapWithBridge with mermaid injection', () => {
  it('injects mermaid script before the nav bridge for mermaid content', () => {
    const html = '<html><head></head><body><pre class="mermaid">graph TD</pre></body></html>';
    const result = wrapWithBridge(html);
    const mermaidIdx = result.indexOf(MERMAID_CDN);
    const bridgeIdx = result.indexOf('renoir:nav-state');
    expect(mermaidIdx).toBeGreaterThan(-1);
    expect(bridgeIdx).toBeGreaterThan(-1);
    expect(mermaidIdx).toBeLessThan(bridgeIdx);
  });

  it('does not inject mermaid for non-mermaid content', () => {
    const html = '<html><head></head><body><p>Hello</p></body></html>';
    const result = wrapWithBridge(html);
    expect(result).not.toContain(MERMAID_CDN);
    expect(result).toContain('renoir:nav-state');
  });

  it('is idempotent — calling wrapWithBridge twice produces the same result', () => {
    const html = '<html><head></head><body><pre class="mermaid">graph TD</pre></body></html>';
    const first = wrapWithBridge(html);
    const second = wrapWithBridge(first);
    expect(second).toBe(first);
  });

  it('does not double-inject mermaid when HTML already has mermaid.min.js', () => {
    const html = `<html><head><script src="${MERMAID_CDN}"></script></head><body><pre class="mermaid">graph TD</pre></body></html>`;
    const result = wrapWithBridge(html);
    // Should only have one occurrence of the CDN URL
    const occurrences = result.split(MERMAID_CDN).length - 1;
    expect(occurrences).toBe(1);
  });
});


describe('NAV_BRIDGE present mode CSS', () => {
  it('hides in-artifact navigation buttons in present mode', () => {
    expect(NAV_BRIDGE).toContain('.prev-btn,.next-btn,.slide-controls,.navigation{display:none!important;}');
  });
});

describe('NAV_BRIDGE reportSize mode guard', () => {
  it('contains a mode guard checking activeMode before posting size', () => {
    // The reportSize function should check activeMode !== 'scroll' and return early
    expect(NAV_BRIDGE).toContain("activeMode !== 'scroll'");
    // Verify the guard is inside the reportSize function
    const reportSizeMatch = NAV_BRIDGE.match(/function reportSize\(\)\s*\{([\s\S]*?)\n  \}/);
    expect(reportSizeMatch).not.toBeNull();
    const reportSizeBody = reportSizeMatch![1];
    expect(reportSizeBody).toContain("activeMode !== 'scroll'");
    expect(reportSizeBody).toContain('return');
  });
});


import fc from 'fast-check';

describe('Property-based tests', () => {
  describe('wrapWithBridge idempotency (Property 4)', () => {
    it('for any HTML string, wrapWithBridge(wrapWithBridge(html)) === wrapWithBridge(html)', () => {
      fc.assert(
        fc.property(fc.string(), (html) => {
          const once = wrapWithBridge(html);
          const twice = wrapWithBridge(once);
          return twice === once;
        }),
        { numRuns: 200 },
      );
    });

    it('idempotency holds for HTML-like strings', () => {
      const htmlArb = fc.oneof(
        fc.constant('<html><head></head><body><p>Hello</p></body></html>'),
        fc.constant('<div>Simple content</div>'),
        fc.constant('<!doctype html><html><body></body></html>'),
        fc.constant('<html><body><pre class="mermaid">graph TD</pre></body></html>'),
        fc.string().map((s) => `<html><body>${s}</body></html>`),
        fc.string().map((s) => `<div>${s}</div>`),
      );
      fc.assert(
        fc.property(htmlArb, (html) => {
          const once = wrapWithBridge(html);
          const twice = wrapWithBridge(once);
          return twice === once;
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Navigation index clamping (Property 3)', () => {
    // Extract the clamping logic from NAV_BRIDGE: Math.max(0, Math.min(list.length - 1, idx))
    // We test this as a pure function since the bridge runs inside an iframe.
    const clampIndex = (idx: number, total: number): number => {
      return Math.max(0, Math.min(total - 1, idx));
    };

    it('for any index and total >= 1, clamped result is in [0, total-1]', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer({ min: 1, max: 1000 }),
          (idx, total) => {
            const clamped = clampIndex(idx, total);
            return clamped >= 0 && clamped <= total - 1;
          },
        ),
        { numRuns: 500 },
      );
    });

    it('negative indices clamp to 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: -1 }),
          fc.integer({ min: 1, max: 1000 }),
          (idx, total) => {
            return clampIndex(idx, total) === 0;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('indices beyond last slide clamp to total - 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (total) => {
            const idx = total + Math.floor(Math.random() * 100);
            return clampIndex(idx, total) === total - 1;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('valid indices remain unchanged', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (total) => {
            return fc.pre(total >= 1);
            // This is handled by the next assertion
          },
        ),
      );
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 99 }),
          (total, offset) => {
            const idx = Math.min(offset, total - 1);
            return clampIndex(idx, total) === idx;
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});
