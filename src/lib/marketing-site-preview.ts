import {
  inferProductNameFromText,
  inferTaglineFromText,
  type MarketingSiteBrief,
} from '@shared/marketing-site-template';
import { applyArtifactTheme } from '@/lib/artifact-theme';
import type { DesignSystemSummary, VisualDirection } from '@/types/global';

/** Merge chat text and brief answers into a marketing-site brief. */
export function marketingBriefFromStudioContext(
  promptText: string,
  opts?: {
    questionAnswers?: Record<string, string>;
    briefAnswers?: Record<string, string>;
  },
): MarketingSiteBrief {
  const merged = { ...(opts?.briefAnswers ?? {}), ...(opts?.questionAnswers ?? {}) };
  const text = promptText.trim() || merged.scope || merged.product || '';
  const product = merged.product?.split(/[—–-]/)[0]?.trim();
  return {
    productName: product || inferProductNameFromText(text),
    tagline: merged.scope || merged.tagline || inferTaglineFromText(text),
  };
}

export async function buildMarketingSitePreviewHtml(
  brief: MarketingSiteBrief,
  designSystem?: DesignSystemSummary,
  direction?: VisualDirection,
): Promise<string | null> {
  try {
    const res = await window.renoir.buildMarketingSite(brief);
    if (!res.ok || !res.html) return null;
    return applyArtifactTheme(res.html, designSystem, direction);
  } catch {
    return null;
  }
}
