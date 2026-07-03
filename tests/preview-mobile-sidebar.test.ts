import { describe, it, expect } from 'vitest';
import { MOBILE_SIDEBAR_MAX, MOBILE_SIDEBAR_BRIDGE_FN } from '../src/lib/preview-mobile-sidebar';
import { NAV_BRIDGE } from '../src/lib/preview-modes';

describe('preview-mobile-sidebar', () => {
  it('uses phone-width breakpoint', () => {
    expect(MOBILE_SIDEBAR_MAX).toBe(520);
  });

  it('exports bridge helpers for sidebar detection and toggle', () => {
    expect(MOBILE_SIDEBAR_BRIDGE_FN).toContain('applyMobileSidebar');
    expect(MOBILE_SIDEBAR_BRIDGE_FN).toContain('findSidebar');
    expect(MOBILE_SIDEBAR_BRIDGE_FN).toContain('__renoir_menu_btn');
    expect(MOBILE_SIDEBAR_BRIDGE_FN).toContain('renoir-sidebar-open');
    expect(MOBILE_SIDEBAR_BRIDGE_FN).toContain('renoir:dashboard');
    expect(MOBILE_SIDEBAR_BRIDGE_FN).toContain('.slide');
  });

  it('is wired into the nav bridge viewport handler', () => {
    expect(NAV_BRIDGE).toContain('applyMobileSidebar');
    expect(NAV_BRIDGE).toContain('closeMobileSidebar');
    expect(NAV_BRIDGE).toContain('applyDashboardContainment');
  });
});
