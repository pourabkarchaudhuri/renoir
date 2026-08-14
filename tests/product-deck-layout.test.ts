import { describe, it, expect } from 'vitest';
import {
  injectProductDeckShell,
  PRODUCT_DECK_BASE_CSS,
  PRODUCT_DECK_META,
} from '../shared/product-deck-layout';
import { normalizeArtifactDocument } from '../src/lib/artifact-html';

const minimalDeck = `<!doctype html><html><head><title>Acme</title></head><body>
<div class="deck">
  <section class="slide"><p class="kicker">Cover</p><h2 class="h2">Acme</h2></section>
</div>
</body></html>`;

describe('product-deck-layout', () => {
  it('injects meta and base style tag', () => {
    const out = injectProductDeckShell(minimalDeck);
    expect(out).toContain(`name="${PRODUCT_DECK_META}"`);
    expect(out).toContain('id="renoir-product-deck-base"');
    expect(out).toContain('.deck>section.slide');
    expect(out).toContain('.feature-card');
    expect(out).toContain('.h2{');
  });

  it('is idempotent — second call does not duplicate style blocks', () => {
    const once = injectProductDeckShell(minimalDeck);
    const twice = injectProductDeckShell(once);
    expect((twice.match(/renoir-product-deck-base/g) || []).length).toBe(1);
    expect((twice.match(new RegExp(PRODUCT_DECK_META, 'g')) || []).length).toBe(1);
  });

  it('includes slide positioning and animation rules in embedded CSS', () => {
    expect(PRODUCT_DECK_BASE_CSS).toContain('position:absolute');
    expect(PRODUCT_DECK_BASE_CSS).toContain(':first-of-type');
    expect(PRODUCT_DECK_BASE_CSS).toContain('minmax(0,1fr)');
    expect(PRODUCT_DECK_BASE_CSS).toContain('clamp(');
    expect(PRODUCT_DECK_BASE_CSS).toContain('.anim-fade-up');
    expect(PRODUCT_DECK_BASE_CSS).toContain('.slide-visual');
  });

  it('integrates via normalizeArtifactDocument for product deck', () => {
    const out = normalizeArtifactDocument(
      '<div class="deck"><section class="slide"><h2 class="h2"></h2></section></div>',
      { title: 'Relay', productDeck: true, productDeckFinalize: true },
    );
    expect(out).toContain('id="renoir-product-deck-base"');
    expect(out).toContain(`name="${PRODUCT_DECK_META}"`);
    expect(out).toContain('.deck>section.slide');
  });
});
