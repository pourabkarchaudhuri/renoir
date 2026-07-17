import { describe, it, expect } from 'vitest';
import { documentToDocxBuffer } from '../../electron/export/docx-exporter';
import { DEFAULT_EXPORT_THEME } from '../../shared/export/theme';
import type { ExportDocument } from '../../shared/export/types';

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

const sampleDoc: ExportDocument = {
  title: 'DOCX Smoke Test',
  subtitle: 'Subtitle here',
  skillName: 'Dashboard',
  createdAt: '2026-04-01T00:00:00.000Z',
  modifiedAt: '2026-04-10T00:00:00.000Z',
  inputs: [{ label: 'Tone', value: 'Professional' }],
  blocks: [
    { type: 'heading', level: 2, text: 'Section' },
    { type: 'paragraph', inlines: [{ type: 'text', text: 'Body text with ', bold: true }, { type: 'text', text: 'emphasis.' }] },
    { type: 'table', headers: ['Col A', 'Col B'], rows: [['a1', 'b1'], ['a2', 'b2']] },
    { type: 'code', language: 'ts', code: 'export const x = 1;' },
    { type: 'bulletList', items: [{ inlines: [{ type: 'text', text: 'Item one' }] }] },
  ],
};

describe('documentToDocxBuffer', () => {
  it('produces a non-empty DOCX buffer', async () => {
    const buf = await documentToDocxBuffer(sampleDoc, { theme: DEFAULT_EXPORT_THEME });
    expect(buf.byteLength).toBeGreaterThan(1000);
    // DOCX is a ZIP archive starting with PK
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('embeds fetched image bytes as word/media in the DOCX archive', async () => {
    const doc: ExportDocument = {
      title: 'Image Export Test',
      createdAt: '2026-04-01T00:00:00.000Z',
      modifiedAt: '2026-04-10T00:00:00.000Z',
      blocks: [
        { type: 'image', src: 'renoir-asset://images/hero.png', alt: 'Hero' },
      ],
    };

    const placeholderDoc: ExportDocument = {
      ...doc,
      blocks: [{ type: 'image', src: '', alt: 'Hero', placeholder: true }],
    };

    const [withImage, placeholderOnly] = await Promise.all([
      documentToDocxBuffer(doc, {
        theme: DEFAULT_EXPORT_THEME,
        assets: {
          fetchImage: async (src) => (src === 'renoir-asset://images/hero.png' ? PNG_BYTES : null),
        },
      }),
      documentToDocxBuffer(placeholderDoc, { theme: DEFAULT_EXPORT_THEME }),
    ]);

    expect(withImage.byteLength).toBeGreaterThan(placeholderOnly.byteLength);
    const archiveText = new TextDecoder().decode(withImage);
    expect(archiveText).toContain('word/media/');
  });

  it('does not embed media when fetchImage is missing', async () => {
    const doc: ExportDocument = {
      title: 'Missing Image',
      createdAt: '2026-04-01T00:00:00.000Z',
      modifiedAt: '2026-04-10T00:00:00.000Z',
      blocks: [
        { type: 'image', src: 'renoir-asset://images/missing.png', alt: 'Hero' },
      ],
    };

    const [withoutFetcher, withFetcher] = await Promise.all([
      documentToDocxBuffer(doc, { theme: DEFAULT_EXPORT_THEME }),
      documentToDocxBuffer(doc, {
        theme: DEFAULT_EXPORT_THEME,
        assets: { fetchImage: async () => PNG_BYTES },
      }),
    ]);

    const archiveText = new TextDecoder().decode(withoutFetcher);
    expect(archiveText).not.toContain('word/media/');
    expect(withoutFetcher.byteLength).toBeLessThan(withFetcher.byteLength);
  });
});
