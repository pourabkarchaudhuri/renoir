/** Multi-screen SaaS marketing site contract — landing + changelog + blog. */
export const MARKETING_SITE_META = 'renoir:marketing-site';
export const MARKETING_SCREEN_IDS = ['landing', 'changelog', 'blog'];
export const MARKETING_SCREENS = [
    {
        id: 'landing',
        label: 'Landing',
        requiredRegions: ['topnav', 'hero', 'features', 'proof', 'pricing', 'closing', 'footer'],
    },
    {
        id: 'changelog',
        label: 'Changelog',
        requiredRegions: ['changelog-header', 'changelog-entries'],
    },
    {
        id: 'blog',
        label: 'Blog',
        requiredRegions: ['article-header', 'article-body', 'author-footer', 'related-posts'],
    },
];
function hasScreenId(html, id) {
    return new RegExp(`\\bdata-screen-id\\s*=\\s*["']${id}["']`, 'i').test(html);
}
export function parseMarketingScreenIds(html) {
    const ids = [];
    const re = /\bdata-screen-id\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const id = m[1];
        if (!ids.includes(id))
            ids.push(id);
    }
    return ids;
}
export function missingMarketingScreens(html) {
    return MARKETING_SCREEN_IDS.filter((id) => !hasScreenId(html, id));
}
/** Heuristic: artifact targets the saas-landing multi-screen contract. */
export function isMarketingSiteArtifact(html) {
    if (!html?.trim())
        return false;
    if (hasScreenId(html, 'landing'))
        return true;
    const ids = parseMarketingScreenIds(html);
    return ids.includes('changelog') && ids.includes('blog');
}
const CHANGELOG_STUB = `<section data-screen-id="changelog" data-screen-label="Changelog" class="marketing-screen renoir-marketing-stub" data-od-id="changelog">
  <header data-od-id="changelog-header"><h1>Changelog</h1><p>Release notes</p></header>
  <div data-od-id="changelog-entries"><article><h2>v1.0.0</h2><ul><li>Initial release</li></ul></article></div>
</section>`;
const BLOG_STUB = `<section data-screen-id="blog" data-screen-label="Blog" class="marketing-screen renoir-marketing-stub" data-od-id="blog">
  <header data-od-id="article-header"><h1>Blog</h1></header>
  <article data-od-id="article-body"><p>Article body placeholder.</p></article>
  <footer data-od-id="author-footer"><p>Author bio</p></footer>
  <div data-od-id="related-posts"><p>Related posts</p></div>
</section>`;
const LANDING_STUB = `<section data-screen-id="landing" data-screen-label="Landing" class="marketing-screen renoir-marketing-stub" data-od-id="landing">
  <nav data-od-id="topnav"><a href="#" data-goto="landing">Home</a><a href="#" data-goto="changelog">Changelog</a><a href="#" data-goto="blog">Blog</a></nav>
  <div data-od-id="hero"><h1>Product</h1></div>
</section>`;
function injectBeforeBodyEnd(html, fragment) {
    if (/<\/body>/i.test(html)) {
        return html.replace(/<\/body>/i, `${fragment}\n</body>`);
    }
    return `${html}\n${fragment}`;
}
function wrapLandingScreen(html) {
    if (hasScreenId(html, 'landing'))
        return html;
    const inner = html.replace(/<\/?body[^>]*>/gi, '').trim();
    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Marketing site</title></head>
<body>
<section data-screen-id="landing" data-screen-label="Landing" class="marketing-screen" data-od-id="landing">
${inner}
</section>
</body>
</html>`;
}
/** Tag missing screens and inject minimal stubs so flow map + lint stay satisfied. */
export function ensureMarketingSiteScreens(html) {
    let out = html?.trim() || '';
    if (!out)
        return out;
    if (!isMarketingSiteArtifact(out) && !/\bdata-goto\s*=/i.test(out)) {
        return out;
    }
    if (!hasScreenId(out, 'landing') && (hasScreenId(out, 'changelog') || hasScreenId(out, 'blog'))) {
        out = injectBeforeBodyEnd(out, LANDING_STUB);
    }
    else if (!hasScreenId(out, 'landing') && /<body/i.test(out)) {
        out = wrapLandingScreen(out);
    }
    if (!hasScreenId(out, 'changelog')) {
        out = injectBeforeBodyEnd(out, CHANGELOG_STUB);
    }
    if (!hasScreenId(out, 'blog')) {
        out = injectBeforeBodyEnd(out, BLOG_STUB);
    }
    return out;
}
/** Prompt block for LLM system prompt when the saas-landing skill is active. */
export function marketingSitePromptLines() {
    return [
        '# SaaS Marketing Site — copy pass on staged shell',
        'A complete 3-screen shell (landing / changelog / blog) is already in preview. Your job: emit the full HTML with customized copy for the brief.',
        'Keep every tag, class, data-screen-id, data-goto, and CSS rule identical — change text nodes only unless the brief demands a pricing tweak.',
        '',
        'Screens: data-screen-id="landing" | "changelog" | "blog". Nav uses data-goto between them.',
        'Budget: ≤280 lines total output. No new CSS. No animations.',
    ];
}
export function lintMarketingSiteFlow(html) {
    if (!isMarketingSiteArtifact(html))
        return null;
    const missing = missingMarketingScreens(html);
    if (missing.length) {
        return {
            rule: 'marketing-screens',
            message: `Missing required marketing screens (data-screen-id): ${missing.join(', ')}`,
        };
    }
    if (!/\bdata-goto\s*=/i.test(html)) {
        return {
            rule: 'marketing-flow-links',
            message: 'Marketing site has no data-goto navigation links for Flow Map walk-through',
        };
    }
    return null;
}
