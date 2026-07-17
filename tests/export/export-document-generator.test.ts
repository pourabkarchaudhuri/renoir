import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportDocument,
  registerExporter,
  listRegisteredFormats,
} from '../../shared/export/document-generator';
import { DEFAULT_EXPORT_THEME } from '../../shared/export/theme';
import type { DocumentExporter } from '../../shared/export/exporter';
import type { ExportDocument } from '../../shared/export/types';

const doc: ExportDocument = {
  title: 'Registry Test',
  createdAt: '2026-01-01T00:00:00.000Z',
  modifiedAt: '2026-01-02T00:00:00.000Z',
  blocks: [{ type: 'paragraph', inlines: [{ type: 'text', text: 'Hello' }] }],
};

describe('document-generator registry', () => {
  beforeEach(() => {
    const testExporter: DocumentExporter = {
      format: 'markdown',
      async export(d) {
        return `# ${d.title}`;
      },
    };
    registerExporter(testExporter);
  });

  it('lists registered formats', () => {
    expect(listRegisteredFormats()).toContain('markdown');
  });

  it('dispatches to registered exporter', async () => {
    const out = await exportDocument('markdown', doc, { theme: DEFAULT_EXPORT_THEME });
    expect(out).toBe('# Registry Test');
  });

  it('throws for unknown format', async () => {
    await expect(
      exportDocument('docx' as 'markdown', doc, { theme: DEFAULT_EXPORT_THEME }),
    ).rejects.toThrow(/No exporter registered/);
  });
});
