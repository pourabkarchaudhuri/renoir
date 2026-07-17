/** Single-screen changelog / release notes contract. */
import { isMarketingSiteArtifact } from './marketing-site-layout.js';
export const CHANGELOG_REGIONS = [
    'changelog',
    'changelog-header',
    'changelog-filters',
    'changelog-entries',
];
function hasOdId(html, id) {
    return new RegExp(`\\bdata-od-id\\s*=\\s*["']${id}["']`, 'i').test(html);
}
function hasScreenId(html) {
    return /\bdata-screen-id\s*=/i.test(html);
}
export function parseChangelogRegionIds(html) {
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
export function missingChangelogRegions(html) {
    return CHANGELOG_REGIONS.filter((id) => !hasOdId(html, id));
}
/** Heuristic: artifact targets the changelog single-screen contract. */
export function isChangelogArtifact(html) {
    if (!html?.trim())
        return false;
    if (isMarketingSiteArtifact(html))
        return false;
    if (hasScreenId(html))
        return false;
    if (hasOdId(html, 'changelog-header') && hasOdId(html, 'changelog-entries'))
        return true;
    return false;
}
/** Prompt block for LLM system prompt when the changelog skill is active. */
export function changelogPromptLines() {
    return [
        '# Changelog — single-screen release notes',
        'Produce one self-contained changelog page. See skills/changelog/example.html for canonical structure.',
        '',
        'Sections (in order), each tagged with data-od-id:',
        '1. changelog — page wrapper (max-width ~720px centered).',
        '2. changelog-header — compact top bar with wordmark + nav label.',
        '3. changelog-filters — decorative filter pills (All / Features / Fixes).',
        '4. changelog-entries — 6–8 reverse-chron version blocks, each with semver tag, date (mono), type chips (feat/fix/perf/breaking), 2–4 bullet items, optional screenshot placeholder.',
        '',
        'Use design-system tokens only. Inline <style> only — no Tailwind CDN. No data-screen-id, no data-goto.',
        'Required data-od-id values: ' + CHANGELOG_REGIONS.map((r) => `"${r}"`).join(', ') + '.',
    ];
}
export function lintChangelogRegions(html) {
    if (!isChangelogArtifact(html))
        return null;
    const missing = missingChangelogRegions(html);
    if (missing.length) {
        return {
            rule: 'changelog-regions',
            message: `Missing required changelog regions (data-od-id): ${missing.join(', ')}`,
        };
    }
    return null;
}
