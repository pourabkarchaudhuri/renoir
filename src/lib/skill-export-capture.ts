import type { CaptureMode, CaptureSurface, ExportFormat } from '@shared/export/types';
import { PREVIEW_SURFACES, ensureViewportMeta, presentHeightForWidth } from '@/lib/preview-surfaces';
import { wrapWithBridge } from '@/lib/preview-modes';
import { parseFlowScreens } from '@/lib/flow-screens';
import { countDeckSlides } from '@/lib/preview-deck-contrast';
import { enrichProductDeckHtml, PRODUCT_DECK_SLIDE_COUNT } from '@/lib/product-deck-content';

export interface CaptureProfile {
  mode: CaptureMode;
  width: number;
  height: number;
  surface: CaptureSurface;
  slideCount?: number;
}

const DECK_SKILL_IDS = new Set(['product-deck', 'pitch-deck', 'all-hands-deck']);

const DOC_SKILL_IDS = new Set([
  'blog-post', 'one-pager', 'case-study', 'job-listing', 'invoice', 'receipt',
  'pm-spec', 'rfc', 'resume', 'newsletter', 'style-guide',
]);

const MOBILE_SKILL_IDS = new Set([
  'mobile-app', 'mobile-onboarding', 'mobile-settings',
]);

const MEDIA_SKILL_IDS = new Set([
  'email-template', 'social-card', 'menu-card', 'wedding-invite',
]);

const RASTER_FORMATS = new Set<ExportFormat>(['pdf', 'png', 'pptx']);

const SKILL_FORMAT_OVERRIDES: Record<string, ExportFormat[]> = {
  'product-deck': ['pptx'],
  'pitch-deck': ['pdf', 'pptx'],
  'all-hands-deck': ['pdf', 'pptx'],
  'saas-landing': ['pdf'],
  'dashboard': ['pdf'],
  'social-card': ['png'],
  'email-template': ['png'],
  'menu-card': ['pdf', 'png'],
  'wedding-invite': ['pdf', 'png'],
  'system-diagram': ['pdf', 'png'],
};

export function isDeckSkill(skillId?: string): boolean {
  return Boolean(skillId && DECK_SKILL_IDS.has(skillId));
}

export function exportFormatsForSkill(skillId?: string): ExportFormat[] {
  if (skillId && SKILL_FORMAT_OVERRIDES[skillId]) {
    return SKILL_FORMAT_OVERRIDES[skillId];
  }
  if (skillId && DOC_SKILL_IDS.has(skillId)) {
    return ['pdf', 'docx', 'markdown'];
  }
  if (skillId && MOBILE_SKILL_IDS.has(skillId)) {
    return ['pdf', 'png'];
  }
  if (skillId && MEDIA_SKILL_IDS.has(skillId)) {
    return ['png'];
  }
  if (skillId && isDeckSkill(skillId)) {
    return ['pdf', 'pptx'];
  }
  // Default web and unknown skills
  return ['pdf'];
}

export function usesRasterCapture(formats: ExportFormat[]): boolean {
  return formats.some((f) => RASTER_FORMATS.has(f));
}

function resolvePresentSlideCount(skillId: string, html: string, productName: string): number {
  if (skillId === 'product-deck') {
    return enrichProductDeckHtml(html, { productName, finalize: true }).slideCount;
  }
  if (skillId === 'saas-landing') {
    const screens = parseFlowScreens(html, skillId);
    if (screens.length >= 2) return screens.length;
  }
  return countDeckSlides(html) || 1;
}

export function buildCaptureProfile(
  skillId: string,
  normalizedHtml: string,
  productName = '',
): CaptureProfile {
  const desktop = PREVIEW_SURFACES.desktop;
  const phone = PREVIEW_SURFACES.phone;

  if (isDeckSkill(skillId)) {
    const w = desktop.w;
    return {
      mode: 'present',
      width: w,
      height: presentHeightForWidth(w),
      surface: 'desktop',
      slideCount: resolvePresentSlideCount(skillId, normalizedHtml, productName),
    };
  }

  if (skillId === 'saas-landing') {
    const w = desktop.w;
    return {
      mode: 'present',
      width: w,
      height: presentHeightForWidth(w),
      surface: 'desktop',
      slideCount: resolvePresentSlideCount(skillId, normalizedHtml, productName),
    };
  }

  if (skillId === 'dashboard' || skillId === 'system-diagram') {
    return {
      mode: 'viewport',
      width: desktop.w,
      height: desktop.h,
      surface: 'desktop',
    };
  }

  if (MOBILE_SKILL_IDS.has(skillId)) {
    return {
      mode: 'viewport',
      width: phone.w,
      height: phone.h,
      surface: 'phone',
    };
  }

  if (skillId === 'social-card') {
    return {
      mode: 'viewport',
      width: 1200,
      height: 630,
      surface: 'desktop',
    };
  }

  if (skillId === 'email-template') {
    return {
      mode: 'viewport',
      width: 600,
      height: 1200,
      surface: 'desktop',
    };
  }

  if (skillId === 'menu-card' || skillId === 'wedding-invite') {
    return {
      mode: 'fullpage',
      width: desktop.w,
      height: desktop.h,
      surface: 'desktop',
    };
  }

  // Doc skills and default web skills
  return {
    mode: 'fullpage',
    width: desktop.w,
    height: desktop.h,
    surface: 'desktop',
  };
}

export function wrapCaptureHtml(normalizedHtml: string, profile: CaptureProfile): string {
  if (profile.mode === 'present') {
    return wrapWithBridge(normalizedHtml);
  }
  return ensureViewportMeta(normalizedHtml, profile.width);
}

export function applyCaptureProfileToDocument(
  doc: { previewHtml?: string; captureHtml?: string; rasterExport?: boolean; slideCount?: number; captureMode?: CaptureMode; captureWidth?: number; captureHeight?: number; surface?: CaptureSurface },
  skillId: string,
  normalizedHtml: string,
  productName: string,
): void {
  const formats = exportFormatsForSkill(skillId);
  if (!usesRasterCapture(formats)) return;

  const profile = buildCaptureProfile(skillId, normalizedHtml, productName);
  doc.previewHtml = normalizedHtml;
  doc.captureHtml = wrapCaptureHtml(normalizedHtml, profile);
  doc.rasterExport = true;
  doc.captureMode = profile.mode;
  doc.captureWidth = profile.width;
  doc.captureHeight = profile.height;
  doc.surface = profile.surface;
  if (profile.slideCount != null) {
    doc.slideCount = profile.slideCount;
  }
}

export { DOC_SKILL_IDS, MOBILE_SKILL_IDS };
