/** Dashboard layout contract — shared by prompts, preview bridge, normalization, and lint. */

import {
  buildBarChartSvg,
  buildLineChartSvg,
  dashboardChartPromptLines,
  DEFAULT_BAR_SERIES,
  DEFAULT_LINE_SERIES,
  inferBarSeries,
  inferLineSeries,
  normalizeDashboardCharts,
  regionExpressesChartData,
  regionExpressesSecondaryData,
  svgExpressesChartData,
} from './dashboard-charts.js';

export const DASHBOARD_META = 'renoir:dashboard';

/** Device widths used in Renoir preview (match PREVIEW_SURFACES). */
export const DASHBOARD_PREVIEW_WIDTHS = {
  phone: 390,
  tablet: 820,
  desktop: 1280,
  ultrawide: 1920,
} as const;

/** Injected layout rhythm — single source of truth for spacious dashboard spacing. */
export const DASHBOARD_SPACING = {
  mainGap: 24,
  mainPadX: 32,
  mainPadTop: 24,
  mainPadBottom: 32,
  kpiGap: 16,
  panelGap: 20,
  cardPad: 24,
  kpiMinH: 88,
  primaryMinH: 180,
  secondaryMinH: 160,
  chartMinH: 120,
} as const;

/** CSS min-width breakpoints for @media queries (mobile-first). */
export const DASHBOARD_BREAKPOINTS = {
  tablet: 640,
  desktop: 1280,
  ultrawide: 1920,
} as const;

/** Required regions — must stay in the DOM at every breakpoint. */
export const DASHBOARD_REGIONS = [
  { id: 'topbar', label: 'Page header (title + actions — no nav links)' },
  { id: 'kpis', label: 'KPI strip (4 cards)' },
  { id: 'primary-chart', label: 'Primary chart' },
  { id: 'secondary-panel', label: 'Secondary chart or data table' },
] as const;

const REGION_IDS = DASHBOARD_REGIONS.map((r) => r.id);

/** Legacy / LLM alias ids accepted in place of the canonical region ids. */
export const DASHBOARD_REGION_ALIASES: Record<string, readonly string[]> = {
  topbar: ['header', 'app-bar', 'appbar'],
  kpis: ['kpi-strip', 'metrics', 'kpi-row', 'kpi-grid', 'stats', 'stat-grid', 'overview-metrics'],
  'primary-chart': ['chart-panel', 'main-chart', 'chart-primary', 'analytics-chart'],
  'secondary-panel': [
    'secondary-chart', 'data-table', 'recent-events', 'signups-panel',
    'events-table', 'table-panel', 'secondary', 'activity', 'activity-feed',
    'panel-table',
  ],
};

/**
 * Scroll lock for dashboard docs — body fills viewport; main scrolls when content overflows.
 */
export const DASHBOARD_SCROLL_LOCK_CSS =
  'html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;' +
  'min-height:100%!important;max-height:100%!important;overflow:hidden!important;' +
  'box-sizing:border-box!important;}';

/**
 * Layout CSS: fill viewport height, distribute regions evenly, scroll inside main when needed.
 * Spacing values come from DASHBOARD_SPACING so preview + lint stay aligned.
 */
