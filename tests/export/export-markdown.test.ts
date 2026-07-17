import { describe, it, expect } from 'vitest';
import { documentToMarkdown } from '../../shared/export/exporters/markdown';
import type { ExportDocument } from '../../shared/export/types';

const sampleDoc: ExportDocument = {
  title: 'Test Report',
  subtitle: 'Q1 Summary',
  skillName: 'Blog Post',
  skillId: 'blog-post',
  createdAt: '2026-01-15T10:00:00.000Z',
  modifiedAt: '2026-02-01T12:00:00.000Z',
  inputs: [{ label: 'Audience', value: 'Developers' }],
  blocks: [
    { type: 'heading', level: 2, text: 'Overview' },
    { type: 'paragraph', inlines: [{ type: 'text', text: 'Hello ', bold: true }, { type: 'link', text: 'world', href: 'https://example.com' }] },
    { type: 'table', headers: ['A', 'B'], rows: [['1', '2']] },
    { type: 'code', language: 'js', code: 'console.log(1)' },
    { type: 'checklist', items: [{ text: 'Task', checked: true }] },
    { type: 'pageBreak' },
    { type: 'horizontalRule' },
  ],
};

describe('documentToMarkdown', () => {
  it('includes YAML frontmatter and metadata', async () => {
    const md = await documentToMarkdown(sampleDoc);
    expect(md).toContain('---');
    expect(md).toContain('title: "Test Report"');
    expect(md).toContain('skill: "Blog Post"');
    expect(md).toContain('created: "2026-01-15T10:00:00.000Z"');
  });

  it('renders brief inputs as GFM table', async () => {
    const md = await documentToMarkdown(sampleDoc);
    expect(md).toContain('## Brief');
    expect(md).toContain('| Audience | Developers |');
  });

  it('renders blocks with GFM formatting', async () => {
    const md = await documentToMarkdown(sampleDoc);
    expect(md).toContain('## Overview');
    expect(md).toContain('**Hello **');
    expect(md).toContain('[world](https://example.com)');
    expect(md).toContain('| A | B |');
    expect(md).toContain('```js');
    expect(md).toContain('- [x] Task');
    expect(md).toContain('<!-- pagebreak -->');
    expect(md).toContain('---');
  });

  it('renders image placeholders as marker text', async () => {
    const md = await documentToMarkdown({
      ...sampleDoc,
      blocks: [
        { type: 'image', src: '', alt: 'Hero visual', placeholder: true },
        { type: 'image', src: 'https://example.com/a.png', alt: 'Real' },
      ],
    });
    expect(md).toContain('> *[Image placeholder: Hero visual]*');
    expect(md).toContain('![Real](https://example.com/a.png)');
  });

  it('inlines renoir-asset image src values when fetchImage is available', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    const md = await documentToMarkdown(
      {
        ...sampleDoc,
        blocks: [{ type: 'image', src: 'renoir-asset://images/hero.png', alt: 'Hero' }],
      },
      {
        theme: { fontFamily: 'sans-serif', accent: '#000', text: '#111', muted: '#666', border: '#ddd', background: '#fff' },
        assets: {
          fetchImage: async (src) => (src === 'renoir-asset://images/hero.png' ? png : null),
        },
      },
    );
    expect(md).toContain('![Hero](data:image/png;base64,');
    expect(md).not.toContain('renoir-asset://');
  });
});
