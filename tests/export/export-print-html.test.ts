import { describe, it, expect } from 'vitest';
import { documentToPrintHtml } from '../../shared/export/exporters/print-html';
import type { ExportDocument } from '../../shared/export/types';

const sampleDoc: ExportDocument = {
  title: 'Annual Review',
  skillName: 'Changelog',
  createdAt: '2026-03-01T00:00:00.000Z',
  modifiedAt: '2026-03-15T00:00:00.000Z',
  blocks: [
    { type: 'heading', level: 2, text: 'Highlights' },
    { type: 'paragraph', inlines: [{ type: 'text', text: 'Strong quarter.' }] },
    { type: 'pageBreak' },
    { type: 'table', headers: ['Metric', 'Value'], rows: [['Revenue', '$1M']] },
  ],
};

describe('documentToPrintHtml', () => {
  it('produces standalone HTML with theme CSS', () => {
    const html = documentToPrintHtml(sampleDoc);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Annual Review</title>');
    expect(html).toContain('.doc-title');
    expect(html).toContain('@page');
    expect(html).toContain('page-break-before: always');
  });

  it('renders document structure', () => {
    const html = documentToPrintHtml(sampleDoc);
    expect(html).toContain('<h2>Highlights</h2>');
    expect(html).toContain('Strong quarter.');
    expect(html).toContain('<div class="page-break">');
    expect(html).toContain('<th>Metric</th>');
    expect(html).toContain('<td>Revenue</td>');
  });

  it('renders image placeholders as styled boxes', () => {
    const html = documentToPrintHtml({
      ...sampleDoc,
      blocks: [
        { type: 'image', src: '', alt: 'Hero visual', placeholder: true },
        { type: 'image', src: '', placeholder: true },
      ],
    });
    expect(html).toContain('<div class="img-placeholder">Hero visual</div>');
    expect(html).toContain('<div class="img-placeholder">Image placeholder</div>');
    expect(html).toContain('.img-placeholder');
  });
});
