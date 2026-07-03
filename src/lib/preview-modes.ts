// Preview-mode selection. Auto-detects the right viewer for the active skill
// and exposes a small registry the renderer can iterate.

export type PreviewMode = 'scroll' | 'present';

/** CDN URL for the Mermaid library injected into artifact iframes. */
export const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

/** Initialization script that configures and runs Mermaid in the artifact iframe. */
export const MERMAID_INIT_SCRIPT = `<script src="${MERMAID_CDN}"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
    mermaid.run({ querySelector: '.mermaid' });
  }
});
</script>`;

const SKILL_TO_MODE: Record<string, PreviewMode> = {
  // Decks → slide presentation (one slide at a time)
  'pitch-deck':     'present',
  'product-deck':   'present',
  'all-hands-deck': 'present',
  // Everything else → scroll (vertical page view)
};

export function defaultModeForSkill(skillId?: string): PreviewMode {
  if (!skillId) return 'scroll';
  return SKILL_TO_MODE[skillId] ?? 'scroll';
}

/**
 * Bridge script injected into the artifact iframe. Listens for nav messages
 * from the parent, reports slide count + active index, and applies the right
 * layout per mode:
 *   • present — slides laid out horizontally, navigated by translateX
 *   • pages   — slides stacked vertically, page-break aware
 *   • scroll  — user content untouched
 *
 * For present mode we position each slide absolutely (left: i*100vw) so
 * nesting in the source doc is irrelevant — the bridge owns the geometry.
 */
