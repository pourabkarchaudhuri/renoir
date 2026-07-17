/** Professional document theme shared across all export formats. */

export interface ExportTheme {
  fonts: {
    body: string;
    heading: string;
    mono: string;
  };
  colors: {
    text: string;
    muted: string;
    border: string;
    codeBg: string;
    codeText: string;
    link: string;
    tableHeaderBg: string;
  };
  sizes: {
    body: number;
    lineHeight: number;
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
    code: number;
    marginCm: number;
  };
}

export const DEFAULT_EXPORT_THEME: ExportTheme = {
  fonts: {
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    heading: 'Georgia, "Times New Roman", Times, serif',
    mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
  },
  colors: {
    text: '#1a1a1a',
    muted: '#5c5c5c',
    border: '#d4d4d4',
    codeBg: '#f5f5f5',
    codeText: '#24292e',
    link: '#0969da',
    tableHeaderBg: '#f0f0f0',
  },
  sizes: {
    body: 11,
    lineHeight: 1.5,
    h1: 24,
    h2: 20,
    h3: 16,
    h4: 14,
    h5: 12,
    h6: 11,
    code: 10,
    marginCm: 2.5,
  },
};

export function headingSize(theme: ExportTheme, level: 1 | 2 | 3 | 4 | 5 | 6): number {
  const map = { 1: theme.sizes.h1, 2: theme.sizes.h2, 3: theme.sizes.h3, 4: theme.sizes.h4, 5: theme.sizes.h5, 6: theme.sizes.h6 };
  return map[level];
}

/** Static CSS for code syntax highlighting in print HTML (no runtime highlighter). */
export function syntaxHighlightCss(): string {
  return `
    .hljs-keyword, .hljs-selector-tag { color: #d73a49; }
    .hljs-string, .hljs-attr { color: #032f62; }
    .hljs-comment { color: #6a737d; font-style: italic; }
    .hljs-number, .hljs-literal { color: #005cc5; }
    .hljs-function, .hljs-title { color: #6f42c1; }
    .hljs-built_in { color: #e36209; }
  `.trim();
}

export function printDocumentCss(theme: ExportTheme): string {
  const m = theme.sizes.marginCm;
  return `
    @page { margin: ${m}cm; size: A4; }
    * { box-sizing: border-box; }
    html { font-size: ${theme.sizes.body}pt; }
    body {
      font-family: ${theme.fonts.body};
      color: ${theme.colors.text};
      line-height: ${theme.sizes.lineHeight};
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${theme.fonts.heading};
      font-weight: 600;
      line-height: 1.25;
      margin: 1.2em 0 0.5em;
      page-break-after: avoid;
    }
    h1 { font-size: ${theme.sizes.h1}pt; }
    h2 { font-size: ${theme.sizes.h2}pt; }
    h3 { font-size: ${theme.sizes.h3}pt; }
    h4 { font-size: ${theme.sizes.h4}pt; }
    h5 { font-size: ${theme.sizes.h5}pt; }
    h6 { font-size: ${theme.sizes.h6}pt; }
    p { margin: 0.6em 0; }
    a { color: ${theme.colors.link}; text-decoration: underline; }
    blockquote {
      margin: 1em 0;
      padding: 0.5em 1em;
      border-left: 3px solid ${theme.colors.border};
      color: ${theme.colors.muted};
    }
    ul, ol { margin: 0.6em 0; padding-left: 1.5em; }
    li { margin: 0.25em 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid ${theme.colors.border};
      padding: 0.4em 0.6em;
      text-align: left;
      vertical-align: top;
    }
    th { background: ${theme.colors.tableHeaderBg}; font-weight: 600; }
    pre, code {
      font-family: ${theme.fonts.mono};
      font-size: ${theme.sizes.code}pt;
    }
    pre {
      background: ${theme.colors.codeBg};
      color: ${theme.colors.codeText};
      padding: 0.8em 1em;
      border-radius: 4px;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    code { background: ${theme.colors.codeBg}; padding: 0.1em 0.3em; border-radius: 2px; }
    pre code { background: none; padding: 0; }
    img { max-width: 100%; height: auto; page-break-inside: avoid; }
    figure { margin: 1em 0; page-break-inside: avoid; }
    figcaption { font-size: 0.9em; color: ${theme.colors.muted}; margin-top: 0.4em; }
    .img-placeholder {
      border: 1.5px dashed ${theme.colors.border};
      border-radius: 6px;
      background: ${theme.colors.codeBg};
      color: ${theme.colors.muted};
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 140px;
      margin: 1em 0;
      font-size: 0.9em;
      font-style: italic;
      page-break-inside: avoid;
    }
    hr { border: none; border-top: 1px solid ${theme.colors.border}; margin: 1.5em 0; }
    .page-break { page-break-before: always; }
    .doc-header { margin-bottom: 2em; border-bottom: 1px solid ${theme.colors.border}; padding-bottom: 1em; }
    .doc-title { font-family: ${theme.fonts.heading}; font-size: ${theme.sizes.h1}pt; margin: 0 0 0.25em; }
    .doc-subtitle { font-size: ${theme.sizes.h3}pt; color: ${theme.colors.muted}; margin: 0 0 0.5em; }
    .doc-meta { font-size: 0.85em; color: ${theme.colors.muted}; }
    .doc-inputs { margin: 1.5em 0; }
    .doc-inputs table { font-size: 0.95em; }
    ${syntaxHighlightCss()}
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `.trim();
}
