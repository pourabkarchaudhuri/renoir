---
name: saas-landing
description: |
  Multi-screen SaaS marketing site — landing page, changelog, and blog article
  linked for walk-through via data-goto. Use when the brief asks for a
  "saas landing", "marketing site", "product site", or a full marketing
  prototype with release notes and blog.
triggers:
  - "saas landing"
  - "marketing site"
  - "product landing"
  - "marketing page"
  - "product site"
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
  example_prompt: "Filebase — block-level file sync for video teams. Multi-screen site with landing, changelog, and engineering blog post."
---

# SaaS Landing Skill

Produce a **three-screen linked marketing site** in one HTML artifact.

## Workflow

1. **Read the active design system** tokens. Map to six `:root` vars only.
2. **Never emit `<question-form>`** — generate on turn 1. Infer product, tiers, article topic.
3. **Speed first** — target ≤280 lines. Copy `MARKETING_BASE_CSS` from the system prompt into one `<style>` block; do not write bespoke CSS.
4. **Three screens** (`class="screen"`, `min-height: 100dvh`):

| Screen | `data-screen-id` | Contents |
|--------|------------------|----------|
| Landing | `landing` | Hero, features, social proof, pricing, testimonial, FAQ, CTA band, footer |
| Changelog | `changelog` | 4 version rows, 2 bullets each |
| Blog | `blog` | 3 H2 sections, ~250 words, author + 3 related cards |

4. **Navigation** — shared sticky nav on every screen:
   - `data-goto="landing"` · `data-goto="changelog"` · `data-goto="blog"`
   - Footer cross-links on landing ("See changelog →", "Read the blog →")
5. **Write** one self-contained HTML document with inline `<style>` only.
6. **Tag** `data-od-id` on every major subsection (hero, pricing, changelog-entries, article-body, etc.).
7. **Self-check**: 3 screens present, data-goto links work, accent ≤2× per screen, responsive ≤768px.

See `example.html` in this directory for the canonical Filebase reference.

## Output contract

Emit between `<artifact>` tags:

```
<artifact identifier="product-slug" type="text/html" title="Product — Marketing Site">
<!doctype html>
<html>...</html>
</artifact>
```

One sentence before the artifact, nothing after.
