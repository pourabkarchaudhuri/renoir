---
name: changelog
description: |
  Single-screen changelog / release notes page. Reverse-chron version blocks
  with semver tags and type chips. Use when the brief asks only for
  "changelog", "release notes", or "what's new" — not a full marketing site.
triggers:
  - "changelog"
  - "release notes"
  - "what's new"
  - "product updates"
od:
  mode: prototype
  platform: desktop
  scenario: marketing
  preview:
    type: html
    entry: example.html
  design_system:
    requires: true
    sections: [color, typography, layout, components]
---

# Changelog Skill

Produce a **single-screen changelog page** — the changelog screen extract from the SaaS Landing skill.

For a full linked marketing site (landing + changelog + blog), use the **SaaS Landing** skill instead.

## Workflow

1. **Read the active design system** tokens. Use only those colors and type rules.
2. **Never emit `<question-form>`** — infer product name and release history from the brief.
3. **Sections**, in order:
   - Compact header + nav (wordmark, optional links).
   - Page title + RSS/subscribe affordance (visual only).
   - Filter pills: All / Features / Fixes (decorative).
   - **6–8 reverse-chron version blocks**, each with:
     - Semver tag + date (mono numerics).
     - Type chips: `feat` / `fix` / `perf` / `breaking`.
     - 2–4 bullet items with specific copy.
     - Optional screenshot placeholder (CSS gradient block).
4. **Write** one self-contained HTML document with inline CSS.
5. **Self-check**: realistic versions and dates, no lorem ipsum, accent restrained.

## Output contract

```
<artifact identifier="changelog-slug" type="text/html" title="Changelog — Product">
<!doctype html>
<html>...</html>
</artifact>
```

One sentence before the artifact, nothing after.
