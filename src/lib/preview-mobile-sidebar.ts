/** Viewport widths at or below this get collapsible sidebar behavior in preview. */
export const MOBILE_SIDEBAR_MAX = 520;

/**
 * Injected into the artifact iframe bridge. Detects sidebars on narrow viewports,
 * collapses them behind a menu button, and opens them full-screen when tapped.
 */
export const MOBILE_SIDEBAR_BRIDGE_FN = `
  var MOBILE_SIDEBAR_MAX = ${MOBILE_SIDEBAR_MAX};
  var MOBILE_SIDEBAR_STYLE_ID = '__renoir_mobile_sidebar_style';

  function findSidebar() {
    if (document.querySelector('.deck, [data-slide], .slide, #deck')) return null;
    var selectors = [
      'body > aside.sidebar', 'body > aside.rail', 'body > aside.sidenav',
      'body > aside[class*="sidebar"]', 'body > aside[class*="rail"]',
      'aside[data-od-id="sidebar"]', 'aside[data-od-id="rail"]',
      'body > .sidebar', 'body > .rail', 'body > .sidenav', 'body > aside',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (!el) continue;
      if (el.classList.contains('notes') || el.closest('.notes')) continue;
      if (el.closest('.deck')) continue;
      return el;
    }
    return null;
  }

  function findMainContent(sidebar) {
    var main = document.querySelector('main');
    if (main) return main;
    if (sidebar && sidebar.nextElementSibling) return sidebar.nextElementSibling;
    return null;
  }

  function closeMobileSidebar() {
    document.body.classList.remove('renoir-sidebar-open');
  }

  function ensureMobileStyles() {
    var st = document.getElementById(MOBILE_SIDEBAR_STYLE_ID);
    if (st) return;
    st = document.createElement('style');
    st.id = MOBILE_SIDEBAR_STYLE_ID;
    st.textContent =
      '#__renoir_menu_btn{display:none;}' +
      'body.renoir-mobile-nav{grid-template-columns:1fr!important;}' +
      'body.renoir-mobile-nav #__renoir_menu_btn{' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'width:40px;height:40px;margin:0 12px 0 0;padding:0;border:1px solid rgba(0,0,0,.12);' +
        'border-radius:8px;background:#fff;font-size:20px;line-height:1;cursor:pointer;flex-shrink:0;' +
        'box-shadow:0 1px 2px rgba(0,0,0,.06);' +
      '}' +
      'body.renoir-mobile-nav .renoir-mobile-main{grid-column:1/-1!important;width:100%!important;max-width:none!important;}' +
      'body.renoir-mobile-nav:not(.renoir-sidebar-open) .renoir-mobile-sidebar{' +
        'display:none!important;' +
      '}' +
      'body.renoir-mobile-nav.renoir-sidebar-open .renoir-mobile-sidebar{' +
        'display:block!important;position:fixed!important;inset:0!important;' +
        'width:100%!important;height:100%!important;max-width:none!important;' +
        'z-index:10001!important;margin:0!important;overflow:auto!important;' +
        'box-sizing:border-box!important;-webkit-overflow-scrolling:touch;' +
      '}' +
      '#__renoir_sidebar_backdrop{display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);}' +
      'body.renoir-sidebar-open #__renoir_sidebar_backdrop{display:block;}' +
      '#__renoir_sidebar_close{display:none;}' +
      'body.renoir-mobile-nav #__renoir_sidebar_close{' +
        'display:block;position:absolute;top:12px;right:12px;z-index:2;' +
        'width:40px;height:40px;border:none;border-radius:8px;background:rgba(0,0,0,.06);' +
        'font-size:28px;line-height:1;cursor:pointer;' +
      '}' +
      'body.renoir-mobile-nav .topbar,body.renoir-mobile-nav header[data-od-id="topbar"]{' +
        'display:flex;align-items:center;flex-wrap:wrap;gap:8px;' +
      '}';
    document.head.appendChild(st);
  }

  function teardownMobileSidebar(sidebar) {
    document.body.classList.remove('renoir-mobile-nav', 'renoir-sidebar-open');
    if (sidebar) sidebar.classList.remove('renoir-mobile-sidebar');
    var main = document.querySelector('.renoir-mobile-main');
    if (main) main.classList.remove('renoir-mobile-main');
    ['__renoir_menu_btn', '__renoir_sidebar_backdrop', '__renoir_sidebar_close'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  function applyMobileSidebar(viewportW) {
    if (document.querySelector('meta[name="renoir:dashboard"]')) {
      teardownMobileSidebar(findSidebar());
      return;
    }
    var mobile = viewportW <= MOBILE_SIDEBAR_MAX;
    var sidebar = findSidebar();
    if (!mobile || !sidebar) {
      teardownMobileSidebar(sidebar);
      return;
    }

    ensureMobileStyles();
    sidebar.classList.add('renoir-mobile-sidebar');

    if (!document.getElementById('__renoir_sidebar_close')) {
      var closeBtn = document.createElement('button');
      closeBtn.id = '__renoir_sidebar_close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close menu');
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeMobileSidebar();
      });
      sidebar.insertBefore(closeBtn, sidebar.firstChild);
    }

    var main = findMainContent(sidebar);
    if (main) main.classList.add('renoir-mobile-main');

    var btn = document.getElementById('__renoir_menu_btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = '__renoir_menu_btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Open menu');
      btn.innerHTML = '&#9776;';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.add('renoir-sidebar-open');
      });
    }

    var menuHost = main
      ? (main.querySelector('.topbar, header, [data-od-id="topbar"]') || main)
      : document.body;
    if (btn.parentElement !== menuHost) {
      menuHost.insertBefore(btn, menuHost.firstChild);
    }

    var backdrop = document.getElementById('__renoir_sidebar_backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = '__renoir_sidebar_backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.addEventListener('click', closeMobileSidebar);
      document.body.appendChild(backdrop);
    }

    document.body.classList.add('renoir-mobile-nav');
    if (!document.body.classList.contains('renoir-sidebar-open')) {
      closeMobileSidebar();
    }
  }

  function currentViewportWidth() {
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      var m = (vp.getAttribute('content') || '').match(/width\\s*=\\s*(\\d+)/i);
      if (m) return parseInt(m[1], 10);
    }
    return window.innerWidth || document.documentElement.clientWidth || 1280;
  }
`;
