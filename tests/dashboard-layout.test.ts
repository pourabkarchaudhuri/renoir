import { describe, it, expect } from 'vitest';
import {
  DASHBOARD_REGIONS,
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_PREVIEW_WIDTHS,
  DASHBOARD_SPACING,
  dashboardLayoutPromptLines,
  injectDashboardShell,
  isDashboardArtifact,
  missingDashboardRegions,
  wrapDashboardPanelsRow,
} from '../shared/dashboard-layout';

describe('dashboard-layout', () => {
  it('defines aligned preview widths and CSS breakpoints', () => {
    expect(DASHBOARD_PREVIEW_WIDTHS).toEqual({ phone: 390, tablet: 820, desktop: 1280, ultrawide: 1920 });
    expect(DASHBOARD_BREAKPOINTS).toEqual({ tablet: 640, desktop: 1280, ultrawide: 1920 });
  });

  it('requires four fixed dashboard regions (no sidebar)', () => {
    expect(DASHBOARD_REGIONS.map((r) => r.id)).toEqual([
      'topbar', 'kpis', 'primary-chart', 'secondary-panel',
    ]);
  });

  it('detects dashboard artifacts', () => {
    const html = '<html><head><meta name="renoir:dashboard" content="1"></head><body></body></html>';
    expect(isDashboardArtifact(html)).toBe(true);
    expect(isDashboardArtifact('<html><body><main data-od-id="kpis"></main></body></html>')).toBe(true);
    expect(isDashboardArtifact('<html><body><div>landing</div></body></html>')).toBe(false);
  });

  it('reports missing dashboard regions', () => {
    const partial = '<main><section data-od-id="kpis"></section></main>';
    expect(missingDashboardRegions(partial)).toEqual(['topbar', 'primary-chart', 'secondary-panel']);
  });

  it('accepts common alias ids for dashboard regions', () => {
    const html = [
      '<header data-od-id="topbar"></header>',
      '<main>',
      '<div data-od-id="kpis"></div>',
      '<div data-od-id="chart-panel"></div>',
      '<div data-od-id="recent-events"></div>',
      '</main>',
    ].join('');
    expect(missingDashboardRegions(html)).toEqual([]);
  });

  it('normalizes alias region ids to canonical names', () => {
    const html = '<div data-od-id="chart-panel"></div><div data-od-id="signups-panel"></div>';
    const out = injectDashboardShell(html);
    expect(out).toContain('data-od-id="primary-chart"');
    expect(out).toContain('data-od-id="secondary-panel"');
    expect(out).not.toContain('chart-panel');
    expect(out).not.toContain('signups-panel');
  });

  it('injects dashboard meta and baseline containment CSS', () => {
    const html = '<!doctype html><html><head><style>body{color:red}</style></head><body></body></html>';
    const out = injectDashboardShell(html);
    expect(out).toContain('name="renoir:dashboard"');
    expect(out).toContain('id="renoir-dashboard-base"');
    expect(out).toContain('overflow-y:auto');
    expect(out).toContain('min-width:0');
    expect(out.indexOf('renoir-dashboard-base')).toBeGreaterThan(out.indexOf('body{color:red}'));
  });

  it('prompt contract forbids sidebars and enforces alignment', () => {
    const lines = dashboardLayoutPromptLines().join('\n');
    expect(lines).toContain('Content parity');
    expect(lines).toContain('Never add or remove components');
    expect(lines).toContain('No navigation chrome');
    expect(lines).toContain('Spacious layout');
    expect(lines).toContain('Uniform element boxes');
    expect(lines).toContain(`${DASHBOARD_SPACING.mainGap}px`);
    expect(lines).toContain('Data plotting');
    expect(lines).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(lines).not.toContain('data-od-id="sidebar"');
    expect(lines).toContain('graphs keep priority');
    expect(lines).toContain('min-width:0');
    expect(lines).toContain('100vw');
  });

  it('tags class-based kpi regions and injects missing stubs', () => {
    const html = `<!doctype html><html><head></head><body>
        <header class="topbar"></header>
        <div class="chart panel"><svg></svg></div>
    </body></html>`;
    const out = injectDashboardShell(html);
    expect(out).toContain('<main>');
    expect(out).toContain('data-od-id="topbar"');
    expect(out).toContain('data-od-id="kpis"');
    expect(out).toContain('data-od-id="primary-chart"');
    expect(out).toContain('data-od-id="secondary-panel"');
    expect(out).not.toContain('<aside');
    expect(missingDashboardRegions(out)).toEqual([]);
  });

  it('strips legacy sidebars and wraps body content in main', () => {
    const html = `<!doctype html><html><head></head><body>
      <aside class="sidebar"><nav>Home</nav></aside>
      <section class="kpis" data-od-id="kpis"><div class="kpi">1</div><div class="kpi">2</div></section>
    </body></html>`;
    const out = injectDashboardShell(html);
    expect(out).not.toContain('<aside');
    expect(out).toContain('<main>');
    expect(out).toContain('data-od-id="kpis"');
  });

  it('includes min-height on chart regions to prevent flex collapse', () => {
    const out = injectDashboardShell('<html><head></head><body></body></html>');
    expect(out).toContain(`min-height:${DASHBOARD_SPACING.primaryMinH}px`);
    expect(out).toContain('flex:2 1 auto');
  });

  it('injects spacious layout rhythm into baseline CSS', () => {
    const out = injectDashboardShell('<html><head></head><body></body></html>');
    expect(out).toContain(`gap:${DASHBOARD_SPACING.mainGap}px`);
    expect(out).toContain(`gap:${DASHBOARD_SPACING.kpiGap}px`);
    expect(out).toContain(`padding:${DASHBOARD_SPACING.mainPadTop}px ${DASHBOARD_SPACING.mainPadX}px ${DASHBOARD_SPACING.mainPadBottom}px`);
    expect(out).toContain(`min-height:${DASHBOARD_SPACING.kpiMinH}px`);
    expect(out).toContain(`padding:${DASHBOARD_SPACING.cardPad}px`);
    expect(out).toContain('grid-auto-rows:1fr');
    expect(out).toContain('align-items:stretch');
  });

  it('wraps adjacent chart panels in panels-row for equal heights', () => {
    const html = `<main>
      <section data-od-id="primary-chart"><div class="chart"><svg></svg></div></section>
      <section data-od-id="secondary-panel"><table></table></section>
    </main>`;
    const out = wrapDashboardPanelsRow(html);
    expect(out).toContain('<div class="panels-row">');
    expect(out).toContain('data-od-id="primary-chart"');
    expect(out).toContain('</section>');
    expect(out).toContain('data-od-id="secondary-panel"');
    expect(wrapDashboardPanelsRow(out)).toBe(out);
  });

  it('injects chart stubs inside panels-row when both are missing', () => {
    const out = injectDashboardShell('<html><head></head><body></body></html>');
    expect(out).toContain('<div class="panels-row">');
    expect(out).toContain('data-od-id="primary-chart"');
    expect(out).toContain('data-od-id="secondary-panel"');
  });

  it('injects chart stubs as siblings after kpis, not nested inside', () => {
    const out = injectDashboardShell('<html><head></head><body></body></html>');
    const main = out.slice(out.indexOf('<main>'), out.indexOf('</main>') + 7);
    const kpisIdx = main.indexOf('data-od-id="kpis"');
    const chartIdx = main.indexOf('data-od-id="primary-chart"');
    const kpisCloseIdx = main.indexOf('</section>', kpisIdx);
    expect(kpisIdx).toBeGreaterThan(-1);
    expect(chartIdx).toBeGreaterThan(kpisCloseIdx);
  });

  it('includes viewport-fill and chart-priority CSS', () => {
    const out = injectDashboardShell('<html><head></head><body></body></html>');
    expect(out).toContain('height:100%');
    expect(out).toContain('[data-od-id="primary-chart"]{flex:2 1 auto');
    expect(out).toContain('overflow-y:auto');
    expect(out).toContain('overflow:hidden!important');
    expect(out).not.toContain('dash-sidebar');
  });

  it('forbids nested scroll on widget regions in prompt and CSS', () => {
    const lines = dashboardLayoutPromptLines().join('\n');
    expect(lines).toContain('No nested scrollbars');
    expect(lines).toContain('Only main may scroll');
    const out = injectDashboardShell('<html><head></head><body></body></html>');
    expect(out).toContain('[data-od-id="primary-chart"],[data-od-id="secondary-panel"],.panels-row>*{');
    expect(out).toContain('overflow:hidden');
    expect(out).not.toMatch(/data-od-id="primary-chart"\][^{]*overflow:auto/);
  });

  it('injects charts into empty primary-chart regions at preview time', () => {
    const html = `<!doctype html><html><head></head><body><main>
      <section data-od-id="kpis"><div class="kpi">1</div><div class="kpi">2</div><div class="kpi">3</div><div class="kpi">4</div></section>
      <section data-od-id="primary-chart"><div class="chart"><svg></svg></div></section>
      <section data-od-id="secondary-panel"><p>Events</p></section>
    </main></body></html>`;
    const out = injectDashboardShell(html);
    expect(out).toContain('data-od-chart="line"');
    expect(out).toContain('<polyline');
    expect(out).toContain('data-od-chart="bar"');
    expect(missingDashboardRegions(out)).toEqual([]);
  });
});
