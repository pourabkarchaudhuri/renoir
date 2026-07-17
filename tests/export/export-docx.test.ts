import { describe, it, expect } from 'vitest';
import { documentToDocxBuffer } from '../../electron/export/docx-exporter';
import { DEFAULT_EXPORT_THEME } from '../../shared/export/theme';
import type { ExportDocument } from '../../shared/export/types';

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
});
