import { describe, it, expect } from 'vitest';
import {
  PREVIEW_SURFACES,
  PREVIEW_SURFACE_ORDER,
  computePreviewScale,
  ensureViewportMeta,
  frameDimensions,
  isDesktopOnlyPreview,
  measurePreviewContainer,
  presentHeightForWidth,
  previewSurfacesForSkill,
  scrollFrameHeight,
} from '../src/lib/preview-surfaces';

describe('preview-surfaces', () => {
  it('defines four device widths', () => {
    expect(PREVIEW_SURFACE_ORDER).toEqual(['phone', 'tablet', 'desktop', 'ultrawide']);
    expect(PREVIEW_SURFACES.phone.w).toBe(390);
    expect(PREVIEW_SURFACES.tablet.w).toBe(820);
    expect(PREVIEW_SURFACES.desktop.w).toBe(1280);
    expect(PREVIEW_SURFACES.ultrawide.w).toBe(1920);
  });

  it('computePreviewScale fits within container and preserves device ratio', () => {
    const deviceW = 390;
    const deviceH = 844;
    const scale = computePreviewScale(400, 900, deviceW, deviceH);
    expect(scale).toBeGreaterThan(0.1);
    expect(deviceW * scale).toBeLessThanOrEqual(400);
    expect(deviceH * scale).toBeLessThanOrEqual(900);
    expect((deviceW * scale) / (deviceH * scale)).toBeCloseTo(deviceW / deviceH, 5);
  });

  it('computePreviewScale fills content box when aspect ratios match', () => {
    const scale = computePreviewScale(640, 400, 1280, 800, 0);
    expect(scale).toBeCloseTo(0.5, 5);
    expect(1280 * scale).toBeCloseTo(640, 1);
    expect(800 * scale).toBeCloseTo(400, 1);
  });

  it('computePreviewScale uses full client area without extra padding', () => {
    const scale = computePreviewScale(536, 636, 1280, 800, 0);
    expect(scale).toBeCloseTo(0.41875, 4);
    expect(1280 * scale).toBeLessThanOrEqual(536);
    expect(800 * scale).toBeLessThanOrEqual(636);
  });

  it('computePreviewScale returns 1 when container not measured yet', () => {
    expect(computePreviewScale(0, 0, 1280, 800)).toBe(1);
  });

  it('measurePreviewContainer subtracts padding from border box', () => {
    const el = {
      getBoundingClientRect: () => ({ width: 600, height: 500, top: 0, left: 0, right: 600, bottom: 500 }),
    } as HTMLElement;
    const original = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () =>
      ({ paddingLeft: '32px', paddingRight: '32px', paddingTop: '32px', paddingBottom: '32px' }) as CSSStyleDeclaration;
    try {
      expect(measurePreviewContainer(el)).toEqual({ w: 536, h: 436 });
    } finally {
      globalThis.getComputedStyle = original;
    }
  });

  it('ensureViewportMeta injects width-specific viewport', () => {
    const html = '<!doctype html><html><head></head><body>hi</body></html>';
    const out = ensureViewportMeta(html, 390);
    expect(out).toContain('width=390');
    expect(out).toContain('initial-scale=1');
  });

  it('ensureViewportMeta supports ultrawide widths', () => {
    const html = '<!doctype html><html><head></head><body></body></html>';
    const out = ensureViewportMeta(html, 1920);
    expect(out).toContain('width=1920');
  });

  it('ensureViewportMeta replaces existing viewport', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width"></head><body></body></html>';
    const out = ensureViewportMeta(html, 820);
    expect(out).toContain('width=820');
    expect(out).not.toContain('device-width');
  });

  it('presentHeightForWidth uses 16:9', () => {
    expect(presentHeightForWidth(1280)).toBe(720);
  });

  it('scrollFrameHeight respects content probe', () => {
    expect(scrollFrameHeight(PREVIEW_SURFACES.phone, 1200)).toBe(1200);
    expect(scrollFrameHeight(PREVIEW_SURFACES.phone, null)).toBe(844);
  });

  it('frameDimensions uses 16:9 for present mode', () => {
    expect(frameDimensions('desktop', 'present')).toEqual({ w: 1280, h: 720 });
    expect(frameDimensions('phone', 'scroll')).toEqual({ w: 390, h: 844 });
  });

  it('product-deck locks preview to desktop only', () => {
    expect(isDesktopOnlyPreview('product-deck')).toBe(true);
    expect(isDesktopOnlyPreview('pitch-deck')).toBe(false);
    expect(previewSurfacesForSkill('product-deck')).toEqual(['desktop']);
    expect(previewSurfacesForSkill('dashboard')).toEqual(PREVIEW_SURFACE_ORDER);
  });
});
