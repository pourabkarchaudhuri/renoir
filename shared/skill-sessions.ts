/** Per-skill session storage — shared between renderer and main process. */

export interface SkillSessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: string;
}

export interface SkillSessionVersion {
  id: string;
  html: string;
  source: 'assistant' | 'fork' | 'restore';
  note?: string;
  createdAt: string;
}

export interface SkillSession {
  conversation: SkillSessionMessage[];
  versions?: SkillSessionVersion[];
  activeVersionId?: string;
  /** Display name for this skill's workspace within the study. */
  name?: string;
}

export interface SkillSessionProject {
  skillId?: string;
  name?: string;
  conversation: SkillSessionMessage[];
  versions?: SkillSessionVersion[];
  activeVersionId?: string;
  skillSessions?: Record<string, SkillSession>;
}

const DEFAULT_SKILL = 'web-prototype';

export function defaultSkillId(project?: SkillSessionProject | null): string {
  return project?.skillId || DEFAULT_SKILL;
}

export function ensureSkillSessions(project: SkillSessionProject): Record<string, SkillSession> {
  if (project.skillSessions && Object.keys(project.skillSessions).length > 0) {
    return project.skillSessions;
  }
  const key = defaultSkillId(project);
  const hasRoot =
    (project.conversation?.length ?? 0) > 0 ||
    (project.versions?.length ?? 0) > 0;
  if (!hasRoot) return {};
  return {
    [key]: {
      conversation: project.conversation ?? [],
      versions: project.versions,
      activeVersionId: project.activeVersionId,
    },
  };
}

export function syncActiveSession<T extends SkillSessionProject>(project: T, skillId: string): T {
  const sessions = { ...ensureSkillSessions(project) };
  const prev = sessions[skillId];
  const rootConvo = project.conversation ?? [];
  const rootVersions = project.versions;
  const conversation =
    rootConvo.length > 0 ? rootConvo : (prev?.conversation ?? []);
  const versions =
    (rootVersions?.length ?? 0) > 0 ? rootVersions : prev?.versions;
  sessions[skillId] = {
    ...prev,
    conversation: [...conversation],
    versions: versions ? [...versions] : [],
    activeVersionId: project.activeVersionId ?? prev?.activeVersionId,
  };
  return { ...project, skillSessions: sessions, skillId };
}

export function loadSession<T extends SkillSessionProject>(project: T, skillId: string): T {
  const sessions = ensureSkillSessions(project);
  const session = sessions[skillId] ?? { conversation: [], versions: [], activeVersionId: undefined };
  return {
    ...project,
    skillId,
    skillSessions: sessions,
    conversation: [...session.conversation],
    versions: session.versions ? [...session.versions] : [],
    activeVersionId: session.activeVersionId,
  };
}

export function projectHasSkillWork(project: SkillSessionProject, skillId: string): boolean {
  const sessions = ensureSkillSessions(project);
  const session = sessions[skillId];
  return Boolean(session?.conversation?.length || session?.versions?.length);
}

export function skillDisplayName(project: SkillSessionProject, skillId: string): string {
  const sessions = ensureSkillSessions(project);
  const session = sessions[skillId];
  if (session?.name?.trim()) return session.name.trim();
  return 'Untitled';
}

export function setSkillSessionName<T extends SkillSessionProject>(
  project: T,
  skillId: string,
  name: string,
): T {
  const sessions = { ...ensureSkillSessions(project) };
  const session = sessions[skillId] ?? { conversation: [], versions: [] };
  sessions[skillId] = { ...session, name: name.trim() };
  return { ...project, skillSessions: sessions };
}

/** Drop a session title that was copied from the shared study name on the wrong skill. */
export function clearInheritedStudyTitle<T extends SkillSessionProject>(
  project: T,
  skillId: string,
): T {
  if (skillId === 'web-prototype' || !project.name?.trim()) return project;
  const sessions = ensureSkillSessions(project);
  const session = sessions[skillId];
  if (!session?.name?.trim() || session.name.trim() !== project.name.trim()) return project;
  const { name: _drop, ...rest } = session;
  return {
    ...project,
    skillSessions: { ...sessions, [skillId]: rest as SkillSession },
  };
}
