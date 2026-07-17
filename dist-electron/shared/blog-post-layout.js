/** Single-screen long-form blog article contract. */
export const BLOG_POST_REGIONS = [
    'masthead',
    'article-header',
    'hero-figure',
    'article-body',
    'author-footer',
    'related-posts',
];
function hasOdId(html, id) {
    return new RegExp(`\\bdata-od-id\\s*=\\s*["']${id}["']`, 'i').test(html);
}
export function parseBlogPostRegionIds(html) {
    const ids = [];
    const re = /\bdata-od-id\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const id = m[1];
        if (!ids.includes(id))
            ids.push(id);
    }
    return ids;
}
export function missingBlogPostRegions(html) {
    return BLOG_POST_REGIONS.filter((id) => !hasOdId(html, id));
}
/** Heuristic: artifact targets the blog-post single-screen contract. */
export function isBlogPostArtifact(html) {
    if (!html?.trim())
        return false;
    if (hasOdId(html, 'article-header') && hasOdId(html, 'article-body'))
        return true;
    return false;
}
/** Prompt block for LLM system prompt when the blog-post skill is active. */
export function blogPostPromptLines() {
    return [
        '# Blog Post — single-screen article',
        'Produce one self-contained long-form article. See skills/blog-post/example.html for canonical structure.',
        '',
        'Sections (in order), each tagged with data-od-id:',
        '1. masthead — wordmark + 4–6 decorative nav links (href="#", no data-goto).',
        '2. article-header — category eyebrow, headline, deck/lede, author + date + read time.',
        '3. hero-figure — 16:9 gradient placeholder block + figcaption.',
        '4. article-body — ~350 words, 4–6 H2 sections, drop cap on first paragraph, pull quote, blockquote, list, inline code.',
        '5. author-footer — initials avatar + bio paragraph.',
        '6. related-posts — 3 cards (thumb block, title, excerpt, date).',
        '',
        'Typography: serif body 18px/1.65, max-width ~680px centered. Sans-serif for chrome (masthead, byline, related).',
        'Use design-system tokens only. Inline <style> only — no Tailwind CDN. Responsive ≤768px.',
        'Required data-od-id values: ' + BLOG_POST_REGIONS.map((r) => `"${r}"`).join(', ') + '.',
    ];
}
export function lintBlogPostRegions(html) {
    if (!isBlogPostArtifact(html))
        return null;
    const missing = missingBlogPostRegions(html);
    if (missing.length) {
        return {
            rule: 'blog-post-regions',
            message: `Missing required blog regions (data-od-id): ${missing.join(', ')}`,
        };
    }
    return null;
}
