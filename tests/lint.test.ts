import { describe, it, expect } from 'vitest';
import { lintArtifact, extractBrandSpec } from '../electron/lint';

describe('lintArtifact', () => {
  it('flags missing doctype as error', () => {
    const r = lintArtifact('<html><body>x</body></html>');
    expect(r.findings.some((f) => f.rule === 'doctype' && f.level === 'error')).toBe(true);
    expect(r.errors).toBeGreaterThanOrEqual(1);
  });

  it('warns on missing html lang', () => {
    const html = '<!doctype html><html><head><title>x</title></head><body><h1>x</h1></body></html>';
    const r = lintArtifact(html);
    const f = r.findings.find((x) => x.rule === 'html-lang');
    expect(f).toBeTruthy();
    expect(f?.category).toBe('structure');
    expect(f?.fixable).toBe(true);
  });

  it('rewards a complete simple doc', () => {
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Hi</title></head>
      <body><main><h1>Hello</h1><img src="a.png" alt="ok"><button>Click</button></main></body></html>`;
    const r = lintArtifact(html);
    expect(r.errors).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it('accepts h2–h6 as document heading', () => {
    const html = `<!doctype html><html><head><title>Deck</title><meta name="viewport" content="width=device-width"></head>
      <body><section><h2>Slide title</h2></section></body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'heading')).toBe(false);
  });

  it('skips decorative images without alt', () => {
    const html = `<!doctype html><html><head><title>x</title></head><body><h1>x</h1><img src="a.png" aria-hidden="true"></body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'img-alt')).toBe(false);
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

  it('warns when dashboard regions are missing', () => {
    const html = `<!doctype html><html><head><meta name="renoir:dashboard" content="1"><title>Dash</title></head>
      <body><main><header data-od-id="topbar"></header></main></body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'dashboard-regions')).toBe(true);
  });

  it('passes lint when dashboard uses alias region ids', () => {
    const html = `<!doctype html><html><head><meta name="renoir:dashboard" content="1"><title>Dash</title></head>
      <body>
        <header data-od-id="topbar"></header>
        <main>
          <section data-od-id="kpis"></section>
          <section data-od-id="chart-panel"></section>
          <section data-od-id="recent-events"></section>
        </main>
      </body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'dashboard-regions')).toBe(false);
  });

  it('warns on 100vw in dashboard artifacts', () => {
    const html = `<!doctype html><html><head><meta name="renoir:dashboard" content="1"><title>Dash</title></head>
      <body><main style="width:100vw" data-od-id="kpis"></main></body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'dashboard-vw')).toBe(true);
  });

  it('warns when dashboard widgets use nested scroll', () => {
    const html = `<!doctype html><html><head><meta name="renoir:dashboard" content="1"><title>Dash</title></head>
      <body><style>.chart { overflow: auto; }</style><section data-od-id="primary-chart"></section></body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'dashboard-nested-scroll')).toBe(true);
  });

  it('warns when dashboard line chart distorts data', () => {
    const html = `<!doctype html><html><head><meta name="renoir:dashboard" content="1"><title>Dash</title></head>
      <body><section data-od-id="primary-chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="0,90 50,50 100,10"/></svg>
      </section></body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'dashboard-chart-distorted')).toBe(true);
  });

  it('warns when marketing site screens are missing', () => {
    const html = `<!doctype html><html><body>
      <section data-screen-id="landing"><a data-goto="changelog">Go</a></section>
    </body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'marketing-screens')).toBe(true);
  });

  it('passes marketing site lint for canonical example structure', () => {
    const html = `<!doctype html><html><body>
      <section data-screen-id="landing"><nav><button data-goto="changelog">Changelog</button></nav></section>
      <section data-screen-id="changelog"></section>
      <section data-screen-id="blog"></section>
    </body></html>`;
    const r = lintArtifact(html);
    expect(r.findings.some((f) => f.rule === 'marketing-screens')).toBe(false);
    expect(r.findings.some((f) => f.rule === 'marketing-flow-links')).toBe(false);
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
