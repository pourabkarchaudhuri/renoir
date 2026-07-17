/** Live iframe accessibility probe — computed contrast, focus order, headings. */
export const A11Y_PROBE_BRIDGE_FN = `
  function parseRgb(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
    var m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  function relLum(c) {
    var rs = c.r / 255, gs = c.g / 255, bs = c.b / 255;
    var r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    var g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    var b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(fg, bg) {
    var l1 = relLum(fg), l2 = relLum(bg);
    var lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  function selectorHint(el) {
    if (el.id) return '#' + el.id;
    if (el.getAttribute('data-od-id')) return '[data-od-id="' + el.getAttribute('data-od-id') + '"]';
    if (el.getAttribute('data-screen-id')) return '[data-screen-id="' + el.getAttribute('data-screen-id') + '"]';
    return el.tagName.toLowerCase();
  }
  function runA11yProbe() {
    var contrasts = [];
    var seen = 0;
    var nodes = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, button, label, span, li, td, th');
    for (var i = 0; i < nodes.length && seen < 40; i++) {
      var el = nodes[i];
      if (!el.offsetParent && el.tagName !== 'BODY') continue;
      var text = (el.textContent || '').trim();
      if (text.length < 2) continue;
      var cs = getComputedStyle(el);
      var fg = parseRgb(cs.color);
      var bg = parseRgb(cs.backgroundColor);
      if (!fg) continue;
      if (!bg || (bg.r === 0 && bg.g === 0 && bg.b === 0)) {
        var p = el.parentElement;
        while (p && p !== document.body) {
          bg = parseRgb(getComputedStyle(p).backgroundColor);
          if (bg && !(bg.r === 0 && bg.g === 0 && bg.b === 0)) break;
          p = p.parentElement;
        }
      }
      if (!bg) bg = { r: 255, g: 255, b: 255 };
      var ratio = contrastRatio(fg, bg);
      seen++;
      contrasts.push({
        selector: selectorHint(el),
        ratio: Math.round(ratio * 100) / 100,
        fg: cs.color,
        bg: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')',
        passesAA: ratio >= 4.5,
      });
    }
    var focusables = [];
    var focusEls = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
    for (var j = 0; j < focusEls.length && j < 30; j++) {
      var fe = focusEls[j];
      focusables.push({
        selector: selectorHint(fe),
        tabIndex: fe.tabIndex || 0,
      });
    }
    var headings = [];
    var hs = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (var k = 0; k < hs.length && k < 20; k++) {
      headings.push({
        level: parseInt(hs[k].tagName.slice(1), 10),
        text: (hs[k].textContent || '').trim().slice(0, 80),
      });
    }
    parent.postMessage({
      type: 'renoir:a11y-report',
      contrasts: contrasts,
      focusables: focusables,
      headings: headings,
    }, '*');
  }
`;
