import { describe, it, expect } from 'vitest';
import { inlineResolvableImagesInHtml } from '../../shared/export/inline-export-images';

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('inlineResolvableImagesInHtml', () => {
  it('inlines renoir-asset:// image src values into data URLs', async () => {
    const html = '<section><img src="renoir-asset://images/hero.png" alt="Hero"></section>';
    const out = await inlineResolvableImagesInHtml(html, async (src) => {
      if (src === 'renoir-asset://images/hero.png') return PNG_BYTES;
      return null;
    });

    expect(out).toContain('src="data:image/png;base64,');
    expect(out).not.toContain('renoir-asset://');
  });

  it('leaves unresolved src values unchanged', async () => {
    const html = '<img src="renoir-asset://images/missing.png" alt="Missing">';
    const out = await inlineResolvableImagesInHtml(html, async () => null);
    expect(out).toBe(html);
  });

  it('skips images that are already data URLs', async () => {
    const html = '<img src="data:image/png;base64,abc" alt="Inline">';
    let called = false;
    const out = await inlineResolvableImagesInHtml(html, async () => {
      called = true;
      return PNG_BYTES;
    });
    expect(out).toBe(html);
    expect(called).toBe(false);
  });
});
