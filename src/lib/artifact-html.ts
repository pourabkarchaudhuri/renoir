import { ensureViewportMeta } from '@/lib/preview-surfaces';
import { buildThemeCss, injectThemeStyle, type ThemeStyleOptions } from '@/lib/theme-tokens';
import { injectDashboardShell } from '@shared/dashboard-layout';
import { ensureMarketingSiteScreens, isMarketingSiteArtifact } from '@shared/marketing-site-layout';
import { enrichProductDeckHtml } from '@/lib/product-deck-content';
import { fixArtifactLintFindings } from '@/lib/artifact-lint-fix';

export interface NormalizeArtifactOptions {
  title?: string;
  viewportWidth?: number;
  theme?: ThemeStyleOptions;
  /** Inject dashboard meta + viewport containment CSS. */
  dashboard?: boolean;
  /** Validate + fill Product Deck slide copy before preview/export. */
  productDeck?: boolean;
  /** Product name hint for deck fallbacks (defaults to title). */
  productName?: string;
  /** When false, skip padding to 12 slides (use while streaming). */
  productDeckFinalize?: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Remove accessibility skip links that LLMs often add but clutter the preview. */
export function stripPreviewChrome(html: string): string {
  return html
    .replace(/<a\b[^>]*\bclass=["'][^"']*\bskip\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<a\b[^>]*href=["']#(?:main|content|main-content)["'][^>]*>[\s\S]*?<\/a>/gi, '');
}

/**
 * Normalize LLM artifact HTML into a complete document shell for preview,
 * export, and lint. Adds doctype, charset, title, and viewport when missing.
 */
export function normalizeArtifactDocument(
  html: string,
  opts: NormalizeArtifactOptions = {},
): string {
  const title = (opts.title?.trim() || 'Artifact');
  let out = stripPreviewChrome(html.trim());

  const isFragment = !/<html[\s>]/i.test(out);

  if (isFragment) {
    const tailwind = !/tailwindcss/i.test(out)
      ? '<script src="https://cdn.tailwindcss.com"></script>'
      : '';
    out = `<!doctype html><html><head><meta charset="utf-8">${tailwind}<title>${escapeHtml(title)}</title></head><body>${out}</body></html>`;
  } else {
    if (!/<!doctype/i.test(out)) {
      out = `<!doctype html>\n${out}`;
    }
    if (!/<head[\s>]/i.test(out) && /<html[^>]*>/i.test(out)) {
      out = out.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>`);
    }
  }

  if (/<head[^>]*>/i.test(out) && !/<meta[^>]+charset/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n  <meta charset="utf-8">`);
  }

  if (!/<title>[^<]*\S[^<]*<\/title>/i.test(out)) {
    if (/<title>\s*<\/title>/i.test(out)) {
      out = out.replace(/<title>\s*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    } else if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n  <title>${escapeHtml(title)}</title>`);
    }
  }

  if (typeof opts.viewportWidth === 'number') {
    out = ensureViewportMeta(out, opts.viewportWidth);
  }

  if (opts.theme?.tokens?.length) {
    out = injectThemeStyle(out, buildThemeCss(opts.theme));
  }

  if (opts.dashboard) {
    out = injectDashboardShell(out);
  }

  if (opts.productDeck) {
    out = enrichProductDeckHtml(out, {
      productName: opts.productName ?? title,
      finalize: opts.productDeckFinalize ?? true,
    }).html;
  }

  if (isMarketingSiteArtifact(out) || (/\bdata-screen-id\s*=\s*["']landing["']/i.test(out) && /\bdata-goto\s*=/i.test(out))) {
    out = ensureMarketingSiteScreens(out);
  }

  out = fixArtifactLintFindings(out, {
    title,
    dashboard: opts.dashboard,
  });

  return out;
}
