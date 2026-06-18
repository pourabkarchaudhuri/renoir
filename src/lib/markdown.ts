// Tiny markdown renderer. Zero deps. Supports the subset our chat actually
// produces: headings, paragraphs, ordered/unordered lists, fenced code, inline
// code, bold/italic, links, hr. HTML inside the source is escaped — never
// executed in the chat surface.

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

import { expandEmoji } from './emoji';

function inlineFmt(raw: string): string {
  let s = esc(expandEmoji(raw));
  // fenced inline code already handled at block level; preserve `code`
  s = s.replace(/`([^`]+?)`/g, '<code class="px-1 py-px rounded bg-secondary text-foreground/90 font-mono text-[0.92em]">$1</code>');
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  s = s.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+?)\]\(((?:https?|mailto):[^\s)]+?)\)/g,
    '<a href="$2" class="text-primary underline underline-offset-2 hover:no-underline">$1</a>');
  return s;
}

export function renderMarkdown(input: string): string {
  if (!input) return '';
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    const fence = line.match(/^```\s*([\w-]*)\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      i++; // consume closing fence
      const source = code.join('\n');
      if (lang.toLowerCase() === 'mermaid') {
        const encoded = btoa(encodeURIComponent(source));
        out.push(`<div data-mermaid-src="${encoded}" class="mermaid-placeholder my-2"></div>`);
      } else {
        out.push(
          `<pre class="my-2 plate rounded-lg p-3 overflow-x-auto scroll-thin"><code class="font-mono text-[12px] leading-relaxed${lang ? ` lang-${lang}` : ''}">${esc(source)}</code></pre>`
        );
      }
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-base', 'text-base'];
      out.push(`<h${level} class="${sizes[level - 1]} font-display italic mt-3 mb-1.5">${inlineFmt(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line)) { out.push('<hr class="my-3 border-border" />'); i++; continue; }

    // Unordered list
    if (/^[\s]*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*]\s+/.test(lines[i])) {
        items.push('<li class="my-0.5">' + inlineFmt(lines[i].replace(/^[\s]*[-*]\s+/, '')) + '</li>');
        i++;
      }
      out.push('<ul class="list-disc pl-5 my-1.5">' + items.join('') + '</ul>');
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
        items.push('<li class="my-0.5">' + inlineFmt(lines[i].replace(/^[\s]*\d+\.\s+/, '')) + '</li>');
        i++;
      }
      out.push('<ol class="list-decimal pl-5 my-1.5">' + items.join('') + '</ol>');
      continue;
    }

    // Blank line
    if (line.trim() === '') { i++; continue; }

    // Paragraph (collect until blank)
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(```|#{1,6}\s|---+$|[-*]\s|\d+\.\s)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push('<p class="my-1.5 leading-relaxed">' + inlineFmt(buf.join(' ')) + '</p>');
  }
  return out.join('');
}
