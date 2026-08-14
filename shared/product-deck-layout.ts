/** Product deck layout contract — shared by prompts, normalization, preview, and export. */

export const PRODUCT_DECK_META = 'renoir:product-deck';

const PRODUCT_DECK_STYLE_ID = 'renoir-product-deck-base';

export const PRODUCT_DECK_META_TAG = `<meta name="${PRODUCT_DECK_META}" content="1">`;

/**
 * Baseline slide layout CSS (html-ppt conventions). Appended at end of head so
 * structural rules win over LLM one-offs. Theme tokens on :root remain overridable.
 */
export const PRODUCT_DECK_BASE_CSS = `
:root{
  --bg:#ffffff;--bg-soft:#f7f7f8;--surface:#ffffff;--surface-2:#f2f2f4;
  --border:rgba(0,0,0,.08);--border-strong:rgba(0,0,0,.16);
  --text-1:#111216;--text-2:#55596a;--text-3:#8a8f9e;
  --accent:#3b6cff;--accent-2:#7a5cff;--accent-3:#ff5c8a;
  --grad:linear-gradient(135deg,#3b6cff,#7a5cff 55%,#ff5c8a);
  --grad-soft:linear-gradient(135deg,#eef2ff,#f5ecff 55%,#ffeef5);
  --radius:18px;--radius-sm:12px;--radius-lg:26px;
  --shadow:0 10px 30px rgba(18,24,40,.08),0 2px 6px rgba(18,24,40,.04);
  --shadow-lg:0 24px 60px rgba(18,24,40,.14),0 6px 16px rgba(18,24,40,.06);
  --font-sans:'Inter','Noto Sans SC',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  --font-serif:'Playfair Display','Noto Serif SC',Georgia,serif;
  --font-mono:'JetBrains Mono','IBM Plex Mono',SFMono-Regular,Menlo,monospace;
  --font-display:var(--font-sans);
  --letter-tight:-.03em;--letter-normal:-.01em;
  --ease:cubic-bezier(.4,0,.2,1);
  --anim-dur:.7s;--anim-ease:cubic-bezier(.4,0,.2,1);
}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%!important;height:100%!important;max-width:100%;max-height:100%;
  overflow:hidden!important;background:var(--bg);color:var(--text-1);
  font-family:var(--font-sans);font-weight:400;line-height:1.6;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  letter-spacing:var(--letter-normal)}
img,svg,video{max-width:100%;display:block}
a{color:var(--accent);text-decoration:none}
.deck,.deck#deck,#deck{
  position:relative;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;
  min-height:0!important;overflow:hidden!important;background:var(--bg)
}
.deck>section.slide{
  position:absolute;inset:0;
  display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;
  padding:40px 48px 48px;box-sizing:border-box;overflow:hidden;
  width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;
  margin:0!important;transform:none!important;
}
/* Show first slide until Renoir present bridge marks the active slide */
.deck>section.slide:first-of-type{opacity:1;pointer-events:auto;z-index:1}
.deck>section.slide~section.slide{opacity:0;pointer-events:none;visibility:hidden}
.deck>section.slide.is-active,.deck>section.slide[data-renoir-active="1"]{
  opacity:1!important;pointer-events:auto!important;transform:none!important;z-index:2!important;
  visibility:visible!important;
}
.deck>section.slide>*{max-width:100%;min-width:0}
.deck>section.slide>:not(.deck-footer){flex:0 1 auto;min-height:0}
.eyebrow{font-size:13px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--text-3)}
.kicker{font-size:14px;font-weight:600;color:var(--accent);letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px}
h1.title,.h1{font-family:var(--font-display);font-size:clamp(32px,4.2vw,52px);line-height:1.05;font-weight:800;
  letter-spacing:var(--letter-tight);margin:0 0 12px;color:var(--text-1)}
h2.title,.h2{font-family:var(--font-display);font-size:clamp(26px,3.4vw,42px);line-height:1.1;font-weight:700;
  letter-spacing:var(--letter-tight);margin:0 0 10px;color:var(--text-1)}
h3,.h3{font-size:clamp(22px,2.4vw,30px);line-height:1.2;font-weight:600;letter-spacing:var(--letter-normal);margin:0 0 8px}
h4,.h4{font-size:clamp(18px,1.8vw,22px);line-height:1.3;font-weight:600;margin:0 0 6px}
.lede{font-size:clamp(15px,1.6vw,19px);line-height:1.45;color:var(--text-2);font-weight:300;max-width:100%;margin:0}
.dim{color:var(--text-2)}.dim2{color:var(--text-3)}
.gradient-text{background:var(--grad);-webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;color:transparent}
.grid{display:grid;gap:20px;min-width:0;max-width:100%}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.grid>*{min-width:0;max-width:100%}
.mt-s{margin-top:8px}.mt-m{margin-top:14px}.mt-l{margin-top:20px}
.mb-s{margin-bottom:8px}.mb-m{margin-bottom:14px}.mb-l{margin-bottom:20px}
.deck>section.slide ul{margin:0;padding:0 0 0 1.25em;font-size:clamp(14px,1.5vw,18px);line-height:1.45;color:var(--text-2)}
.deck>section.slide ul li{margin:6px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:20px 22px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.feature-card{padding:24px 20px;border-radius:var(--radius-lg);background:var(--surface);
  border:1px solid var(--border);position:relative;overflow:hidden;min-width:0}
.feature-card .icon{width:48px;height:48px;border-radius:14px;background:var(--grad);
  display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;
  font-weight:900;margin-bottom:14px}
.price-card{padding:28px 24px;border-radius:var(--radius-lg);border:1.5px solid var(--border);
  background:var(--surface);text-align:left;min-width:0}
.price-card.pro{background:#0a0a12;color:#fff;border-color:#0a0a12;
  transform:none;box-shadow:0 20px 50px rgba(59,108,255,.18)}
.price-card.pro .dim{color:rgba(255,255,255,.7)}
.price-card h4{font-size:16px;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin:0 0 8px}
.price-card.pro h4{color:var(--accent-2)}
.price-card .amount{font-size:clamp(36px,4vw,52px);font-weight:900;letter-spacing:-.035em;margin:10px 0}
.price-card ul{list-style:none;padding:0;margin:20px 0 0}
.price-card li{padding:8px 0;font-size:15px;color:var(--text-2);border-top:1px solid var(--border)}
.price-card.pro li{color:rgba(255,255,255,.8);border-color:rgba(255,255,255,.12)}
.deck-footer{position:absolute;bottom:12px;left:48px;right:48px;display:flex;
  align-items:center;justify-content:space-between;font-size:12px;color:var(--text-3);
  z-index:10;pointer-events:none;margin:0}
.slide-number::before{content:attr(data-current)}
.slide-number::after{content:" / " attr(data-total)}
.slide-visual{
  overflow:hidden;position:relative;box-sizing:border-box;
  width:100%;max-width:100%;flex:0 1 auto;min-height:0;
  max-height:min(36vh,240px);border-radius:var(--radius);aspect-ratio:16/9;margin-top:auto;align-self:stretch
}
.slide-visual>img,img.slide-image{width:100%;height:100%;max-width:100%;object-fit:cover;
  object-position:center;display:block;border:0;border-radius:var(--radius)}
.deck>section.slide:not(.dark){
  background:var(--surface,#fff);
  color:var(--text-1);
  --fg:var(--text-1);
  --muted:var(--text-2);
  --text-1:#111216;
  --text-2:#55596a;
  --text-3:#8a8f9e;
  --surface:#fff;
  --surface-2:#f2f2f4;
  --border:rgba(0,0,0,.08);
}
.deck>section.slide:not(.dark) .h1,.deck>section.slide:not(.dark) .h2,.deck>section.slide:not(.dark) .h3,
.deck>section.slide:not(.dark) .h4,.deck>section.slide:not(.dark) .kicker,.deck>section.slide:not(.dark) .lede,
.deck>section.slide:not(.dark) p,.deck>section.slide:not(.dark) li,.deck>section.slide:not(.dark) h1,
.deck>section.slide:not(.dark) h2,.deck>section.slide:not(.dark) h3,.deck>section.slide:not(.dark) h4{
  color:inherit;
}
.deck>section.slide:not(.dark) .gradient-text{
  background:none;
  -webkit-background-clip:unset;
  background-clip:unset;
  -webkit-text-fill-color:currentColor;
  color:var(--accent);
}
.deck>section.slide.dark{background:#0a0a12;color:#f5f5f7;
  --fg:#f5f5f7;--text-1:#f5f5f7;--text-2:rgba(245,245,247,.72);--text-3:rgba(245,245,247,.5)}
.deck>section.slide.dark .h1,.deck>section.slide.dark .h2,.deck>section.slide.dark h3,
.deck>section.slide.dark h4{color:#fff}
.deck>section.slide.dark .lede,.deck>section.slide.dark .dim{color:rgba(245,245,247,.72)}
.deck>section.slide.dark .card,.deck>section.slide.dark .feature-card{
  background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12);box-shadow:none}
.deck>section.slide.dark .kicker{color:var(--accent-2)}
.cta-btn{display:inline-block;padding:14px 28px;border-radius:999px;background:var(--grad);
  color:#fff;font-weight:700;font-size:clamp(14px,1.6vw,18px);box-shadow:0 12px 32px rgba(59,108,255,.2);
  text-decoration:none;margin-top:16px;max-width:100%}
@media(max-width:480px){
  .deck>section.slide{padding:28px 24px 40px}
  .deck-footer{left:24px;right:24px}
  .g3,.g2,.g4{grid-template-columns:1fr!important}
}
@keyframes kf-fade-up{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:none}}
@keyframes kf-rise{from{opacity:0;transform:translateY(60px) scale(.97);filter:blur(6px)}
  to{opacity:1;transform:none;filter:none}}
.anim-fade-up{animation:kf-fade-up var(--anim-dur) var(--anim-ease) both}
.anim-rise-in{animation:kf-rise .9s var(--anim-ease) both}
.anim-stagger-list>*{opacity:0;animation:kf-rise .65s var(--anim-ease) both}
.anim-stagger-list>*:nth-child(1){animation-delay:.05s}
.anim-stagger-list>*:nth-child(2){animation-delay:.15s}
.anim-stagger-list>*:nth-child(3){animation-delay:.25s}
.anim-stagger-list>*:nth-child(4){animation-delay:.35s}
.anim-stagger-list>*:nth-child(5){animation-delay:.45s}
.anim-stagger-list>*:nth-child(6){animation-delay:.55s}
@media print{
  .deck>section.slide{position:relative;opacity:1!important;transform:none!important;
    page-break-after:always;height:100vh}
  .deck-footer{display:none!important}
}
`.trim();

