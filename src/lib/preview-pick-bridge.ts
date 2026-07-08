/** Point-and-edit bridge — pick regions tagged with data-od-id. */
export const PICK_BRIDGE_FN = `
  var pickEnabled = false;
  var pickStyleId = '__renoir_pick_style';
  var pickHovered = null;
  function ensurePickStyle() {
    var st = document.getElementById(pickStyleId);
    if (!st) {
      st = document.createElement('style');
      st.id = pickStyleId;
      document.head.appendChild(st);
    }
    st.textContent = '[data-od-id].renoir-pick-hover{outline:2px solid #f97316!important;outline-offset:2px!important;cursor:crosshair!important}';
    return st;
  }
  function nearestOdId(el) {
    while (el && el !== document.body) {
      if (el.nodeType === 1 && el.hasAttribute && el.hasAttribute('data-od-id')) return el;
      el = el.parentElement;
    }
    return null;
  }
  function onPickMove(e) {
    if (!pickEnabled || activeMode === 'present') return;
    var t = nearestOdId(e.target);
    if (pickHovered && pickHovered !== t) pickHovered.classList.remove('renoir-pick-hover');
    pickHovered = t;
    if (t) t.classList.add('renoir-pick-hover');
  }
  function onPickClick(e) {
    if (!pickEnabled || activeMode === 'present') return;
    var t = nearestOdId(e.target);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    var odId = t.getAttribute('data-od-id');
    var rect = t.getBoundingClientRect();
    var textPreview = (t.textContent || '').trim().slice(0, 120);
    parent.postMessage({
      type: 'renoir:picked',
      odId: odId,
      tag: t.tagName,
      textPreview: textPreview,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    }, '*');
  }
  function setPickEnabled(on) {
    pickEnabled = !!on;
    ensurePickStyle();
    if (pickEnabled) {
      document.addEventListener('mousemove', onPickMove, true);
      document.addEventListener('click', onPickClick, true);
      document.body.style.cursor = 'crosshair';
    } else {
      document.removeEventListener('mousemove', onPickMove, true);
      document.removeEventListener('click', onPickClick, true);
      document.body.style.cursor = '';
      if (pickHovered) pickHovered.classList.remove('renoir-pick-hover');
      pickHovered = null;
    }
  }
`;
