// Artifact lint. Surface-level structural and accessibility checks on a
// generated HTML document. Intentionally cheap — no full DOM parser, just
// regex spot-checks. Renderer shows a quick scorecard.

export interface LintFinding {
  level: 'error' | 'warn' | 'info';
  rule: string;
  message: string;
}

export interface LintReport {
  score: number;             // 0–100
  errors: number;
  warnings: number;
  findings: LintFinding[];
}

const RULES: ((html: string) => LintFinding | null)[] = [
  (html) => /<!doctype/i.test(html) ? null
    : { level: 'error', rule: 'doctype', message: 'Missing <!doctype html> declaration' },
  (html) => /<html[\s>]/i.test(html) ? null
    : { level: 'error', rule: 'html-root', message: 'No <html> root element' },
  (html) => /<title>[^<]+<\/title>/i.test(html) ? null
    : { level: 'warn',  rule: 'title', message: 'No non-empty <title>' },
  (html) => /<meta[^>]+name="viewport"/i.test(html) ? null
    : { level: 'warn',  rule: 'viewport', message: 'Missing viewport meta tag' },
  (html) => /<main[\s>]/i.test(html) ? null
    : { level: 'info',  rule: 'main', message: 'No <main> landmark — consider adding one' },
  (html) => /<h1[\s>]/i.test(html) ? null
    : { level: 'warn',  rule: 'h1', message: 'Document has no <h1>' },
  (html) => {
    const imgs = html.match(/<img\b[^>]*>/gi) || [];
    const missing = imgs.filter((tag) => !/\balt\s*=/.test(tag));
    if (missing.length === 0) return null;
    return { level: 'warn', rule: 'img-alt', message: `${missing.length} <img> without alt text` };
  },
  (html) => {
    const inputs = html.match(/<input\b[^>]*>/gi) || [];
    const missing = inputs.filter((t) => !/\b(aria-label|aria-labelledby|id\s*=)/.test(t));
    if (missing.length === 0) return null;
    return { level: 'warn', rule: 'input-label', message: `${missing.length} <input> with no obvious label` };
  },
  (html) => /target="_blank"[^>]*(?!rel)/i.test(html) && !/rel=["'][^"']*noopener/.test(html)
    ? { level: 'warn', rule: 'noopener', message: 'target="_blank" link without rel="noopener"' }
    : null,
  (html) => {
    const buttons = html.match(/<button\b[^>]*>([\s\S]*?)<\/button>/gi) || [];
    const empty = buttons.filter((b) => !/[A-Za-z0-9]/.test(b.replace(/<[^>]+>/g, '')));
    if (empty.length === 0) return null;
    return { level: 'warn', rule: 'button-empty', message: `${empty.length} <button> with no readable text` };
  },
  (html) => /style="\s*color\s*:\s*#fff[^"']*background[^"']*#fff/i.test(html)
    ? { level: 'warn', rule: 'contrast', message: 'Likely white-on-white inline style' }
    : null,
  (html) => /<a\b[^>]*>(\s|click here|here|read more)\s*<\/a>/i.test(html)
    ? { level: 'info', rule: 'link-text', message: 'Generic link text ("here", "click here", "read more")' }
    : null,
  (html) => /(<script[^>]*src="http:\/\/)|(<link[^>]*href="http:\/\/)/i.test(html)
    ? { level: 'warn', rule: 'mixed-content', message: 'Loading subresources over http://' }
    : null,
  (html) => html.length < 600
    ? { level: 'info', rule: 'thin', message: 'Artifact body is unusually short' }
    : null,
  (html) => html.length > 200_000
    ? { level: 'info', rule: 'fat', message: 'Artifact is large — consider trimming' }
    : null,
];

export function lintArtifact(html: string): LintReport {
  const findings: LintFinding[] = [];
  for (const rule of RULES) {
    try { const f = rule(html); if (f) findings.push(f); }
    catch { /* swallow rule error */ }
  }
  const errors   = findings.filter((f) => f.level === 'error').length;
  const warnings = findings.filter((f) => f.level === 'warn').length;
  const infos    = findings.filter((f) => f.level === 'info').length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 8 - infos * 2);
  return { score, errors, warnings, findings };
}

/* ─── Brand-spec extraction ───────────────────────────────────────────── */

export interface BrandSpec {
  name?: string;
  voice?: string;
  audience?: string;
  colors: string[];     // hex / oklch / hsl / rgb / named
  fonts: string[];
  doNots: string[];
  values: string[];
}

