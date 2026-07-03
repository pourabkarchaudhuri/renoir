/**
 * Post-generation enrichment for Product Deck artifacts.
 * Validates slide text, removes placeholders, pads to 12 slides, and fills gaps —
 * without modifying the AI / backend generation pipeline.
 */

import { countDeckSlides } from './preview-deck-contrast';

export const PRODUCT_DECK_SLIDE_COUNT = 12;

const MIN_LEDE_CHARS = 72;

const PLACEHOLDER_RE =
  /\b(lorem ipsum|coming soon|insert text|placeholder|tbd|todo|xxx+|your text here|add (?:copy|content) here|sample text|description goes here)\b/i;

const SLIDE_SECTION_RE =
  /<section\b([^>]*\bclass=["'][^"']*\bslide\b[^"']*["'][^>]*)>([\s\S]*?)<\/section>/gi;

export interface ProductDeckEnrichOptions {
  productName?: string;
  /** When false (streaming), only repair existing slides — do not pad to 12. */
  finalize?: boolean;
}

export interface ProductDeckEnrichResult {
  html: string;
  slideCount: number;
  filledFields: number;
}

export interface SlideBlueprint {
  kicker: string;
  title: string;
  lede: string;
  bullets: string[];
  cards?: { title: string; body: string }[];
  cta?: string;
  dark?: boolean;
  /** When set, enrichment injects an empty <img> for the image pipeline. */
  imageAlt?: string;
}

/** Extra system-prompt lines for the Product Deck skill. */
export function productDeckPromptLines(): string[] {
  return [
    '# Product Deck requirements',
    'Deliver exactly 12 slides inside a .deck wrapper (section.slide per slide).',
    'Copy density: every slide needs a kicker, title, and lede of at least two full sentences.',
    'Bullets: 3 concrete points per slide (or 3 feature/price cards with title + 2-line body each).',
    'No placeholder copy — no "Lorem ipsum", "Coming soon", or empty list items.',
    'Images: on cover, product-map, and all 4 feature slides include:',
    '  <div class="slide-visual mt-l"><img src="" alt="<specific scene for AI image>" class="slide-image" width="960" height="540"></div>',
    'Use descriptive alt text (product UI, workflow diagram, hero shot). Renoir will ask before generating photos from these slots.',
    'Do not use CSS color blocks or gradient rectangles instead of these img slots on those slides.',
  ];
}

export function isPlaceholderText(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (t.length < 2) return true;
  if (PLACEHOLDER_RE.test(t)) return true;
  if (/^[\W_]+$/.test(t)) return true;
  return false;
}

export function meaningfulText(text: string): boolean {
  return !isPlaceholderText(text);
}

function isSparseText(text: string, minChars: number): boolean {
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length < minChars;
}

function slideHasImage(html: string): boolean {
  return /<img\b/i.test(html);
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function productLabel(name?: string): string {
  const n = (name || '').trim();
  return n && !isPlaceholderText(n) ? n : 'Your product';
}

function defaultBlueprints(product: string): SlideBlueprint[] {
  return [
    {
      kicker: 'Product walkthrough',
      title: product,
      lede: `A focused walkthrough of ${product} — the problem it solves, how the product works, and why teams adopt it now. Each slide builds a clear narrative for stakeholders evaluating a rollout.`,
      bullets: [],
      dark: true,
      imageAlt: `${product} hero — polished product UI on a modern desktop, soft gradient backdrop, professional SaaS marketing style`,
    },
    {
      kicker: 'Why now',
      title: 'The moment is right',
      lede: `Market pressure and buyer expectations have shifted — ${product} meets that shift head-on. Teams that wait another quarter pay compounding costs in rework, support load, and missed revenue.`,
      bullets: [
        'Teams need faster time-to-value without sacrificing quality or governance.',
        'Legacy workflows create friction that compounds every quarter you defer change.',
        'Modern buyers expect clarity, proof, and a credible rollout path before they commit budget.',
      ],
    },
    {
      kicker: 'The problem',
      title: 'What breaks today',
      lede: 'Without a cohesive product story, teams waste cycles on work that does not move metrics. Fragmented tooling hides risk until launch week and erodes trust with customers and internal sponsors.',
      bullets: [
        'Scattered tools slow onboarding and increase support load across every new hire.',
        'Incomplete visibility hides risks until launch week when fixes are most expensive.',
        'Manual handoffs create errors that erode customer trust and delay expansion revenue.',
      ],
    },
    {
      kicker: 'Product map',
      title: 'How it fits together',
      lede: `${product} connects discovery, delivery, and adoption in one coherent flow. Stakeholders see the same source of truth from first demo through production rollout.`,
      bullets: [
        'Discover — align on outcomes, constraints, and success metrics up front.',
        'Build — ship iteratively with shared context and lightweight approvals.',
        'Adopt — measure usage, close the feedback loop, and expand seat by seat.',
      ],
      cards: [
        { title: 'Core workflow', body: 'The primary path users follow every day — fast, obvious, and hard to misuse.' },
        { title: 'Collaboration', body: 'Shared views that keep stakeholders aligned without endless status meetings.' },
        { title: 'Insights', body: 'Dashboards that surface what to do next instead of burying signal in exports.' },
      ],
      imageAlt: `${product} workflow diagram — three connected stages from discovery to adoption, clean product illustration`,
    },
    {
      kicker: 'Feature 01',
      title: 'Clarity from day one',
      lede: 'Onboarding that orients new users in minutes, not weeks. Guided paths reduce time-to-first-value and cut support tickets during the critical first 30 days.',
      bullets: [],
      cards: [
        { title: 'Guided setup', body: 'Step-by-step flows reduce time-to-first-value. Admins see progress across the whole team.' },
        { title: 'Smart defaults', body: 'Sensible starting points based on role and goal — no blank-canvas paralysis.' },
        { title: 'In-product tips', body: 'Contextual help appears only when it is needed, then gets out of the way.' },
      ],
      imageAlt: `${product} onboarding screen — guided setup wizard with progress steps, modern SaaS UI`,
    },
    {
      kicker: 'Feature 02',
      title: 'Built for real teams',
      lede: 'Permissions, spaces, and roles that mirror how work actually happens. Security reviewers get auditability without blocking day-to-day velocity.',
      bullets: [],
      cards: [
        { title: 'Workspaces', body: 'Separate contexts for teams without siloing knowledge or duplicating admin work.' },
        { title: 'Approvals', body: 'Lightweight review paths that do not block velocity when stakes are low.' },
        { title: 'Audit trail', body: 'See who changed what, and when — exportable for compliance reviews.' },
      ],
      imageAlt: `${product} team permissions UI — roles, workspaces, and member list, enterprise SaaS aesthetic`,
    },
    {
      kicker: 'Feature 03',
      title: 'Faster iteration',
      lede: 'Ship improvements continuously with confidence. Preview links and version history make it safe to show work-in-progress to customers and executives.',
      bullets: [],
      cards: [
        { title: 'Version history', body: 'Compare changes and roll back safely when an experiment misses the mark.' },
        { title: 'Preview links', body: 'Share work-in-progress with a single URL — no staging environment required.' },
        { title: 'Release notes', body: 'Auto-summarize what shipped each cycle so GTM and support stay aligned.' },
      ],
      imageAlt: `${product} version history panel — diff view and preview link sharing, clean product screenshot`,
    },
    {
      kicker: 'Feature 04',
      title: 'Outcomes you can measure',
      lede: 'Tie product usage to business results teams care about. Activation, retention, and expansion metrics update in near real time for revenue and success leaders.',
      bullets: [],
      cards: [
        { title: 'Activation', body: 'Track completion of the first meaningful action — the moment value becomes real.' },
        { title: 'Retention', body: 'Spot drop-off before it becomes churn with cohort views and alerts.' },
        { title: 'Expansion', body: 'Identify accounts ready for the next tier based on usage patterns, not guesswork.' },
      ],
      imageAlt: `${product} analytics dashboard — activation and retention charts, executive-friendly metrics`,
    },
    {
      kicker: 'Integrations',
      title: 'Plays well with your stack',
      lede: `${product} connects to the tools your team already relies on. Events flow to analytics, issues sync with your tracker, and identity stays centralized.`,
      bullets: [
        'Sync issues and docs from your project tracker without duplicate data entry.',
        'Push events to analytics and data warehouses for unified reporting.',
        'Authenticate with SSO and SCIM provisioning for enterprise rollouts.',
      ],
    },
    {
      kicker: 'Security',
      title: 'Enterprise-ready by default',
      lede: 'Security and compliance are part of the core architecture — not a late add-on slide. Buyers get the packet they need without a bespoke review cycle.',
      bullets: [
        'Encryption in transit and at rest with customer-managed keys available.',
        'Role-based access with least-privilege defaults and periodic access reviews.',
        'SOC 2–aligned controls and exportable audit logs for vendor assessments.',
      ],
    },
    {
      kicker: 'Pricing',
      title: 'Plans that scale with you',
      lede: 'Transparent tiers for pilots, growth, and organization-wide rollouts. No surprise overages on the metrics that matter for expansion.',
      bullets: [],
      cards: [
        { title: 'Starter', body: 'For small teams validating fit — core workflow included, up to 10 seats.' },
        { title: 'Growth', body: 'Advanced collaboration, integrations, and reporting for scaling departments.' },
        { title: 'Enterprise', body: 'SSO, dedicated support, custom security review, and volume pricing.' },
      ],
    },
    {
      kicker: 'Next steps',
      title: 'Let\'s go deeper',
      lede: `Ready to see ${product} on your workflow? We will tailor a walkthrough to your team, data model, and security requirements — not a generic demo.`,
      bullets: [
        'Book a 30-minute product session with your stakeholders and our solutions team.',
        'Share a sample project for a guided pilot with success criteria defined up front.',
        'Get a security packet and reference architecture for your review process.',
      ],
      cta: 'Schedule a walkthrough',
      dark: true,
    },
  ];
}

export function extractProductName(html: string, fallback?: string): string {
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  if (titleTag && meaningfulText(titleTag)) return titleTag.replace(/\s*[·|–-].*$/, '').trim();

  const h1 = html.match(/<h1[^>]*class=["'][^"']*\bh1\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) {
    const plain = h1.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (meaningfulText(plain)) return plain.slice(0, 80);
  }

  return productLabel(fallback);
}

function replaceTagInner(html: string, tag: string, className: string, inner: string): string {
  const re = new RegExp(
    `<${tag}\\b([^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'][^>]*)>([\\s\\S]*?)<\\/${tag}>`,
    'i',
  );
  if (re.test(html)) {
    return html.replace(re, `<${tag}$1>${inner}</${tag}>`);
  }
  const re2 = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i');
  if (re2.test(html)) {
    return html.replace(re2, `<${tag}$1>${inner}</${tag}>`);
  }
  return html;
}

function firstTagText(html: string, tags: string[]): string {
  for (const tag of tags) {
    const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (m) {
      const plain = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (meaningfulText(plain)) return plain;
    }
  }
  return '';
}

function sanitizeText(text: string, fallback: string): string {
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return meaningfulText(plain) ? plain : fallback;
}

function fillListItems(html: string, bullets: string[]): { html: string; filled: number } {
  let filled = 0;
  const items = [...bullets];
  let out = html.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => {
    const plain = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (meaningfulText(plain)) return _m;
    const next = items.shift();
    if (!next) return _m;
    filled += 1;
    return `<li>${esc(next)}</li>`;
  });

  const existingItems = (out.match(/<li\b[^>]*>/gi) || []).length;
  const sparseOnly = existingItems > 0 && items.length > 0;
  if ((items.length > 0 && existingItems < 3) || sparseOnly) {
    if (!/<ul[\s>]/i.test(out) && !/<ol[\s>]/i.test(out)) {
      const list = `<ul class="mt-m">${items.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
      if (/<h2\b/i.test(out)) {
        out = out.replace(/(<h2\b[^>]*>[\s\S]*?<\/h2>)/i, `$1\n${list}`);
      } else {
        out = `${out}\n${list}`;
      }
      filled += items.length;
    } else if (items.length > 0) {
      const append = items.map((b) => `<li>${esc(b)}</li>`).join('');
      out = out.replace(/(<\/ul>)/i, `${append}$1`);
      filled += items.length;
    }
  }

  return { html: out, filled };
}

function fillFeatureCards(html: string, cards: { title: string; body: string }[]): { html: string; filled: number } {
  let filled = 0;
  let cardIdx = 0;
  const out = html.replace(
    /<div\b([^>]*\bclass=["'][^"']*\b(?:feature-card|card|price-card)\b[^"']*["'][^>]*)>([\s\S]*?)<\/div>/gi,
    (_m, attrs, inner) => {
      const card = cards[cardIdx] ?? cards[cards.length - 1];
      cardIdx += 1;
      let block = inner;
      const h4 = inner.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i);
      const h4Text = h4?.[1]?.replace(/<[^>]+>/g, ' ').trim() ?? '';
      if (!meaningfulText(h4Text)) {
        if (h4) {
          block = block.replace(/<h4\b[^>]*>[\s\S]*?<\/h4>/i, `<h4>${esc(card.title)}</h4>`);
        } else {
          block = `<h4>${esc(card.title)}</h4>${block}`;
        }
        filled += 1;
      }
      const p = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
      const pText = p?.[1]?.replace(/<[^>]+>/g, ' ').trim() ?? '';
      if (!meaningfulText(pText)) {
        if (p) {
          block = block.replace(/<p\b[^>]*>[\s\S]*?<\/p>/i, `<p class="dim">${esc(card.body)}</p>`);
        } else {
          block = `${block}<p class="dim">${esc(card.body)}</p>`;
        }
        filled += 1;
      }
      return `<div${attrs}>${block}</div>`;
    },
  );
  return { html: out, filled };
}

function injectSlideImage(html: string, alt: string): { html: string; filled: number } {
  if (!alt || slideHasImage(html)) return { html, filled: 0 };
  const block =
    `\n<div class="slide-visual mt-l">` +
    `<img src="" alt="${esc(alt)}" class="slide-image" width="960" height="540" />` +
    `</div>`;
  if (/<div[^>]*\bclass=["'][^"']*\bdeck-footer\b/i.test(html)) {
    return {
      html: html.replace(/(<div[^>]*\bclass=["'][^"']*\bdeck-footer\b)/i, `${block}\n$1`),
      filled: 1,
    };
  }
  return { html: `${html}${block}`, filled: 1 };
}

function enrichSlideInner(inner: string, bp: SlideBlueprint, product: string): { html: string; filled: number } {
  let filled = 0;
  let out = inner;

  const titleFallback = bp.title.replace('{product}', product);
  const existingTitle = firstTagText(out, ['h1', 'h2']);
  const title = sanitizeText(existingTitle, titleFallback);

  if (!existingTitle || !meaningfulText(existingTitle)) {
    if (/<h1\b/i.test(out)) {
      out = replaceTagInner(out, 'h1', 'h1', esc(title));
    } else if (/<h2\b/i.test(out)) {
      out = replaceTagInner(out, 'h2', 'h2', esc(title));
    } else {
      out = `<h2 class="h2">${esc(title)}</h2>\n${out}`;
    }
    filled += 1;
  }

  if (!/<p\b[^>]*\bclass=["'][^"']*\bkicker\b/i.test(out)) {
    out = `<p class="kicker">${esc(bp.kicker)}</p>\n${out}`;
    filled += 1;
  } else {
    out = out.replace(
      /(<p\b[^>]*\bclass=["'][^"']*\bkicker\b[^"']*["'][^>]*>)([\s\S]*?)(<\/p>)/i,
      (_m, open, text, close) => {
        const plain = text.replace(/<[^>]+>/g, ' ').trim();
        if (meaningfulText(plain)) return _m;
        filled += 1;
        return `${open}${esc(bp.kicker)}${close}`;
      },
    );
  }

  const ledePlain = (() => {
    const m = out.match(/<p\b[^>]*\bclass=["'][^"']*\blede\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    return m?.[1]?.replace(/<[^>]+>/g, ' ').trim() ?? '';
  })();
  if (!meaningfulText(ledePlain) || isSparseText(ledePlain, MIN_LEDE_CHARS)) {
    if (/<p\b[^>]*\bclass=["'][^"']*\blede\b/i.test(out)) {
      out = out.replace(
        /(<p\b[^>]*\bclass=["'][^"']*\blede\b[^"']*["'][^>]*>)([\s\S]*?)(<\/p>)/i,
        `$1${esc(bp.lede)}$3`,
      );
    } else {
      out = `${out}\n<p class="lede mt-m">${esc(bp.lede)}</p>`;
    }
    filled += 1;
  }

  const listResult = fillListItems(out, bp.bullets);
  out = listResult.html;
  filled += listResult.filled;

  if (bp.cards?.length) {
    const cardResult = fillFeatureCards(out, bp.cards);
    out = cardResult.html;
    filled += cardResult.filled;
  }

  if (bp.cta && !/<a\b[^>]*\bclass=["'][^"']*\bcta/i.test(out)) {
    out = `${out}\n<a class="cta-btn mt-l" href="#">${esc(bp.cta)}</a>`;
    filled += 1;
  }

  if (bp.imageAlt) {
    const imgResult = injectSlideImage(out, bp.imageAlt.replace('{product}', product));
    out = imgResult.html;
    filled += imgResult.filled;
  }

  return { html: out, filled };
}

function buildSlideSection(bp: SlideBlueprint, index: number, product: string): string {
  const dark = bp.dark ? ' dark' : '';
  const dataTitle = esc(bp.kicker);
  let inner = `<p class="kicker">${esc(bp.kicker)}</p>`;
  inner += `\n<h2 class="h2">${esc(bp.title.replace('{product}', product))}</h2>`;
  inner += `\n<p class="lede mt-m">${esc(bp.lede)}</p>`;

  if (bp.cards?.length) {
    inner += `\n<div class="grid g3 mt-l">`;
    for (const card of bp.cards) {
      inner += `\n<div class="feature-card"><h4>${esc(card.title)}</h4><p class="dim">${esc(card.body)}</p></div>`;
    }
    inner += `\n</div>`;
  } else if (bp.bullets.length) {
    inner += `\n<ul class="mt-m">${bp.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
  }

  if (bp.cta) {
    inner += `\n<a class="cta-btn mt-l" href="#">${esc(bp.cta)}</a>`;
  }

  if (bp.imageAlt) {
    inner += `\n<div class="slide-visual mt-l"><img src="" alt="${esc(bp.imageAlt.replace('{product}', product))}" class="slide-image" width="960" height="540" /></div>`;
  }

  inner += `\n<div class="deck-footer"><span>${esc(product)}</span><span class="slide-number" data-current="${index + 1}" data-total="${PRODUCT_DECK_SLIDE_COUNT}"></span></div>`;

  return `<section class="slide${dark}" data-title="${dataTitle}">\n${inner}\n</section>`;
}

function parseSlideSections(html: string): { attrs: string; inner: string; full: string }[] {
  const slides: { attrs: string; inner: string; full: string }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SLIDE_SECTION_RE.source, SLIDE_SECTION_RE.flags);
  while ((m = re.exec(html)) !== null) {
    slides.push({ attrs: m[1], inner: m[2], full: m[0] });
  }
  return slides;
}

function rebuildDeckHtml(html: string, slideSections: string[]): string {
  const joined = slideSections.join('\n\n');
  if (/<div[^>]*\bclass=["'][^"']*\bdeck\b/i.test(html)) {
    return html.replace(
      /(<div[^>]*\bclass=["'][^"']*\bdeck\b[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/i,
      `$1\n${joined}\n$3`,
    );
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>\n<div class="deck">\n${joined}\n</div>`);
  }
  return `<div class="deck">\n${joined}\n</div>`;
}

function updateSlideTotals(html: string, total: number): string {
  return html
    .replace(/\bdata-total=["']\d+["']/gi, `data-total="${total}"`)
    .replace(/\/\s*\d+\s*<\/span>/g, `/ ${total}</span>`);
}

/**
 * Validate and enrich a Product Deck artifact for preview / export.
 */
export function enrichProductDeckHtml(
  html: string,
  opts: ProductDeckEnrichOptions = {},
): ProductDeckEnrichResult {
  const product = extractProductName(html, opts.productName);
  const blueprints = defaultBlueprints(product);
  const finalize = opts.finalize !== false;

  let filledFields = 0;
  let parsed = parseSlideSections(html);
  let slideSections: string[] = [];

  if (parsed.length === 0) {
    if (!finalize) {
      return { html, slideCount: countDeckSlides(html), filledFields: 0 };
    }
    slideSections = blueprints.map((bp, i) => buildSlideSection(bp, i, product));
    const out = updateSlideTotals(rebuildDeckHtml(html, slideSections), PRODUCT_DECK_SLIDE_COUNT);
    return { html: out, slideCount: PRODUCT_DECK_SLIDE_COUNT, filledFields: slideSections.length };
  }

  if (finalize && parsed.length > PRODUCT_DECK_SLIDE_COUNT) {
    parsed = parsed.slice(0, PRODUCT_DECK_SLIDE_COUNT);
  }

  for (let i = 0; i < parsed.length; i += 1) {
    const bp = blueprints[Math.min(i, blueprints.length - 1)];
    const result = enrichSlideInner(parsed[i].inner, bp, product);
    filledFields += result.filled;
    slideSections.push(`<section${parsed[i].attrs}>\n${result.html}\n</section>`);
  }

  if (finalize) {
    for (let i = parsed.length; i < PRODUCT_DECK_SLIDE_COUNT; i += 1) {
      slideSections.push(buildSlideSection(blueprints[i], i, product));
      filledFields += 1;
    }
  }

  let out = rebuildDeckHtml(html, slideSections);
  const slideCount = finalize ? PRODUCT_DECK_SLIDE_COUNT : slideSections.length;
  out = updateSlideTotals(out, slideCount);
  return { html: out, slideCount, filledFields };
}
