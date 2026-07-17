/** Chart plotting contract — shared by prompts, stubs, lint, and normalization. */
const DEFAULT_PAD = { top: 16, right: 16, bottom: 28, left: 44 };
function escapeSvgAttr(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}
export const DEFAULT_LINE_SERIES = [38.2, 39.1, 40.4, 41.0, 42.3, 43.1, 44.5, 45.2, 46.0, 47.1, 47.8, 48.2];
export const DEFAULT_BAR_SERIES = [42, 58, 51, 67, 73, 61, 78];
function parseChartSeries(raw) {
    const vals = raw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    return vals.length ? vals : null;
}
function isValidPolylinePoints(points) {
    const pairs = points.trim().split(/\s+/).filter(Boolean);
    if (pairs.length < 2)
        return false;
    return pairs.every((pair) => {
        const [x, y] = pair.split(',');
        return Number.isFinite(Number(x)) && Number.isFinite(Number(y));
    });
}
function chartSizeFromAttrs(attrs, inner) {
    const viewBox = attrs.match(/viewBox\s*=\s*["']0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)["']/i);
    if (viewBox)
        return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
    const w = attrs.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
    const h = attrs.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
    if (w)
        return { width: Number(w[1]), height: h ? Number(h[1]) : 200 };
    return { width: 600, height: 200 };
}
function chartLabelFromAttrs(attrs) {
    const m = attrs.match(/\baria-label\s*=\s*["']([^"']*)["']/i);
    return m?.[1];
}
function rectIsValid(tag) {
    const h = tag.match(/\bheight\s*=\s*["']([^"']+)["']/i)?.[1];
    const w = tag.match(/\bwidth\s*=\s*["']([^"']+)["']/i)?.[1];
    return !!h && !!w && Number(w) > 0 && Number(h) > 0
        && Number.isFinite(Number(h)) && Number.isFinite(Number(w));
}
/** True when an inline SVG actually plots data (not an empty decorative shell). */
export function svgExpressesChartData(svg) {
    const attrs = svg.match(/<svg\b([^>]*)>/i)?.[1] ?? '';
    const inner = svg.replace(/^<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
    const seriesRaw = attrs.match(/data-od-series\s*=\s*["']([^"']+)["']/i)?.[1];
    if (seriesRaw && parseChartSeries(seriesRaw) && !chartNeedsRebuild(attrs, inner))
        return true;
    if (/<polyline\b/i.test(inner)) {
        const poly = inner.match(/<polyline\b[^>]*\bpoints\s*=\s*["']([^"']*)["']/i);
        if (poly && isValidPolylinePoints(poly[1]))
            return true;
    }
    const rects = [...inner.matchAll(/<rect\b[^>]*>/gi)];
    if (rects.length && rects.every((m) => rectIsValid(m[0])))
        return true;
    return false;
}
/** True when a chart region contains at least one SVG with plotted geometry. */
export function regionExpressesChartData(regionHtml) {
    const svgs = regionHtml.match(/<svg\b[\s\S]*?<\/svg>/gi) ?? [];
    return svgs.some(svgExpressesChartData);
}
/** Secondary panel is satisfied by a data table (2+ rows) or a valid chart. */
export function regionExpressesSecondaryData(regionHtml) {
    if (/<table\b/i.test(regionHtml) && (regionHtml.match(/<tr\b/gi)?.length ?? 0) >= 2)
        return true;
    return regionExpressesChartData(regionHtml);
}
function parseMetricNumber(text) {
    const raw = text.trim();
    if (!raw || !/\d/.test(raw))
        return null;
    let mult = 1;
    if (/[Kk]\b/.test(raw) || /\d\s*K\b/i.test(raw))
        mult = 1_000;
    if (/[Mm]\b/.test(raw) || /\d\s*M\b/i.test(raw))
        mult = 1_000_000;
    const cleaned = raw.replace(/[^0-9.\-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n * mult : null;
}
function extractKpiNumbers(html) {
    const block = html.match(/<([a-z]+)[^>]*data-od-id=["']kpis["'][^>]*>[\s\S]*?<\/\1>/i)?.[0];
    if (!block)
        return [];
    const nums = [];
    for (const m of block.matchAll(/<strong[^>]*>([^<]+)<\/strong>/gi)) {
        const n = parseMetricNumber(m[1]);
        if (n != null)
            nums.push(n);
    }
    if (nums.length)
        return nums;
    for (const m of block.matchAll(/>([^<]*\d[\d,.%$KkMm]*[^<]*)</g)) {
        const n = parseMetricNumber(m[1]);
        if (n != null)
            nums.push(n);
    }
    return nums;
}
function trendSeries(base, end, steps = 12) {
    return Array.from({ length: steps }, (_, i) => base + ((end - base) * i) / (steps - 1));
}
/** Derive a line-chart series from KPI numbers when the LLM omitted chart data. */
export function inferLineSeries(html) {
    const kpis = extractKpiNumbers(html);
    if (kpis.length >= 6)
        return kpis.slice(0, 12);
    if (kpis.length >= 2)
        return trendSeries(kpis[0], kpis[kpis.length - 1]);
    if (kpis.length === 1)
        return trendSeries(kpis[0] * 0.88, kpis[0]);
    return DEFAULT_LINE_SERIES;
}
/** Derive a bar-chart series from KPI numbers when the secondary panel has no data. */
export function inferBarSeries(html) {
    const kpis = extractKpiNumbers(html);
    if (kpis.length >= 4)
        return kpis.slice(0, 7);
    if (kpis.length >= 2)
        return kpis;
    return DEFAULT_BAR_SERIES;
}
function chartNeedsRebuild(attrs, inner) {
    const seriesRaw = attrs.match(/data-od-series\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!seriesRaw || !parseChartSeries(seriesRaw))
        return false;
    const isLine = /data-od-chart\s*=\s*["']line["']/i.test(attrs) || /<polyline\b/i.test(inner);
    const isBar = /data-od-chart\s*=\s*["']bar["']/i.test(attrs) || (!isLine && /<rect\b/i.test(inner));
    if (isLine) {
        const poly = inner.match(/<polyline\b[^>]*\bpoints\s*=\s*["']([^"']*)["']/i);
        if (!poly || !isValidPolylinePoints(poly[1]))
            return true;
        return false;
    }
    if (isBar) {
        const rects = [...inner.matchAll(/<rect\b[^>]*>/gi)];
        if (!rects.length)
            return true;
        return rects.some((m) => !rectIsValid(m[0]));
    }
    const hasDataGeometry = /<(?:polyline|path|rect)\b/i.test(inner);
    return !hasDataGeometry;
}
function plotArea(opts) {
    const width = opts.width ?? 600;
    const height = opts.height ?? 200;
    const padding = opts.padding ?? DEFAULT_PAD;
    return {
        width,
        height,
        padding,
        plotW: width - padding.left - padding.right,
        plotH: height - padding.top - padding.bottom,
    };
}
function seriesRange(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max)
        return { min: min - 1, max: max + 1 };
    return { min, max };
}
/** Map numeric series to SVG polyline points (y grows downward). */
export function lineChartPoints(values, opts = {}) {
    if (!values.length)
        return '';
    const plotValues = values.length === 1 ? [values[0], values[0]] : values;
    const { padding, plotW, plotH } = plotArea(opts);
    const { min, max } = seriesRange(plotValues);
    const range = max - min;
    return plotValues
        .map((v, i) => {
        const x = padding.left + (plotValues.length === 1 ? 0 : (i / (plotValues.length - 1)) * plotW);
        const y = padding.top + plotH - ((v - min) / range) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
        .join(' ');
}
/** Build an inline SVG line chart from a numeric series. */
export function buildLineChartSvg(values, opts = {}) {
    const series = values.length ? values : [0, 0];
    const { width, height, padding, plotW, plotH } = plotArea(opts);
    const color = opts.color ?? 'currentColor';
    const { min, max } = seriesRange(series);
    const points = lineChartPoints(series, opts);
    const aria = escapeSvgAttr(opts.label ?? `Line chart from ${min} to ${max}`);
    const baseline = padding.top + plotH;
    const yTicks = [min, (min + max) / 2, max];
    const grid = yTicks
        .map((tick) => {
        const y = padding.top + plotH - ((tick - min) / (max - min)) * plotH;
        return `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(padding.left + plotW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.12"/>`;
    })
        .join('');
    const yLabels = yTicks
        .map((tick) => {
        const y = padding.top + plotH - ((tick - min) / (max - min)) * plotH;
        const text = Number.isInteger(tick) ? String(tick) : tick.toFixed(1);
        return `<text x="${padding.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="currentColor" opacity="0.55">${text}</text>`;
    })
        .join('');
    return [
        `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img"`,
        ` aria-label="${aria}" data-od-chart="line" data-od-series="${series.join(',')}">`,
        grid,
        `<line x1="${padding.left}" y1="${baseline}" x2="${(padding.left + plotW).toFixed(1)}" y2="${baseline}" stroke="currentColor" stroke-opacity="0.25"/>`,
        yLabels,
        `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>`,
        '</svg>',
    ].join('');
}
/** Build an inline SVG bar chart from a numeric series. */
export function buildBarChartSvg(values, opts = {}) {
    const series = values.length ? values : [1, 1];
    const { width, height, padding, plotW, plotH } = plotArea(opts);
    const color = opts.color ?? 'currentColor';
    const { min, max } = seriesRange(series);
    const range = max - min;
    const n = series.length;
    const gap = 8;
    const barW = Math.max(4, (plotW - gap * (n - 1)) / n);
    const aria = escapeSvgAttr(opts.label ?? `Bar chart, max ${max}`);
    const bars = series
        .map((v, i) => {
        const h = Math.max(0.5, ((v - min) / range) * plotH);
        const x = padding.left + i * (barW + gap);
        const y = padding.top + plotH - h;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" opacity="${(0.35 + (0.45 * (v - min)) / range).toFixed(2)}"/>`;
    })
        .join('');
    const baseline = padding.top + plotH;
    return [
        `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img"`,
        ` aria-label="${aria}" data-od-chart="bar" data-od-series="${series.join(',')}">`,
        `<line x1="${padding.left}" y1="${baseline}" x2="${(padding.left + plotW).toFixed(1)}" y2="${baseline}" stroke="currentColor" stroke-opacity="0.25"/>`,
        bars,
        '</svg>',
    ].join('');
}
/** Lint dashboard chart regions for common plotting mistakes. */
export function lintDashboardCharts(html) {
    const findings = [];
    if (!isChartLintTarget(html))
        return findings;
    for (const region of ['primary-chart', 'secondary-panel']) {
        const block = extractRegionHtml(html, region);
        if (!block)
            continue;
        const svgs = block.match(/<svg\b[\s\S]*?<\/svg>/gi) ?? [];
        if (!svgs.length && region === 'primary-chart') {
            findings.push({
                level: 'warn',
                rule: 'dashboard-chart-missing',
                message: 'Primary chart region has no SVG — plot the metric series inline',
            });
            continue;
        }
        for (const svg of svgs) {
            if (!/\bviewBox\s*=/i.test(svg)) {
                findings.push({
                    level: 'warn',
                    rule: 'dashboard-chart-viewbox',
                    message: `${region}: SVG chart must include a viewBox for correct scaling`,
                });
            }
            if (/<polyline\b/i.test(svg) && /preserveAspectRatio\s*=\s*["']none["']/i.test(svg)) {
                findings.push({
                    level: 'warn',
                    rule: 'dashboard-chart-distorted',
                    message: `${region}: Do not use preserveAspectRatio="none" on line charts — it distorts the data`,
                });
            }
            const hasDataGeometry = /<(?:polyline|path|rect|circle)\b/i.test(svg);
            if (!hasDataGeometry) {
                findings.push({
                    level: 'warn',
                    rule: 'dashboard-chart-empty',
                    message: `${region}: SVG chart has no plotted geometry`,
                });
            }
            const poly = svg.match(/<polyline\b[^>]*\bpoints\s*=\s*["']([^"']*)["']/i);
            if (poly) {
                if (!isValidPolylinePoints(poly[1])) {
                    findings.push({
                        level: 'warn',
                        rule: 'dashboard-chart-geometry',
                        message: `${region}: Line chart has invalid or empty point geometry`,
                    });
                }
                const pointCount = poly[1].trim().split(/\s+/).filter(Boolean).length;
                if (pointCount < 3) {
                    findings.push({
                        level: 'warn',
                        rule: 'dashboard-chart-sparse',
                        message: `${region}: Line chart needs at least 3 data points`,
                    });
                }
            }
            if (!/\bdata-od-series\s*=/i.test(svg) && !/\baria-label\s*=/i.test(svg)) {
                findings.push({
                    level: 'info',
                    rule: 'dashboard-chart-series',
                    message: `${region}: Add data-od-series or aria-label so values are traceable`,
                });
            }
        }
    }
    return findings;
}
function isChartLintTarget(html) {
    return /name=["']renoir:dashboard["']/i.test(html)
        || /data-od-id=["']primary-chart["']/i.test(html)
        || /data-od-id=["']secondary-panel["']/i.test(html)
        || /data-od-id=["']kpis["']/i.test(html)
        || /data-od-id=["']chart-panel["']/i.test(html);
}
function extractRegionHtml(html, id) {
    const re = new RegExp(`<([a-z]+)[^>]*data-od-id=["']${id}["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'i');
    return html.match(re)?.[0] ?? null;
}
/** Fix common SVG scaling mistakes in dashboard chart regions. */
export function normalizeDashboardCharts(html) {
    if (!isChartLintTarget(html))
        return html;
    return html.replace(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi, (full, attrs, inner) => {
        const seriesRaw = attrs.match(/data-od-series\s*=\s*["']([^"']+)["']/i)?.[1];
        const series = seriesRaw ? parseChartSeries(seriesRaw) : null;
        if (series && chartNeedsRebuild(attrs, inner)) {
            const { width, height } = chartSizeFromAttrs(attrs, inner);
            const label = chartLabelFromAttrs(attrs);
            const isBar = /data-od-chart\s*=\s*["']bar["']/i.test(attrs)
                || (!/<polyline\b/i.test(inner) && series.length <= 12);
            return isBar
                ? buildBarChartSvg(series, { width, height, label })
                : buildLineChartSvg(series, { width, height, label });
        }
        const isLine = /<polyline\b/i.test(inner);
        let nextAttrs = attrs;
        if (isLine && /preserveAspectRatio\s*=\s*["']none["']/i.test(nextAttrs)) {
            nextAttrs = nextAttrs.replace(/preserveAspectRatio\s*=\s*["']none["']/i, 'preserveAspectRatio="xMidYMid meet"');
        }
        if (!/\bviewBox\s*=/i.test(nextAttrs)) {
            const wMatch = nextAttrs.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
            if (wMatch) {
                const hMatch = nextAttrs.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
                const w = wMatch[1];
                const h = hMatch?.[1] ?? '200';
                nextAttrs = ` viewBox="0 0 ${w} ${h}"${nextAttrs}`;
            }
        }
        return `<svg${nextAttrs}>${inner}</svg>`;
    });
}
/** Prompt lines for accurate data plotting in dashboard artifacts. */
export function dashboardChartPromptLines() {
    return [
        '## Data plotting (non-negotiable)',
        'Every chart must be a faithful visual representation of real numbers — never decorative squiggles.',
        '',
        '### Before drawing',
        '1. Pick a concrete numeric series (6–12 points for lines, 4–8 bars) that matches the dashboard topic.',
        '2. KPI headline numbers must be consistent with the chart (same units, same order of magnitude).',
        '3. Store the series on the SVG: data-od-series="v1,v2,v3,..." and aria-label summarizing the trend.',
        '',
        '### Coordinate mapping (SVG y-axis points down)',
        '- Let min = minimum value, max = maximum value, range = max - min (use range = 1 if flat).',
        '- Plot area: leave padding (top 16, left 44, right 16, bottom 28) inside viewBox.',
        '- For each point i of N values: x = padLeft + (i / (N-1)) * plotWidth',
        '- y = padTop + plotHeight - ((value - min) / range) * plotHeight',
        '- Bar height = ((value - min) / range) * plotHeight; bars sit on the baseline.',
        '',
        '### SVG requirements',
        '- Always set viewBox="0 0 W H" and preserveAspectRatio="xMidYMid meet".',
        '- NEVER use preserveAspectRatio="none" on line/area charts — it skews the data.',
        '- Draw a baseline axis + light horizontal gridlines at min/mid/max.',
        '- Use <polyline> for lines, <rect> for bars — no chart libraries.',
        '- Tag charts: data-od-chart="line" or data-od-chart="bar".',
        '',
        '### Self-check',
        '- Re-read each y coordinate: higher values must plot higher (smaller y).',
        '- If the KPI says revenue grew, the line must trend upward.',
        '- Secondary panel: either a second correctly scaled chart OR a table — never an empty panel.',
    ];
}