const HEX_RE     = /#(?:[0-9a-f]{3}){1,2}\b/gi;
const OKLCH_RE   = /oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)/gi;
const HSL_RE     = /hsl\(\s*\d+\s*,?\s*[\d.]+%?\s*,?\s*[\d.]+%?\s*\)/gi;
const RGB_RE     = /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi;
const NAMED_COLORS = [
  'navy', 'teal', 'coral', 'salmon', 'crimson', 'indigo', 'slate',
  'amber', 'emerald', 'violet', 'fuchsia', 'rose', 'cyan', 'lime',
  'burgundy', 'charcoal', 'ivory', 'cream', 'gold', 'silver', 'bronze',
  'copper', 'rust', 'sage', 'olive', 'plum', 'lavender', 'mint',
  'peach', 'blush', 'mauve', 'taupe', 'sand', 'terracotta',
];
const FONT_HINTS = [
  'Inter', 'Roboto', 'Helvetica', 'Arial', 'Geist',
  'JetBrains Mono', 'IBM Plex', 'Fraunces', 'Instrument Serif', 'Playfair', 'PT Serif',
  'Tiempos', 'GT Walsheim', 'Poppins', 'Montserrat', 'Lato', 'Open Sans',
  'Source Sans', 'Nunito', 'Raleway', 'Work Sans', 'DM Sans', 'Space Grotesk', 'Manrope',
  'Plus Jakarta Sans', 'Outfit', 'Satoshi', 'General Sans', 'Cabinet Grotesk', 'Clash Display',
  'Switzer', 'Futura', 'Avenir', 'Proxima Nova',
  'Garamond', 'Georgia', 'Merriweather', 'Lora', 'Crimson Text', 'Source Serif',
  'Fira Code', 'SF Mono', 'Cascadia Code', 'Berkeley Mono',
];

export function extractBrandSpec(text: string): BrandSpec {
  const t = text || '';
  const colors = Array.from(new Set([
    ...(t.match(HEX_RE) || []).map((s) => s.toLowerCase()),
    ...(t.match(OKLCH_RE) || []).map((s) => s.toLowerCase()),
    ...(t.match(HSL_RE) || []).map((s) => s.toLowerCase()),
    ...(t.match(RGB_RE) || []).map((s) => s.toLowerCase()),
    ...NAMED_COLORS.filter((c) => new RegExp('\\b' + c + '\\b', 'i').test(t)),
  ]));
  const fonts = FONT_HINTS.filter((f) => {
    // Simple case-insensitive word-boundary check
    const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    try { return new RegExp('\\b' + escaped + '\\b', 'i').test(t); }
    catch { return t.toLowerCase().includes(f.toLowerCase()); }
  });

  const lines = t.split(/\r?\n/);
  const after = (re: RegExp) => {
    for (const ln of lines) {
      const m = ln.match(re);
      if (m) return m[1]?.trim();
    }
    return undefined;
  };

  const doNots: string[] = [];
  const values:  string[] = [];
  for (const ln of lines) {
    const m1 = ln.match(/^[\s\-•]*(?:don'?t|never|avoid)\s*[:\-]?\s*(.+)$/i);
    if (m1) doNots.push(m1[1].trim());
    const m2 = ln.match(/^[\s\-•]*(?:values?|principles?)\s*[:\-]\s*(.+)$/i);
    if (m2) values.push(...m2[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean));
  }

  // Also try to extract voice/tone from unstructured prose
  let voice = after(/(?:voice|tone)\s*[:\-]\s*(.+)/i);
  if (!voice) {
    const toneMatch = t.match(/\b(?:tone|voice|style)\s+(?:should be|is|:)\s+([^.,;!?\n]{3,40})/i);
    if (toneMatch) voice = toneMatch[1].trim();
  }

  let audience = after(/(?:audience|customer|users?)\s*[:\-]\s*(.+)/i);
  if (!audience) {
    const audMatch = t.match(/\b(?:for|targeting|aimed at|designed for)\s+([^.,;!?\n]{3,60})/i);
    if (audMatch) audience = audMatch[1].trim();
  }

  return {
    name:     after(/(?:brand|name|company)\s*[:\-]\s*(.+)/i),
    voice,
    audience,
    colors,
    fonts: Array.from(new Set(fonts)),
    doNots,
    values,
  };
}