export const NAV_BRIDGE = `<!--renoir-nav-bridge-->
<script>
(function () {
  var STYLE_ID = '__renoir_mode_style';
  var POLISH_ID = '__renoir_preview_polish';
  function ensurePreviewPolish() {
    if (document.getElementById(POLISH_ID)) return;
    var st = document.createElement('style');
    st.id = POLISH_ID;
    st.textContent =
      'html,body{min-height:100%;}' +
      'html:has(body[data-renoir-mode="scroll"]){height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;}' +
      'body[data-renoir-mode="scroll"]{height:auto!important;min-height:100%!important;overflow:visible!important;}' +
      'header,header>*,.site-header,nav.topnav,.topnav{max-width:100%;box-sizing:border-box;}' +
      'header nav,nav.topnav,.topnav,header .nav,nav.site-nav{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:0.4rem 0.65rem;min-width:0;flex:1 1 auto;}' +
      'header .brand,header .logo,header>a:first-child{flex-shrink:0;min-width:0;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      'header .btn,nav .btn,header button,nav button,.cta,.btn-primary{box-sizing:border-box;white-space:nowrap;flex-shrink:1;min-width:0;max-width:9.5rem;overflow:hidden;text-overflow:ellipsis;font-size:clamp(11px,2.4vw,14px);padding:0.45rem 0.75rem;}' +
      '@media(max-width:640px){header nav a,nav.topnav a{font-size:11px;padding:2px 4px;}header .btn,nav .btn,header button,.cta{max-width:7.5rem;font-size:11px;padding:0.4rem 0.55rem;}}';
    document.head.appendChild(st);
  }
  function slides() {
    var main = document.querySelector('main');
    if (main) {
      var direct = main.querySelectorAll(':scope > section, :scope > [data-slide]');
      if (direct.length) return Array.from(direct);
    }
    var top = document.body.querySelectorAll(':scope > section, :scope > [data-slide]');
    if (top.length) return Array.from(top);
    var all = document.querySelectorAll('section, [data-slide]');
    return all.length ? Array.from(all) : [document.body];
  }
  function ensureStyle() {
    var st = document.getElementById(STYLE_ID);
    if (!st) {
      st = document.createElement('style');
      st.id = STYLE_ID;
      document.head.appendChild(st);
    }
    return st;
  }
  function clearInline(el) {
    var props = ['position','top','left','right','bottom','width','height','minHeight','maxHeight',
      'transform','transition','overflow','boxSizing','willChange','zIndex','paddingTop','display'];
    props.forEach(function (p) { el.style[p] = ''; });
    delete el.dataset.renoirOwned;
    el.removeAttribute('data-renoir-active');
  }
  function clearChrome() {
    document.querySelectorAll('[data-renoir-chrome]').forEach(function (el) {
      el.style.display = '';
      delete el.dataset.renoirChrome;
    });
  }
  function applyChrome(idx, list) {
    clearChrome();
    document.querySelectorAll('footer, [role="contentinfo"]').forEach(function (el) {
      if (list.indexOf(el) >= 0) return;
      var show = idx === list.length - 1;
      el.dataset.renoirChrome = '1';
      el.style.display = show ? '' : 'none';
      if (show) el.dataset.renoirFooterFixed = '1';
      else delete el.dataset.renoirFooterFixed;
    });
  }
  function measureChrome() {
    if (document.body.getAttribute('data-renoir-mode') !== 'present') return;
    var top = 72;
    var header = document.querySelector(
      'body[data-renoir-mode="present"] > header,' +
      'body[data-renoir-mode="present"] > nav,' +
      'body[data-renoir-mode="present"] header.site-header,' +
      'body[data-renoir-mode="present"] nav.topnav'
    );
    if (header) {
      var hr = header.getBoundingClientRect();
      if (hr.height > 0) top = Math.ceil(hr.height) + 8;
    }
    var bottom = 0;
    document.querySelectorAll('footer[data-renoir-footer-fixed], [role="contentinfo"][data-renoir-footer-fixed]').forEach(function (el) {
      if (el.style.display === 'none') return;
      var fr = el.getBoundingClientRect();
      if (fr.height > 0) bottom = Math.max(bottom, Math.ceil(fr.height) + 8);
    });
    document.documentElement.style.setProperty('--renoir-chrome-top', top + 'px');
    document.documentElement.style.setProperty('--renoir-chrome-bottom', bottom + 'px');
  }
  function unwrapFitRoots() {
    document.querySelectorAll('[data-renoir-fit-root]').forEach(function (root) {
      var parent = root.parentNode;
      if (!parent) return;
      while (root.firstChild) parent.insertBefore(root.firstChild, root);
      parent.removeChild(root);
    });
  }
  function ensureFitRoot(slide) {
    if (slide === document.body) return slide;
    var existing = slide.querySelector(':scope > [data-renoir-fit-root]');
    if (existing) return existing;
    var root = document.createElement('div');
    root.setAttribute('data-renoir-fit-root', '1');
    while (slide.firstChild) root.appendChild(slide.firstChild);
    slide.appendChild(root);
    return root;
  }
  function resetFitRoot(root) {
    if (!root) return;
    root.style.transform = '';
    root.style.transformOrigin = '';
    root.style.zoom = '';
    root.style.width = '';
    root.style.maxWidth = '';
    root.style.maxHeight = '';
    root.style.height = '';
    root.style.marginBottom = '';
    root.style.marginLeft = '';
    root.style.marginRight = '';
    root.style.overflow = '';
  }
  function slideContentBox() {
    var top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--renoir-chrome-top')) || 0;
    var bottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--renoir-chrome-bottom')) || 0;
    var h = (window.innerHeight || document.documentElement.clientHeight || 800) - top - bottom;
    var w = window.innerWidth || document.documentElement.clientWidth || 390;
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }
  function fitSlide(slide) {
    if (!slide || slide === document.body) return;
    var box = slideContentBox();
    var root = ensureFitRoot(slide);
    resetFitRoot(root);
    root.style.boxSizing = 'border-box';
    root.style.width = '100%';
    root.style.maxWidth = '100%';
    var naturalH = root.scrollHeight || root.offsetHeight || 0;
    var naturalW = root.scrollWidth || root.offsetWidth || box.w;
    if (naturalH < 1) return;
    var scale = Math.min(1, box.h / naturalH, box.w / Math.max(naturalW, 1));
    scale = Math.floor(scale * 1000) / 1000;
    if (scale >= 0.995) return;
    root.style.zoom = String(scale);
    root.style.width = '100%';
    root.style.maxWidth = '100%';
  }
  function fitActiveSlide() {
    if (document.body.getAttribute('data-renoir-mode') !== 'present') return;
    measureChrome();
    slides().forEach(function (slide) {
      if (slide === document.body) return;
      var root = slide.querySelector(':scope > [data-renoir-fit-root]');
      if (root) resetFitRoot(root);
    });
    var active = document.querySelector('section[data-renoir-active], [data-slide][data-renoir-active]');
    if (active && active !== document.body) fitSlide(active);
  }
  function scheduleFit() {
    fitActiveSlide();
    setTimeout(fitActiveSlide, 0);
    setTimeout(fitActiveSlide, 80);
    setTimeout(fitActiveSlide, 200);
    setTimeout(fitActiveSlide, 500);
    setTimeout(fitActiveSlide, 1200);
  }
  function applyHorizontal(idx) {
    removeScrollTail();
    var list = slides();
    var st = ensureStyle();
    st.textContent =
      'html,body{margin:0;padding:0;overflow:hidden;height:100%;width:100%;}' +
      '[data-nav],[class*="nav-btn"],[class*="slide-nav"],' +
      'button[onclick*="prev"],button[onclick*="next"],' +
      '.prev-btn,.next-btn,.slide-controls,.navigation{display:none!important;}' +
      'body[data-renoir-mode="present"] > header,' +
      'body[data-renoir-mode="present"] > nav,' +
      'body[data-renoir-mode="present"] header.site-header,' +
      'body[data-renoir-mode="present"] nav.topnav{' +
        'position:absolute!important;top:0!important;left:0!important;right:0!important;' +
        'z-index:20!important;width:100%!important;}' +
      'body[data-renoir-mode="present"] footer[data-renoir-footer-fixed],' +
      'body[data-renoir-mode="present"] [role="contentinfo"][data-renoir-footer-fixed]{' +
        'position:fixed!important;bottom:0!important;left:0!important;right:0!important;' +
        'z-index:30!important;width:100%!important;margin:0!important;' +
        'max-height:min(40vh,280px)!important;overflow-y:auto!important;' +
        'box-sizing:border-box!important;-webkit-overflow-scrolling:touch;}' +
      'body[data-renoir-mode="present"] section,' +
      'body[data-renoir-mode="present"] [data-slide]{' +
        'position:absolute!important;top:0!important;left:0!important;' +
        'width:100%!important;height:100%!important;margin:0!important;' +
        'padding-top:var(--renoir-chrome-top,72px)!important;' +
        'padding-bottom:var(--renoir-chrome-bottom,0px)!important;' +
        'box-sizing:border-box!important;overflow:hidden!important;' +
        'display:flex!important;flex-direction:column!important;align-items:stretch!important;' +
        'transition:transform 380ms cubic-bezier(0.16,1,0.3,1)!important;' +
        'will-change:transform;z-index:1;' +
      '}' +
      'body[data-renoir-mode="present"] [data-renoir-fit-root]{' +
        'width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;flex-shrink:0!important;' +
      '}' +
      'body[data-renoir-mode="present"] section *,' +
      'body[data-renoir-mode="present"] [data-slide] *{max-width:100%;box-sizing:border-box;}' +
      'body[data-renoir-mode="present"] section table,' +
      'body[data-renoir-mode="present"] [data-slide] table{display:block;overflow-x:auto;max-width:100%;}' +
      'body[data-renoir-mode="present"] [data-renoir-fit-root] h1,' +
      'body[data-renoir-mode="present"] [data-renoir-fit-root] h2{' +
        'font-size:clamp(1.15rem,4.5vw,2.25rem)!important;line-height:1.15!important;}' +
      'body[data-renoir-mode="present"] [data-renoir-fit-root] p,' +
      'body[data-renoir-mode="present"] [data-renoir-fit-root] li{' +
        'font-size:clamp(0.7rem,2.2vw,0.95rem)!important;line-height:1.35!important;}' +
      'body[data-renoir-mode="present"] [class*="plan"] ul li:nth-child(n+5),' +
      'body[data-renoir-mode="present"] [class*="card"] ul li:nth-child(n+5){display:none!important;}' +
      'body[data-renoir-mode="present"] table{font-size:clamp(0.65rem,1.8vw,0.85rem)!important;}' +
      '@media(max-width:1024px){' +
        'body[data-renoir-mode="present"] section [class*="plans"],' +
        'body[data-renoir-mode="present"] section [class*="pricing"],' +
        'body[data-renoir-mode="present"] section [class*="tiers"],' +
        'body[data-renoir-mode="present"] [data-slide] [class*="plans"],' +
        'body[data-renoir-mode="present"] [data-slide] [class*="pricing"],' +
        'body[data-renoir-mode="present"] [data-slide] [class*="tiers"]{' +
          'display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0.4rem!important;}' +
        'body[data-renoir-mode="present"] section .card,' +
        'body[data-renoir-mode="present"] section [class*="card"],' +
        'body[data-renoir-mode="present"] section [class*="plan"],' +
        'body[data-renoir-mode="present"] [data-slide] .card,' +
        'body[data-renoir-mode="present"] [data-slide] [class*="card"],' +
        'body[data-renoir-mode="present"] [data-slide] [class*="plan"]{' +
          'width:100%!important;max-width:100%!important;min-width:0!important;padding:0.65rem!important;}' +
        'body[data-renoir-mode="present"] [data-renoir-fit-root] [class*="price"],' +
        'body[data-renoir-mode="present"] [data-renoir-fit-root] [class*="amount"]{' +
          'font-size:clamp(1.1rem,4vw,1.75rem)!important;}' +
      '}' +
      '@media(max-width:480px){' +
        'body[data-renoir-mode="present"] section [class*="plans"],' +
        'body[data-renoir-mode="present"] section [class*="pricing"],' +
        'body[data-renoir-mode="present"] section [class*="tiers"],' +
        'body[data-renoir-mode="present"] section [class*="grid"],' +
        'body[data-renoir-mode="present"] [data-slide] [class*="plans"],' +
        'body[data-renoir-mode="present"] [data-slide] [class*="pricing"],' +
        'body[data-renoir-mode="present"] [data-slide] [class*="tiers"],' +
        'body[data-renoir-mode="present"] [data-slide] [class*="grid"]{' +
          'grid-template-columns:1fr!important;gap:0.5rem!important;}' +
      '}' +
      '@media(max-width:1024px){' +
        'body[data-renoir-mode="present"] footer[data-renoir-footer-fixed],' +
        'body[data-renoir-mode="present"] [role="contentinfo"][data-renoir-footer-fixed]{' +
          'max-height:min(28vh,160px)!important;font-size:11px!important;padding:0.5rem 0.75rem!important;}' +
        'body[data-renoir-mode="present"] footer[data-renoir-footer-fixed] nav,' +
        'body[data-renoir-mode="present"] footer[data-renoir-footer-fixed] .browse,' +
        'body[data-renoir-mode="present"] footer[data-renoir-footer-fixed] [class*="browse"],' +
        'body[data-renoir-mode="present"] [role="contentinfo"][data-renoir-footer-fixed] nav{' +
          'display:none!important;}' +
      '}';
    document.body.setAttribute('data-renoir-mode', 'present');
    applyChrome(idx, list);
    list.forEach(function (el, i) {
      el.dataset.renoirOwned = '1';
      el.style.transform = 'translateX(' + ((i - idx) * 100) + '%)';
      el.removeAttribute('data-renoir-active');
      if (i === idx) el.setAttribute('data-renoir-active', '1');
    });
    scheduleFit();
  }
  var activeMode = 'scroll';
  var activeIdx  = 0;
  var SCROLL_TAIL_ID = '__renoir_scroll_tail';
  function removeScrollTail() {
    var el = document.getElementById(SCROLL_TAIL_ID);
    if (el) el.remove();
  }
  function measureStackedHeight() {
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var fromFooter = 0;
    var footer = document.querySelector('body > footer, body > [role="contentinfo"]');
    if (footer && footer.style.display !== 'none') {
      fromFooter = Math.ceil((footer.offsetTop || 0) + (footer.offsetHeight || footer.scrollHeight || 0));
    }
    var fromSections = 0;
    var header = document.querySelector('body > header, body > nav, header.site-header, nav.topnav');
    var main = document.querySelector('main');
    if (header) fromSections += Math.max(header.offsetHeight || 0, header.scrollHeight || 0);
    if (main) {
      var sectionSum = 0;
      main.querySelectorAll(':scope > section, :scope > [data-slide]').forEach(function (sec) {
        sectionSum += Math.max(sec.offsetHeight || 0, sec.scrollHeight || 0);
      });
      if (sectionSum > 0) fromSections += sectionSum;
      else fromSections += Math.max(main.offsetHeight || 0, main.scrollHeight || 0);
    }
    if (footer && footer.style.display !== 'none') {
      fromSections += Math.max(footer.offsetHeight || 0, footer.scrollHeight || 0);
    }
    var best = Math.max(fromSections, fromFooter > vh ? fromFooter : 0);
    return Math.ceil(Math.max(best, document.documentElement.scrollHeight || 0));
  }
  function syncScrollExtent() {
    if (document.body.getAttribute('data-renoir-mode') !== 'scroll') return;
    void document.documentElement.offsetHeight;
    var total = measureStackedHeight();
    var current = document.documentElement.scrollHeight || 0;
    var extra = Math.max(0, total - current + 2);
    if (extra < 1) {
      removeScrollTail();
      return;
    }
    var tail = document.getElementById(SCROLL_TAIL_ID);
    if (!tail) {
      tail = document.createElement('div');
      tail.id = SCROLL_TAIL_ID;
      tail.setAttribute('aria-hidden', 'true');
      tail.style.cssText = 'clear:both;width:100%;height:0;pointer-events:none;visibility:hidden;';
      document.body.appendChild(tail);
    }
    tail.style.height = extra + 'px';
  }
  function applyScroll() {
    unwrapFitRoots();
    removeScrollTail();
    var st = ensureStyle();
    var shell =
      'html{height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;width:100%;margin:0;}' +
      'body{height:auto!important;min-height:100%!important;overflow:visible!important;width:100%;margin:0;box-sizing:border-box;}' +
      'body[data-renoir-mode="scroll"] .faq,body[data-renoir-mode="scroll"] details,body[data-renoir-mode="scroll"] .table-wrap,body[data-renoir-mode="scroll"] .table-scroll{' +
        'overflow:visible!important;max-height:none!important;height:auto!important;}';
    st.textContent =
      shell +
      'main,#content,.page,.site-content{overflow:visible!important;height:auto!important;max-height:none!important;display:block!important;position:relative!important;}' +
      'body[data-renoir-mode="scroll"] section,' +
      'body[data-renoir-mode="scroll"] [data-slide]{' +
        'position:relative!important;inset:auto!important;transform:none!important;' +
        'width:100%!important;height:auto!important;min-height:unset!important;max-height:none!important;' +
        'overflow:visible!important;opacity:1!important;visibility:visible!important;' +
        'display:block!important;padding-top:unset!important;padding-bottom:unset!important;' +
      '}' +
      'body[data-renoir-mode="scroll"] footer,' +
      'body[data-renoir-mode="scroll"] [role="contentinfo"]{position:relative!important;display:block!important;max-height:none!important;overflow:visible!important;}';
    document.body.setAttribute('data-renoir-mode', 'scroll');
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    clearChrome();
    document.querySelectorAll('footer, [role="contentinfo"]').forEach(function (el) {
      el.style.display = '';
      el.style.position = '';
      delete el.dataset.renoirFooterFixed;
      delete el.dataset.renoirChrome;
    });
    document.querySelectorAll('section, [data-slide], main').forEach(function (el) {
      if (el === document.body) return;
      ['position','top','left','right','bottom','width','height','minHeight','maxHeight',
        'transform','transition','overflow','paddingTop','paddingBottom','zoom'
      ].forEach(function (p) { el.style[p] = ''; });
      el.removeAttribute('data-renoir-active');
      delete el.dataset.renoirOwned;
    });
    slides().forEach(function (el) {
      if (el !== document.body) clearInline(el);
    });
    syncScrollExtent();
    setTimeout(syncScrollExtent, 0);
    setTimeout(syncScrollExtent, 120);
    setTimeout(syncScrollExtent, 400);
    setTimeout(syncScrollExtent, 1000);
  }
  function focus(idx, mode) {
    var list = slides();
    var clamped = Math.max(0, Math.min(list.length - 1, idx));
    if (mode === 'present') applyHorizontal(clamped);
    else applyScroll();
    parent.postMessage({ type: 'renoir:nav-state', idx: clamped, total: list.length }, '*');
    return clamped;
  }
  function nav(dir, idx) {
    var list = slides();
    if (dir === 'next') return Math.min(list.length - 1, activeIdx + 1);
    if (dir === 'prev') return Math.max(0, activeIdx - 1);
    if (typeof idx === 'number') return Math.max(0, Math.min(list.length - 1, idx));
    return activeIdx;
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'renoir:set-mode') {
      var prevMode = activeMode;
      activeMode = d.mode || 'scroll';
      if (activeMode === 'present' && prevMode !== 'present') activeIdx = 0;
      activeIdx = focus(activeIdx, activeMode);
    } else if (d.type === 'renoir:nav') {
      if (activeMode !== 'present') activeMode = 'present';
      activeIdx = nav(d.dir, d.idx);
      activeIdx = focus(activeIdx, activeMode);
    } else if (d.type === 'renoir:probe') {
      var l = slides();
      if (activeMode === 'scroll') applyScroll();
      else focus(activeIdx, activeMode);
      parent.postMessage({ type: 'renoir:nav-state', idx: activeIdx, total: l.length }, '*');
    }
  });
  window.addEventListener('resize', function () {
    if (activeMode === 'present') scheduleFit();
    else if (activeMode === 'scroll') syncScrollExtent();
  });
  window.addEventListener('keydown', function (e) {
    if (activeMode !== 'present') return;
    var t = e.target;
    var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (t && t.isContentEditable)) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      activeIdx = nav('next');
      activeIdx = focus(activeIdx, activeMode);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      activeIdx = nav('prev');
      activeIdx = focus(activeIdx, activeMode);
    }
  });
  var sizeObserver;
  try {
    sizeObserver = new ResizeObserver(function () {
      if (activeMode === 'scroll') syncScrollExtent();
    });
    sizeObserver.observe(document.documentElement);
    if (document.body) sizeObserver.observe(document.body);
  } catch (e) { /* swallow */ }
  window.addEventListener('load', function () {
    if (activeMode === 'scroll') applyScroll();
    parent.postMessage({ type: 'renoir:nav-state', idx: activeIdx, total: slides().length }, '*');
  });
  setTimeout(function () {
    if (activeMode === 'scroll') syncScrollExtent();
  }, 200);
  setTimeout(function () {
    parent.postMessage({ type: 'renoir:nav-state', idx: activeIdx, total: slides().length }, '*');
  }, 30);
  ensurePreviewPolish();
  if (activeMode === 'scroll') applyScroll();
})();
</script>`;

