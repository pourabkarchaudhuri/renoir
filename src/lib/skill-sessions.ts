import type { ArtifactVersion, ProjectMessage, ProjectRecord } from '@/types/global';
import { extractArtifact } from '@/lib/prompt';

export interface SkillSession {
  conversation: ProjectMessage[];
  versions?: ArtifactVersion[];
  activeVersionId?: string;
  previewHtml?: string;
  pendingAssistant?: string;
  isStreaming?: boolean;
  streamStatus?: 'idle' | 'streaming' | 'stalled' | 'retrying';
  retryNote?: string;
  conversationId?: string;
}

export type SkillStreamState = Pick<
  SkillSession,
  'pendingAssistant' | 'isStreaming' | 'streamStatus' | 'retryNote' | 'conversationId'
>;

const DEFAULT_KEY = '_default';

export function sessionKey(skillId?: string): string {
  return skillId?.trim() || DEFAULT_KEY;
}

export function emptySession(): SkillSession {
  return { conversation: [], versions: [], activeVersionId: undefined };
}

/** Migrate legacy single-conversation projects into per-skill sessions. */
export function ensureSkillSessions(project: ProjectRecord): ProjectRecord {
  const key = sessionKey(project.skillId);
  const hasTopData =
    (project.conversation?.length ?? 0) > 0 ||
    (project.versions?.length ?? 0) > 0 ||
    Boolean(project.activeVersionId);

  const sessions = { ...(project.skillSessions ?? {}) };
  const existing = sessions[key];
  const storedEmpty = !existing || (
    (existing.conversation?.length ?? 0) === 0 &&
    (existing.versions?.length ?? 0) === 0 &&
    !existing.previewHtml
  );

  if (hasTopData && storedEmpty) {
    sessions[key] = {
      conversation: project.conversation ?? [],
      versions: project.versions,
      activeVersionId: project.activeVersionId,
      previewHtml: resolvePreviewHtml({
        conversation: project.conversation ?? [],
        versions: project.versions,
        activeVersionId: project.activeVersionId,
      }),
    };
    return { ...project, skillSessions: sessions };
  }

  if (!project.skillSessions) {
    if (!hasTopData) return { ...project, skillSessions: {} };
    return {
      ...project,
      skillSessions: {
        [key]: {
          conversation: project.conversation ?? [],
          versions: project.versions,
          activeVersionId: project.activeVersionId,
          previewHtml: resolvePreviewHtml({
            conversation: project.conversation ?? [],
            versions: project.versions,
            activeVersionId: project.activeVersionId,
          }),
        },
      },
    };
  }

  return { ...project, skillSessions: sessions };
}

/** Resolve the best artifact HTML from a session's versions or conversation. */
export function resolvePreviewHtml(session: Pick<SkillSession, 'conversation' | 'versions' | 'activeVersionId' | 'previewHtml'>): string | undefined {
  if (session.previewHtml?.trim()) return session.previewHtml;
  const versions = session.versions ?? [];
  if (session.activeVersionId) {
    const active = versions.find((v) => v.id === session.activeVersionId);
    if (active?.html) return active.html;
  }
  if (versions.length > 0) return versions[versions.length - 1]?.html;
  const lastAssistant = [...(session.conversation ?? [])].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return undefined;
  return extractArtifact(lastAssistant.content)?.html;
}

export function findSkillForConversation(
  project: ProjectRecord | null | undefined,
  conversationId: string,
): string | undefined {
  if (!project?.skillSessions) return undefined;
  for (const [key, session] of Object.entries(project.skillSessions)) {
    if (session.conversationId === conversationId) {
      return key === DEFAULT_KEY ? undefined : key;
    }
  }
  return undefined;
}

export function getSkillSession(project: ProjectRecord, skillId?: string): SkillSession {
  const migrated = ensureSkillSessions(project);
  return migrated.skillSessions?.[sessionKey(skillId)] ?? emptySession();
}

