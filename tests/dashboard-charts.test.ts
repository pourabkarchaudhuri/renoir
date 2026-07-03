import { describe, it, expect } from 'vitest';
import {
  buildBarChartSvg,
  buildLineChartSvg,
  lineChartPoints,
  lintDashboardCharts,
  normalizeDashboardCharts,
  regionExpressesChartData,
} from '../shared/dashboard-charts';
import { ensureDashboardChartData } from '../shared/dashboard-layout';

describe('dashboard-charts', () => {
  it('maps higher values to smaller y (upward trend)', () => {
    const values = [10, 20, 30, 40];
    const points = lineChartPoints(values, { width: 400, height: 200 });
    const ys = points.split(/\s+/).map((p) => Number(p.split(',')[1]));
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeLessThan(ys[i - 1]);
    }
  });

  it('builds line charts with viewBox and data series attribute', () => {
    const svg = buildLineChartSvg([1, 2, 3, 4, 5]);
    expect(svg).toContain('viewBox="0 0 600 200"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain('data-od-series="1,2,3,4,5"');
    expect(svg).toContain('<polyline');
  });

  it('builds bar charts with proportional bar heights', () => {
    const svg = buildBarChartSvg([10, 20, 30]);
    expect(svg).toContain('data-od-chart="bar"');
    const heights = [...svg.matchAll(/height="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(heights[2]).toBeGreaterThan(heights[1]);
    expect(heights[1]).toBeGreaterThan(heights[0]);
  });

  it('warns on distorted line charts', () => {
    const html = `<html><head><meta name="renoir:dashboard" content="1"></head><body>
      <section data-od-id="primary-chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points="0,90 50,50 100,10"/>
        </svg>
      </section>
    </body></html>`;
    const findings = lintDashboardCharts(html);
    expect(findings.some((f) => f.rule === 'dashboard-chart-distorted')).toBe(true);
  });

  it('fixes preserveAspectRatio on line charts during normalization', () => {
    const html = `<html><head><meta name="renoir:dashboard" content="1"></head><body>
      <section data-od-id="primary-chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="0,1 1,0"/></svg>
      </section>
    </body></html>`;
    const out = normalizeDashboardCharts(html);
    expect(out).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it('warns when primary chart has no svg', () => {
    const html = `<html><head><meta name="renoir:dashboard" content="1"></head><body>
      <section data-od-id="primary-chart"><p>empty</p></section>
    </body></html>`;
    const findings = lintDashboardCharts(html);
    expect(findings.some((f) => f.rule === 'dashboard-chart-missing')).toBe(true);
  });

  it('handles single-point and flat series without invalid geometry', () => {
    const line = buildLineChartSvg([42]);
    expect(line).toMatch(/points="[^"]+\s+[^"]+"/);
    const flat = buildBarChartSvg([10, 10, 10]);
    expect(flat).not.toMatch(/height="0(?:\.0)?"/);
  });

  it('rebuilds broken line geometry from data-od-series', () => {
    const html = `<html><head><meta name="renoir:dashboard" content="1"></head><body>
      <section data-od-id="primary-chart">
        <svg viewBox="0 0 600 200" data-od-chart="line" data-od-series="1,2,3,4,5">
          <polyline points=""/>
        </svg>
      </section>
    </body></html>`;
    const out = normalizeDashboardCharts(html);
    expect(out).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(out).toMatch(/points="[^"]+,[^"]+"/);
    const findings = lintDashboardCharts(out);
    expect(findings.some((f) => f.rule === 'dashboard-chart-geometry')).toBe(false);
  });

  it('injects charts when regions exist but express no data', () => {
    const html = `<html><head><meta name="renoir:dashboard" content="1"></head><body><main>
      <section data-od-id="kpis">
        <div class="kpi"><span>MRR</span><strong>$48K</strong></div>
        <div class="kpi"><span>Users</span><strong>3,184</strong></div>
        <div class="kpi"><span>Churn</span><strong>2.1%</strong></div>
        <div class="kpi"><span>Uptime</span><strong>99.9%</strong></div>
      </section>
      <section data-od-id="primary-chart"><p>Chart loading…</p></section>
      <section data-od-id="secondary-panel"></section>
    </main></body></html>`;
    const out = ensureDashboardChartData(html);
    expect(out).toContain('data-od-chart="line"');
    expect(out).toContain('data-od-chart="bar"');
    expect(out).toContain('<polyline');
    const findings = lintDashboardCharts(out);
    expect(findings.some((f) => f.rule === 'dashboard-chart-missing')).toBe(false);
  });

  it('treats empty svg shells as missing chart data', () => {
    const html = `<section data-od-id="primary-chart"><div class="chart"><svg></svg></div></section>`;
    expect(regionExpressesChartData(html)).toBe(false);
  });
});
