import { bytesToDataUrl } from './image-bytes.js';
const IMG_SRC_RE = /(<img\b[^>]*\bsrc\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi;
function collectResolvableSrcs(html) {
    const srcs = new Set();
    let match;
    const re = new RegExp(IMG_SRC_RE.source, IMG_SRC_RE.flags);
    while ((match = re.exec(html)) !== null) {
        const src = match[2] ?? match[3] ?? '';
        if (src && !src.startsWith('data:'))
            srcs.add(src);
    }
    return srcs;
}
/**
 * Rewrite <img src="..."> values to data URLs when fetchImage can resolve them.
 * Used by PDF export so offscreen data: documents render disk-backed generated images.
 */
export async function inlineResolvableImagesInHtml(html, fetchImage) {
    const srcs = collectResolvableSrcs(html);
    if (srcs.size === 0)
        return html;
    const dataUrls = new Map();
    await Promise.all([...srcs].map(async (src) => {
        const bytes = await fetchImage(src);
        if (!bytes?.length)
            return;
        dataUrls.set(src, bytesToDataUrl(bytes));
    }));
    if (dataUrls.size === 0)
        return html;
    return html.replace(new RegExp(IMG_SRC_RE.source, IMG_SRC_RE.flags), (match, prefix, dq, sq) => {
        const src = dq ?? sq ?? '';
        const dataUrl = dataUrls.get(src);
        if (!dataUrl)
            return match;
        return `${prefix}"${dataUrl}"`;
    });
}
