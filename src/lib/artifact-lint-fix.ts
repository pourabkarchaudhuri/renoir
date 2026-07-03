/**
 * Deterministic repairs for artifact lint findings — applied during
 * normalizeArtifactDocument so preview, export, and Findings stay aligned.
 */

import { isDashboardArtifact } from '@shared/dashboard-layout';

export interface LintFixOptions {
  title?: string;
  dashboard?: boolean;
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function inferImgAlt(tag: string): string {
  const src = tag.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ?? '';
  if (!src || src === '#' || /placeholder/i.test(src)) return '';
  const base = src.split(/[/?#]/).pop()?.replace(/\.[a-z0-9]+$/i, '') ?? '';
  const words = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (words && /[a-z]/i.test(words)) {
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return 'Illustration';
}

/** Add alt text to images that lack it (unless decorative). */
export function fixImgAlt(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\balt\s*=/.test(tag)) return tag;
    if (/\baria-hidden\s*=\s*["']?true["']?/i.test(tag)) return tag;
    if (/\brole\s*=\s*["']?presentation["']?/i.test(tag)) return tag;
    const alt = inferImgAlt(tag);
    if (tag.endsWith('/>')) {
      return tag.replace(/\s*\/>$/, ` alt="${escapeAttr(alt)}" />`);
    }
    return tag.replace(/>$/, ` alt="${escapeAttr(alt)}">`);
  });
}

/** Add rel="noopener noreferrer" to target="_blank" links. */
export function fixNoopenerLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs) => {
    if (!/\btarget\s*=\s*["']_blank["']/i.test(attrs)) return full;
    if (/\brel\s*=\s*["'][^"']*noopener/i.test(attrs)) return full;
    if (/\brel\s*=\s*["']([^"']*)["']/i.test(attrs)) {
      const next = attrs.replace(
        /\brel\s*=\s*["']([^"']*)["']/i,
        'rel="$1 noopener noreferrer"',
      );
      return `<a${next}>`;
    }
    return `<a${attrs} rel="noopener noreferrer">`;
  });
}

/** Give unlabeled inputs an aria-label derived from placeholder or type. */
export function fixInputLabels(html: string): string {
  return html.replace(/<input\b([^>]*)>/gi, (full, attrs) => {
    if (/\btype\s*=\s*["']?(hidden|submit|button|reset|image)["']?/i.test(attrs)) return full;
    if (/\b(aria-label|aria-labelledby|title)\s*=/i.test(attrs)) return full;
    const placeholder = attrs.match(/\bplaceholder\s*=\s*["']([^"']*)["']/i)?.[1]?.trim();
    const type = attrs.match(/\btype\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ?? 'text';
    const label = placeholder || `${type.charAt(0).toUpperCase()}${type.slice(1)} input`;
    return `<input${attrs} aria-label="${escapeAttr(label)}">`;
  });
}

/** Give empty buttons a readable aria-label. */
export function fixEmptyButtons(html: string): string {
  return html.replace(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (full, attrs, inner) => {
    if (/\b(aria-label|aria-labelledby)\s*=/i.test(attrs)) return full;
    const text = inner.replace(/<[^>]+>/g, '').trim();
    if (/[A-Za-z0-9]/.test(text)) return full;
    return `<button${attrs} aria-label="Action">${inner}</button>`;
  });
}

/** Upgrade http:// subresource URLs to https://. */
export function fixMixedContent(html: string): string {
  return html
    .replace(/(<script[^>]*\bsrc\s*=\s*["'])http:\/\//gi, '$1https://')
    .replace(/(<link[^>]*\bhref\s*=\s*["'])http:\/\//gi, '$1https://');
}

/** Default viewport when still missing after normalization. */
export function fixViewportMeta(html: string): string {
  if (/<meta[^>]+name=["']viewport["']/i.test(html)) return html;
  const tag = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${tag}`);
  }
  return html;
}

/** Wrap body content in <main> when no landmark exists. */
export function fixMainLandmark(html: string): string {
  if (/<main[\s>]/i.test(html) || /<article[\s>]/i.test(html)) return html;
  if (!/<body[^>]*>/i.test(html)) return html;
  return html.replace(
    /<body([^>]*)>([\s\S]*)<\/body>/i,
    (_m, attrs, inner) => `<body${attrs}><main>${inner}</main></body>`,
  );
}

/** Add a document heading when none exists (screen-reader friendly). */
export function fixMissingHeading(html: string, title?: string): string {
  if (/<h[1-6][\s>]/i.test(html) || /role=["']heading["']/i.test(html)) return html;
  const label = escapeAttr((title || 'Document').trim() || 'Document');
  const h1 = `<h1 class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">${label}</h1>`;
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>\n${h1}`);
  }
  return `${h1}\n${html}`;
}

/** Replace 100vw with 100% in dashboard artifacts. */
export function fixDashboardVw(html: string): string {
  if (!isDashboardArtifact(html)) return html;
  return html.replace(/\b100vw\b/g, '100%');
}

/** Prevent nested scroll inside dashboard widgets. */
export function fixDashboardNestedScroll(html: string): string {
  if (!isDashboardArtifact(html)) return html;
  let out = html.replace(
    /((?:data-od-id=["'](?:topbar|kpis|primary-chart|secondary-panel)["'][^>]*style=["'][^"']*)overflow\s*:\s*)(?:auto|scroll)/gi,
    '$1hidden',
  );
  out = out.replace(
    /(\.(?:chart|panel|kpi|card|widget)[^{]*\{[^}]*overflow\s*:\s*)(?:auto|scroll)/gi,
    '$1hidden',
  );
  return out;
}

/**
 * Apply all deterministic lint repairs. Safe to run multiple times.
 */
export function fixArtifactLintFindings(html: string, opts: LintFixOptions = {}): string {
  let out = html;
  out = fixViewportMeta(out);
  out = fixImgAlt(out);
  out = fixNoopenerLinks(out);
  out = fixInputLabels(out);
  out = fixEmptyButtons(out);
  out = fixMixedContent(out);
  out = fixMainLandmark(out);
  out = fixMissingHeading(out, opts.title);
  if (opts.dashboard || isDashboardArtifact(out)) {
    out = fixDashboardVw(out);
    out = fixDashboardNestedScroll(out);
  }
  return out;
}