export const DASHBOARD_BASE_CSS = (() => {
  const s = DASHBOARD_SPACING;
  const mainPad = `${s.mainPadTop}px ${s.mainPadX}px ${s.mainPadBottom}px`;
  return [
  'html{height:100%;}',
  'body{margin:0;padding:0;width:100%;height:100%;min-height:100%;max-height:100%;overflow:hidden;box-sizing:border-box;',
    'display:flex;flex-direction:column;}',
  'body>main,body>section.dashboard,body>div.dashboard,body>div.app,body>#app,body>.shell{',
    'display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;width:100%;',
    `max-height:100%;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;gap:${s.mainGap}px;padding:${mainPad};}`,
  'main{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;width:100%;',
    `max-height:100%;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;gap:${s.mainGap}px;padding:${mainPad};}`,
  '[data-od-id="topbar"],main>header,body>header{flex:0 0 auto;}',
  `[data-od-id="kpis"]{flex:0 0 auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:${s.kpiGap}px;width:100%;align-items:stretch;grid-auto-rows:1fr;}`,
  `[data-od-id="kpis"]>*,[data-od-id="kpis"] .kpi{display:flex;flex-direction:column;min-height:${s.kpiMinH}px;height:100%;width:100%;padding:${s.cardPad}px;box-sizing:border-box;}`,
  `main>.panels-row,.panels-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:${s.panelGap}px;flex:2 1 auto;min-height:0;width:100%;align-items:stretch;}`,
  `[data-od-id="primary-chart"],[data-od-id="secondary-panel"]{padding:${s.cardPad}px;box-sizing:border-box;}`,
  `[data-od-id="primary-chart"]{flex:2 1 auto;min-height:${s.primaryMinH}px;}`,
  `[data-od-id="secondary-panel"]{flex:1 1 auto;min-height:${s.secondaryMinH}px;}`,
  `.panels-row>[data-od-id="primary-chart"],.panels-row>[data-od-id="secondary-panel"]{flex:1 1 auto;height:100%;min-height:${s.secondaryMinH}px;}`,
  `[data-od-id="primary-chart"],[data-od-id="secondary-panel"],.panels-row>*{`,
    `display:flex;flex-direction:column;min-width:0;min-height:${s.secondaryMinH}px;overflow:hidden;}`,
  '[data-od-id="topbar"],[data-od-id="kpis"],[data-od-id="kpis"]>*,[data-od-id="kpis"] .kpi,',
    '.panels-row,[data-od-id="primary-chart"],[data-od-id="secondary-panel"],.panels-row>*{overflow:hidden!important;}',
  '[data-od-id="kpis"]>*,[data-od-id="kpis"] .kpi{overflow:hidden;text-overflow:ellipsis;}',
  '[data-od-id="primary-chart"] .chart,[data-od-id="secondary-panel"] .chart{',
    'flex:1 1 auto;min-height:0;min-width:0;overflow:hidden;display:flex;flex-direction:column;}',
  '[data-od-id="primary-chart"] svg,[data-od-id="primary-chart"] .chart,',
    `[data-od-id="secondary-panel"] svg{flex:1 1 auto;width:100%;height:100%;min-height:0;max-height:100%;}`,
  '[data-od-id="secondary-panel"] table{width:100%;table-layout:fixed;border-collapse:collapse;}',
  '[data-od-id="secondary-panel"] th,[data-od-id="secondary-panel"] td{',
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.renoir-dash-stub{opacity:.92;}',
  '*,*::before,*::after{box-sizing:border-box;}',
  '[data-od-id]{min-width:0;}',
  'img,svg,canvas,video{max-width:100%;}',
  'table{width:100%;border-collapse:collapse;}',
  `@media (max-width:${DASHBOARD_BREAKPOINTS.tablet - 1}px){`,
  '[data-od-id="kpis"]{grid-template-columns:repeat(2,minmax(0,1fr));}',
  '.panels-row,main>.panels-row{grid-template-columns:1fr;}',
  '}',
  `@media (min-width:${DASHBOARD_BREAKPOINTS.tablet}px) and (max-width:${DASHBOARD_BREAKPOINTS.desktop - 1}px){`,
  '[data-od-id="kpis"]{grid-template-columns:repeat(2,minmax(0,1fr));}',
  '}',
].join('');
})();

const TOPBAR_STUB = `<header data-od-id="topbar" class="renoir-dash-stub" aria-label="Page header">
  <h1 style="margin:0;font-size:18px;font-weight:600">Dashboard</h1>
</header>`;

const DASHBOARD_META_TAG = `<meta name="${DASHBOARD_META}" content="1">`;
const DASHBOARD_STYLE_TAG = `<style id="renoir-dashboard-base">\n${DASHBOARD_BASE_CSS}\n</style>`;

const KPI_STUB = `<section data-od-id="kpis" class="renoir-dash-stub" aria-label="Key metrics">
  <div class="kpi"><span>MRR</span><strong>$48.2K</strong></div>
  <div class="kpi"><span>Active users</span><strong>3,184</strong></div>
  <div class="kpi"><span>Churn</span><strong>2.1%</strong></div>
  <div class="kpi"><span>Uptime</span><strong>99.97%</strong></div>
</section>`;

const SECONDARY_STUB = `<section data-od-id="secondary-panel" class="renoir-dash-stub panel" aria-label="Secondary analytics">
  <h3 style="margin:0 0 8px;font-size:13px;font-weight:500">Weekly signups</h3>
  ${buildBarChartSvg(DEFAULT_BAR_SERIES, { label: 'Weekly signups bar chart', height: 120 })}
</section>`;