/**
 * Checks whether the given HTML contains mermaid content markers.
 * Looks for class="mermaid", class='mermaid', or pre class="mermaid".
 */
export function hasMermaidContent(html: string): boolean {
  return (
    html.includes('class="mermaid"') ||
    html.includes("class='mermaid'") ||
    html.includes('pre class="mermaid"')
  );
}

/**
 * Conditionally injects the Mermaid CDN script and initialization code into HTML.
 * - Skips injection if mermaid is already present (mermaid.min.js or mermaid.esm)
 * - Skips injection if no mermaid content markers are found
 * - Injects before </head> if present, else before </body>, else appends at end
 */
export function injectMermaidScript(html: string): string {
  // Idempotency: skip if mermaid is already present
  if (html.includes('mermaid.min.js') || html.includes('mermaid.esm')) {
    return html;
  }

  // Only inject if the HTML contains mermaid content
  if (!hasMermaidContent(html)) {
    return html;
  }

  // Inject before </head> if present, else before </body>, else append at end
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${MERMAID_INIT_SCRIPT}\n</head>`);
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${MERMAID_INIT_SCRIPT}\n</body>`);
  }
  return html + '\n' + MERMAID_INIT_SCRIPT;
}

/** Wrap an artifact body with the nav bridge; replaces any prior bridge injection. */
export function wrapWithBridge(html: string): string {
  const MARKER = '<!--renoir-nav-bridge-->';
  let result = injectMermaidScript(html);
  const markerAt = result.indexOf(MARKER);
  if (markerAt >= 0) {
    const scriptEnd = result.indexOf('</script>', markerAt);
    if (scriptEnd >= 0) {
      result = result.slice(0, markerAt) + result.slice(scriptEnd + '</script>'.length);
    } else {
      result = result.slice(0, markerAt);
    }
  }

  if (/<\/body>/i.test(result)) return result.replace(/<\/body>/i, `${NAV_BRIDGE}</body>`);
  if (/<\/html>/i.test(result)) return result.replace(/<\/html>/i, `${NAV_BRIDGE}</html>`);
  return result + NAV_BRIDGE;
}