export function patchSkillSession(
  project: ProjectRecord,
  skillId: string | undefined,
  patch: Partial<SkillSession>,
): ProjectRecord {
  const migrated = ensureSkillSessions(project);
  const key = sessionKey(skillId);
  const sessions = { ...migrated.skillSessions };
  sessions[key] = { ...sessions[key] ?? emptySession(), ...patch };
  return { ...migrated, skillSessions: sessions };
}

/** Copy the active top-level conversation/versions into the session map. */
export function syncActiveSession(
  project: ProjectRecord,
  skillId?: string,
  stream?: SkillStreamState,
): ProjectRecord {
  const migrated = ensureSkillSessions(project);
  const key = sessionKey(skillId ?? project.skillId);
  const prev = migrated.skillSessions?.[key];
  const sessions = { ...migrated.skillSessions };
  sessions[key] = {
    conversation: project.conversation ?? [],
    versions: project.versions,
    activeVersionId: project.activeVersionId,
    previewHtml: resolvePreviewHtml({
      conversation: project.conversation ?? [],
      versions: project.versions,
      activeVersionId: project.activeVersionId,
      previewHtml: prev?.previewHtml,
    }),
    pendingAssistant: stream?.pendingAssistant ?? prev?.pendingAssistant,
    isStreaming: stream?.isStreaming ?? prev?.isStreaming,
    streamStatus: stream?.streamStatus ?? prev?.streamStatus,
    retryNote: stream?.retryNote ?? prev?.retryNote,
    conversationId: stream?.conversationId ?? prev?.conversationId,
  };
  return { ...migrated, skillSessions: sessions };
}

/** Persist the current top-level state under `skillId` without switching. */
export function captureSession(
  project: ProjectRecord,
  skillId?: string,
  stream?: SkillStreamState,
): ProjectRecord {
  return syncActiveSession(project, skillId, stream);
}

/** Load a skill's session into the top-level conversation/versions fields. */
export function applySession(project: ProjectRecord, skillId?: string): ProjectRecord {
  const migrated = ensureSkillSessions(project);
  const key = sessionKey(skillId);
  const session = migrated.skillSessions?.[key] ?? emptySession();
  return {
    ...migrated,
    conversation: session.conversation ?? [],
    versions: session.versions,
    activeVersionId: session.activeVersionId,
  };
}

/** Preview HTML for the active skill (versions → conversation fallback). */
export function previewHtmlForSkill(project: ProjectRecord, skillId?: string): string | undefined {
  const session = getSkillSession(project, skillId);
  if (skillId === project.skillId || skillId === undefined) {
    return resolvePreviewHtml({
      conversation: project.conversation ?? session.conversation,
      versions: project.versions ?? session.versions,
      activeVersionId: project.activeVersionId ?? session.activeVersionId,
      previewHtml: session.previewHtml,
    });
  }
  return resolvePreviewHtml(session);
}

/** UI stream slice for the skill currently on screen. */
export function streamStateForSkill(session: SkillSession, isStreamingSkill: boolean): SkillStreamState & {
  pendingAssistant: string;
  isStreaming: boolean;
  streamStatus: 'idle' | 'streaming' | 'stalled' | 'retrying';
} {
  return {
    pendingAssistant: isStreamingSkill ? (session.pendingAssistant ?? '') : '',
    isStreaming: isStreamingSkill && Boolean(session.isStreaming),
    streamStatus: isStreamingSkill ? (session.streamStatus ?? 'idle') : 'idle',
    retryNote: isStreamingSkill ? session.retryNote : undefined,
    conversationId: session.conversationId,
  };
}

/**
 * Save the outgoing skill's state and load the incoming skill's preview + chat.
 * Stream state is preserved per skill so background generation can continue.
 */
