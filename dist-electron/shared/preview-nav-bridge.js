/**
 * Shared HTML wrapping for artifact preview / export capture.
 * Full NAV_BRIDGE lives in the renderer (preview-modes.ts); export uses a minimal present-mode bridge.
 */
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
/** Snap active slide animations to their final visible frame before raster export. */
export const EXPORT_SLIDE_FREEZE_FN = `
  var FREEZE_STYLE_ID = '__renoir_export_freeze_style';
  function activeSlideEl() {
    return document.querySelector(
      'body[data-renoir-mode="present"] .slide.is-active,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"]'
    );
  }
  function freezeAnimatedEl(el) {
    el.style.setProperty('animation', 'none', 'important');
    el.style.setProperty('animation-delay', '0s', 'important');
    el.style.setProperty('transition', 'none', 'important');
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('filter', 'none', 'important');
    el.style.setProperty('-webkit-filter', 'none', 'important');
    el.style.setProperty('clip-path', 'none', 'important');
    el.style.setProperty('-webkit-clip-path', 'none', 'important');
    if (el.classList.contains('anim-typewriter')) {
      el.style.width = 'auto';
      el.style.borderRight = 'none';
      el.style.whiteSpace = 'normal';
    }
    el.querySelectorAll('path,line,polyline,circle,rect').forEach(function (path) {
      path.style.strokeDashoffset = '0';
    });
  }
  function ensureFreezeStyles() {
    var st = document.getElementById(FREEZE_STYLE_ID);
    if (st) return st;
    st = document.createElement('style');
    st.id = FREEZE_STYLE_ID;
    st.textContent =
      'body[data-renoir-mode="present"] .slide.is-active,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"],' +
      'body[data-renoir-mode="present"] .slide.is-active *,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] *{' +
        'animation:none!important;animation-delay:0s!important;transition:none!important;' +
      '}' +
      'body[data-renoir-mode="present"] .slide.is-active [class*="anim-"],' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] [class*="anim-"],' +
      'body[data-renoir-mode="present"] .slide.is-active .anim-stagger-list > *,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .anim-stagger-list > *{' +
        'opacity:1!important;visibility:visible!important;' +
        'transform:none!important;filter:none!important;clip-path:none!important;' +
      '}';
    document.head.appendChild(st);
    return st;
  }
  function freezeActiveSlideForCapture() {
    ensureFreezeStyles();
    var slide = activeSlideEl();
    if (!slide) return;
    freezeAnimatedEl(slide);
    slide.querySelectorAll('[class*="anim-"], .anim-stagger-list > *, [data-anim]').forEach(freezeAnimatedEl);
    slide.querySelectorAll('.kicker,.h1,.h2,.h3,.h4,.lede,p,li,h1,h2,h3,h4').forEach(function (el) {
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
    });
  }
`;
/** One-shot script for offscreen capture — works with any nav bridge. */
export const EXPORT_CAPTURE_FREEZE_SCRIPT = `(function () {
  if (typeof freezeActiveSlideForCapture === 'function') {
    freezeActiveSlideForCapture();
    return;
  }
  ${EXPORT_SLIDE_FREEZE_FN}
  freezeActiveSlideForCapture();
})();`;
/** Deck contrast + export capture freeze helpers (matches preview-deck-contrast bridge). */
const EXPORT_DECK_CONTRAST_FN = `
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
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .kicker,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .h1,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .h2,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .h3,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .h4,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] .lede,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] p,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"] li{' +
        'opacity:1!important;visibility:visible!important;color:inherit;' +
      '}';
    document.head.appendChild(st);
    return st;
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
  }
  function applySlideContrast(slide) {
    if (!slide || slide === document.body) return;
    ensureContrastStyles();
  }
${EXPORT_SLIDE_FREEZE_FN}
`;
/** Post this in the export capture window to snap the active slide to its final frame. */
export const EXPORT_CAPTURE_FREEZE_MESSAGE = 'renoir:freeze-capture';
/**
 * Minimal present-mode nav bridge for offscreen export capture.
 * Supports renoir:set-mode / renoir:nav without parent iframe chrome.
 */
