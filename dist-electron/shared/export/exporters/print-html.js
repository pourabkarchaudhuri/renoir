import { DEFAULT_EXPORT_THEME, printDocumentCss } from '../theme.js';
function escHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function inlineToHtml(inline) {
    if (inline.type === 'link') {
        return `<a href="${escHtml(inline.href)}">${escHtml(inline.text)}</a>`;
    }
    let t = escHtml(inline.text);
    if (inline.code)
        t = `<code>${t}</code>`;
    if (inline.bold)
        t = `<strong>${t}</strong>`;
    if (inline.italic)
        t = `<em>${t}</em>`;
    return t;
}
function inlinesToHtml(inlines) {
    return inlines.map(inlineToHtml).join('');
}
function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    catch {
        return iso;
    }
}
function inputsToHtml(inputs) {
    if (!inputs.length)
        return '';
    const rows = inputs.map((i) => `<tr><th>${escHtml(i.label)}</th><td>${escHtml(i.value).replace(/\n/g, '<br>')}</td></tr>`);
    return `<section class="doc-inputs"><h2>Brief</h2><table><tbody>${rows.join('')}</tbody></table></section>`;
}
function blockToHtml(block) {
    switch (block.type) {
        case 'heading':
            return `<h${block.level}>${escHtml(block.text)}</h${block.level}>`;
        case 'paragraph':
            return `<p>${inlinesToHtml(block.inlines)}</p>`;
        case 'bulletList':
            return `<ul>${block.items.map((item) => {
                const nested = item.nested?.map(blockToHtml).join('') ?? '';
                return `<li>${inlinesToHtml(item.inlines)}${nested}</li>`;
            }).join('')}</ul>`;
        case 'orderedList':
            return `<ol>${block.items.map((item) => {
                const nested = item.nested?.map(blockToHtml).join('') ?? '';
                return `<li>${inlinesToHtml(item.inlines)}${nested}</li>`;
            }).join('')}</ol>`;
        case 'checklist':
            return `<ul class="checklist">${block.items.map((item) => `<li><input type="checkbox" disabled ${item.checked ? 'checked' : ''}> ${escHtml(item.text)}</li>`).join('')}</ul>`;
        case 'table': {
            const headers = block.headers;
            const head = headers?.length
                ? `<thead><tr>${headers.map((h) => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>`
                : '';
            const body = block.rows.map((row) => `<tr>${row.map((c) => `<td>${escHtml(c)}</td>`).join('')}</tr>`).join('');
            return `<table>${head}<tbody>${body}</tbody></table>`;
        }
        case 'code':
            return `<pre><code class="language-${escHtml(block.language ?? '')}">${escHtml(block.code)}</code></pre>`;
        case 'blockquote':
            return `<blockquote>${inlinesToHtml(block.inlines)}</blockquote>`;
        case 'image': {
            if (block.placeholder || !block.src) {
                const label = block.alt?.trim() ? escHtml(block.alt) : 'Image placeholder';
                return `<div class="img-placeholder">${label}</div>`;
            }
            const cap = block.caption ? `<figcaption>${escHtml(block.caption)}</figcaption>` : '';
            const w = block.widthPx ? ` width="${block.widthPx}"` : '';
            return `<figure><img src="${escHtml(block.src)}" alt="${escHtml(block.alt ?? '')}"${w}>${cap}</figure>`;
        }
        case 'pageBreak':
            return '<div class="page-break"></div>';
        case 'horizontalRule':
            return '<hr>';
        default:
            return '';
    }
}
export function documentToPrintHtml(doc, theme = DEFAULT_EXPORT_THEME) {
    const metaParts = [];
    if (doc.skillName)
        metaParts.push(`Skill: ${escHtml(doc.skillName)}`);
    metaParts.push(`Created: ${formatDate(doc.createdAt)}`);
    metaParts.push(`Modified: ${formatDate(doc.modifiedAt)}`);
    const header = `
    <header class="doc-header">
      <h1 class="doc-title">${escHtml(doc.title)}</h1>
      ${doc.subtitle ? `<p class="doc-subtitle">${escHtml(doc.subtitle)}</p>` : ''}
      ${doc.description ? `<p>${escHtml(doc.description)}</p>` : ''}
      <p class="doc-meta">${metaParts.join(' · ')}</p>
    </header>
  `;
    const body = doc.blocks.map(blockToHtml).join('\n');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(doc.title)}</title>
  <style>${printDocumentCss(theme)}</style>
</head>
<body>
${header}
${doc.inputs?.length ? inputsToHtml(doc.inputs) : ''}
<main>
${body}
</main>
</body>
</html>`;
}
export const printHtmlExporter = {
    format: 'pdf',
    async export(doc, ctx) {
        return documentToPrintHtml(doc, ctx.theme);
    },
};
/** PDF pipeline uses print HTML as intermediate; this helper returns the HTML string. */
export function exportDocumentToPrintHtml(doc, theme) {
    return documentToPrintHtml(doc, theme ?? DEFAULT_EXPORT_THEME);
}
