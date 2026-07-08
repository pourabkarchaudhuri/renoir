/** Click-through prototype navigation via data-goto / data-screen-id. */
export const FLOW_BRIDGE_FN = `
  var flowEnabled = false;
  var flowStyleId = '__renoir_flow_style';
  function ensureFlowStyle() {
    var st = document.getElementById(flowStyleId);
    if (!st) {
      st = document.createElement('style');
      st.id = flowStyleId;
      document.head.appendChild(st);
    }
    st.textContent = '[data-goto]{cursor:pointer!important}[data-screen-id].renoir-flow-active,[data-od-id].renoir-flow-active{outline:2px solid #3b82f6!important;outline-offset:2px!important}';
    return st;
  }
  function screenLabel(el) {
    return el.getAttribute('data-screen-label') ||
      (el.querySelector('h1,h2,h3') && el.querySelector('h1,h2,h3').textContent.trim().slice(0, 60)) ||
      el.getAttribute('data-screen-id') ||
      el.getAttribute('data-od-id') ||
      'Screen';
  }
  function findScreen(id) {
    if (!id) return null;
    return document.querySelector('[data-screen-id="' + id + '"]') ||
      document.querySelector('[data-od-id="' + id + '"]');
  }
  function activateScreen(el) {
    if (!el) return;
    document.querySelectorAll('.renoir-flow-active').forEach(function (n) {
      n.classList.remove('renoir-flow-active');
    });
    el.classList.add('renoir-flow-active');
    if (el.hasAttribute('data-screen-id') && typeof activeMode !== 'undefined' && activeMode === 'present') {
      activeMode = 'scroll';
      applyScroll();
    }
    var targetTop = el.getBoundingClientRect().top +
      (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
    window.scrollTo({ top: Math.max(0, Math.round(targetTop)), left: 0, behavior: 'auto' });
    try {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    } catch (e) { /* swallow */ }
    var sid = el.getAttribute('data-screen-id') || el.getAttribute('data-od-id') || '';
    parent.postMessage({
      type: 'renoir:flow-screen',
      screenId: sid,
      label: screenLabel(el),
    }, '*');
  }
  function navigateToScreen(screenId) {
    if (!screenId) return;
    if (screenId.indexOf('slide-') === 0) {
      var idx = parseInt(screenId.slice(6), 10);
      if (!isNaN(idx)) {
        navigate(null, idx);
        parent.postMessage({
          type: 'renoir:flow-screen',
          screenId: screenId,
          label: 'Slide ' + (idx + 1),
        }, '*');
        return;
      }
    }
    var el = findScreen(screenId);
    if (el && el.hasAttribute('data-screen-id') && typeof activeMode !== 'undefined' && activeMode === 'present') {
      activeMode = 'scroll';
      applyScroll();
    }
    if (el) activateScreen(el);
  }
  function onFlowClick(e) {
    if (!flowEnabled || activeMode === 'present') return;
    var t = e.target;
    while (t && t !== document.body) {
      if (t.nodeType === 1 && t.hasAttribute && t.hasAttribute('data-goto')) {
        e.preventDefault();
        e.stopPropagation();
        navigateToScreen(t.getAttribute('data-goto'));
        return;
      }
      t = t.parentElement;
    }
  }
  function setFlowEnabled(on) {
    flowEnabled = !!on;
    ensureFlowStyle();
    if (flowEnabled) {
      document.addEventListener('click', onFlowClick, true);
    } else {
      document.removeEventListener('click', onFlowClick, true);
      document.querySelectorAll('.renoir-flow-active').forEach(function (n) {
        n.classList.remove('renoir-flow-active');
      });
    }
  }
`;
