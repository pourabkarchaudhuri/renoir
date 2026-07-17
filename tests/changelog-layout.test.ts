import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHANGELOG_REGIONS,
  changelogPromptLines,
  isChangelogArtifact,
  lintChangelogRegions,
  missingChangelogRegions,
  parseChangelogRegionIds,
} from '../shared/changelog-layout';

const exampleHtml = readFileSync(
  resolve(__dirname, '../skills/changelog/example.html'),
  'utf-8',
);

describe('changelogPromptLines', () => {
  it('includes section contract and required region ids', () => {
    const lines = changelogPromptLines().join('\n');
    expect(lines).toContain('# Changelog — single-screen release notes');
    expect(lines).toContain('6–8 reverse-chron');
    expect(lines).toContain('max-width ~720px');
    for (const region of CHANGELOG_REGIONS) {
      expect(lines).toContain(`"${region}"`);
    }
  });
});

describe('parseChangelogRegionIds', () => {
  it('extracts unique data-od-id values from example.html', () => {
    const ids = parseChangelogRegionIds(exampleHtml);
    for (const region of CHANGELOG_REGIONS) {
      expect(ids).toContain(region);
    }
  });
});

describe('missingChangelogRegions', () => {
  it('returns no missing regions for canonical example', () => {
    expect(missingChangelogRegions(exampleHtml)).toEqual([]);
  });

  it('flags missing regions when changelog-header is present', () => {
    const partial = '<div data-od-id="changelog-header"><h1>Changelog</h1></div>';
    const missing = missingChangelogRegions(partial);
    expect(missing).toContain('changelog');
    expect(missing).toContain('changelog-filters');
    expect(missing).toContain('changelog-entries');
  });
});

describe('isChangelogArtifact', () => {
  it('detects standalone changelog artifacts by header and entries', () => {
    expect(isChangelogArtifact(exampleHtml)).toBe(true);
    expect(isChangelogArtifact('<div data-od-id="changelog-header"></div>')).toBe(false);
    expect(isChangelogArtifact('<p>plain html</p>')).toBe(false);
  });

  it('returns false for marketing-site changelog screen with data-screen-id', () => {
    const marketingChangelog = `
      <section data-screen-id="changelog" data-od-id="changelog">
        <header data-od-id="changelog-header"><h1>Changelog</h1></header>
        <div data-od-id="changelog-entries"><article><h2>v1.0.0</h2></article></div>
      </section>
    `;
    expect(isChangelogArtifact(marketingChangelog)).toBe(false);
  });
});

describe('lintChangelogRegions', () => {
  it('returns null for canonical example', () => {
    expect(lintChangelogRegions(exampleHtml)).toBeNull();
  });

  it('reports missing regions for partial changelog artifacts', () => {
    const partial = `
      <header data-od-id="changelog-header"><h1>Changelog</h1></header>
      <div data-od-id="changelog-entries"><article><h2>v1.0.0</h2></article></div>
    `;
    const issue = lintChangelogRegions(partial);
    expect(issue?.rule).toBe('changelog-regions');
    expect(issue?.message).toContain('changelog');
    expect(issue?.message).toContain('changelog-filters');
  });

  it('ignores non-changelog artifacts', () => {
    expect(lintChangelogRegions('<p>not a changelog</p>')).toBeNull();
  });

  it('ignores marketing-site changelog screens', () => {
    const marketingChangelog = `
      <section data-screen-id="changelog">
        <header data-od-id="changelog-header"><h1>Changelog</h1></header>
        <div data-od-id="changelog-entries"><article><h2>v1.0.0</h2></article></div>
      </section>
    `;
    expect(lintChangelogRegions(marketingChangelog)).toBeNull();
  });
});
