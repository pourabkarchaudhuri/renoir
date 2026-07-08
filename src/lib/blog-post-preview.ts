import { blogBriefFromText, type BlogPostBrief } from '@shared/blog-post-template';
import { inferTaglineFromText } from '@shared/marketing-site-template';
import { applyArtifactTheme } from '@/lib/artifact-theme';
import type { DesignSystemSummary, VisualDirection, ProjectRecord } from '@/types/global';

const DEFAULT_BLOG_PROMPT =
  'Filebase engineering blog — why we rewrote our sync engine in Rust. Editorial, first-person voice.';

/** Merge chat text, brief answers, and question-form answers into a blog brief. */
export function blogBriefFromStudioContext(
  promptText: string,
  opts?: {
    questionAnswers?: Record<string, string>;
    briefAnswers?: Record<string, string>;
  },
): BlogPostBrief {
  const merged = { ...(opts?.briefAnswers ?? {}), ...(opts?.questionAnswers ?? {}) };
  const text = promptText.trim() || merged.scope || merged.article_topic || '';
  const fromText = blogBriefFromText(text || DEFAULT_BLOG_PROMPT);
  const product = merged.product?.split(/[—–-]/)[0]?.trim();
  return {
    companyName: product || fromText.companyName,
    headline: merged.article_topic || merged.headline || fromText.headline,
    tagline: merged.scope || merged.tagline || fromText.tagline || inferTaglineFromText(text),
  };
}

/** Resolve design system + direction from studio state with sensible fallbacks. */
export function resolveStudioTheme(
  designSystems: DesignSystemSummary[],
  directions: VisualDirection[],
  selectedDesignSystemId?: string,
  selectedDirectionId?: string,
  project?: ProjectRecord | null,
): { designSystem?: DesignSystemSummary; direction?: VisualDirection } {
  const designSystem = designSystems.find((d) => d.id === selectedDesignSystemId)
    ?? designSystems.find((d) => d.id === project?.designSystemId)
    ?? designSystems[0];
  const direction = directions.find((d) => d.id === selectedDirectionId)
    ?? directions.find((d) => d.id === project?.visualDirectionId);
  return { designSystem, direction };
}

/**
 * Build themed blog-post HTML via the same template + theme path used before LLM completion.
 * Final LLM artifacts are themed again in PreviewPane for parity on direction/design changes.
 */
export async function buildBlogPostPreviewHtml(
  brief: BlogPostBrief,
  designSystem?: DesignSystemSummary,
  direction?: VisualDirection,
): Promise<string | null> {
  try {
    const res = await window.renoir.buildBlogPost(brief);
    if (!res.ok || !res.html) return null;
    return applyArtifactTheme(res.html, designSystem, direction);
  } catch {
    return null;
  }
}

export function blogPostPromptSource(
  draft: string,
  conversation: { role: string; content: string }[],
  awaitingNewArtifact: boolean,
  isStreaming: boolean,
): string {
  const lastUser = [...conversation].reverse().find((m) => m.role === 'user');
  if (lastUser && (awaitingNewArtifact || isStreaming)) return lastUser.content;
  if (draft.trim()) return draft;
  return lastUser?.content || DEFAULT_BLOG_PROMPT;
}
