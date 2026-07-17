/** Fill the canonical blog-post HTML shell with brief copy. */

import { inferProductNameFromText, inferTaglineFromText } from './marketing-site-template.js';

export interface BlogPostBrief {
  companyName?: string;
  headline?: string;
  tagline?: string;
}

const DEFAULT_HEADLINE = 'Why we rewrote our sync engine in Rust';
const DEFAULT_LEDE =
  'For two years our Go sync engine was good enough. Then video editors started joining the customer list, and the GC pauses we\'d been politely ignoring turned into bug reports we couldn\'t ignore.';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fillBlogPostTemplate(template: string, brief: BlogPostBrief = {}): string {
  const company = brief.companyName?.trim() || 'Acme';
  let out = template.replace(/Filebase/g, company);
  const headline = brief.headline?.trim();
  if (headline) {
    out = out.replace(new RegExp(DEFAULT_HEADLINE, 'g'), escapeHtml(headline));
    out = out.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escapeHtml(headline)} — ${escapeHtml(company)}</title>`,
    );
  }
  const tagline = brief.tagline?.trim();
  if (tagline) {
    out = out.replace(DEFAULT_LEDE, escapeHtml(tagline.slice(0, 320)));
  }
  return out;
}

/** Pull article headline from freeform brief text (text after em-dash). */
export function inferBlogHeadlineFromText(text: string): string | undefined {
  const t = text.trim();
  const dashMatch = t.match(/\s[—–-]\s+(.+)/);
  if (dashMatch?.[1]) return dashMatch[1].trim().slice(0, 120);
  return undefined;
}

export function blogBriefFromText(text: string): BlogPostBrief {
  return {
    companyName: inferProductNameFromText(text),
    headline: inferBlogHeadlineFromText(text),
    tagline: inferTaglineFromText(text),
  };
}
