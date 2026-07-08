// Artifact lint. Surface-level structural and accessibility checks on a
// generated HTML document. Intentionally cheap — no full DOM parser, just
// regex spot-checks. Renderer shows a quick scorecard.
import { isDashboardArtifact, missingDashboardRegions, normalizeDashboardRegionIds, tagHeuristicDashboardRegions } from '../shared/dashboard-layout.js';
import { lintDashboardCharts } from '../shared/dashboard-charts.js';
import { lintMarketingSiteFlow } from '../shared/marketing-site-layout.js';
const RULES = [
    (html) => /<!doctype/i.test(html) ? null
        : { level: 'error', rule: 'doctype', message: 'Missing <!doctype html> declaration' },
    (html) => /<html[\s>]/i.test(html) ? null
        : { level: 'error', rule: 'html-root', message: 'No <html> root element' },
    (html) => /<html[^>]*\blang\s*=/i.test(html) ? null
        : { level: 'warn', rule: 'html-lang', message: 'Missing lang attribute on <html>' },
    (html) => {
        const h1s = html.match(/<h1\b[^>]*>/gi) || [];
        if (h1s.length <= 1)
            return null;
        return { level: 'warn', rule: 'multiple-h1', message: `Document has ${h1s.length} <h1> elements — prefer one per page` };
    },
    (html) => {
        const matches = [...html.matchAll(/\btabindex\s*=\s*["']?(\d+)["']?/gi)];
        const high = matches.filter((m) => parseInt(m[1], 10) > 0);
        if (!high.length)
            return null;
        return { level: 'warn', rule: 'tabindex-positive', message: `${high.length} element(s) with tabindex > 0` };
    },
    (html) => {
        const hasNav = /<nav[\s>]/i.test(html);
        const hasSkip = /skip-link|skip-to-main|skip-to-content/i.test(html);
        if (!hasNav || hasSkip)
            return null;
        return { level: 'info', rule: 'skip-link', message: 'Consider a skip-to-main link for keyboard users' };
    },
    (html) => /<title>[^<]*\S[^<]*<\/title>/i.test(html) ? null
        : { level: 'warn', rule: 'title', message: 'No non-empty <title>' },
    (html) => /<meta[^>]+name=["']viewport["']/i.test(html) ? null
        : { level: 'warn', rule: 'viewport', message: 'Missing viewport meta tag' },
    (html) => /<main[\s>]/i.test(html) || /<article[\s>]/i.test(html) ? null
        : { level: 'info', rule: 'main', message: 'No <main> or <article> landmark — consider adding one' },
    (html) => /<h[1-6][\s>]/i.test(html) || /role=["']heading["']/i.test(html) ? null
        : { level: 'warn', rule: 'heading', message: 'Document has no heading (h1–h6)' },
    (html) => {
        const imgs = html.match(/<img\b[^>]*>/gi) || [];
        const missing = imgs.filter((tag) => {
            if (/\balt\s*=/.test(tag))
                return false;
            if (/\baria-hidden\s*=\s*["']?true["']?/i.test(tag))
                return false;
            if (/\brole\s*=\s*["']?presentation["']?/i.test(tag))
                return false;
            return true;
        });
        if (missing.length === 0)
            return null;
        return { level: 'warn', rule: 'img-alt', message: `${missing.length} <img> without alt text` };
    },
    (html) => {
        const inputs = html.match(/<input\b[^>]*>/gi) || [];
        const missing = inputs.filter((t) => {
            if (/\btype\s*=\s*["']?(hidden|submit|button|reset|image)["']?/i.test(t))
                return false;
            return !/\b(aria-label|aria-labelledby|title\s*=|placeholder\s*=|id\s*=)/i.test(t);
        });
        if (missing.length === 0)
            return null;
        return { level: 'warn', rule: 'input-label', message: `${missing.length} <input> with no obvious label` };
    },
    (html) => {
        const links = html.match(/<a\b[^>]*>/gi) || [];
        const bad = links.filter((tag) => /target\s*=\s*["']_blank["']/i.test(tag)
            && !/rel\s*=\s*["'][^"']*noopener/i.test(tag));
        if (bad.length === 0)
            return null;
        return { level: 'warn', rule: 'noopener', message: `${bad.length} target="_blank" link(s) without rel="noopener"` };
    },
    (html) => {
        const buttons = html.match(/<button\b[^>]*>([\s\S]*?)<\/button>/gi) || [];
        const empty = buttons.filter((b) => {
            if (/\baria-label\s*=/.test(b))
                return false;
            if (/\baria-labelledby\s*=/.test(b))
                return false;
            return !/[A-Za-z0-9]/.test(b.replace(/<[^>]+>/g, ''));
        });
        if (empty.length === 0)
            return null;
        return { level: 'warn', rule: 'button-empty', message: `${empty.length} <button> with no readable text` };
    },
    (html) => /style="\s*color\s*:\s*#fff[^"']*background[^"']*#fff/i.test(html)
        ? { level: 'warn', rule: 'contrast', message: 'Likely white-on-white inline style' }
        : null,
    (html) => /<a\b[^>]*>\s*(click here|here|read more)\s*<\/a>/i.test(html)
        ? { level: 'info', rule: 'link-text', message: 'Generic link text ("here", "click here", "read more")' }
        : null,
    (html) => /(<script[^>]*src=["']http:\/\/[^"']+["'])|(<link[^>]*href=["']http:\/\/[^"']+["'])/i.test(html)
        ? { level: 'warn', rule: 'mixed-content', message: 'Loading subresources over http://' }
        : null,
    (html) => {
        const isDeck = /<section[\s>]/i.test(html) || /data-slide/i.test(html);
        if (isDeck || html.length >= 400)
            return null;
        return { level: 'info', rule: 'thin', message: 'Artifact body is unusually short' };
    },
    (html) => html.length > 200_000
        ? { level: 'info', rule: 'fat', message: 'Artifact is large — consider trimming' }
        : null,
    (html) => {
        if (!isDashboardArtifact(html))
            return null;
        let normalized = normalizeDashboardRegionIds(html);
        normalized = tagHeuristicDashboardRegions(normalized);
        const missing = missingDashboardRegions(normalized);
        if (!missing.length)
            return null;
        return {
            level: 'warn',
            rule: 'dashboard-regions',
            message: `Missing required dashboard regions (data-od-id): ${missing.join(', ')}`,
        };
    },
    (html) => {
        if (!isDashboardArtifact(html))
            return null;
        if (!/\b100vw\b/.test(html))
            return null;
        return {
            level: 'warn',
            rule: 'dashboard-vw',
            message: 'Avoid 100vw in dashboards — use 100% to prevent horizontal misalignment',
        };
    },
    (html) => {
        if (!isDashboardArtifact(html))
            return null;
        const nested = html.match(/(?:data-od-id=["'](?:topbar|kpis|primary-chart|secondary-panel)["'][^>]*style=["'][^"']*overflow\s*:\s*(?:auto|scroll)|(?:\.chart|\.panel|\.kpi|\.card|\.widget)[^{]*\{[^}]*overflow\s*:\s*(?:auto|scroll))/gi);
        if (!nested?.length)
            return null;
        return {
            level: 'warn',
            rule: 'dashboard-nested-scroll',
            message: 'Dashboard widgets must not scroll — use overflow:hidden on cards/charts/tables; only main scrolls',
        };
    },
    (html) => {
        const flowIssue = lintMarketingSiteFlow(html);
        if (!flowIssue)
            return null;
        return {
            level: 'warn',
            rule: flowIssue.rule,
            message: flowIssue.message,
        };
    },
];
const RULE_META = {
    doctype: { category: 'structure' },
    'html-root': { category: 'structure' },
    'html-lang': { category: 'structure', fixable: true },
    title: { category: 'structure', fixable: true },
    viewport: { category: 'structure', fixable: true },
    main: { category: 'structure', fixable: true },
    heading: { category: 'structure', fixable: true },
    'multiple-h1': { category: 'structure' },
    'img-alt': { category: 'images', fixable: true },
    'input-label': { category: 'forms', fixable: true },
    noopener: { category: 'structure', fixable: true },
    'button-empty': { category: 'forms', fixable: true },
    contrast: { category: 'contrast' },
    'link-text': { category: 'structure' },
    'mixed-content': { category: 'structure', fixable: true },
    'tabindex-positive': { category: 'keyboard' },
    'skip-link': { category: 'keyboard' },
    'dashboard-regions': { category: 'dashboard' },
    'dashboard-vw': { category: 'dashboard', fixable: true },
    'dashboard-nested-scroll': { category: 'dashboard', fixable: true },
    'marketing-screens': { category: 'structure', fixable: true },
    'marketing-flow-links': { category: 'structure', fixable: true },
};
function enrichFinding(f) {
    const meta = RULE_META[f.rule];
    return meta ? { ...f, ...meta } : f;
}
export function lintArtifact(html) {
    const findings = [];
    for (const rule of RULES) {
        try {
            const f = rule(html);
            if (f)
                findings.push(enrichFinding(f));
        }
        catch { /* swallow rule error */ }
    }
    if (isDashboardArtifact(html)) {
        for (const f of lintDashboardCharts(html))
            findings.push(enrichFinding(f));
    }
    const errors = findings.filter((f) => f.level === 'error').length;
    const warnings = findings.filter((f) => f.level === 'warn').length;
    const infos = findings.filter((f) => f.level === 'info').length;
    const score = Math.max(0, 100 - errors * 25 - warnings * 8 - infos * 2);
    return { score, errors, warnings, findings };
}
const HEX_RE = /#(?:[0-9a-f]{3}){1,2}\b/gi;
const OKLCH_RE = /oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)/gi;
const HSL_RE = /hsl\(\s*\d+\s*,?\s*[\d.]+%?\s*,?\s*[\d.]+%?\s*\)/gi;
const RGB_RE = /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi;
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
export function extractBrandSpec(text) {
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
        const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, String.raw `\$&`);
        try {
            return new RegExp('\\b' + escaped + '\\b', 'i').test(t);
        }
        catch {
            return t.toLowerCase().includes(f.toLowerCase());
        }
    });
    const lines = t.split(/\r?\n/);
    const after = (re) => {
        for (const ln of lines) {
            const m = ln.match(re);
            if (m)
                return m[1]?.trim();
        }
        return undefined;
    };
    const doNots = [];
    const values = [];
    for (const ln of lines) {
        const m1 = ln.match(/^[\s\-•]*(?:don'?t|never|avoid)\s*[:\-]?\s*(.+)$/i);
        if (m1)
            doNots.push(m1[1].trim());
        const m2 = ln.match(/^[\s\-•]*(?:values?|principles?)\s*[:\-]\s*(.+)$/i);
        if (m2)
            values.push(...m2[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean));
    }
    // Also try to extract voice/tone from unstructured prose
    let voice = after(/(?:voice|tone)\s*[:\-]\s*(.+)/i);
    if (!voice) {
        const toneMatch = t.match(/\b(?:tone|voice|style)\s+(?:should be|is|:)\s+([^.,;!?\n]{3,40})/i);
        if (toneMatch)
            voice = toneMatch[1].trim();
    }
    let audience = after(/(?:audience|customer|users?)\s*[:\-]\s*(.+)/i);
    if (!audience) {
        const audMatch = t.match(/\b(?:for|targeting|aimed at|designed for)\s+([^.,;!?\n]{3,60})/i);
        if (audMatch)
            audience = audMatch[1].trim();
    }
    return {
        name: after(/(?:brand|name|company)\s*[:\-]\s*(.+)/i),
        voice,
        audience,
        colors,
        fonts: Array.from(new Set(fonts)),
        doNots,
        values,
    };
}
