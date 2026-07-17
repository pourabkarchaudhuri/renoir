/**
 * Injected into the artifact iframe bridge. Improves text readability on deck
 * slides without changing generated HTML or theme tokens.
 */
export const DECK_CONTRAST_BRIDGE_FN = `
  var CONTRAST_STYLE_ID = '__renoir_deck_contrast_style';

  function ensureContrastStyles() {
    var st = document.getElementById(CONTRAST_STYLE_ID);
    if (st) return st;
    st = document.createElement('style');
    st.id = CONTRAST_STYLE_ID;
    st.textContent =
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"]{' +
        '--renoir-fg:#111827;--renoir-muted:#4b5563;--renoir-heading:#0f172a;' +
      '}' +
      'body[data-renoir-mode="present"] .renoir-slide.dark[data-renoir-active="1"],' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"][data-theme="dark"]{' +
        '--renoir-fg:#f9fafb;--renoir-muted:#d1d5db;--renoir-heading:#ffffff;' +
      '}' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] h1,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] h2,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] h3,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] h4{' +
        'text-shadow:0 1px 2px rgba(0,0,0,.12);' +
      '}' +
      'body[data-renoir-mode="present"] .renoir-slide.dark[data-renoir-active="1"] h1,' +
      'body[data-renoir-mode="present"] .renoir-slide.dark[data-renoir-active="1"] h2,' +
      'body[data-renoir-mode="present"] .renoir-slide.dark[data-renoir-active="1"] h3,' +
      'body[data-renoir-mode="present"] .renoir-slide.dark[data-renoir-active="1"] h4{' +
        'text-shadow:0 1px 3px rgba(0,0,0,.45);' +
      '}' +
      'body[data-renoir-mode="present"] .slide.is-active [class*="anim-"],' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] [class*="anim-"],' +
      'body[data-renoir-mode="present"] .slide.is-active .anim-stagger-list > *,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .anim-stagger-list > *{' +
        'opacity:1!important;visibility:visible!important;' +
      '}' +
      'body[data-renoir-mode="present"] .slide.is-active .kicker,' +
      'body[data-renoir-mode="present"] .slide.is-active .h1,' +
      'body[data-renoir-mode="present"] .slide.is-active .h2,' +
      'body[data-renoir-mode="present"] .slide.is-active .h3,' +
      'body[data-renoir-mode="present"] .slide.is-active .h4,' +
      'body[data-renoir-mode="present"] .slide.is-active .lede,' +
      'body[data-renoir-mode="present"] .slide.is-active p,' +
      'body[data-renoir-mode="present"] .slide.is-active li,' +
      'body[data-renoir-mode="present"] .slide.is-active h1,' +
      'body[data-renoir-mode="present"] .slide.is-active h2,' +
      'body[data-renoir-mode="present"] .slide.is-active h3,' +
      'body[data-renoir-mode="present"] .slide.is-active h4,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .kicker,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .h1,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .h2,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .h3,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .h4,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .lede,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] p,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] li,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] h1,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] h2,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] h3,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] h4{' +
        'opacity:1!important;visibility:visible!important;color:inherit;' +
      '}' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .dim,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .muted,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] small{' +
        'opacity:1!important;' +
      '}' +
      'body[data-renoir-mode="present"] .renoir-slide.dark[data-renoir-active="1"] .dim,' +
      'body[data-renoir-mode="present"] .renoir-slide.dark[data-renoir-active="1"] .muted{' +
        'opacity:1!important;' +
      '}' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] a,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .cta-btn{' +
        'text-shadow:none;' +
      '}';
    document.head.appendChild(st);
    return st;
  }

  function parseRgba(color) {
    if (!color || color === 'transparent') return null;
    var m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
  }

  function relativeLuminance(rgb) {
    var chan = [rgb.r, rgb.g, rgb.b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  }

  function revealSlideAnimations(slide) {
    if (!slide) return;
    slide.querySelectorAll('[class*="anim-"], .anim-stagger-list > *').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
      el.style.clipPath = 'none';
      if (el.classList.contains('anim-typewriter')) {
        el.style.width = 'auto';
        el.style.borderRight = 'none';
      }
    });
    slide.querySelectorAll('[data-anim]').forEach(function (el) {
      var a = el.getAttribute('data-anim');
      if (!a) return;
      el.classList.remove('anim-' + a);
      void el.offsetWidth;
      el.classList.add('anim-' + a);
    });
  }

  function applySlideContrast(slide) {
    if (!slide || slide === document.body) return;
    ensureContrastStyles();
    if (slide.classList.contains('dark')) return;
    var bg = window.getComputedStyle(slide).backgroundColor;
    var rgba = parseRgba(bg);
    if (!rgba || rgba.a < 0.12) return;
    var lum = relativeLuminance(rgba);
    if (lum > 0.72) {
      slide.style.setProperty('--renoir-fg', '#111827');
      slide.style.setProperty('--renoir-muted', '#374151');
      slide.style.setProperty('--renoir-heading', '#0f172a');
    }
  }
`;

/** Estimate slide count from artifact HTML (mirrors iframe bridge heuristics). */
export function countDeckSlides(html: string): number {
  const dataSlide = (html.match(/\bdata-slide\b/gi) || []).length;
  if (dataSlide > 0) return dataSlide;

  const hasDeck = /\bclass=["'][^"']*\bdeck\b/.test(html) || /\bid=["']deck["']/.test(html);
  if (hasDeck) {
    const sectionSlides = (html.match(/<section[^>]*\bclass=["'][^"']*\bslide\b/gi) || []).length;
    if (sectionSlides > 0) return sectionSlides;
    const divSlides = (html.match(/<div[^>]*\bclass=["'][^"']*\bslide\b/gi) || []).length;
    if (divSlides > 0) return divSlides;
  }

  const slideEls = html.match(
    /<(?:section|div|article)\b[^>]*\bclass=["'][^"']*\bslide\b[^"']*["']/gi,
  );
  if (slideEls && slideEls.length > 0) return slideEls.length;

  const sections = (html.match(/<section[\s>]/gi) || []).length;
  if (sections > 1) return sections;

  return 1;
}
