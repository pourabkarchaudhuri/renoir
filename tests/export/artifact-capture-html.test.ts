import { describe, it, expect } from 'vitest';
import { pngDimensions } from '../../electron/export/artifact-capture';
import { wrapCaptureHtml, buildCaptureProfile } from '../../src/lib/skill-export-capture';

describe('pngDimensions', () => {
  it('reads width and height from PNG IHDR', () => {
    const buf = Buffer.alloc(24);
    buf.write('89504e470d0a1a0a', 0, 'hex');
    buf.writeUInt32BE(1200, 16);
    buf.writeUInt32BE(630, 20);
    expect(pngDimensions(buf)).toEqual({ width: 1200, height: 630 });
  });
});

describe('wrapCaptureHtml', () => {
  it('wraps present-mode HTML with nav bridge', () => {
    const html = '<div class="deck"><section class="slide"></section></div>';
    const profile = buildCaptureProfile('pitch-deck', html);
    const out = wrapCaptureHtml(html, profile);
    expect(out).toMatch(/__renoir_mode_style|renoir:nav-state/);
  });

  it('injects viewport meta for fullpage capture', () => {
    const html = '<html><head></head><body><p>Hi</p></body></html>';
    const profile = buildCaptureProfile('web-prototype', html);
    const out = wrapCaptureHtml(html, profile);
    expect(out).toContain('width=1280');
  });
});