const PRIMARY_CHART_STUB = `<section data-od-id="primary-chart" class="renoir-dash-stub panel" aria-label="Primary chart">
  <h3 style="margin:0 0 8px;font-size:13px;font-weight:500">MRR · 30 days ($K)</h3>
  <div class="chart" style="flex:1;min-height:120px">
    ${buildLineChartSvg(DEFAULT_LINE_SERIES, { label: 'MRR trend in thousands', height: 200 })}
  </div>
</section>`;

const PANELS_ROW_WRAP = (inner: string) => `<div class="panels-row">\n${inner}\n</div>`;

/** Slice a balanced <section> or <div> that carries a canonical data-od-id. */
function sliceOdElement(html: string, odId: string): { start: number; end: number } | null {
  const openRe = new RegExp(
    `<((?:section)|(?:div))[^>]*data-od-id=["']${odId}["'][^>]*>`,
    'i',
  );
  const open = openRe.exec(html);
  if (!open || open.index == null) return null;
  const tag = open[1].toLowerCase();
  const start = open.index;
  let pos = start + open[0].length;
  let depth = 1;
  const openTagRe = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi');
  const closeTagRe = new RegExp(`</${tag}>`, 'gi');
  while (depth > 0 && pos < html.length) {
    openTagRe.lastIndex = pos;
    closeTagRe.lastIndex = pos;
    const nextOpen = openTagRe.exec(html);
    const nextClose = closeTagRe.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      pos = nextOpen.index + nextOpen[0].length;
    } else {
      depth -= 1;
      pos = nextClose.index + nextClose[0].length;
    }
  }
  return depth === 0 ? { start, end: pos } : null;
}

/** Wrap adjacent chart regions in a panels-row so grid enforces equal panel heights. */
export function wrapDashboardPanelsRow(html: string): string {
  if (
    /\bclass=["'][^"']*\bpanels-row\b[^"']*["'][^>]*>[\s\S]*?data-od-id=["']primary-chart["']/i.test(html)
  ) {
    return html;
  }
  const primary = sliceOdElement(html, 'primary-chart');
  const secondary = sliceOdElement(html, 'secondary-panel');
  if (!primary || !secondary || secondary.start < primary.end) return html;
  if (!/^\s*$/.test(html.slice(primary.end, secondary.start))) return html;
  const inner = `${html.slice(primary.start, primary.end)}\n${html.slice(secondary.start, secondary.end)}`;
  return `${html.slice(0, primary.start)}${PANELS_ROW_WRAP(inner)}${html.slice(secondary.end)}`;
}

