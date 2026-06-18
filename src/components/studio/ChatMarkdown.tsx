import { useMemo } from 'react';
import { MermaidBlock } from './MermaidBlock';

interface ChatMarkdownProps {
  /** HTML string produced by renderMarkdown() */
  html: string;
}

/**
 * Generates a simple hash from a string for use in unique IDs.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

interface Segment {
  type: 'html' | 'mermaid';
  content: string; // HTML string for 'html', decoded source for 'mermaid'
}

/**
 * Splits the HTML output from renderMarkdown() into segments,
 * separating mermaid-placeholder divs from regular HTML content.
 */
function splitAtMermaidPlaceholders(html: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /<div data-mermaid-src="([^"]*)" class="mermaid-placeholder[^"]*"><\/div>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    // Add preceding HTML if any
    if (match.index > lastIndex) {
      segments.push({ type: 'html', content: html.slice(lastIndex, match.index) });
    }

    // Decode the mermaid source from the data attribute
    const encoded = match[1];
    try {
      const source = decodeURIComponent(atob(encoded));
      segments.push({ type: 'mermaid', content: source });
    } catch {
      // If decoding fails, render as raw HTML
      segments.push({ type: 'html', content: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add trailing HTML if any
  if (lastIndex < html.length) {
    segments.push({ type: 'html', content: html.slice(lastIndex) });
  }

  return segments;
}

/**
 * ChatMarkdown renders the HTML output from renderMarkdown(), replacing
 * mermaid-placeholder divs with interactive MermaidBlock React components.
 * Non-mermaid content is rendered identically to the previous dangerouslySetInnerHTML approach.
 */
export function ChatMarkdown({ html }: ChatMarkdownProps) {
  const segments = useMemo(() => splitAtMermaidPlaceholders(html), [html]);

  // Fast path: no mermaid placeholders, render exactly as before
  if (segments.length === 1 && segments[0].type === 'html') {
    return <div className="prose-renoir" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  let mermaidIndex = 0;

  return (
    <div className="prose-renoir">
      {segments.map((segment, i) => {
        if (segment.type === 'html') {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: segment.content }}
            />
          );
        }

        // Mermaid segment — render MermaidBlock with unique ID
        const currentIndex = mermaidIndex++;
        const id = `mermaid-${currentIndex}-${simpleHash(segment.content)}`;
        return (
          <MermaidBlock
            key={id}
            source={segment.content}
            id={id}
          />
        );
      })}
    </div>
  );
}
