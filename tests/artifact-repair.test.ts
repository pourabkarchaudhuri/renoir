import { describe, it, expect } from 'vitest';
import { lintArtifact } from '../electron/lint';
import { repairArtifactHtml, repairArtifactIfNeeded } from '../src/lib/artifact-repair';

describe('artifact-repair', () => {
  it('repairs common lint issues in one pass', () => {
    const raw = `<html><head></head><body>
      <img src="hero.png">
      <a href="https://x.com" target="_blank">Open</a>
    </body></html>`;
    const out = repairArtifactHtml(raw, { title: 'Demo' });
    const report = lintArtifact(out);
    expect(report.errors).toBe(0);
    expect(report.findings.some((f) => f.rule === 'img-alt')).toBe(false);
    expect(report.findings.some((f) => f.rule === 'noopener')).toBe(false);
  });

  it('repairArtifactIfNeeded reports improvement for broken artifacts', async () => {
    const raw = `<html><head></head><body><img src="a.png"></body></html>`;
    const result = await repairArtifactIfNeeded(
      raw,
      { title: 'Demo', viewportWidth: 1280 },
      async (h) => lintArtifact(h),
      raw,
    );
    expect(result.improved).toBe(true);
    expect(result.after.errors).toBe(0);
    expect(result.after.findings.some((f) => f.rule === 'img-alt')).toBe(false);
  });

  it('repairArtifactIfNeeded is a no-op when preview is already clean', async () => {
    const clean = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Ok</title></head>
      <body><main><h1>Hi</h1><img src="a.png" alt="Photo"></main></body></html>`;
    const result = await repairArtifactIfNeeded(
      clean,
      { title: 'Ok' },
      async (html) => lintArtifact(html),
    );
    expect(result.improved).toBe(false);
    expect(result.changed).toBe(false);
  });
});
