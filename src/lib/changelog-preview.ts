import { changelogBriefFromText, type ChangelogBrief } from '@shared/changelog-template';
import { applyArtifactTheme } from '@/lib/artifact-theme';
import type { DesignSystemSummary, VisualDirection } from '@/types/global';

const DEFAULT_CHANGELOG_PROMPT =
  'Filebase changelog — release notes for sync engine v2.4. Reverse-chron semver entries.';

/** Merge chat text, brief answers, and question-form answers into a changelog brief. */
export function changelogBriefFromStudioContext(
  promptText: string,
  opts?: {
    questionAnswers?: Record<string, string>;
    briefAnswers?: Record<string, string>;
  },
): ChangelogBrief {
  const merged = { ...(opts?.briefAnswers ?? {}), ...(opts?.questionAnswers ?? {}) };
  const text = promptText.trim() || merged.product || '';
  const fromText = changelogBriefFromText(text || DEFAULT_CHANGELOG_PROMPT);
  const product = merged.product?.split(/[—–-]/)[0]?.trim();
  return {
    productName: product || fromText.productName,
  };
}

/**
 * Build themed changelog HTML via the same template + theme path used before LLM completion.
 * Final LLM artifacts are themed again in PreviewPane for parity on direction/design changes.
 */
export async function buildChangelogPreviewHtml(
  brief: ChangelogBrief,
  designSystem?: DesignSystemSummary,
  direction?: VisualDirection,
): Promise<string | null> {
  try {
    const res = await window.renoir.buildChangelog(brief);
    if (!res.ok || !res.html) return null;
    return applyArtifactTheme(res.html, designSystem, direction);
  } catch {
    return null;
  }
}

export function changelogPromptSource(
  draft: string,
  conversation: { role: string; content: string }[],
  awaitingNewArtifact: boolean,
  isStreaming: boolean,
): string {
  const lastUser = [...conversation].reverse().find((m) => m.role === 'user');
  if (lastUser && (awaitingNewArtifact || isStreaming)) return lastUser.content;
  if (draft.trim()) return draft;
  return lastUser?.content || DEFAULT_CHANGELOG_PROMPT;
}
