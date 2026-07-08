import {
  blogBriefFromStudioContext,
  buildBlogPostPreviewHtml,
} from '@/lib/blog-post-preview';
import {
  marketingBriefFromStudioContext,
  buildMarketingSitePreviewHtml,
} from '@/lib/marketing-site-preview';
import { usesInstantStagedPreview } from '@/lib/instant-preview-skills';
import type { DesignSystemSummary, VisualDirection } from '@/types/global';

export async function buildStagedPreviewHtml(
  skillId: string,
  promptText: string,
  designSystem?: DesignSystemSummary,
  direction?: VisualDirection,
  opts?: {
    questionAnswers?: Record<string, string>;
    briefAnswers?: Record<string, string>;
  },
): Promise<string | null> {
  if (!usesInstantStagedPreview(skillId)) return null;

  if (skillId === 'blog-post') {
    const brief = blogBriefFromStudioContext(promptText, opts);
    return buildBlogPostPreviewHtml(brief, designSystem, direction);
  }

  if (skillId === 'saas-landing') {
    const brief = marketingBriefFromStudioContext(promptText, opts);
    return buildMarketingSitePreviewHtml(brief, designSystem, direction);
  }

  return null;
}