export const PRODUCT_DECK_STYLE_TAG =
  `<style id="${PRODUCT_DECK_STYLE_ID}">\n${PRODUCT_DECK_BASE_CSS}\n</style>`;

function injectBeforeHeadClose(html: string, fragment: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${fragment}\n</head>`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${fragment}`);
  }
  return `${fragment}\n${html}`;
}

/** Inject product-deck meta + baseline slide CSS into artifact HTML. Idempotent. */
export function injectProductDeckShell(html: string): string {
  let out = html;
  if (!new RegExp(`name=["']${PRODUCT_DECK_META}["']`, 'i').test(out)) {
    out = injectBeforeHeadClose(out, PRODUCT_DECK_META_TAG);
  }
  if (!new RegExp(`id=["']${PRODUCT_DECK_STYLE_ID}["']`, 'i').test(out)) {
    out = injectBeforeHeadClose(out, PRODUCT_DECK_STYLE_TAG);
  }
  return out;
}

/** System-prompt lines describing the injected deck layout contract. */
export function productDeckLayoutPromptLines(): string[] {
  return [
    '# Product Deck layout (Renoir-injected CSS)',
    'Renoir injects the slide layout system — do NOT redefine .deck/.slide positioning or stack slides vertically.',
    'Structure: <div class="deck"> wrapping exactly 12 <section class="slide"> elements.',
    'Use semantic classes: .kicker, .h1/.h2, .lede, .grid.g3, .feature-card, .price-card, .slide-visual, .deck-footer.',
    'Focus creative effort on copy, :root theme tokens, accents, and optional .slide.dark — not layout mechanics.',
    'Optional entrance: .anim-fade-up, .anim-rise-in, .anim-stagger-list on headings, cards, or lists.',
  ];
}
