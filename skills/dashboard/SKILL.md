---
name: dashboard
description: |
  Admin / analytics dashboard in a single HTML file. Full-width layout with
  a page header, KPI cards, and one or two charts — no sidebars or nav menus.
  Use when the brief asks for a "dashboard", "admin", "analytics", or
  "control panel" screen.
triggers:
  - "dashboard"
  - "admin panel"
  - "analytics"
  - "control panel"
  - "后台"
  - "管理后台"
od:
  mode: prototype
  platform: desktop
  scenario: operations
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout, components]
  craft:
    requires: [state-coverage]
---

# Dashboard Skill

Produce a single-screen admin / analytics dashboard that is **production-ready at every breakpoint**.

## Workflow

1. **Read the active DESIGN.md** (injected above). Colors, typography, spacing,
   component styling all come from it. Do not invent new tokens.
2. **Classify** what the dashboard monitors (sales, traffic, usage, incidents,
   ops, etc.) from the brief. Generate specific, plausible metric names and
   values — no "Metric A / Metric B" placeholders.
3. **Define the fixed region set** — these four regions must exist in the DOM at
   **every** breakpoint (never add or remove between layouts; only rearrange):
   - `data-od-id="topbar"` — page title, date range, primary actions (no nav links)
   - `data-od-id="kpis"` — exactly 4 KPI cards (label + number + delta)
   - `data-od-id="primary-chart"` — inline SVG line / bar / area chart
   - `data-od-id="secondary-panel"` — secondary chart or recent-events table
4. **No navigation chrome** — do not add sidebars, nav rails, hamburger menus,
   or multi-page nav links. The dashboard is a single focused analytics view.
5. **Lay out per breakpoint** (mobile-first CSS). Fill the entire viewport — no dead whitespace. When space is tight, **prioritize graphs** (primary-chart flexes largest; KPI row compresses first):
   - **Mobile** (&lt;640px): single column; KPIs 2-col; charts stacked vertically.
   - **Tablet** (640–1279px): 2-col KPI grid; charts stacked or side-by-side when space allows.
   - **Desktop** (1280–1919px): full-width main; 4 KPI row;
     primary chart 2/3 + secondary 1/3.
   - **Ultrawide** (1920px+): same elements — widen the chart grid; never stretch widgets to fill void space.
6. **Alignment rules** — at every width:
   - No overlap, clipping, horizontal overflow, or unintended empty gutters.
   - Use `min-width: 0` on grid/flex children; prefer `width: 100%` over `100vw`.
   - 8px base grid with **spacious major-region gaps** (24px between sections, 32px page padding, 16px KPI gap, 20px chart row gap). Cards use 20–24px internal padding.
   - **Uniform boxes**: all 4 KPI cards equal height per row (class `kpi`, 88px min-height); chart panels in a `panels-row` wrapper with equal row height and 24px padding.
   - **No nested scrollbars**: only `<main>` scrolls; charts/tables/cards use `overflow:hidden` and flex scaling — never `overflow:auto` on widgets.
7. **Write** one self-contained HTML document:
   - `<!doctype html>` through `</html>`, CSS in one inline `<style>` block.
   - Flexbox column shell; grid inside KPI/chart rows.
   - Semantic HTML: `<header>`, `<main>`, `<section>`.
8. **Charts**: inline SVG only, no JS libraries. Plot every series from real numbers — see **Data plotting** below.
9. **Self-check**:
   - All four `data-od-id` regions present in HTML.
   - No sidebar or nav menu markup.
   - Every color from DESIGN.md tokens.
   - Density matches the DS mood.
   - Chart geometry matches the numeric series (higher values plot higher).
   - No nested scrollbars on cards, charts, or tables — only main scrolls.

## Data plotting (essential)

Charts must be **accurate**, not decorative.

1. Choose a numeric series (6–12 points for lines, 4–8 for bars) that matches the dashboard topic.
2. KPI headline numbers must use the **same units** and order of magnitude as the chart.
3. Map values to SVG coordinates:
   - `min` / `max` from the series; `range = max - min` (use 1 if flat).
   - Padding inside viewBox: top 16, left 44, right 16, bottom 28.
   - `x = padLeft + (i / (N-1)) * plotWidth`
   - `y = padTop + plotHeight - ((value - min) / range) * plotHeight`
   - Bar height = `((value - min) / range) * plotHeight`
4. SVG rules:
   - `viewBox="0 0 W H"` and `preserveAspectRatio="xMidYMid meet"`.
   - **Never** `preserveAspectRatio="none"` on line charts — it distorts data.
   - Draw baseline + light gridlines at min/mid/max.
   - Tag: `data-od-chart="line|bar"` and `data-od-series="v1,v2,..."`.
5. Self-check: if KPI says growth, the line must trend up; re-read every y coordinate.

## Output contract

Emit between `<artifact>` tags:

```
<artifact identifier="dashboard-slug" type="text/html" title="Dashboard Title">
<!doctype html>
<html>...</html>
</artifact>
```

One sentence before the artifact, nothing after.

