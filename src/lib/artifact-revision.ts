/** Skill-agnostic post-creation revision helpers.
 *
 * Detects when a user follow-up should revise an existing artifact,
 * keeps the latest preview HTML as the LLM source of truth, and
 * re-exports the shared revision prompt addendum.
 */

import { extractArtifact, REVISION_PROMPT_ADDENDUM } from '@/lib/prompt';
import type { SkillSession } from '@/lib/skill-sessions';

export { REVISION_PROMPT_ADDENDUM };

/** True when the session already has complete artifact HTML to revise. */
export function hasCompleteArtifact(
  session: Pick<SkillSession, 'conversation' | 'versions' | 'activeVersionId' | 'previewHtml'>,
): boolean {
  if (session.previewHtml?.trim()) return true;
  const versions = session.versions ?? [];
  if (session.activeVersionId) {
    const active = versions.find((v) => v.id === session.activeVersionId);
    if (active?.html?.trim()) return true;
  }
  if (versions.length > 0 && versions[versions.length - 1]?.html?.trim()) return true;
  const lastAssistant = [...(session.conversation ?? [])].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return false;
  return Boolean(extractArtifact(lastAssistant.content)?.complete);
}

export interface RevisionTurnOpts {
  conversation: { role: string; content: string }[];
  previewHtml?: string;
  versions?: SkillSession['versions'];
  activeVersionId?: string;
  isAutoContinue?: boolean;
}

/** True when this send should revise an existing artifact (not first gen / auto-continue). */
export function isRevisionTurn(opts: RevisionTurnOpts): boolean {
  if (opts.isAutoContinue) return false;
  return hasCompleteArtifact({
    conversation: opts.conversation as SkillSession['conversation'],
    previewHtml: opts.previewHtml,
    versions: opts.versions,
    activeVersionId: opts.activeVersionId,
  });
}

const ARTIFACT_OPEN_RE = /<artifact\b[^>]*>/i;

/**
 * Replace the last assistant message's <artifact> body with `latestHtml`
 * so LLM context matches the living preview (images, lint fixes, etc.).
 * If no artifact tag exists, wraps latestHtml in a new <artifact> block.
 */
export function withLatestArtifact<T extends { role: string; content: string }>(
  messages: T[],
  latestHtml: string | undefined | null,
): T[] {
  const html = latestHtml?.trim();
  if (!html) return messages;

  const lastAssistantIdx = messages.findLastIndex((m) => m.role === 'assistant');
  if (lastAssistantIdx < 0) return messages;

  const msg = messages[lastAssistantIdx];
  const openTag = msg.content.match(ARTIFACT_OPEN_RE);
  if (!openTag || openTag.index === undefined) {
    const prose = msg.content.trim();
    const content = prose
      ? `${prose}\n\n<artifact>\n${html}\n</artifact>`
      : `<artifact>\n${html}\n</artifact>`;
    return messages.map((m, i) => (i === lastAssistantIdx ? { ...m, content } : m));
  }

  const contentStart = openTag.index + openTag[0].length;
  const afterOpen = msg.content.slice(contentStart);
  const closeMatch = afterOpen.match(/<\/artifact>/i);
  let content: string;
  if (closeMatch && closeMatch.index !== undefined) {
    const before = msg.content.slice(0, contentStart);
    const after = afterOpen.slice(closeMatch.index);
    content = `${before}\n${html}\n${after}`;
  } else {
    content = `${msg.content.slice(0, contentStart)}\n${html}\n</artifact>`;
  }

  return messages.map((m, i) => (i === lastAssistantIdx ? { ...m, content } : m));
}
