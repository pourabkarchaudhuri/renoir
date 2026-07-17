const BLOCK_TAGS = new Set([
    'P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'NAV', 'ASIDE',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'PRE', 'BLOCKQUOTE',
    'HR', 'FIGURE', 'IMG', 'LI', 'DL', 'DT', 'DD',
]);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO']);
function textContent(node) {
    return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
}
function collectInlines(node, inherited = {}) {
    const out = [];
    const pushText = (t, style) => {
        const trimmed = t.replace(/\s+/g, ' ');
        if (!trimmed)
            return;
        out.push({
            type: 'text',
            text: trimmed,
            bold: style.bold || undefined,
            italic: style.italic || undefined,
            code: style.code || undefined,
        });
    };
    const walk = (n, style) => {
        if (n.nodeType === 3) {
            pushText(n.textContent ?? '', style);
            return;
        }
        if (n.nodeType !== 1)
            return;
        const el = n;
        const tag = el.tagName;
        if (SKIP_TAGS.has(tag))
            return;
        if (tag === 'BR') {
            out.push({ type: 'text', text: '\n' });
            return;
        }
        if (tag === 'A') {
            const href = el.getAttribute('href') ?? '';
            const label = textContent(el);
            if (href && label) {
                out.push({ type: 'link', text: label, href });
            }
            else if (label) {
                out.push({ type: 'text', text: label });
            }
            return;
        }
        const next = {
            bold: style.bold || tag === 'STRONG' || tag === 'B',
            italic: style.italic || tag === 'EM' || tag === 'I',
            code: style.code || tag === 'CODE',
        };
        for (const child of Array.from(el.childNodes))
            walk(child, next);
    };
    for (const child of Array.from(node.childNodes))
        walk(child, inherited);
    return mergeAdjacentTextInlines(out);
}
function mergeAdjacentTextInlines(inlines) {
    const merged = [];
    for (const inline of inlines) {
        if (inline.type !== 'text') {
            merged.push(inline);
            continue;
        }
        const prev = merged[merged.length - 1];
        if (prev?.type === 'text'
            && prev.bold === inline.bold
            && prev.italic === inline.italic
            && prev.code === inline.code) {
            prev.text += inline.text;
        }
        else {
            merged.push({ ...inline });
        }
    }
    return merged.filter((i) => i.type !== 'text' || i.text.trim().length > 0);
}
function parseListItems(listEl, ordered) {
    const items = [];
    for (const li of Array.from(listEl.querySelectorAll(':scope > li'))) {
        const clone = li.cloneNode(true);
        for (const nested of Array.from(clone.querySelectorAll('ul, ol')))
            nested.remove();
        const inlines = collectInlines(clone);
        const nested = [];
        for (const child of Array.from(li.children)) {
            if (child.tagName === 'UL')
                nested.push(...parseList(child, false));
            if (child.tagName === 'OL')
                nested.push(...parseList(child, true));
        }
        items.push({
            inlines: inlines.length ? inlines : [{ type: 'text', text: textContent(li) }],
            nested: nested.length ? nested : undefined,
        });
    }
    return items;
}
function parseList(el, ordered) {
    const items = parseListItems(el, ordered);
    if (!items.length)
        return [];
    return [{ type: ordered ? 'orderedList' : 'bulletList', items }];
}
function parseTable(table) {
    const headers = [];
    const rows = [];
    const thead = table.querySelector('thead');
    if (thead) {
        const hr = thead.querySelector('tr');
        if (hr) {
            for (const cell of Array.from(hr.querySelectorAll('th, td'))) {
                headers.push(textContent(cell));
            }
        }
    }
    const bodyRows = table.querySelectorAll('tbody tr, tr');
    for (const tr of Array.from(bodyRows)) {
        if (thead && tr.closest('thead'))
            continue;
        const cells = [];
        for (const cell of Array.from(tr.querySelectorAll('th, td'))) {
            cells.push(textContent(cell));
        }
        if (cells.length) {
            if (!headers.length && rows.length === 0 && tr.querySelector('th')) {
                headers.push(...cells);
            }
            else {
                rows.push(cells);
            }
        }
    }
    if (!headers.length && !rows.length)
        return null;
    return { type: 'table', headers: headers.length ? headers : undefined, rows };
}
function parseChecklist(ul) {
    const inputs = ul.querySelectorAll('input[type="checkbox"]');
    if (!inputs.length)
        return null;
    const items = [];
    for (const li of Array.from(ul.querySelectorAll(':scope > li'))) {
        const input = li.querySelector('input[type="checkbox"]');
        if (!input)
            continue;
        const clone = li.cloneNode(true);
        clone.querySelector('input')?.remove();
        items.push({
            text: textContent(clone),
            checked: input.checked || input.hasAttribute('checked'),
        });
    }
    return items.length ? { type: 'checklist', items } : null;
}
function parsePre(el) {
    const code = el.querySelector('code');
    const lang = code?.className.match(/language-(\w+)/)?.[1]
        ?? code?.className.match(/lang-(\w+)/)?.[1]
        ?? undefined;
    const source = code ? textContent(code) : textContent(el);
    return { type: 'code', language: lang, code: source };
}
function isPlaceholderSrc(src) {
    const s = src.trim();
    return !s || s === '#' || s === 'about:blank' || s.toLowerCase().includes('placeholder');
}
/** Class tokens the app uses to mark image slots awaiting generation. */
const PLACEHOLDER_CLASS_RE = /(?:^|\s)(?:ph-img|img-slot|img-placeholder|image-placeholder|placeholder)(?:\s|$)/i;
function isPlaceholderElement(el) {
    return PLACEHOLDER_CLASS_RE.test(el.getAttribute('class') ?? '');
}
/** Human label for a placeholder slot (e.g. "[ Hero visual · 16:9 ]" → "Hero visual"). */
function placeholderLabel(el) {
    const raw = (el.getAttribute('alt') ?? el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
    if (!raw)
        return undefined;
    return raw.replace(/^\[|\]$/g, '').replace(/\s*·\s*\d+:\d+\s*$/, '').trim() || undefined;
}
function parseImage(el) {
    const src = el.getAttribute('src') ?? '';
    const alt = el.getAttribute('alt') ?? undefined;
    const width = el.getAttribute('width');
    if (isPlaceholderSrc(src)) {
        return { type: 'image', src: '', alt: placeholderLabel(el) ?? alt, placeholder: true };
    }
    return {
        type: 'image',
        src,
        alt,
        widthPx: width ? parseInt(width, 10) || undefined : undefined,
    };
}
function parseElement(el, opts) {
    const tag = el.tagName;
    if (SKIP_TAGS.has(tag))
        return [];
    if (/^H[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        const t = textContent(el);
        return t ? [{ type: 'heading', level, text: t }] : [];
    }
    if (tag === 'P') {
        const inlines = collectInlines(el);
        return inlines.length ? [{ type: 'paragraph', inlines }] : [];
    }
    if (tag === 'UL') {
        const checklist = parseChecklist(el);
        if (checklist)
            return [checklist];
        return parseList(el, false);
    }
    if (tag === 'OL')
        return parseList(el, true);
    if (tag === 'TABLE') {
        const table = parseTable(el);
        return table ? [table] : [];
    }
    if (tag === 'PRE')
        return [parsePre(el)];
    if (tag === 'BLOCKQUOTE') {
        const inlines = collectInlines(el);
        return inlines.length ? [{ type: 'blockquote', inlines }] : [];
    }
    if (tag === 'HR')
        return [{ type: 'horizontalRule' }];
    if (tag === 'IMG') {
        const img = parseImage(el);
        return img ? [img] : [];
    }
    if (tag === 'FIGURE') {
        const img = el.querySelector('img');
        const caption = el.querySelector('figcaption');
        if (img) {
            const block = parseImage(img);
            if (block && block.type === 'image' && caption) {
                block.caption = textContent(caption);
            }
            return block ? [block] : [];
        }
    }
    if (tag === 'SECTION' && el.hasAttribute('data-slide') && opts.pageBreakBetweenSlides) {
        const inner = parseChildren(el, opts);
        return [{ type: 'pageBreak' }, ...inner];
    }
    // Image slot divs awaiting generation (ph-img, img-slot, *placeholder*) — keep as placeholder.
    if ((tag === 'DIV' || tag === 'FIGURE' || tag === 'SECTION') && isPlaceholderElement(el)) {
        return [{ type: 'image', src: '', alt: placeholderLabel(el), placeholder: true }];
    }
    if (BLOCK_TAGS.has(tag) || tag === 'SPAN') {
        return parseChildren(el, opts);
    }
    const inlines = collectInlines(el);
    if (inlines.length)
        return [{ type: 'paragraph', inlines }];
    return parseChildren(el, opts);
}
function parseChildren(parent, opts) {
    const blocks = [];
    for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType === 3) {
            const t = (child.textContent ?? '').trim();
            if (t)
                blocks.push({ type: 'paragraph', inlines: [{ type: 'text', text: t }] });
            continue;
        }
        if (child.nodeType !== 1)
            continue;
        blocks.push(...parseElement(child, opts));
    }
    return blocks;
}
function extractBodyHtml(html) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch)
        return bodyMatch[1];
    return html;
}
/**
 * Parse HTML (full document or fragment) into export blocks.
 * Requires a DOM implementation (jsdom in Node, document in browser).
 */
export function htmlToExportBlocks(html, parseHtml, opts = {}) {
    const bodyHtml = extractBodyHtml(html);
    const wrapped = `<!DOCTYPE html><html><body>${bodyHtml}</body></html>`;
    const doc = parseHtml(wrapped);
    const body = doc.body;
    if (!body)
        return [];
    const blocks = parseChildren(body, opts);
    // Drop leading page break from slide sections
    if (blocks[0]?.type === 'pageBreak')
        blocks.shift();
    return blocks;
}
/** Strip scripts/styles from HTML string (lightweight pre-sanitize). */
export function sanitizeHtmlForExport(html) {
    return html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
}
