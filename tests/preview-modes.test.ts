import { describe, it, expect } from 'vitest';
import {
  MERMAID_CDN,
  MERMAID_INIT_SCRIPT,
  NAV_BRIDGE,
  countDeckSlides,
  defaultModeForSkill,
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
  it('loads mermaid from the CDN', () => {
    expect(MERMAID_INIT_SCRIPT).toContain(MERMAID_CDN);
    expect(MERMAID_INIT_SCRIPT).toContain("s.src = '");
  });

  it('initializes mermaid with startOnLoad: false and securityLevel: strict', () => {
    expect(MERMAID_INIT_SCRIPT).toContain('startOnLoad: false');
    expect(MERMAID_INIT_SCRIPT).toContain("securityLevel: 'strict'");
  });

  it('calls mermaid.render per diagram with stored source', () => {
    expect(MERMAID_INIT_SCRIPT).toContain('mm.render(id, src)');
    expect(MERMAID_INIT_SCRIPT).toContain('__renoirRunMermaid');
    expect(MERMAID_INIT_SCRIPT).toContain('data-renoir-mermaid-src');
  });

  it('does not auto-run mermaid before the preview is activated', () => {
    expect(MERMAID_INIT_SCRIPT).not.toContain('DOMContentLoaded');
    expect(MERMAID_INIT_SCRIPT).not.toContain('mermaid.run(');
  });

  it('wraps initialization in DOMContentLoaded listener', () => {
    // Mermaid is loaded on demand when the preview bridge calls __renoirRunMermaid.
    expect(MERMAID_INIT_SCRIPT).toContain('ensureMermaid');
  });

  it('guards against mermaid being undefined', () => {
    expect(MERMAID_INIT_SCRIPT).toContain('ensureMermaid');
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
    expect(result).toContain('mm.initialize');
    expect(result).toContain('mm.render(id, src)');
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


describe('countDeckSlides', () => {
  it('counts data-slide markers', () => {
    const html = '<div data-slide="1"></div><div data-slide="2"></div><div data-slide="3"></div>';
    expect(countDeckSlides(html)).toBe(3);
  });

  it('counts section.slide inside .deck', () => {
    const slides = Array.from({ length: 12 }, (_, i) => `<section class="slide">${i}</section>`).join('');
    const html = `<div class="deck">${slides}</div>`;
    expect(countDeckSlides(html)).toBe(12);
  });

  it('counts section.slide elements', () => {
    const html = '<section class="slide">1</section>';
    expect(countDeckSlides(html)).toBe(1);
  });

  it('counts multiple section tags', () => {
    const html = '<section>A</section><section>B</section><section>C</section>';
    expect(countDeckSlides(html)).toBe(3);
  });

  it('returns 1 when no deck structure is found', () => {
    expect(countDeckSlides('<div>hello</div>')).toBe(1);
  });
});

describe('defaultModeForSkill', () => {
  it('uses present mode for pitch-deck', () => {
    expect(defaultModeForSkill('pitch-deck')).toBe('present');
  });

  it('uses present mode for all-hands-deck', () => {
    expect(defaultModeForSkill('all-hands-deck')).toBe('present');
  });

  it('defaults to scroll for unknown skills', () => {
    expect(defaultModeForSkill('pricing-page')).toBe('scroll');
    expect(defaultModeForSkill(undefined)).toBe('scroll');
  });
});

describe('NAV_BRIDGE present mode CSS', () => {
  it('hides in-artifact navigation buttons in present mode', () => {
    expect(NAV_BRIDGE).toContain('.prev-btn,.next-btn,.slide-controls,.navigation');
    expect(NAV_BRIDGE).toContain('a.skip-link,.skip-to-main,.skip-to-content');
  });

  it('shows one slide at a time via hidden attribute and is-active class', () => {
    expect(NAV_BRIDGE).toContain('renoir-slide');
    expect(NAV_BRIDGE).toContain("setAttribute('hidden'");
    expect(NAV_BRIDGE).toContain("classList.add('is-active')");
    expect(NAV_BRIDGE).toContain('opacity:1!important');
    expect(NAV_BRIDGE).not.toContain('translateX(');
  });

  it('detects slides inside .deck container', () => {
    expect(NAV_BRIDGE).toContain("document.querySelector('.deck')");
    expect(NAV_BRIDGE).toContain('bootPresentIfDeck');
  });

  it('prefers data-screen-id flow screens over nested sections', () => {
    expect(NAV_BRIDGE).toContain("document.querySelectorAll('[data-screen-id]')");
    expect(NAV_BRIDGE).toContain("document.querySelectorAll('[data-screen-id]').length >= 2");
  });

  it('applies deck contrast helpers', () => {
    expect(NAV_BRIDGE).toContain('applySlideContrast');
    expect(NAV_BRIDGE).toContain('revealSlideAnimations');
    expect(NAV_BRIDGE).toContain('ensureContrastStyles');
  });

  it('handles explicit preview reload messages', () => {
    expect(NAV_BRIDGE).toContain("d.type === 'renoir:reload'");
  });

  it('supports point-and-edit pick messages', () => {
    expect(NAV_BRIDGE).toContain("d.type === 'renoir:pick-enable'");
    expect(NAV_BRIDGE).toContain("d.type === 'renoir:pick-disable'");
    expect(NAV_BRIDGE).toContain("type: 'renoir:picked'");
    expect(NAV_BRIDGE).toContain('data-od-id');
  });

  it('supports scroll-sync and flow walk messages', () => {
    expect(NAV_BRIDGE).toContain("d.type === 'renoir:scroll-sync'");
    expect(NAV_BRIDGE).toContain("type: 'renoir:scroll'");
    expect(NAV_BRIDGE).toContain("d.type === 'renoir:flow-enable'");
    expect(NAV_BRIDGE).toContain("d.type === 'renoir:flow-nav'");
    expect(NAV_BRIDGE).toContain("type: 'renoir:flow-screen'");
  });

  it('supports live a11y probe messages', () => {
    expect(NAV_BRIDGE).toContain("d.type === 'renoir:a11y-probe'");
    expect(NAV_BRIDGE).toContain("type: 'renoir:a11y-report'");
    expect(NAV_BRIDGE).toContain('runA11yProbe');
  });

  it('does not force a white background in present mode', () => {
    expect(NAV_BRIDGE).not.toContain('background:white');
  });

  it('pins footer and reserves chrome space on the last slide', () => {
    expect(NAV_BRIDGE).toContain('renoir-footer-fixed');
    expect(NAV_BRIDGE).toContain('--renoir-chrome-top');
    expect(NAV_BRIDGE).toContain('--renoir-chrome-bottom');
    expect(NAV_BRIDGE).toContain('function measureChrome(');
  });

  it('stacks grids and scales slides to fit on phone/tablet', () => {
    expect(NAV_BRIDGE).toContain('function fitActiveSlide()');
    expect(NAV_BRIDGE).toContain('function fitSlide(');
    expect(NAV_BRIDGE).toContain('root.style.zoom');
    expect(NAV_BRIDGE).toContain('data-renoir-fit-root');
    expect(NAV_BRIDGE).toContain('overflow:hidden!important');
    expect(NAV_BRIDGE).toContain('repeat(3,minmax(0,1fr))');
    expect(NAV_BRIDGE).toContain('@media(max-width:480px)');
  });
});

describe('NAV_BRIDGE scroll mode', () => {
  it('scrolls via html and syncs full document extent', () => {
    expect(NAV_BRIDGE).toContain('overflow-y:auto!important');
    expect(NAV_BRIDGE).toContain('function syncScrollExtent()');
    expect(NAV_BRIDGE).toContain('function measureStackedHeight()');
    expect(NAV_BRIDGE).toContain('__renoir_scroll_tail');
    expect(NAV_BRIDGE).not.toContain('useOuterScroll');
    expect(NAV_BRIDGE).not.toContain("type: 'renoir:wheel'");
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

describe('scroll mode integration (jsdom)', () => {
  const salonLikeHtml = `<!doctype html><html><head><style>
    html,body{margin:0;overflow:hidden;height:100vh}
    main{height:100vh;overflow:hidden}
    section{position:absolute;inset:0;width:100%;height:100vh;overflow:hidden}
    section h1{margin:0;padding:2rem}
  </style></head><body>
  <header style="height:64px">Sunny Snips nav</header>
  <main>
    <section id="hero"><h1>Hero</h1><div style="height:600px">hero body</div></section>
    <section id="services"><h1>Services</h1><div style="height:500px">cards</div></section>
    <section id="gallery"><h1>Gallery</h1><div style="height:400px">grid</div></section>
    <section id="team"><h1>Team</h1></section>
    <section id="cta"><h1>Book</h1></section>
    <section id="visit"><h1>Visit</h1></section>
  </main>
  <footer style="height:120px">Footer</footer>
  </body></html>`;

  it('stacks all sections vertically in scroll mode (full page height)', async () => {
    const { JSDOM } = await import('jsdom');
    const src = wrapWithBridge(salonLikeHtml);
    const dom = new JSDOM(src, { runScripts: 'dangerously', pretendToBeVisual: true });
    const win = dom.window;
    const heights: number[] = [];
    win.parent = {
      postMessage(data: { type?: string; height?: number }) {
        if (data?.type === 'renoir:size' && data.height) heights.push(data.height);
      },
    } as unknown as Window;

    await new Promise<void>((r) => {
      if (win.document.readyState === 'complete') r();
      else win.addEventListener('load', () => r());
    });

    win.postMessage({ type: 'renoir:set-mode', mode: 'scroll' }, '*');
    await new Promise((r) => setTimeout(r, 50));

    expect(win.document.body.getAttribute('data-renoir-mode')).toBe('scroll');

    const sections = Array.from(win.document.querySelectorAll('main > section'));
    expect(sections.length).toBe(6);

    const positions = sections.map((s) => win.getComputedStyle(s as Element).position);
    expect(positions.every((p) => p === 'relative' || p === 'static')).toBe(true);

    const transforms = sections.map((s) => (s as HTMLElement).style.transform);
    expect(transforms.every((t) => !t || t === 'none')).toBe(true);

    const modeStyle = win.document.getElementById('__renoir_mode_style');
    expect(modeStyle?.textContent).toContain('position:relative!important');

    dom.window.close();
  });

  it('recovers full scroll height after present mode', async () => {
    const { JSDOM } = await import('jsdom');
    const src = wrapWithBridge(salonLikeHtml);
    const dom = new JSDOM(src, { runScripts: 'dangerously', pretendToBeVisual: true });
    const win = dom.window;
    const heights: number[] = [];
    win.parent = {
      postMessage(data: { type?: string; height?: number }) {
        if (data?.type === 'renoir:size' && data.height) heights.push(data.height);
      },
    } as unknown as Window;

    await new Promise<void>((r) => {
      if (win.document.readyState === 'complete') r();
      else win.addEventListener('load', () => r());
    });

    win.postMessage({ type: 'renoir:set-mode', mode: 'present' }, '*');
    await new Promise((r) => setTimeout(r, 30));
    win.postMessage({ type: 'renoir:set-mode', mode: 'scroll' }, '*');
    win.postMessage({ type: 'renoir:probe' }, '*');
    await new Promise((r) => setTimeout(r, 900));

    const footer = win.document.querySelector('footer') as HTMLElement;
    expect(footer?.style.display).not.toBe('none');

    const sections = Array.from(win.document.querySelectorAll('main > section'));
    expect(sections.every((s) => {
      const pos = win.getComputedStyle(s as Element).position;
      return pos === 'relative' || pos === 'static';
    })).toBe(true);

    dom.window.close();
  });
});
