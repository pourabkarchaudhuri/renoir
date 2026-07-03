---
name: pricing-page
description: |
  A standalone pricing page — header, plan tiers (Free / Standard / Premium by default),
  feature comparison table, and FAQ. Use when the brief asks for "pricing", "plans",
  or "subscription tiers".
triggers:
  - "pricing"
  - "pricing page"
  - "plans"
  - "subscription"
  - "compare plans"
  - "定价"
  - "套餐"
od:
  mode: prototype
  platform: desktop
  scenario: sales
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout, components]
---

# Pricing Page Skill

Produce a single-screen pricing page that respects the active design system (e.g. Ember).

## Workflow

1. **Read the active design system** tokens injected in the prompt. Use only those colors and type rules.
2. **Never emit `<question-form>`** — generate the artifact on turn 1. If the brief is thin, infer product name, tone, and tier copy; use defaults below.
3. **Default tiers** unless the user specifies otherwise: **Free**, **Standard**, **Premium** (not Pro/Max).
4. **Sections**, in order:
   1. Compact header + hero ("Pricing" + subhead + optional monthly/annual toggle).
   2. **Three plan cards** in a row — Claude-style dark cards, serif tier titles, checkmark feature lists, CTA per card. Highlight Standard as recommended.
   3. **Comparison table** — features × tiers.
   4. **FAQ** — `<details><summary>` items.
   5. Slim footer.
5. **Write** one self-contained HTML document with inline `<style>` only (no Tailwind CDN).
6. **Self-check**: plausible prices, domain-specific copy, Ember/warm token theme, mobile stack ≤768px.

## Output contract

Emit between `<artifact>` tags:

```
<artifact identifier="pricing-slug" type="text/html" title="Pricing — Product Name">
<!doctype html>
<html>...</html>
</artifact>
```

One sentence before the artifact, nothing after.
