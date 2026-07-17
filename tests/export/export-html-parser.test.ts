import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { htmlToExportBlocks, sanitizeHtmlForExport } from '../../shared/export/html-parser';

const fixture = fs.readFileSync(
  path.join(__dirname, '../fixtures/export/sample-artifact.html'),
  'utf8',
);

function parse(html: string) {
  return htmlToExportBlocks(html, (source) => new JSDOM(source).window.document);
}

describe('htmlToExportBlocks', () => {
  it('parses headings, paragraphs, and inline formatting', () => {
    const blocks = parse(fixture);
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'Product Launch' });
    expect(blocks[1]?.type).toBe('paragraph');
    if (blocks[1]?.type === 'paragraph') {
      expect(blocks[1].inlines.some((i) => i.type === 'text' && i.bold)).toBe(true);
      expect(blocks[1].inlines.some((i) => i.type === 'text' && i.italic)).toBe(true);
    }
  });

  it('parses lists and tables', () => {
    const blocks = parse(fixture);
    expect(blocks.some((b) => b.type === 'bulletList')).toBe(true);
    expect(blocks.some((b) => b.type === 'orderedList')).toBe(true);
    const table = blocks.find((b) => b.type === 'table');
    expect(table).toMatchObject({
      type: 'table',
      headers: ['Plan', 'Price'],
      rows: [['Pro', '$29'], ['Team', '$99']],
    });
  });

  it('parses code, blockquote, image, hr, checklist', () => {
    const blocks = parse(fixture);
    expect(blocks.some((b) => b.type === 'code' && b.language === 'typescript')).toBe(true);
    expect(blocks.some((b) => b.type === 'blockquote')).toBe(true);
    expect(blocks.some((b) => b.type === 'image')).toBe(true);
    expect(blocks.some((b) => b.type === 'horizontalRule')).toBe(true);
    const checklist = blocks.find((b) => b.type === 'checklist');
    expect(checklist?.type === 'checklist' && checklist.items.length).toBe(2);
  });

  it('strips scripts via sanitizeHtmlForExport', () => {
    const dirty = '<script>alert(1)</script><p>Safe</p>';
    const clean = sanitizeHtmlForExport(dirty);
    const blocks = parse(clean);
    expect(clean).not.toContain('script');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('paragraph');
  });

  it('inserts page breaks between deck slides', () => {
    const html = '<section data-slide="1"><h1>Slide 1</h1></section><section data-slide="2"><h1>Slide 2</h1></section>';
    const blocks = htmlToExportBlocks(html, (s) => new JSDOM(s).window.document, { pageBreakBetweenSlides: true });
    expect(blocks.filter((b) => b.type === 'pageBreak').length).toBe(1);
  });

  it('keeps images with empty or placeholder src as placeholder blocks', () => {
    const html = '<img src="" alt="Hero shot"><img src="#" alt=""><img src="https://cdn.example.com/placeholder.png" alt="Team photo">';
    const blocks = parse(html);
    expect(blocks).toHaveLength(3);
    for (const b of blocks) {
      expect(b).toMatchObject({ type: 'image', placeholder: true, src: '' });
    }
    expect(blocks[0]).toMatchObject({ alt: 'Hero shot' });
    expect(blocks[2]).toMatchObject({ alt: 'Team photo' });
  });

  it('converts app image-slot divs into placeholder blocks with cleaned labels', () => {
    const html = '<div class="ph-img wide">[ Hero visual · 16:9 ]</div><div class="img-slot">Dashboard screenshot</div>';
    const blocks = parse(html);
    expect(blocks).toEqual([
      { type: 'image', src: '', alt: 'Hero visual', placeholder: true },
      { type: 'image', src: '', alt: 'Dashboard screenshot', placeholder: true },
    ]);
  });

  it('does not treat regular images as placeholders', () => {
    const blocks = parse('<img src="data:image/png;base64,iVBORw0KGgo=" alt="Logo">');
    expect(blocks[0]).toMatchObject({ type: 'image', alt: 'Logo' });
    expect(blocks[0]?.type === 'image' && blocks[0].placeholder).toBeFalsy();
  });

  it('parses filled ph-img frames as real image blocks', () => {
    const html = '<div class="ph-img wide"><img src="renoir-asset://images/hero.png" alt="Hero visual" class="renoir-framed-img"></div>';
    const blocks = parse(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'image',
      src: 'renoir-asset://images/hero.png',
      alt: 'Hero visual',
    });
    expect(blocks[0]?.type === 'image' && blocks[0].placeholder).toBeFalsy();
  });

  it('parses filled img-slot frames with inline data URLs', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const html = `<div class="img-slot"><img src="${dataUrl}" alt="Dashboard screenshot"></div>`;
    const blocks = parse(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'image',
      src: dataUrl,
      alt: 'Dashboard screenshot',
    });
    expect(blocks[0]?.type === 'image' && blocks[0].placeholder).toBeFalsy();
  });

  it('keeps empty ph-img frames as placeholders', () => {
    const html = '<div class="ph-img wide">[ Hero visual · 16:9 ]</div>';
    const blocks = parse(html);
    expect(blocks).toEqual([
      { type: 'image', src: '', alt: 'Hero visual', placeholder: true },
    ]);
  });
});
