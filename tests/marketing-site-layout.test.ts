import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  MARKETING_SCREEN_IDS,
  marketingSitePromptLines,
  ensureMarketingSiteScreens,
  missingMarketingScreens,
  isMarketingSiteArtifact,
  lintMarketingSiteFlow,
} from '../shared/marketing-site-layout';
import { parseFlowScreens, artifactHasFlowLinks } from '../src/lib/flow-screens';

const examplePath = path.join(process.cwd(), 'skills', 'saas-landing', 'example.html');
const exampleHtml = fs.readFileSync(examplePath, 'utf8');

describe('marketing-site-layout', () => {
  it('prompt lines mention all three screen ids', () => {
    const text = marketingSitePromptLines().join('\n');
    expect(text).toContain('data-screen-id="landing"');
    expect(text).toContain('≤280 lines');
  });

  it('canonical example parses three flow screens', () => {
    const screens = parseFlowScreens(exampleHtml, 'saas-landing');
    expect(screens.map((s) => s.id)).toEqual(['landing', 'changelog', 'blog']);
    expect(screens[0].label).toBe('Landing');
  });

  it('canonical example has flow navigation links', () => {
    expect(artifactHasFlowLinks(exampleHtml)).toBe(true);
    expect(isMarketingSiteArtifact(exampleHtml)).toBe(true);
    expect(lintMarketingSiteFlow(exampleHtml)).toBeNull();
  });

  it('ensureMarketingSiteScreens injects missing changelog and blog stubs', () => {
    const landingOnly = `<!doctype html><html><body>
      <section data-screen-id="landing" data-screen-label="Landing">
        <a href="#" data-goto="changelog">Changelog</a>
      </section>
    </body></html>`;
    const out = ensureMarketingSiteScreens(landingOnly);
    expect(missingMarketingScreens(out)).toEqual([]);
    expect(out).toContain('data-screen-id="changelog"');
    expect(out).toContain('data-screen-id="blog"');
  });

  it('lintMarketingSiteFlow warns when screens are missing', () => {
    const partial = '<section data-screen-id="landing"></section>';
    const issue = lintMarketingSiteFlow(partial);
    expect(issue?.rule).toBe('marketing-screens');
    expect(issue?.message).toContain('changelog');
  });

  it('lintMarketingSiteFlow warns when data-goto is absent', () => {
    const noLinks = `
      <section data-screen-id="landing"></section>
      <section data-screen-id="changelog"></section>
      <section data-screen-id="blog"></section>
    `;
    const issue = lintMarketingSiteFlow(noLinks);
    expect(issue?.rule).toBe('marketing-flow-links');
  });
});
