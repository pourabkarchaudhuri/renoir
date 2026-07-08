/** Scroll relay for linked diff panes. */
export const SCROLL_SYNC_BRIDGE_FN = `
  var scrollSyncLock = false;
  var lastScrollPost = 0;
  function onUserScroll() {
    if (scrollSyncLock || activeMode === 'present') return;
    var now = Date.now();
    if (now - lastScrollPost < 32) return;
    lastScrollPost = now;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    parent.postMessage({ type: 'renoir:scroll', y: y }, '*');
  }
  window.addEventListener('scroll', onUserScroll, { passive: true });
  function applyScrollSync(y) {
    scrollSyncLock = true;
    window.scrollTo(0, Math.max(0, Number(y) || 0));
    setTimeout(function () { scrollSyncLock = false; }, 50);
  }
`;
