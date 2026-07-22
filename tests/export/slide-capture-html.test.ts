import { describe, it, expect } from 'vitest';
import { wrapForExportCapture, wrapWithBridge, EXPORT_PRESENT_NAV_BRIDGE, EXPORT_CAPTURE_FREEZE_MESSAGE } from '../../shared/preview-nav-bridge';
import { EXPORT_CAPTURE_SCALE } from '../../electron/export/slide-capture';
import { countDeckSlides } from '../../src/lib/preview-deck-contrast';

const deckFixture = `<!doctype html><html><body><div class="deck">
<section class="slide"><h1>One</h1></section>
<section class="slide"><h1>Two</h1></section>
<section class="slide"><h1>Three</h1></section>
</div></body></html>`;

describe('slide capture HTML prep', () => {
  it('wrapForExportCapture injects export nav bridge once', () => {
    const out = wrapForExportCapture(deckFixture);
    expect(out).toContain('__renoir_mode_style');
    expect(out).toContain('renoir:set-mode');
    const twice = wrapForExportCapture(out);
    expect(twice).toBe(out);
  });

  it('wrapWithBridge is idempotent with custom bridge', () => {
    const once = wrapWithBridge(deckFixture, EXPORT_PRESENT_NAV_BRIDGE);
    const twice = wrapWithBridge(once, EXPORT_PRESENT_NAV_BRIDGE);
    expect(twice).toBe(once);
  });

  it('counts slides in deck fixture', () => {
    expect(countDeckSlides(deckFixture)).toBe(3);
  });

  it('exports deck capture at 2× for sharp PPT/PDF raster', () => {
    expect(EXPORT_CAPTURE_SCALE).toBe(2);
  });

  it('freezes slide animations before raster capture', () => {
    expect(EXPORT_PRESENT_NAV_BRIDGE).toContain('freezeActiveSlideForCapture');
    expect(EXPORT_PRESENT_NAV_BRIDGE).toContain(EXPORT_CAPTURE_FREEZE_MESSAGE);
    expect(EXPORT_PRESENT_NAV_BRIDGE).toContain('animation:none!important');
  });
});
