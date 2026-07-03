import { describe, it, expect } from 'vitest';
import { lintArtifact } from '../electron/lint';
import { normalizeArtifactDocument } from '../src/lib/artifact-html';
import {
  fixArtifactLintFindings,
  fixDashboardVw,
  fixImgAlt,
  fixNoopenerLinks,
} from '../src/lib/artifact-lint-fix';

describe('artifact-lint-fix', () => {
  it('adds alt text to images missing it', () => {
    const html = '<img src="hero-shot.png">';
    const out = fixImgAlt(html);
    expect(out).toContain('alt="Hero shot"');
    expect(lintArtifact(`<!doctype html><html><head><title>x</title></head><body><h1>x</h1>${out}</body></html>`).findings
      .some((f) => f.rule === 'img-alt')).toBe(false);
  });

  it('adds noopener to target=_blank links', () => {
    const html = '<a href="https://x.com" target="_blank">Open</a>';
    const out = fixNoopenerLinks(html);
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('replaces 100vw in dashboards', () => {
    const html = '<meta name="renoir:dashboard" content="1"><main style="width:100vw"></main>';
    expect(fixDashboardVw(html)).toContain('width:100%');
  });

  it('clears common warnings via normalizeArtifactDocument', () => {
    const raw = `<html><head></head><body>
      <img src="a.png">
      <a href="https://example.com" target="_blank">Open</a>
      <input type="text">
      <button></button>
    </body></html>`;
    const before = lintArtifact(raw);
    expect(before.findings.some((f) => f.rule === 'doctype')).toBe(true);

    const out = normalizeArtifactDocument(raw, { title: 'Demo', viewportWidth: 1280 });
    const after = lintArtifact(out);
    expect(after.errors).toBe(0);
    expect(after.findings.some((f) => f.rule === 'doctype')).toBe(false);
    expect(after.findings.some((f) => f.rule === 'img-alt')).toBe(false);
    expect(after.findings.some((f) => f.rule === 'noopener')).toBe(false);
    expect(after.findings.some((f) => f.rule === 'input-label')).toBe(false);
    expect(after.findings.some((f) => f.rule === 'button-empty')).toBe(false);
  });

  it('fixes dashboard region warnings when shell is injected', () => {
    const raw = `<!doctype html><html><head><meta name="renoir:dashboard" content="1"><title>Dash</title></head>
      <body><main><header data-od-id="topbar"></header></main></body></html>`;
    const before = lintArtifact(raw);
    expect(before.findings.some((f) => f.rule === 'dashboard-regions')).toBe(true);

    const out = normalizeArtifactDocument(raw, { title: 'Dash', dashboard: true, viewportWidth: 1280 });
    const after = lintArtifact(out);
    expect(after.findings.some((f) => f.rule === 'dashboard-regions')).toBe(false);
  });

  it('is idempotent', () => {
    const html = '<img src="x.png"><a href="/" target="_blank">x</a>';
    const once = fixArtifactLintFindings(html, { title: 'T' });
    const twice = fixArtifactLintFindings(once, { title: 'T' });
    expect(twice).toBe(once);
  });
});