export function switchSkillSession(
  project: ProjectRecord,
  fromSkillId: string | undefined,
  toSkillId: string | undefined,
  fromStream?: SkillStreamState,
): ProjectRecord {
  const migrated = ensureSkillSessions(project);
  const fromKey = sessionKey(fromSkillId);
  const toKey = sessionKey(toSkillId);

  const sessions = { ...migrated.skillSessions };
  const prevFrom = sessions[fromKey];
  sessions[fromKey] = {
    conversation: project.conversation ?? [],
    versions: project.versions,
    activeVersionId: project.activeVersionId,
    previewHtml: resolvePreviewHtml({
      conversation: project.conversation ?? [],
      versions: project.versions,
      activeVersionId: project.activeVersionId,
      previewHtml: prevFrom?.previewHtml,
    }),
    pendingAssistant: fromStream?.pendingAssistant ?? prevFrom?.pendingAssistant,
    isStreaming: fromStream?.isStreaming ?? prevFrom?.isStreaming,
    streamStatus: fromStream?.streamStatus ?? prevFrom?.streamStatus,
    retryNote: fromStream?.retryNote ?? prevFrom?.retryNote,
    conversationId: fromStream?.conversationId ?? prevFrom?.conversationId,
  };

  const topHasData = (project.conversation?.length ?? 0) > 0;
  const toSession = sessions[toKey];
  const toEmpty = !toSession || (toSession.conversation?.length ?? 0) === 0;
  if (fromKey === toKey && topHasData && toEmpty) {
    sessions[toKey] = { ...sessions[fromKey] };
  }

  const nextSession = sessions[toKey] ?? emptySession();
  return {
    ...migrated,
    skillSessions: sessions,
    conversation: nextSession.conversation ?? [],
    versions: nextSession.versions,
    activeVersionId: nextSession.activeVersionId,
    skillId: toSkillId,
  };
}

/** True when top-level fields are ahead of the stored session entry. */
function topLevelIsNewer(project: ProjectRecord, skillId?: string): boolean {
  const key = sessionKey(skillId ?? project.skillId);
  const stored = project.skillSessions?.[key];
  if (!stored) return (project.conversation?.length ?? 0) > 0 || (project.versions?.length ?? 0) > 0;
  const topVersions = project.versions?.length ?? 0;
  const storedVersions = stored.versions?.length ?? 0;
  const topConv = project.conversation?.length ?? 0;
  const storedConv = stored.conversation?.length ?? 0;
  if (topVersions !== storedVersions) return topVersions > storedVersions;
  if (topConv !== storedConv) return topConv > storedConv;
  if (project.activeVersionId !== stored.activeVersionId) return Boolean(project.activeVersionId);
  return false;
}

/** Prepare a loaded project: heal + apply the saved skill's session. */
export function hydrateProject(project: ProjectRecord): ProjectRecord {
  const migrated = ensureSkillSessions(project);
  const skillId = project.skillId;
  const stored = migrated.skillSessions?.[sessionKey(skillId)];
  const storedEmpty = !stored || ((stored.conversation?.length ?? 0) === 0 && (stored.versions?.length ?? 0) === 0);

  if (storedEmpty && topLevelIsNewer(migrated, skillId)) {
    return applySession(syncActiveSession(migrated, skillId), skillId);
  }
  if (topLevelIsNewer(migrated, skillId)) {
    return applySession(syncActiveSession(migrated, skillId), skillId);
  }
  return applySession(migrated, skillId);
}

/** Conversation for a skill — top-level when active, otherwise from skillSessions. */
export function conversationForSkill(project: ProjectRecord, skillId: string | undefined, viewingSkillId?: string): ProjectMessage[] {
  if (skillId === viewingSkillId) return project.conversation ?? [];
  return getSkillSession(project, skillId).conversation ?? [];
}

/** Merge an in-progress assistant draft into a conversation copy. */
export function withInProgressAssistant(
  conversation: ProjectMessage[],
  pendingAssistant: string,
): ProjectMessage[] {
  if (!pendingAssistant) return conversation;
  const conv = conversation.slice();
  const tail = conv[conv.length - 1];
  const draftMsg = {
    role: 'assistant' as const,
    content: pendingAssistant,
    ts: new Date().toISOString(),
    inProgress: true,
  };
  if (tail && (tail as ProjectMessage & { inProgress?: boolean }).inProgress) {
    conv[conv.length - 1] = draftMsg;
  } else {
    conv.push(draftMsg);
  }
  return conv;
}

export {
  loadSession,
  projectHasSkillWork,
  skillDisplayName,
  setSkillSessionName,
  clearInheritedStudyTitle,
  defaultSkillId,
} from '@shared/skill-sessions';
