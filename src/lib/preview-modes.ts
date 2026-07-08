// Preview-mode selection. Auto-detects the right viewer for the active skill
// and exposes a small registry the renderer can iterate.

import { MOBILE_SIDEBAR_BRIDGE_FN } from './preview-mobile-sidebar';
import { DASHBOARD_BRIDGE_FN } from '@shared/dashboard-layout';
import { DECK_CONTRAST_BRIDGE_FN, countDeckSlides } from './preview-deck-contrast';
import { PICK_BRIDGE_FN } from './preview-pick-bridge';
import { SCROLL_SYNC_BRIDGE_FN } from './preview-scroll-sync';
import { A11Y_PROBE_BRIDGE_FN } from './preview-a11y-probe';
import { FLOW_BRIDGE_FN } from './preview-flow-bridge';

export { countDeckSlides };

export type PreviewMode = 'scroll' | 'present';

/** CDN URL for the Mermaid library injected into artifact iframes. */
export const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

/** Initialization script that configures and runs Mermaid in the artifact iframe. */
export const MERMAID_INIT_SCRIPT = `<script>
(function () {
  var mermaidReady = null;
  function ensureMermaid() {
    if (typeof mermaid !== 'undefined') return Promise.resolve(mermaid);
    if (mermaidReady) return mermaidReady;
    mermaidReady = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '${MERMAID_CDN}';
      s.onload = function () { resolve(window.mermaid); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return mermaidReady;
  }
  function hydrateMermaidPlaceholders() {
    document.querySelectorAll('.mermaid-placeholder[data-mermaid-src]').forEach(function (el) {
      try {
        var src = atob(el.getAttribute('data-mermaid-src') || '');
        var pre = document.createElement('pre');
        pre.className = 'mermaid';
        pre.setAttribute('data-renoir-mermaid-src', src);
        pre.textContent = src;
        el.replaceWith(pre);
      } catch (e) { /* swallow */ }
    });
  }
  function getMermaidSource(el) {
    var src = el.getAttribute('data-renoir-mermaid-src');
    if (!src) {
      src = (el.textContent || '').trim();
      if (src) el.setAttribute('data-renoir-mermaid-src', src);
    }
    return src || '';
  }
  window.__renoirRunMermaid = function () {
    return ensureMermaid().then(function (mm) {
      hydrateMermaidPlaceholders();
      mm.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
      var nodes = Array.prototype.slice.call(document.querySelectorAll('.mermaid'));
      if (!nodes.length) return;
      return Promise.all(nodes.map(function (el, i) {
        var src = getMermaidSource(el);
        if (!src) return Promise.resolve();
        var id = 'renoir-m-' + i + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        return mm.render(id, src).then(function (out) {
          el.innerHTML = out.svg;
          el.setAttribute('data-renoir-mermaid-src', src);
        }).catch(function () {
          el.textContent = src;
        });
      }));
    });
  };
})();
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
 *   • present — one slide visible at a time; inactive slides hidden
 *   • scroll  — user content untouched
 */
export const NAV_BRIDGE = `
<script>
(function () {
${MOBILE_SIDEBAR_BRIDGE_FN}
${DASHBOARD_BRIDGE_FN}
${DECK_CONTRAST_BRIDGE_FN}
${PICK_BRIDGE_FN}
${SCROLL_SYNC_BRIDGE_FN}
${A11Y_PROBE_BRIDGE_FN}
${FLOW_BRIDGE_FN}
  var STYLE_ID = '__renoir_mode_style';
  var SCROLL_STYLE_ID = '__renoir_scroll_style';
  var SLIDE_CLASS = 'renoir-slide';
  function isSlideEl(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'LINK' || tag === 'META') return false;
    if (el.hasAttribute('data-slide')) return true;
    if (el.classList && el.classList.contains('slide')) return true;
    var parent = el.parentElement;
    if (tag === 'SECTION' && parent && (parent.classList.contains('deck') || parent.id === 'deck')) return true;
    return false;
  }
  function slides() {
    var flowScreens = document.querySelectorAll('[data-screen-id]');
    if (flowScreens.length >= 2) return Array.from(flowScreens);
    var dataSlides = document.querySelectorAll('[data-slide]');
    if (dataSlides.length) return Array.from(dataSlides);
    var deck = document.querySelector('.deck') || document.getElementById('deck');
    if (deck) {
      var deckSlides = Array.from(deck.children).filter(isSlideEl);
      if (deckSlides.length) return deckSlides;
    }
    var byClass = document.querySelectorAll('section.slide, div.slide, article.slide');
    if (byClass.length) return Array.from(byClass);
    var allSections = document.querySelectorAll('section');
    if (allSections.length > 1) return Array.from(allSections);
    return [document.body];
  }
  function resetScroller() {
    try {
      document.body.scrollLeft = 0;
      document.body.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
      document.documentElement.scrollTop = 0;
    } catch (e) { /* swallow */ }
  }
  function neutralizeDeckTrack() {
    ['.deck', '#deck'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      el.style.transform = 'none';
      el.style.transition = 'none';
      el.style.display = 'block';
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.overflow = 'hidden';
      el.style.flexWrap = 'nowrap';
      el.scrollLeft = 0;
    });
    document.body.style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'hidden';
    document.body.style.transform = 'none';
    document.body.style.scrollSnapType = 'none';
    resetScroller();
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
    if (el.dataset.renoirOwned) {
      el.classList.remove(SLIDE_CLASS);
      el.classList.remove('is-active');
      el.style.position = '';
      el.style.top = '';
      el.style.left = '';
      el.style.right = '';
      el.style.bottom = '';
      el.style.width = '';
      el.style.height = '';
      el.style.transform = '';
      el.style.transition = '';
      el.style.overflow = '';
      el.style.boxSizing = '';
      el.style.willChange = '';
      el.removeAttribute('hidden');
      delete el.dataset.renoirOwned;
    }
  }
  function enablePageScroll() {
    var scrollSt = document.getElementById(SCROLL_STYLE_ID);
    if (!scrollSt) {
      scrollSt = document.createElement('style');
      scrollSt.id = SCROLL_STYLE_ID;
      document.head.appendChild(scrollSt);
    }
    if (isDashboardDoc()) {
      applyDashboardContainment();
      return;
    }
    scrollSt.textContent =
      'html,body{margin:0!important;padding:0!important;width:100%!important;max-width:100%!important;' +
      'overflow-x:hidden!important;overflow-y:auto!important;' +
      'height:auto!important;min-height:100%!important;-webkit-overflow-scrolling:touch;box-sizing:border-box!important;}';
  }
  function disablePageScroll() {
    var scrollSt = document.getElementById(SCROLL_STYLE_ID);
    if (scrollSt) scrollSt.textContent = '';
  }
  var HIDE_NAV_CSS =
    '[data-nav],[class*="nav-btn"],[class*="slide-nav"],' +
    'button[onclick*="prev"],button[onclick*="next"],' +
    '.prev-btn,.next-btn,.slide-controls,.navigation,' +
    'a.skip-link,.skip-to-main,.skip-to-content{display:none!important;}';
  var HIDE_DECK_CHROME_CSS =
    '.deck-counter,.deck-hint,.deck-progress,#deck-counter,#deck-progress,#deck-hint,' +
    '#nav,#hint,.deck-nav,.presentation-nav,' +
    'body>.deck-counter,body>.deck-hint,body>.deck-progress,' +
    'body>nav:not([class*="slide"]){display:none!important;visibility:hidden!important;}';
  function applyHorizontal(idx) {
    var list = slides();
    var st = ensureStyle();
    disablePageScroll();
    neutralizeDeckTrack();
    ensureContrastStyles();
    if (list.length === 1 && list[0] === document.body) {
      st.textContent = HIDE_NAV_CSS + HIDE_DECK_CHROME_CSS;
      document.body.setAttribute('data-renoir-mode', 'present-single');
      enablePageScroll();
      parent.postMessage({ type: 'renoir:nav-state', idx: 0, total: 1 }, '*');
      return;
    }
    st.textContent =
      HIDE_NAV_CSS +
      HIDE_DECK_CHROME_CSS +
      'html{margin:0!important;padding:0!important;overflow:hidden!important;height:100%!important;width:100%!important;max-height:100%!important;}' +
      'body[data-renoir-mode="present"]{' +
        'margin:0!important;padding:0!important;display:block!important;overflow:hidden!important;' +
        'height:100%!important;width:100%!important;min-height:100%!important;max-height:100%!important;' +
        'scroll-snap-type:none!important;scroll-behavior:auto!important;position:relative!important;' +
      '}' +
      'body[data-renoir-mode="present"] .deck,body[data-renoir-mode="present"] #deck{' +
        'position:relative!important;transform:none!important;display:block!important;' +
        'height:100%!important;width:100%!important;overflow:hidden!important;' +
      '}' +
      'body[data-renoir-mode="present"] .' + SLIDE_CLASS + '{' +
        'transition:none!important;animation:none!important;' +
        'scroll-snap-align:none!important;' +
      '}' +
      'body[data-renoir-mode="present"] .' + SLIDE_CLASS + '[hidden],' +
      'body[data-renoir-mode="present"] .slide:not(.is-active)[data-renoir-owned="1"]{' +
        'display:none!important;visibility:hidden!important;pointer-events:none!important;' +
        'opacity:0!important;' +
      '}' +
      'body[data-renoir-mode="present"] .slide.is-active,' +
      'body[data-renoir-mode="present"] .' + SLIDE_CLASS + '[data-renoir-active="1"]{' +
        'opacity:1!important;visibility:visible!important;pointer-events:auto!important;' +
        'transform:none!important;z-index:2!important;' +
        'display:flex!important;flex-direction:column!important;' +
        'width:100%!important;height:100%!important;min-height:100%!important;' +
        'overflow:auto!important;box-sizing:border-box!important;' +
      '}';
    document.body.setAttribute('data-renoir-mode', 'present');
    resetScroller();
    list.forEach(function (el, i) {
      el.classList.add(SLIDE_CLASS);
      el.dataset.renoirOwned = '1';
      el.style.transform = '';
      el.style.left = '';
      el.style.top = '';
      if (i === idx) {
        el.classList.add('is-active');
        el.removeAttribute('hidden');
        el.style.display = '';
        el.style.opacity = '';
        el.style.pointerEvents = '';
        el.setAttribute('data-renoir-active', '1');
        applySlideContrast(el);
        revealSlideAnimations(el);
      } else {
        el.classList.remove('is-active');
        el.setAttribute('hidden', '');
        el.removeAttribute('data-renoir-active');
      }
    });
  }
  function applyScroll() {
    var st = ensureStyle();
    st.textContent = '';
    document.body.removeAttribute('data-renoir-mode');
    document.body.style.transform = '';
    enablePageScroll();
    slides().forEach(function (el) {
      clearInline(el);
      el.removeAttribute('data-renoir-active');
    });
  }
  function rerenderCharts() {
    function attempt() {
      if (typeof window.__renoirRunMermaid !== 'function') return;
      Promise.resolve(window.__renoirRunMermaid())
        .then(function () { setTimeout(reportSize, 100); })
        .catch(function () { /* swallow */ });
    }
    setTimeout(attempt, 30);
    setTimeout(attempt, 180);
    setTimeout(attempt, 450);
    setTimeout(attempt, 900);
  }
  function focus(idx, mode) {
    var list = slides();
    var clamped = Math.max(0, Math.min(list.length - 1, idx));
    if (mode === 'present')      applyHorizontal(clamped);
    else                         applyScroll();
    rerenderCharts();
    parent.postMessage({ type: 'renoir:nav-state', idx: clamped, total: list.length }, '*');
    return clamped;
  }
  var activeMode = 'scroll';
  var activeIdx  = 0;
  function navigate(dir, idx) {
    var list = slides();
    if (dir === 'next')          activeIdx = Math.min(list.length - 1, activeIdx + 1);
    else if (dir === 'prev')     activeIdx = Math.max(0, activeIdx - 1);
    else if (typeof idx === 'number') activeIdx = idx;
    activeIdx = focus(activeIdx, activeMode);
  }
  function bootPresentIfDeck() {
    if (document.querySelectorAll('[data-screen-id]').length >= 2) return;
    var list = slides();
    if (list.length > 1 && list[0] !== document.body) {
      activeMode = 'present';
      activeIdx = focus(activeIdx, 'present');
    }
  }
  function swallowNativeDeckKeys(e) {
    if (activeMode !== 'present') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === ' ' ||
        e.key === 'PageDown' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') navigate('next');
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') navigate('prev');
      else if (e.key === 'Home') navigate(null, 0);
      else if (e.key === 'End') navigate(null, 999);
    }
  }
  window.addEventListener('keydown', swallowNativeDeckKeys, true);
  document.addEventListener('keydown', swallowNativeDeckKeys, true);
  function lockScroller() {
    if (activeMode !== 'present' || document.body.getAttribute('data-renoir-mode') !== 'present') return;
    if (document.body.scrollLeft !== 0) document.body.scrollLeft = 0;
    if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
    if (document.documentElement.scrollLeft !== 0) document.documentElement.scrollLeft = 0;
    if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0;
  }
  document.addEventListener('scroll', lockScroller, true);
  window.addEventListener('scroll', lockScroller, true);
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'renoir:set-mode') {
      activeMode = d.mode;
      activeIdx  = focus(activeIdx, activeMode);
    } else if (d.type === 'renoir:nav') {
      navigate(d.dir, d.idx);
    } else if (d.type === 'renoir:probe') {
      var l = slides();
      parent.postMessage({ type: 'renoir:nav-state', idx: activeIdx, total: l.length }, '*');
    } else if (d.type === 'renoir:set-viewport') {
      var vw = Math.max(320, Math.min(2560, Number(d.width) || window.innerWidth));
      var vp = document.querySelector('meta[name="viewport"]');
      if (!vp) {
        vp = document.createElement('meta');
        vp.setAttribute('name', 'viewport');
        document.head.appendChild(vp);
      }
      vp.setAttribute('content', 'width=' + vw + ', initial-scale=1');
      applyMobileSidebar(vw);
      applyDashboardContainment();
      reportSize();
      rerenderCharts();
    } else if (d.type === 'renoir:reload') {
      focus(activeIdx, activeMode);
      applyMobileSidebar(currentViewportWidth());
      applyDashboardContainment();
      rerenderCharts();
      reportSize();
    } else if (d.type === 'renoir:pick-enable') {
      setPickEnabled(true);
    } else if (d.type === 'renoir:pick-disable') {
      setPickEnabled(false);
    } else if (d.type === 'renoir:scroll-sync') {
      applyScrollSync(d.y);
    } else if (d.type === 'renoir:a11y-probe') {
      runA11yProbe();
    } else if (d.type === 'renoir:flow-enable') {
      setFlowEnabled(true);
    } else if (d.type === 'renoir:flow-disable') {
      setFlowEnabled(false);
    } else if (d.type === 'renoir:flow-nav') {
      navigateToScreen(d.screenId);
    }
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('renoir-sidebar-open')) {
      e.preventDefault();
      closeMobileSidebar();
    }
  });
  window.addEventListener('wheel', function (e) {
    if (activeMode !== 'present') return;
    e.preventDefault();
  }, { passive: false });
  function reportSize() {
    if (activeMode !== 'scroll') return;
    var h = Math.max(
      document.documentElement.scrollHeight || 0,
      document.body ? document.body.scrollHeight : 0,
    );
    parent.postMessage({ type: 'renoir:size', height: h }, '*');
  }
  var sizeObserver;
  try {
    sizeObserver = new ResizeObserver(function () { reportSize(); });
    sizeObserver.observe(document.documentElement);
    if (document.body) sizeObserver.observe(document.body);
  } catch (e) { /* swallow */ }
  window.addEventListener('load', function () {
    applyMobileSidebar(currentViewportWidth());
    applyDashboardContainment();
    bootPresentIfDeck();
    reportSize();
  });
  setTimeout(function () { applyMobileSidebar(currentViewportWidth()); applyDashboardContainment(); bootPresentIfDeck(); }, 80);
  setTimeout(bootPresentIfDeck, 200);
  setTimeout(reportSize, 200);
  setInterval(reportSize, 1500);

  setTimeout(function () {
    parent.postMessage({ type: 'renoir:nav-state', idx: 0, total: slides().length }, '*');
  }, 30);
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
    html.includes('pre class="mermaid"') ||
    html.includes('mermaid-placeholder') ||
    html.includes('data-mermaid-src')
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

/** Wrap an artifact body with the nav bridge; idempotent if already wrapped. */
export function wrapWithBridge(html: string): string {
  if (html.includes('id="__renoir_mode_style"') || html.includes('renoir:nav-state')) return html;

  // Inject mermaid support BEFORE the nav bridge
  let result = injectMermaidScript(html);

  // Inject nav bridge before </body> if present, otherwise at the end.
  if (/<\/body>/i.test(result)) return result.replace(/<\/body>/i, `${NAV_BRIDGE}</body>`);
  if (/<\/html>/i.test(result)) return result.replace(/<\/html>/i, `${NAV_BRIDGE}</html>`);
  return result + NAV_BRIDGE;
}
