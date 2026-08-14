import { describe, it, expect } from 'vitest';
import {
  PRODUCT_DECK_SLIDE_COUNT,
  enrichProductDeckHtml,
  extractProductName,
  isPlaceholderText,
} from '../src/lib/product-deck-content';

const deckShell = (slides: string) =>
  `<!doctype html><html><head><title>Acme Analytics</title></head><body><div class="deck">${slides}</div></body></html>`;

const slide = (inner: string, title = 'Slide') =>
  `<section class="slide" data-title="${title}">${inner}</section>`;

describe('product-deck-content', () => {
  it('detects placeholder copy', () => {
    expect(isPlaceholderText('Lorem ipsum dolor')).toBe(true);
    expect(isPlaceholderText('Coming soon')).toBe(true);
    expect(isPlaceholderText('Real product headline')).toBe(false);
  });

  it('extracts product name from title tag', () => {
    const html = '<html><head><title>Acme Analytics · Deck</title></head><body></body></html>';
    expect(extractProductName(html)).toBe('Acme Analytics');
  });

  it('pads incomplete decks to exactly 12 slides when finalized', () => {
    const html = deckShell(
      slide('<p class="kicker">Cover</p><h1 class="h1">Acme</h1><p class="lede">Overview</p>', 'Cover'),
    );
    const { html: out, slideCount } = enrichProductDeckHtml(html, { finalize: true });
    expect(slideCount).toBe(PRODUCT_DECK_SLIDE_COUNT);
    expect((out.match(/<section\b[^>]*\bslide\b/gi) || []).length).toBe(12);
    expect(out).toContain('data-total="12"');
  });

  it('fills empty titles and placeholder body copy', () => {
    const html = deckShell(
      [
        slide('<p class="kicker">Cover</p><h1 class="h1"></h1><p class="lede">Lorem ipsum</p>', 'Cover'),
        slide('<p class="kicker">Why</p><h2 class="h2">Coming soon</h2><p class="lede"></p><ul><li></li><li>Real point</li></ul>', 'Why'),
      ].join(''),
    );
    const { html: out, filledFields } = enrichProductDeckHtml(html, { finalize: true, productName: 'Acme' });
    expect(filledFields).toBeGreaterThan(0);
    expect(out).not.toMatch(/lorem ipsum/i);
    expect(out).not.toMatch(/coming soon/i);
    expect(out).toContain('<h1 class="h1">');
    expect(out).toMatch(/<h2 class="h2">[^<]+<\/h2>/);
    expect(out).toContain('<li>Real point</li>');
  });

  it('fills empty feature cards', () => {
    const html = deckShell(
      slide(
        '<p class="kicker">Feature</p><h2 class="h2">Speed</h2><p class="lede">Fast.</p>' +
        '<div class="grid g3 mt-l"><div class="feature-card"><h4></h4><p class="dim"></p></div></div>',
        'Feature',
      ),
    );
    const { html: out } = enrichProductDeckHtml(html, { finalize: true });
    expect(out).toMatch(/<h4>[^<]+<\/h4>/);
    expect(out).toMatch(/<p class="dim">[^<]+<\/p>/);
  });

  it('does not pad to 12 slides while streaming', () => {
    const html = deckShell(slide('<h2 class="h2">One</h2><p class="lede">Only slide</p>'));
    const { slideCount } = enrichProductDeckHtml(html, { finalize: false });
    expect(slideCount).toBe(1);
  });

  it('integrates via normalizeArtifactDocument for product deck', async () => {
    const { normalizeArtifactDocument } = await import('../src/lib/artifact-html');
    const out = normalizeArtifactDocument('<div class="deck"><section class="slide"><h2 class="h2"></h2></section></div>', {
      title: 'Relay',
      productDeck: true,
      productDeckFinalize: true,
    });
    expect((out.match(/<section\b[^>]*\bslide\b/gi) || []).length).toBe(12);
    expect(out).not.toMatch(/<h2 class="h2">\s*<\/h2>/);
  });

  it('injects image placeholders on visual slides when finalized', () => {
    const html = deckShell(
      slide('<p class="kicker">Cover</p><h1 class="h1">Acme</h1><p class="lede">Short.</p>', 'Cover'),
    );
    const { html: out } = enrichProductDeckHtml(html, { finalize: true, productName: 'Acme' });
    const imgs = out.match(/<img\b[^>]*\bsrc=["']\s*["']/gi) || [];
    expect(imgs.length).toBeGreaterThanOrEqual(6);
    expect(out).toContain('class="slide-image"');
    expect(out).toMatch(/alt="[^"]+hero[^"]*"/i);
  });

  it('expands sparse lede copy to fuller paragraphs', () => {
    const html = deckShell(
      slide('<p class="kicker">Why</p><h2 class="h2">Now</h2><p class="lede">Too short.</p>', 'Why'),
    );
    const { html: out } = enrichProductDeckHtml(html, { finalize: true });
    const lede = out.match(/<p class="lede[^"]*">([^<]+)<\/p>/i)?.[1] ?? '';
    expect(lede.length).toBeGreaterThan(40);
  });

  it('rebuilds decks with nested feature cards without orphaning slides', () => {
    const nestedSlide = (title: string, body: string) =>
      slide(
        `<p class="kicker">${title}</p><h2 class="h2">${title}</h2>` +
          `<p class="lede">${body} This lede has enough characters to avoid sparse expansion.</p>` +
          '<div class="grid g3 mt-l">' +
          '<div class="feature-card"><h4>Card A</h4><p class="dim">Body A with concrete detail.</p></div>' +
          '<div class="feature-card"><h4>Card B</h4><p class="dim">Body B with concrete detail.</p></div>' +
          '</div>' +
          '<div class="slide-visual mt-l"><img src="" alt="Product UI" class="slide-image" width="960" height="540"></div>' +
          '<div class="deck-footer"><span>Acme</span><span class="slide-number">1 / 3</span></div>',
        title,
      );

    const html = deckShell(
      [
        nestedSlide('Cover', 'Welcome to Acme Analytics for modern teams.'),
        nestedSlide('Why Now', 'Teams need clarity from day one without busywork.'),
        nestedSlide('Features', 'Built for real product workflows across the stack.'),
      ].join('\n'),
    );

    const { html: out, slideCount } = enrichProductDeckHtml(html, {
      finalize: true,
      productName: 'Acme',
    });

    expect(slideCount).toBe(PRODUCT_DECK_SLIDE_COUNT);
    expect((out.match(/<section\b[^>]*\bclass=["'][^"']*\bslide\b/gi) || []).length).toBe(12);
    // Nested closing divs must not leave orphan slides outside .deck
    const deckInner = out.match(/<div[^>]*\bclass=["'][^"']*\bdeck\b[^"']*["'][^>]*>([\s\S]*)<\/div>\s*<\/body>/i)?.[1] ?? '';
    expect((deckInner.match(/<section\b[^>]*\bclass=["'][^"']*\bslide\b/gi) || []).length).toBe(12);
    expect(out).toContain('Card A');
    expect(out).toContain('Welcome to Acme Analytics');
  });

  it('does not duplicate body content when rebuilding without a .deck wrapper', () => {
    const html =
      '<!doctype html><html><body>' +
      slide('<p class="kicker">Cover</p><h1 class="h1">Acme</h1><p class="lede">Enough copy for the cover slide lede.</p>', 'Cover') +
      '</body></html>';
    const { html: out, slideCount } = enrichProductDeckHtml(html, { finalize: true, productName: 'Acme' });
    expect(slideCount).toBe(PRODUCT_DECK_SLIDE_COUNT);
    expect((out.match(/<section\b[^>]*\bclass=["'][^"']*\bslide\b/gi) || []).length).toBe(12);
    expect((out.match(/<div\b[^>]*\bclass=["'](?:[^"']*\s)?deck(?:\s[^"']*)?["']/gi) || []).length).toBe(1);
  });
});
