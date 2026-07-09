/** Fill the canonical changelog HTML shell with brief copy. */
import { inferProductNameFromText } from './marketing-site-template.js';
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
export function fillChangelogTemplate(template, brief = {}) {
    const product = brief.productName?.trim() || 'Acme';
    let out = template.replace(/Filebase/g, product);
    out = out.replace(/<title>[^<]*<\/title>/, `<title>Changelog — ${escapeHtml(product)}</title>`);
    return out;
}
export function changelogBriefFromText(text) {
    return {
        productName: inferProductNameFromText(text),
    };
}