/** Strip sidebar/nav chrome and ensure a scrollable main shell exists. */
export function normalizeDashboardStructure(html: string): string {
  let out = html
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(
      /<nav\b[^>]*\bclass=["'][^"']*\b(?:sidebar|sidenav|rail|nav-rail)\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi,
      '',
    );

  if (/<main[\s>]/i.test(out)) return out;

  return out.replace(
    /(<body[^>]*>)([\s\S]*?)(<\/body>)/i,
    (_match, open: string, inner: string, close: string) => {
      if (/^\s*<main[\s>]/i.test(inner.trim())) return `${open}${inner}${close}`;
      return `${open}<main>${inner}</main>${close}`;
    },
  );
}

export function isDashboardArtifact(html: string): boolean {
  if (new RegExp(`name=["']${DASHBOARD_META}["']`, 'i').test(html)) return true;
  if (!/<main[\s>]/i.test(html)) return false;
  return hasRegionId(html, 'kpis')
    || /\bkpi\b/i.test(html);
}

function hasRegionId(html: string, id: string): boolean {
  if (new RegExp(`data-od-id=["']${id}["']`, 'i').test(html)) return true;
  const aliases = DASHBOARD_REGION_ALIASES[id] ?? [];
  return aliases.some((alias) => new RegExp(`data-od-id=["']${alias}["']`, 'i').test(html));
}

function hasHeuristicKpis(html: string): boolean {
  if (hasRegionId(html, 'kpis')) return true;
  if (/\bclass=["'][^"']*\b(?:kpis|kpi-grid|metrics-row|stat-grid)\b/i.test(html)) return true;
  return (html.match(/\bclass=["'][^"']*\bkpi\b/gi) ?? []).length >= 2;
}

function getRegionBlock(html: string, id: string): string | null {
  const direct = html.match(
    new RegExp(`<([a-z]+)[^>]*data-od-id=["']${id}["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'i'),
  )?.[0];
  if (direct) return direct;
  for (const alias of DASHBOARD_REGION_ALIASES[id] ?? []) {
    const block = html.match(
      new RegExp(`<([a-z]+)[^>]*data-od-id=["']${alias}["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'i'),
    )?.[0];
    if (block) return block;
  }
  return null;
}

function hasHeuristicPrimaryChart(html: string): boolean {
  const block = getRegionBlock(html, 'primary-chart');
  if (block) return regionExpressesChartData(block);
  const svgs = html.match(/<svg\b[\s\S]*?<\/svg>/gi) ?? [];
  return svgs.some(svgExpressesChartData);
}

function hasHeuristicSecondary(html: string): boolean {
  const block = getRegionBlock(html, 'secondary-panel');
  if (block) return regionExpressesSecondaryData(block);
  if (/\bclass=["'][^"']*\b(?:panel|card)\b[^"']*["'][^>]*>[\s\S]{0,400}<table/i.test(html)) return true;
  const charts = html.match(/<svg\b/gi) ?? [];
  return charts.length >= 2;
}

export function missingDashboardRegions(html: string): string[] {
  const missing = REGION_IDS.filter((id) => !hasRegionId(html, id));
  if (missing.includes('kpis') && hasHeuristicKpis(html)) {
    return missing.filter((id) => id !== 'kpis');
  }
  if (missing.includes('primary-chart') && hasHeuristicPrimaryChart(html)) {
    return missing.filter((id) => id !== 'primary-chart');
  }
  if (missing.includes('secondary-panel') && hasHeuristicSecondary(html)) {
    return missing.filter((id) => id !== 'secondary-panel');
  }
  return missing;
}

/** Rewrite common alias data-od-id values to canonical region ids. */
export function normalizeDashboardRegionIds(html: string): string {
  let out = html;
  for (const id of REGION_IDS) {
    if (new RegExp(`data-od-id=["']${id}["']`, 'i').test(out)) continue;
    const aliases = DASHBOARD_REGION_ALIASES[id] ?? [];
    for (const alias of aliases) {
      const re = new RegExp(`(data-od-id=["'])${alias}(["'])`, 'i');
      if (re.test(out)) {
        out = out.replace(re, `$1${id}$2`);
        break;
      }
    }
  }
  return out;
}

function tagOpenTag(html: string, pattern: RegExp, id: string): string {
  return html.replace(pattern, (match, tag: string, attrs: string) => {
    if (/data-od-id\s*=/i.test(attrs)) return match;
    return `<${tag}${attrs} data-od-id="${id}">`;
  });
}

/** Add canonical data-od-id to common class-based dashboard regions. */
export function tagHeuristicDashboardRegions(html: string): string {
  let out = html;
  if (!hasRegionId(out, 'topbar')) {
    out = tagOpenTag(
      out,
      /<(header|div)([^>]*\bclass=["'][^"']*\btopbar\b[^"']*["'][^>]*)>/i,
      'topbar',
    );
    if (!hasRegionId(out, 'topbar')) {
      let taggedHeader = false;
      out = out.replace(/<(header)([^>]*)>/i, (match, tag, attrs) => {
        if (taggedHeader || /data-od-id=/i.test(attrs)) return match;
        taggedHeader = true;
        return `<${tag}${attrs} data-od-id="topbar">`;
      });
    }
  }
  if (!hasRegionId(out, 'kpis')) {
    out = tagOpenTag(
      out,
      /<(div|section)([^>]*\bclass=["'][^"']*\b(?:kpis|kpi-grid|metrics-row|stat-grid)\b[^"']*["'][^>]*)>/i,
      'kpis',
    );
  }
  if (!hasRegionId(out, 'primary-chart')) {
    let taggedChart = false;
    out = out.replace(
      /<(div|section)([^>]*\bclass=["'][^"']*(?:chart-panel|chart-area|primary-chart)\b[^"']*["'][^>]*)>/gi,
      (match, tag, attrs) => {
        if (taggedChart || /data-od-id=/i.test(attrs)) return match;
        taggedChart = true;
        return `<${tag}${attrs} data-od-id="primary-chart">`;
      },
    );
    if (!hasRegionId(out, 'primary-chart')) {
      out = out.replace(
        /<(div|section)([^>]*\bclass=["'][^"']*\bchart\b[^"']*["'][^>]*)>/i,
        (match, tag, attrs) => {
          if (/data-od-id=/i.test(attrs)) return match;
          return `<${tag}${attrs} data-od-id="primary-chart">`;
        },
      );
    }
  }
  if (!hasRegionId(out, 'secondary-panel')) {
    let taggedSecondary = false;
    out = out.replace(
      /<(div|section)([^>]*\bclass=["'][^"']*\b(?:panel|card)\b[^"']*["'][^>]*)>/gi,
      (match, tag, attrs, offset) => {
        if (taggedSecondary || /data-od-id=/i.test(attrs)) return match;
        const after = out.slice(offset, offset + 600);
        if (!/<table/i.test(after) && !/<svg/i.test(after)) return match;
        taggedSecondary = true;
        return `<${tag}${attrs} data-od-id="secondary-panel">`;
      },
    );
  }
  return out;
}

function injectAfterTopbar(html: string, fragment: string): string {
  const topbarClose = /<header[^>]*data-od-id=["']topbar["'][^>]*>[\s\S]*?<\/header>/i;
  if (topbarClose.test(html)) {
    return html.replace(topbarClose, (m) => `${m}\n${fragment}`);
  }
  const topbarDiv = /<div[^>]*data-od-id=["']topbar["'][^>]*>[\s\S]*?<\/div>/i;
  if (topbarDiv.test(html)) {
    return html.replace(topbarDiv, (m) => `${m}\n${fragment}`);
  }
  const mainOpen = /<main[^>]*>/i;
  if (mainOpen.test(html)) {
    return html.replace(mainOpen, (m) => `${m}\n${fragment}`);
  }
  return html.replace(/<body[^>]*>/i, (m) => `${m}\n${fragment}`);
}

function injectBeforeMainEnd(html: string, fragment: string): string {
  if (/<\/main>/i.test(html)) {
    return html.replace(/<\/main>/i, `${fragment}\n</main>`);
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${fragment}\n</body>`);
  }
  return `${html}\n${fragment}`;
}

function injectAfterKpis(html: string, fragment: string): string {
  const kpisClose = /<section[^>]*data-od-id=["']kpis["'][^>]*>[\s\S]*?<\/section>/i;
  if (kpisClose.test(html)) {
    return html.replace(kpisClose, (m) => `${m}\n${fragment}`);
  }
  const kpisDiv = /<div[^>]*data-od-id=["']kpis["'][^>]*>[\s\S]*?<\/div>/i;
  if (kpisDiv.test(html)) {
    return html.replace(kpisDiv, (m) => `${m}\n${fragment}`);
  }
  return injectAfterTopbar(html, fragment);
}

/** Insert minimal stub regions so lint + layout contracts are satisfied. */
export function injectMissingDashboardRegions(html: string): string {
  let out = html;
  if (!hasRegionId(out, 'topbar')) {
    const mainOpen = /<main[^>]*>/i;
    if (mainOpen.test(out)) {
      out = out.replace(mainOpen, (m) => `${m}\n${TOPBAR_STUB}`);
    } else {
      out = out.replace(/<body[^>]*>/i, (m) => `${m}\n${TOPBAR_STUB}`);
    }
  }
  if (!hasRegionId(out, 'kpis') && !hasHeuristicKpis(out)) {
    out = injectAfterTopbar(out, KPI_STUB);
  }
  const needPrimary = !hasRegionId(out, 'primary-chart') && !hasHeuristicPrimaryChart(out);
  const needSecondary = !hasRegionId(out, 'secondary-panel') && !hasHeuristicSecondary(out);
  if (needPrimary && needSecondary) {
    out = injectAfterKpis(out, PANELS_ROW_WRAP(`${PRIMARY_CHART_STUB}\n${SECONDARY_STUB}`));
  } else if (needPrimary) {
    out = injectAfterKpis(out, PRIMARY_CHART_STUB);
  } else if (needSecondary) {
    out = injectBeforeMainEnd(out, SECONDARY_STUB);
  }
  return out;
}

/**
 * Inject plotted SVG charts into chart regions that exist but express no data.
 * Runs before normalizeDashboardCharts so geometry repair can fix edge cases.
 */
export function ensureDashboardChartData(html: string): string {
  if (!isDashboardArtifact(html) && !hasRegionId(html, 'primary-chart') && !hasRegionId(html, 'kpis')) {
    return html;
  }
  let out = html;
  for (const { id, kind } of [
    { id: 'primary-chart', kind: 'line' as const },
    { id: 'secondary-panel', kind: 'secondary' as const },
  ]) {
    const region = getRegionBlock(out, id);
    if (!region) continue;
    const ok = kind === 'secondary'
      ? regionExpressesSecondaryData(region)
      : regionExpressesChartData(region);
    if (ok) continue;

    const open = region.match(/^<((?:section)|(?:div))([^>]*)>/i);
    if (!open) continue;
    const tag = open[1];
    const attrs = open[2].replace(
      /data-od-id\s*=\s*["'][^"']+["']/i,
      `data-od-id="${id}"`,
    );
    const series = kind === 'line' ? inferLineSeries(out) : inferBarSeries(out);
    const title = kind === 'line' ? 'Trend' : 'Breakdown';
    const chart = kind === 'line'
      ? buildLineChartSvg(series, { label: 'Primary metric trend', height: 200 })
      : buildBarChartSvg(series, { label: 'Secondary metric breakdown', height: 120 });
    const inner = kind === 'line'
      ? `<h3 style="margin:0 0 8px;font-size:13px;font-weight:500">${title}</h3><div class="chart" style="flex:1;min-height:120px">${chart}</div>`
      : `<h3 style="margin:0 0 8px;font-size:13px;font-weight:500">${title}</h3>${chart}`;
    out = out.replace(region, `<${tag}${attrs}>${inner}</${tag}>`);
  }
  return out;
}

/** Normalize ids, tag heuristics, and inject any still-missing required regions. */
export function ensureDashboardRegions(html: string): string {
  let out = normalizeDashboardStructure(html);
  out = normalizeDashboardRegionIds(out);
  out = tagHeuristicDashboardRegions(out);
  out = injectMissingDashboardRegions(out);
  out = wrapDashboardPanelsRow(out);
  return out;
}

/** Prompt block for LLM system prompt when the dashboard skill is active. */
export function dashboardLayoutPromptLines(): string[] {
  const regions = DASHBOARD_REGIONS.map((r) => `  - data-od-id="${r.id}" — ${r.label}`).join('\n');
  const { tablet, desktop, ultrawide } = DASHBOARD_BREAKPOINTS;
  const { phone, tablet: tabW, desktop: deskW, ultrawide: ultraW } = DASHBOARD_PREVIEW_WIDTHS;

  return [
    '# Dashboard — responsive layout contract',
    'Produce a single self-contained HTML dashboard that inherits the active design system as :root CSS variables.',
    '',
    '## Content parity (non-negotiable)',
    'The SAME set of dashboard elements and functionality must exist at every breakpoint.',
    'Never add or remove components between layouts — only rearrange, resize, and reposition them.',
    'Every region below must be present in the DOM with the exact data-od-id (use CSS to collapse/stack — never omit from HTML):',
    regions,
    '',
    '## No navigation chrome',
    'Do NOT include sidebars, nav rails, hamburger menus, or multi-page nav links.',
    'The topbar is a page header only (title, date range, primary actions) — not a site menu.',
    '',
    '## Viewport fill & space priority',
    '- The dashboard must fully occupy the viewport height and width — no dead whitespace at any resolution.',
    '- Use body { height: 100%; overflow: hidden } and main { flex: 1; overflow-y: auto } so content fills the frame and scrolls inside main when it overflows.',
    '- **Only main may scroll vertically.** Never put overflow:auto/scroll on KPI cards, chart panels, tables, or widgets — they must resize or scale to fit.',
    '- Chart rows use flex: 1 1 0 to share remaining vertical space evenly; primary-chart gets flex: 2, secondary-panel flex: 1.',
    '- When space is tight, graphs keep priority over KPI compression; let main scroll — never add nested scrollbars inside regions.',
    '',
    '## No nested scrollbars (required)',
    '- Cards, charts, graphs, tables, and widgets: overflow:hidden — adapt with flex/grid, min-height:0, and SVG preserveAspectRatio="xMidYMid meet".',
    '- Tables: truncate long cell text (text-overflow:ellipsis) or reduce font-size — do not wrap tables in scroll containers.',
    '- At every breakpoint (mobile / tablet / desktop), reposition and resize components; the page scrolls as one unit.',
    '',
    '## Spacious layout (required)',
    `Use generous spacing throughout — main region gap ${DASHBOARD_SPACING.mainGap}px, page padding ${DASHBOARD_SPACING.mainPadX}px horizontal, KPI grid gap ${DASHBOARD_SPACING.kpiGap}px, chart row gap ${DASHBOARD_SPACING.panelGap}px.`,
    'Cards and panels need comfortable internal padding (20–24px). Never pack regions tighter than the injected baseline CSS.',
    '',
    '## Uniform element boxes (required)',
    `- All 4 KPI cards: equal height per grid row (use class="kpi" on each child), min-height ${DASHBOARD_SPACING.kpiMinH}px, padding ${DASHBOARD_SPACING.cardPad}px.`,
    `- Chart panels: wrap primary-chart + secondary-panel in <div class="panels-row"> so they share one grid row with equal height; padding ${DASHBOARD_SPACING.cardPad}px on each panel.`,
    '- Never give KPI cards or chart panels inconsistent padding or min-heights within the same row.',
    '',
    '## Alignment & production quality',
    'At every supported width the UI must look production-ready:',
    '- No overlapping panels, clipped text, horizontal overflow, or unintended empty gutters.',
    '- 8px base grid with spacious major-region gaps; uniform card padding, aligned baselines, and clear visual hierarchy.',
    '- Use min-width:0 on grid/flex children so text truncates instead of blowing out the layout.',
    '- Prefer width:100% / fr units over 100vw (avoids scrollbar misalignment).',
    '',
    `## Breakpoints (mobile-first @media min-width)`,
    `- Default / mobile (preview ${phone}px): single column; KPIs 2-col; charts stacked with primary chart tallest.`,
    `- Tablet (min-width ${tablet}px, preview ${tabW}px): 2-col KPI grid; charts side-by-side when possible; graphs keep priority.`,
    `- Desktop (min-width ${desktop}px, preview ${deskW}px): full-width main; 4 KPI row; primary 2/3 + secondary 1/3.`,
    `- Ultrawide (min-width ${ultrawide}px, preview ${ultraW}px): same elements — widen chart grid; never leave empty margins.`,
    '',
    '## Implementation',
    'Semantic HTML: header (topbar), main, section. Flexbox column shell; chart regions flex-grow inside main.',
    'Charts: inline SVG only. Tag each region with data-od-id. Realistic metric names and values.',
    'Every chart region MUST include a plotted SVG (viewBox + polyline or rect geometry) or a data table in secondary-panel — empty placeholders are invalid.',
    '',
    ...dashboardChartPromptLines(),
  ];
}

/** Append dashboard meta + layout CSS at end of head so it wins over artifact styles. */
function injectBeforeHeadClose(html: string, fragment: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${fragment}\n</head>`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${fragment}`);
  }
  return `${fragment}\n${html}`;
}

/** Inject dashboard meta + baseline containment CSS into artifact HTML. */
export function injectDashboardShell(html: string): string {
  let out = ensureDashboardRegions(html);
  out = ensureDashboardChartData(out);
  out = normalizeDashboardCharts(out);
  if (!new RegExp(`name=["']${DASHBOARD_META}["']`, 'i').test(out)) {
    out = injectBeforeHeadClose(out, DASHBOARD_META_TAG);
  }
  if (!/id=["']renoir-dashboard-base["']/i.test(out)) {
    out = injectBeforeHeadClose(out, DASHBOARD_STYLE_TAG);
  }
  return out;
}

/**
 * Iframe bridge helpers — keeps dashboard content inside the preview viewport.
 * Injected into NAV_BRIDGE alongside the mobile-sidebar helpers.
 */
export const DASHBOARD_BRIDGE_FN = `
  var DASHBOARD_STYLE_ID = '__renoir_dashboard_style';

  function isDashboardDoc() {
    return !!document.querySelector('meta[name="${DASHBOARD_META}"]');
  }

  function applyDashboardContainment() {
    if (!isDashboardDoc()) return;
    var scrollSt = document.getElementById('__renoir_scroll_style');
    if (!scrollSt) {
      scrollSt = document.createElement('style');
      scrollSt.id = '__renoir_scroll_style';
      document.head.appendChild(scrollSt);
    }
    scrollSt.textContent = ${JSON.stringify(DASHBOARD_SCROLL_LOCK_CSS)};
    var st = document.getElementById(DASHBOARD_STYLE_ID);
    if (!st) {
      st = document.createElement('style');
      st.id = DASHBOARD_STYLE_ID;
      document.head.appendChild(st);
    }
    st.textContent = ${JSON.stringify(DASHBOARD_BASE_CSS)};
  }
`;
