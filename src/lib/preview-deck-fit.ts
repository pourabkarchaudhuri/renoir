/**
 * Present-mode deck fit helpers — injected into the artifact iframe bridge.
 * Pins slides to the preview viewport and scales overflowing content to fit.
 */
export const DECK_FIT_BRIDGE_FN = `
  function measureChrome(slide) {
    if (!slide) return { top: 0, bottom: 0 };
    var footer = slide.querySelector('.deck-footer');
    var bottom = footer ? Math.ceil(footer.getBoundingClientRect().height) + 16 : 0;
    return { top: 0, bottom: bottom };
  }
  function fitSlide(slide) {
    if (!slide) return;
    var chrome = measureChrome(slide);
    slide.style.setProperty('--renoir-chrome-top', chrome.top + 'px');
    slide.style.setProperty('--renoir-chrome-bottom', chrome.bottom + 'px');
    var footer = slide.querySelector('.deck-footer');
    if (footer) footer.classList.add('renoir-footer-fixed');
    var root = slide.querySelector('[data-renoir-fit-root]') || slide;
    if (root === slide) root.setAttribute('data-renoir-fit-root', '1');
    root.style.zoom = '1';
    var maxH = slide.clientHeight - chrome.bottom;
    if (maxH < 48) return;
    if (root.scrollHeight > maxH + 2) {
      var z = maxH / root.scrollHeight;
      root.style.zoom = String(Math.max(0.55, Math.min(1, z)));
    }
  }
  function fitActiveSlide() {
    if (document.body.getAttribute('data-renoir-mode') !== 'present') return;
    var active = document.querySelector(
      'body[data-renoir-mode="present"] .slide.is-active,' +
      'body[data-renoir-mode="present"] .renoir-slide[data-renoir-active="1"]'
    );
    if (active) fitSlide(active);
  }
  function pinPresentSlide(el) {
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    el.style.right = '0';
    el.style.bottom = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.maxWidth = '100%';
    el.style.maxHeight = '100%';
    el.style.margin = '0';
    el.style.boxSizing = 'border-box';
    el.style.transform = 'none';
  }
  function scheduleFitActiveSlide() {
    fitActiveSlide();
    setTimeout(fitActiveSlide, 50);
    setTimeout(fitActiveSlide, 200);
    setTimeout(fitActiveSlide, 500);
  }
  try {
    var fitObserver = new ResizeObserver(function () { fitActiveSlide(); });
    window.addEventListener('load', function () {
      if (document.body) fitObserver.observe(document.body);
    });
  } catch (e) { /* swallow */ }
`;
