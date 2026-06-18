import { describe, it, expect } from 'vitest';
import { lintArtifact, extractBrandSpec } from '../electron/lint';

describe('lintArtifact', () => {
  it('flags missing doctype as error', () => {
    const r = lintArtifact('<html><body>x</body></html>');
    expect(r.findings.some((f) => f.rule === 'doctype' && f.level === 'error')).toBe(true);
    expect(r.errors).toBeGreaterThanOrEqual(1);
  });

  it('rewards a complete simple doc', () => {
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Hi</title></head>
      <body><main><h1>Hello</h1><img src="a.png" alt="ok"><button>Click</button></main></body></html>`;
    const r = lintArtifact(html);
    expect(r.errors).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it('warns on imgs without alt', () => {
    const html = `<!doctype html><html><head><title>Hi</title></head><body><h1>x</h1><img src="a.png"><img src="b.png"></body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'img-alt')).toBe(true);
  });

  it('flags generic link text', () => {
    const html = `<!doctype html><html><head><title>x</title></head><body><h1>x</h1><a href="/">click here</a></body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'link-text')).toBe(true);
  });
});

describe('extractBrandSpec', () => {
  it('pulls hex + oklch colors', () => {
    const spec = extractBrandSpec('Brand colors are #ff8800 and oklch(0.74 0.18 50)');
    expect(spec.colors).toContain('#ff8800');
    expect(spec.colors.some((c) => c.startsWith('oklch'))).toBe(true);
  });

  it('parses voice / audience / brand from key:value lines', () => {
    const spec = extractBrandSpec(`brand: Acme\nvoice: warm and direct\naudience: mid-market CFOs`);
    expect(spec.name).toBe('Acme');
    expect(spec.voice).toContain('warm');
    expect(spec.audience).toContain('CFO');
  });

  it('captures do-nots and values', () => {
    const spec = extractBrandSpec(`don't: shout\n- avoid jargon\nvalues: honesty, restraint`);
    expect(spec.doNots.length).toBeGreaterThanOrEqual(1);
    expect(spec.values).toContain('honesty');
    expect(spec.values).toContain('restraint');
  });

  it('detects known font hints', () => {
    const spec = extractBrandSpec('We use Inter for UI and Instrument Serif for display.');
    expect(spec.fonts).toContain('Inter');
    expect(spec.fonts).toContain('Instrument Serif');
  });
});
