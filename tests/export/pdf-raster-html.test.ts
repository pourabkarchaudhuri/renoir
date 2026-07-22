import { describe, expect, it } from 'vitest';
import { buildRasterPdfHtml } from '../../electron/export/index';

describe('buildRasterPdfHtml', () => {
  it('waits for embedded page images before printing', () => {
    const html = buildRasterPdfHtml([Buffer.from([0x89, 0x50, 0x4e, 0x47])]);

    expect(html).toContain('<img src="data:image/png;base64,');
    expect(html).toContain('window.__renoirPdfReady = false;');
    expect(html).toContain('document.fonts?.ready ?? Promise.resolve()');
    expect(html).toContain('images.map(decodeImage)');
    expect(html).toContain('window.__renoirPdfReady = true;');
  });
});
