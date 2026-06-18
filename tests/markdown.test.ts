import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/lib/markdown';

describe('mermaid block detection', () => {
  it('emits a mermaid-placeholder div for mermaid fenced blocks', () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('class="mermaid-placeholder my-2"');
    expect(html).toContain('data-mermaid-src=');
    expect(html).not.toContain('<pre');
    expect(html).not.toContain('<code');
  });

  it('detects mermaid language case-insensitively', () => {
    const variants = ['Mermaid', 'MERMAID', 'MeRmAiD'];
    for (const lang of variants) {
      const html = renderMarkdown(`\`\`\`${lang}\ngraph LR\n  X-->Y\n\`\`\``);
      expect(html).toContain('mermaid-placeholder');
      expect(html).not.toContain('<pre');
    }
  });

  it('base64-encodes mermaid source and round-trips correctly', () => {
    const source = 'graph TD\n  A[Start] --> B[End]';
    const md = '```mermaid\n' + source + '\n```';
    const html = renderMarkdown(md);
    const match = html.match(/data-mermaid-src="([^"]+)"/);
    expect(match).not.toBeNull();
    const decoded = decodeURIComponent(atob(match![1]));
    expect(decoded).toBe(source);
  });

  it('preserves non-mermaid code blocks as pre/code', () => {
    const md = '```typescript\nconst x = 1;\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('<pre');
    expect(html).toContain('<code');
    expect(html).toContain('lang-typescript');
    expect(html).not.toContain('mermaid-placeholder');
  });

  it('handles empty mermaid blocks gracefully', () => {
    const md = '```mermaid\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('mermaid-placeholder');
    expect(html).toContain('data-mermaid-src=');
    // Should encode empty string — btoa('') is ''
    const match = html.match(/data-mermaid-src="([^"]*)"/);
    expect(match).not.toBeNull();
    const decoded = decodeURIComponent(atob(match![1]));
    expect(decoded).toBe('');
  });

  it('never contains unescaped script tags inside mermaid source', () => {
    const md = '```mermaid\n<script>alert("xss")</script>\n```';
    const html = renderMarkdown(md);
    expect(html).not.toContain('<script>');
    expect(html).toContain('mermaid-placeholder');
    // The source is base64-encoded, not rendered as raw HTML
    const match = html.match(/data-mermaid-src="([^"]+)"/);
    expect(match).not.toBeNull();
    const decoded = decodeURIComponent(atob(match![1]));
    expect(decoded).toBe('<script>alert("xss")</script>');
  });
});

describe('markdown renderer', () => {
  it('escapes raw HTML', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders headings', () => {
    expect(renderMarkdown('# Title')).toMatch(/<h1[^>]*>Title<\/h1>/);
    expect(renderMarkdown('### Sub')).toMatch(/<h3[^>]*>Sub<\/h3>/);
  });

  it('renders ordered + unordered lists', () => {
    expect(renderMarkdown('- a\n- b')).toMatch(/<ul[^>]*>.*<li[^>]*>a<\/li>.*<li[^>]*>b<\/li>.*<\/ul>/);
    expect(renderMarkdown('1. a\n2. b')).toMatch(/<ol[^>]*>.*<li[^>]*>a<\/li>/);
  });

  it('renders fenced code with language', () => {
    const html = renderMarkdown('```ts\nconst x = 1;\n```');
    expect(html).toContain('lang-ts');
    expect(html).toContain('const x = 1;');
  });

  it('renders inline emphasis + code + links', () => {
    const html = renderMarkdown('hi **bold** and *italic* and `code` and [home](https://example.com)');
    expect(html).toContain('<strong');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code');
    expect(html).toContain('href="https://example.com"');
  });

  it('handles horizontal rule', () => {
    expect(renderMarkdown('---')).toContain('<hr');
  });
});