export const EXPORT_PRESENT_NAV_BRIDGE = `
<script>
(function () {
${EXPORT_DECK_CONTRAST_FN}
  var STYLE_ID = '__renoir_mode_style';
  var SLIDE_CLASS = 'renoir-slide';
  function isSlideEl(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hasAttribute('data-slide')) return true;
    if (el.classList && el.classList.contains('slide')) return true;
    var parent = el.parentElement;
    if (el.tagName === 'SECTION' && parent && (parent.classList.contains('deck') || parent.id === 'deck')) return true;
    return false;
  }
  function slides() {
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
  function neutralizeDeckTrack() {
    ['.deck', '#deck'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      el.style.transform = 'none';
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.overflow = 'hidden';
    });
    document.body.style.overflow = 'hidden';
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
  function applyHorizontal(idx) {
    var list = slides();
    var st = ensureStyle();
    neutralizeDeckTrack();
    ensureContrastStyles();
    st.textContent =
      'html,body{margin:0!important;padding:0!important;overflow:hidden!important;height:100%!important;width:100%!important;}' +
      'body[data-renoir-mode="present"] .deck,body[data-renoir-mode="present"] #deck{' +
        'position:relative!important;height:100%!important;width:100%!important;overflow:hidden!important;' +
      '}' +
      'body[data-renoir-mode="present"] .' + SLIDE_CLASS + '{' +
        'transition:none!important;animation:none!important;' +
      '}' +
      'body[data-renoir-mode="present"] .slide:not(.is-active)[data-renoir-owned="1"],' +
      'body[data-renoir-mode="present"] .' + SLIDE_CLASS + '[hidden]{' +
        'display:none!important;visibility:hidden!important;opacity:0!important;' +
      '}' +
      'body[data-renoir-mode="present"] .slide.is-active,' +
      'body[data-renoir-mode="present"] .' + SLIDE_CLASS + '[data-renoir-active="1"]{' +
        'opacity:1!important;visibility:visible!important;transform:none!important;' +
        'display:flex!important;flex-direction:column!important;' +
        'width:100%!important;height:100%!important;min-height:100%!important;' +
        'overflow:auto!important;box-sizing:border-box!important;' +
      '}';
    document.body.setAttribute('data-renoir-mode', 'present');
    list.forEach(function (el, i) {
      el.classList.add(SLIDE_CLASS);
      el.dataset.renoirOwned = '1';
      if (i === idx) {
        el.classList.add('is-active');
        el.removeAttribute('hidden');
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
  function focus(idx, mode) {
    var list = slides();
    var clamped = Math.max(0, Math.min(list.length - 1, idx));
    if (mode === 'present') applyHorizontal(clamped);
    return clamped;
  }
  var activeMode = 'scroll';
  var activeIdx = 0;
  function navigate(dir, idx) {
    if (dir === 'next') activeIdx = Math.min(slides().length - 1, activeIdx + 1);
    else if (dir === 'prev') activeIdx = Math.max(0, activeIdx - 1);
    else if (typeof idx === 'number') activeIdx = idx;
    activeIdx = focus(activeIdx, activeMode);
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'renoir:set-mode') {
      activeMode = d.mode;
      activeIdx = focus(activeIdx, activeMode);
    } else if (d.type === 'renoir:nav') {
      navigate(d.dir, d.idx);
    } else if (d.type === '${EXPORT_CAPTURE_FREEZE_MESSAGE}') {
      freezeActiveSlideForCapture();
    }
  });
  setTimeout(function () {
    activeMode = 'present';
    focus(0, 'present');
  }, 50);
})();
</script>`;
export function hasMermaidContent(html) {
    return (html.includes('class="mermaid"') ||
        html.includes("class='mermaid'") ||
        html.includes('pre class="mermaid"') ||
        html.includes('mermaid-placeholder') ||
        html.includes('data-mermaid-src'));
}
export function injectMermaidScript(html) {
    if (html.includes('mermaid.min.js') || html.includes('mermaid.esm'))
        return html;
    if (!hasMermaidContent(html))
        return html;
    if (/<\/head>/i.test(html))
        return html.replace(/<\/head>/i, `${MERMAID_INIT_SCRIPT}\n</head>`);
    if (/<\/body>/i.test(html))
        return html.replace(/<\/body>/i, `${MERMAID_INIT_SCRIPT}\n</body>`);
    return html + '\n' + MERMAID_INIT_SCRIPT;
}
/** Wrap artifact HTML with a nav bridge script; idempotent if already wrapped. */
export function wrapWithBridge(html, navBridge) {
    if (html.includes('id="__renoir_mode_style"')
        || html.includes('__renoir_mode_style')
        || html.includes('renoir:nav-state')) {
        return html;
    }
    const result = injectMermaidScript(html);
    if (/<\/body>/i.test(result))
        return result.replace(/<\/body>/i, `${navBridge}</body>`);
    if (/<\/html>/i.test(result))
        return result.replace(/<\/html>/i, `${navBridge}</html>`);
    return result + navBridge;
}
/** Bridge-wrapped HTML for offscreen deck export capture. */
export function wrapForExportCapture(html) {
    return wrapWithBridge(html, EXPORT_PRESENT_NAV_BRIDGE);
}
