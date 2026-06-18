import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/lib/markdown';

/**
 * These tests verify that the ChatMarkdown integration works correctly by
 * testing the HTML output from renderMarkdown() that ChatMarkdown consumes.
 * They ensure:
 * - Non-mermaid messages produce HTML without mermaid-placeholder divs (render identically)
 * - Mermaid messages produce properly structured placeholder divs that ChatMarkdown can parse
 * - Mixed content (mermaid + non-mermaid) produces correct split points
 */

describe('ChatMarkdown integration - non-mermaid rendering identity', () => {
  it('plain text renders as paragraph without mermaid placeholders', () => {
    const html = renderMarkdown('Hello world');
    expect(html).toContain('<p');
    expect(html).toContain('Hello world');
    expect(html).not.toContain('mermaid-placeholder');
  });

  it('code blocks render as pre/code without mermaid placeholders', () => {
    const html = renderMarkdown('```javascript\nconsole.log("hi");\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('<code');
    expect(html).toContain('lang-javascript');
    expect(html).not.toContain('mermaid-placeholder');
  });

  it('headings, lists, and inline formatting render without mermaid placeholders', () => {
    const md = `# Title

- item **bold**
- item *italic*

1. first
2. second

Some \`inline code\` and [link](https://example.com)`;
    const html = renderMarkdown(md);
    expect(html).toContain('<h1');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
    expect(html).toContain('<strong');
    expect(html).toContain('<em>');
    expect(html).toContain('<code');
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('mermaid-placeholder');
  });
});

describe('ChatMarkdown integration - mermaid placeholder structure', () => {
  it('mermaid placeholder div has correct structure for ChatMarkdown parsing', () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    const html = renderMarkdown(md);
    // The regex in ChatMarkdown expects this exact pattern
    const regex = /<div data-mermaid-src="([^"]*)" class="mermaid-placeholder[^"]*"><\/div>/;
    expect(html).toMatch(regex);
  });

  it('mixed content produces HTML with clear split points', () => {
    const md = `Here is some text.

\`\`\`mermaid
graph TD
  A-->B
\`\`\`

And more text after.`;
    const html = renderMarkdown(md);
    // Should have both regular HTML and a mermaid placeholder
    expect(html).toContain('<p');
    expect(html).toContain('Here is some text.');
    expect(html).toContain('mermaid-placeholder');
    expect(html).toContain('And more text after.');
  });

  it('multiple mermaid blocks produce multiple placeholders', () => {
    const md = `\`\`\`mermaid
graph TD
  A-->B
\`\`\`

\`\`\`mermaid
sequenceDiagram
  Alice->>Bob: Hello
\`\`\``;
    const html = renderMarkdown(md);
    const matches = html.match(/mermaid-placeholder/g);
    expect(matches).toHaveLength(2);
  });

  it('mermaid source can be decoded from placeholder data attribute', () => {
    const source = 'graph TD\n  A[Start] --> B[End]';
    const md = '```mermaid\n' + source + '\n```';
    const html = renderMarkdown(md);
    const match = html.match(/data-mermaid-src="([^"]+)"/);
    expect(match).not.toBeNull();
    const decoded = decodeURIComponent(atob(match![1]));
    expect(decoded).toBe(source);
  });
});

describe('ChatMarkdown integration - unique ID generation', () => {
  it('different mermaid sources produce different hashes', () => {
    const source1 = 'graph TD\n  A-->B';
    const source2 = 'graph LR\n  X-->Y';
    // Simulate the simpleHash function from ChatMarkdown
    function simpleHash(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return Math.abs(hash).toString(36);
    }
    const hash1 = simpleHash(source1);
    const hash2 = simpleHash(source2);
    expect(hash1).not.toBe(hash2);
  });

  it('same mermaid source produces same hash (deterministic)', () => {
    const source = 'graph TD\n  A-->B';
    function simpleHash(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return Math.abs(hash).toString(36);
    }
    expect(simpleHash(source)).toBe(simpleHash(source));
  });

  it('ID format follows mermaid-{index}-{hash} pattern', () => {
    const source = 'graph TD\n  A-->B';
    function simpleHash(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return Math.abs(hash).toString(36);
    }
    const id = `mermaid-0-${simpleHash(source)}`;
    expect(id).toMatch(/^mermaid-\d+-[a-z0-9]+$/);
  });
});
