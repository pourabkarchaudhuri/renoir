/** Device viewport presets for artifact preview (scroll + present modes). */



export type PreviewSurface = 'phone' | 'tablet' | 'desktop' | 'ultrawide';



export interface SurfaceSpec {

  id: PreviewSurface;

  w: number;

  h: number;

  label: string;

}



export const PREVIEW_SURFACES: Record<PreviewSurface, SurfaceSpec> = {

  phone:     { id: 'phone',     w: 390,  h: 844,  label: 'Mobile' },

  tablet:    { id: 'tablet',    w: 820,  h: 1180, label: 'Tablet' },

  desktop:   { id: 'desktop',   w: 1280, h: 800,  label: 'Desktop' },

  ultrawide: { id: 'ultrawide', w: 1920, h: 1080, label: 'Ultrawide' },

};



export const PREVIEW_SURFACE_ORDER: PreviewSurface[] = [

  'phone', 'tablet', 'desktop', 'ultrawide',

];



/** Skills that lock preview to desktop present mode (no device / scroll toggles). */
export function isDesktopOnlyPreview(skillId?: string): boolean {
  return skillId === 'product-deck';
}

/** Device surfaces shown in the preview toolbar for the active skill. */
export function previewSurfacesForSkill(skillId?: string): PreviewSurface[] {
  if (isDesktopOnlyPreview(skillId)) return ['desktop'];
  return PREVIEW_SURFACE_ORDER;
}



/** Breakpoints mirrored in generated dashboard CSS (mobile-first). */
export { DASHBOARD_BREAKPOINTS, DASHBOARD_PREVIEW_WIDTHS } from '@shared/dashboard-layout';



const STORAGE_KEY = 'renoir.previewSurface';



export function loadPreviewSurface(): PreviewSurface {

  try {

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

    if (raw === 'laptop') return 'desktop';
    if (raw && raw in PREVIEW_SURFACES) return raw as PreviewSurface;

  } catch { /* swallow */ }

  return 'desktop';

}



export function savePreviewSurface(surface: PreviewSurface): void {

  try { localStorage.setItem(STORAGE_KEY, surface); } catch { /* swallow */ }

}



/** Device pixel frame for a surface + preview mode. */

export function frameDimensions(

  surface: PreviewSurface,

  mode: 'scroll' | 'present',

): { w: number; h: number } {

  const spec = PREVIEW_SURFACES[surface];

  if (mode === 'present') {

    return { w: spec.w, h: presentHeightForWidth(spec.w) };

  }

  return { w: spec.w, h: spec.h };

}



/**
 * Uniform scale so the device frame fits the preview area without distortion.
 * Pass the container content-box size (e.g. element.clientWidth / clientHeight).
 * Optional `padding` subtracts once per axis for an extra inset when measuring
 * the border box instead of the content box.
 */
export function computePreviewScale(

  containerW: number,

  containerH: number,

  deviceW: number,

  deviceH: number,

  padding = 32,

): number {

  if (containerW < 48 || containerH < 48) return 1;

  const availW = containerW - padding;

  const availH = containerH - padding;

  if (availW <= 0 || availH <= 0) return 1;

  return Math.min(availW / deviceW, availH / deviceH);

}



/** Content-box size of a padded preview container (works for absolute inset-0 layouts). */

export function measurePreviewContainer(el: HTMLElement): { w: number; h: number } {

  const rect = el.getBoundingClientRect();

  const style = getComputedStyle(el);

  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);

  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

  return {

    w: Math.max(0, rect.width - padX),

    h: Math.max(0, rect.height - padY),

  };

}



/** Slide / present mode height for a device width (16:9). */

export function presentHeightForWidth(deviceW: number): number {

  return Math.round(deviceW * 9 / 16);

}



/** Scroll-mode iframe height from content probe or device minimum. */

export function scrollFrameHeight(spec: SurfaceSpec, contentHeight: number | null): number {

  if (contentHeight && contentHeight > 0) {

    return Math.min(40_000, Math.max(spec.h, contentHeight));

  }

  return spec.h;

}



/** Inject or replace viewport meta so responsive CSS matches the device width. */

export function ensureViewportMeta(html: string, width: number): string {

  const w = Math.max(320, Math.min(2560, Math.round(width)));

  const content = `width=${w}, initial-scale=1`;

  const tag = `<meta name="viewport" content="${content}">`;



  if (/<meta[^>]+name=["']viewport["'][^>]*>/i.test(html)) {

    return html.replace(

      /<meta[^>]+name=["']viewport["'][^>]*>/i,

      tag,

    );

  }

  if (/<head[^>]*>/i.test(html)) {

    return html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${tag}`);

  }

  if (/<html[^>]*>/i.test(html)) {

    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${tag}</head>`);

  }

  return `<!doctype html><html><head>${tag}</head><body>${html}</body></html>`;

}


