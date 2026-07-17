---
name: blog-post
description: |
  Single-screen long-form blog article — masthead, hero image placeholder,
  article body with figures and pull quotes, author byline, related posts.
  Use when the brief asks only for "blog", "article", "post", or "essay".
  For a full linked marketing site, use the SaaS Landing skill instead.
triggers:
  - "blog"
  - "blog post"
  - "article"
  - "essay"
  - "case study"
  - "newsletter"
  - "博客"
  - "文章"
od:
  mode: prototype
  platform: desktop
  scenario: marketing
  featured: 11
  preview:
    type: html
    entry: example.html
  design_system:
    requires: true
    sections: [color, typography, layout, components]
  example_prompt: "Filebase engineering blog — why we rewrote our sync engine in Rust. Editorial, first-person voice."
---

# Blog Post Skill

Produce a **single-screen long-form article** — the blog screen extract from the SaaS Landing skill.

For a full linked marketing site (landing + changelog + blog), use the **SaaS Landing** skill instead.

## Workflow

1. **Read the active design system** tokens. Long-form is 70% typography, 20% image, 10% chrome.
2. **Never emit `<question-form>`** — infer topic, angle, and author from the brief.
3. **Sections**, in order (tag each with `data-od-id`):
   - **Masthead** (`masthead`) — wordmark + 4–6 nav links.
   - **Article header** (`article-header`) — category eyebrow, headline, deck, author + date + read time.
   - **Hero image** (`hero-figure`) — 16:9 placeholder block (DS gradient) + caption.
   - **Body** (`article-body`) — ~350 words, 4–6 H2 sections, pull quote, blockquote, list, figure.
   - **Author footer** (`author-footer`) — initials avatar + bio paragraph.
   - **Related** (`related-posts`) — 3 cards (image block, title, excerpt, date).
4. **Write** a single HTML document with CSS inline. Body max-width ~680px.
5. **Self-check**: type hierarchy clear, line length 60–75 chars, accent ≤2×.

## Output contract

```
<artifact identifier="post-slug" type="text/html" title="Article Title">
<!doctype html>
<html>...</html>
</artifact>
```

One sentence before the artifact, nothing after.
