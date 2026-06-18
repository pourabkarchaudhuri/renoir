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
export const NAV_BRIDGE = `
<script>
(function () {
  var STYLE_ID = '__renoir_mode_style';
  function slides() {
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
  // Inline-style flags so we can clean up on mode change without nuking
  // user styles: tag attributes we set so we know what to strip.
  function clearInline(el) {
    if (el.dataset.renoirOwned) {
      el.style.position = '';
      el.style.top = '';
      el.style.left = '';
      el.style.width = '';
      el.style.height = '';
      el.style.transform = '';
      el.style.transition = '';
      el.style.overflow = '';
      el.style.boxSizing = '';
      el.style.willChange = '';
      delete el.dataset.renoirOwned;
    }
  }
  function applyHorizontal(idx) {
    var list = slides();
    var st = ensureStyle();
    // Hide any in-artifact navigation buttons (LLMs often generate these)
    // and force one-slide-at-a-time layout.
    st.textContent =
      'html,body{margin:0;padding:0;overflow:hidden;height:100vh;width:100vw;background:white;}' +
      '[data-nav],[class*="nav-btn"],[class*="slide-nav"],' +
      'button[onclick*="prev"],button[onclick*="next"],' +
      '.prev-btn,.next-btn,.slide-controls,.navigation{display:none!important;}' +
      'body[data-renoir-mode="present"] section,' +
      'body[data-renoir-mode="present"] [data-slide]{' +
        'position:fixed!important;top:0!important;left:0!important;' +
        'width:100vw!important;height:100vh!important;margin:0!important;' +
        'box-sizing:border-box!important;overflow:auto!important;' +
        'transition:transform 380ms cubic-bezier(0.16,1,0.3,1)!important;' +
        'will-change:transform;' +
      '}';
    document.body.setAttribute('data-renoir-mode', 'present');
    list.forEach(function (el, i) {
      el.dataset.renoirOwned = '1';
      el.style.transform = 'translateX(' + ((i - idx) * 100) + 'vw)';
      el.removeAttribute('data-renoir-active');
      if (i === idx) el.setAttribute('data-renoir-active', '1');
    });
  }
  function applyScroll() {
    var st = ensureStyle();
    st.textContent = '';
    document.body.removeAttribute('data-renoir-mode');
    slides().forEach(function (el) {
      clearInline(el);
      el.removeAttribute('data-renoir-active');
    });
  }
  function focus(idx, mode) {
    var list = slides();
    var clamped = Math.max(0, Math.min(list.length - 1, idx));
    if (mode === 'present')      applyHorizontal(clamped);
    else                         applyScroll();
    parent.postMessage({ type: 'renoir:nav-state', idx: clamped, total: list.length }, '*');
    return clamped;
  }
  var activeMode = 'scroll';
  var activeIdx  = 0;
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'renoir:set-mode') {
      activeMode = d.mode;
      activeIdx  = focus(activeIdx, activeMode);
    } else if (d.type === 'renoir:nav') {
      var list = slides();
      if (d.dir === 'next')          activeIdx = Math.min(list.length - 1, activeIdx + 1);
      else if (d.dir === 'prev')     activeIdx = Math.max(0, activeIdx - 1);
      else if (typeof d.idx === 'number') activeIdx = d.idx;
      activeIdx = focus(activeIdx, activeMode);
    } else if (d.type === 'renoir:probe') {
      var l = slides();
      parent.postMessage({ type: 'renoir:nav-state', idx: activeIdx, total: l.length }, '*');
    }
  });
  // Optional: arrow keys inside the iframe also navigate (when focused).
  window.addEventListener('keydown', function (e) {
    if (activeMode !== 'present') return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault(); parent.postMessage({ type: 'renoir:nav', dir: 'next' }, '*');
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault(); parent.postMessage({ type: 'renoir:nav', dir: 'prev' }, '*');
    }
  });
  // Continuously announce content size in scroll mode so the parent can
  // grow the iframe to fit (no inner scrollbar — outer container scrolls).
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
  window.addEventListener('load', reportSize);
  setTimeout(reportSize, 200);
  setInterval(reportSize, 1500);

  // First paint — announce so the parent knows totals immediately.
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
