import { create } from 'zustand';
import type {
  ProjectRecord, SkillSummary, DesignSystemSummary, ByokConfig, AzureStatus, ProjectMessage,
  PromptTemplate, VisualDirection, AgentRecord, TemplateRecord,
} from '@/types/global';
import { hydrateProject, switchSkillSession, syncActiveSession, patchSkillSession, getSkillSession, streamStateForSkill, conversationForSkill, withInProgressAssistant, applySession, loadSession, projectHasSkillWork, clearInheritedStudyTitle } from '@/lib/skill-sessions';
import { extractArtifact } from '@/lib/prompt';
import { notifyArtifactImageReady } from '@/lib/image-post-process';
import { loadPreviewSurface, savePreviewSurface, type PreviewSurface } from '@/lib/preview-surfaces';
import { saveWorkspaceSnapshot } from '@/lib/workspace-persist';

export type Route = 'home' | 'studio' | 'gallery' | 'settings' | 'media';

export type JobKind = 'pdf' | 'pptx' | 'docx' | 'markdown' | 'zip' | 'image' | 'image-edit' | 'audio' | 'video' | 'storyboard' | 'hyperframe';

export interface Job {
  id: string;
  kind: JobKind;
  label: string;
  phase?: string;
  status: 'running' | 'ok' | 'err';
  startedAt: number;
  endedAt?: number;
  progress?: number;          // 0–1 if known
  // outputs (set on completion)
  savedPath?: string;
  savedPaths?: string[];
  dataUrls?: string[];
  videoPath?: string;
  framesDir?: string;
  error?: string;
  params?: Record<string, unknown>;
}

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface UIState {
  route: Route;
  setRoute: (r: Route) => void;
  toasts: { id: string; tone: 'info' | 'ok' | 'warn' | 'err'; text: string; action?: ToastAction }[];
  toast: (text: string, tone?: 'info' | 'ok' | 'warn' | 'err', action?: ToastAction) => void;
  dismissToast: (id: string) => void;
  refreshToastDismiss: (id: string, ms?: number) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  jobs: Job[];
  pushJob: (input: { kind: JobKind; label: string; params?: Record<string, unknown> }) => string;
  updateJob: (id: string, patch: Partial<Pick<Job, 'phase' | 'progress' | 'label' | 'params'>>) => void;
  completeJob: (id: string, patch: {
    ok: boolean; savedPath?: string; savedPaths?: string[]; dataUrls?: string[];
    videoPath?: string; framesDir?: string; error?: string;
  }) => void;
  dismissJob: (id: string) => void;
  // legacy alias kept for ExportSnackbar (so older imports still resolve)
  pushExport: (e: { kind: 'pdf' | 'pptx' | 'docx' | 'markdown' | 'zip'; label: string; params?: Record<string, unknown> }) => string;
  updateExport: (id: string, patch: { phase?: string }) => void;
  completeExport: (id: string, patch: { ok: boolean; savedPath?: string; error?: string }) => void;
  chatWidth: number;            // 0–100, percent of the chat+preview row
  setChatWidth: (n: number) => void;
  previewFull: boolean;
  setPreviewFull: (v: boolean) => void;
  chatCollapsed: boolean;
  toggleChat: () => void;
  railCollapsed: boolean;
  toggleRail: () => void;
  previewSurface: PreviewSurface;
  setPreviewSurface: (s: PreviewSurface) => void;
  a11yPanelOpen: boolean;
  setA11yPanelOpen: (v: boolean) => void;
  activeFlowScreenId: string | null;
  setActiveFlowScreenId: (id: string | null) => void;
}

const initialTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('renoir.theme')) === 'light' ? 'light' : 'dark';
const initialChatWidth = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('renoir.chatWidth') : null;
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) && n >= 20 && n <= 75 ? n : 28;
  } catch { return 28; }
})();
const initialRailCollapsed = (() => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('renoir.railCollapsed') === '1'; }
  catch { return false; }
})();

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

function toastDismissMs(tone: 'info' | 'ok' | 'warn' | 'err'): number {
  if (tone === 'err') return 15_000;
  if (tone === 'warn') return 10_000;
  return 5_000;
}

export const useUI = create<UIState>((set, get) => ({
  route: 'home',
  setRoute: (r) => {
    set({ route: r });
    saveWorkspaceSnapshot({ route: r });
  },
  toasts: [],
  toast: (text, tone = 'info', action) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, tone, text, action }] }));
    get().refreshToastDismiss(id, action ? 8_000 : toastDismissMs(tone));
  },
  refreshToastDismiss: (id, ms = 60_000) => {
    const prev = toastTimers.get(id);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      toastTimers.delete(id);
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, ms);
    toastTimers.set(id, timer);
  },
  dismissToast: (id) => {
    const prev = toastTimers.get(id);
    if (prev) clearTimeout(prev);
    toastTimers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  theme: initialTheme as 'dark' | 'light',
  setTheme: (t) => {
    try { localStorage.setItem('renoir.theme', t); } catch { /* swallow */ }
    set({ theme: t });
  },
  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  jobs: [],
  pushJob: ({ kind, label, params }) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ jobs: [...s.jobs, {
      id, kind, label, status: 'running', startedAt: Date.now(), params,
    }] }));
    return id;
  },
  updateJob: (id, patch) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),
  completeJob: (id, patch) => {
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: patch.ok ? 'ok' : 'err',
              endedAt: Date.now(),
              error:       patch.error,
              savedPath:   patch.savedPath,
              savedPaths:  patch.savedPaths,
              dataUrls:    patch.dataUrls,
              videoPath:   patch.videoPath,
              framesDir:   patch.framesDir,
            }
          : j,
      ),
    }));
    // Auto-prune old finished jobs after 12 minutes (keeps history briefly).
    setTimeout(() => set((s) => ({
      jobs: s.jobs.filter((j) => j.id !== id || j.status === 'running'),
    })), 12 * 60 * 1000);
  },
  dismissJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
  // Legacy bridge for ExportSnackbar callers — delegates to the same backing slice.
  pushExport: (e) => get().pushJob({ kind: e.kind, label: e.label, params: e.params }),
  updateExport: (id, patch) => get().updateJob(id, { phase: patch.phase }),
  completeExport: (id, patch) => get().completeJob(id, {
    ok: patch.ok, savedPath: patch.savedPath, error: patch.error,
  }),
  chatWidth: initialChatWidth,
  setChatWidth: (n) => {
    const clamped = Math.max(20, Math.min(75, n));
    try { localStorage.setItem('renoir.chatWidth', String(clamped)); } catch { /* swallow */ }
    set({ chatWidth: clamped });
  },
  previewFull: false,
  setPreviewFull: (v) => set({ previewFull: v }),
  chatCollapsed: false,
  toggleChat: () => set((s) => {
    const next = !s.chatCollapsed;
    try { localStorage.setItem('renoir.chatCollapsed', next ? '1' : '0'); } catch { /* swallow */ }
    return { chatCollapsed: next };
  }),
  railCollapsed: initialRailCollapsed,
  toggleRail: () => set((s) => {
    const next = !s.railCollapsed;
    try { localStorage.setItem('renoir.railCollapsed', next ? '1' : '0'); } catch { /* swallow */ }
    return { railCollapsed: next };
  }),
  previewSurface: loadPreviewSurface(),
  setPreviewSurface: (s) => {
    savePreviewSurface(s);
    set({ previewSurface: s });
  },
  a11yPanelOpen: false,
  setA11yPanelOpen: (v) => set({ a11yPanelOpen: v }),
  activeFlowScreenId: null,
  setActiveFlowScreenId: (id) => set({ activeFlowScreenId: id }),
}));

interface CatalogState {
  skills: SkillSummary[];
  designSystems: DesignSystemSummary[];
  promptTemplates: PromptTemplate[];
  directions: VisualDirection[];
  agents: AgentRecord[];
  templates: TemplateRecord[];
  byok: ByokConfig | null;
  azure: AzureStatus | null;
  refresh: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
}

export const useCatalog = create<CatalogState>((set) => ({
  skills: [],
  designSystems: [],
  promptTemplates: [],
  directions: [],
  agents: [],
  templates: [],
  byok: null,
  azure: null,
  refresh: async () => {
    const [skills, designSystems, prompts, directions, agents, templates, byok, azure] = await Promise.all([
      window.renoir.listSkills(),
      window.renoir.listDesignSystems(),
      window.renoir.listPromptTemplates(),
      window.renoir.listVisualDirections(),
      window.renoir.listAgents(),
      window.renoir.listTemplates(),
      window.renoir.byokGet(),
      window.renoir.azureStatus(),
    ]);
    set({
      skills, designSystems,
      promptTemplates: prompts,
      directions,
      agents,
      templates,
      byok, azure,
    });
  },
  refreshTemplates: async () => {
    const templates = await window.renoir.listTemplates();
    set({ templates });
  },
}));

interface StudioState {
  projectId: string | null;
  project: ProjectRecord | null;
  draft: string;
  isStreaming: boolean;
  pendingAssistant: string;
  streamStatus: 'idle' | 'streaming' | 'stalled' | 'retrying';
  retryNote?: string;
  selectedSkillId?: string;
  selectedDesignSystemId?: string;
  selectedDirectionId?: string;
  selectedAgentId?: string;          // 'byok' or a CLI agent id
  questionAnswers: Record<string, string>;
  /** Skill that owns the active LLM stream (may differ from selectedSkillId). */
  streamingSkillId?: string;
  activeConversationId?: string;

  setProject: (rec: ProjectRecord | null) => void;
  setDraft: (s: string) => void;
  setSkill: (id?: string) => void;
  switchSkill: (id: string) => Promise<void>;
  setSystem: (id?: string) => void;
  setDirection: (id?: string) => void;
  setAgent: (id?: string) => void;
  setAnswer: (key: string, value: string) => void;
  resetAnswers: () => void;
  bindConversation: (conversationId: string) => void;
  startStreaming: () => void;
  appendAssistantDelta: (s: string) => void;
  finishStreaming: () => Promise<void>;
  appendUser: (content: string, attachments?: any[]) => Promise<void>;
  markStalled: (sinceMs: number) => void;
  markRetry: (attempt: number, waitMs: number, reason: string) => void;
  flushProject: () => Promise<void>;
}

export const useStudio = create<StudioState>((set, get) => ({
  projectId: null,
  project: null,
  draft: '',
  isStreaming: false,
  pendingAssistant: '',
  streamStatus: 'idle',
  retryNote: undefined,
  selectedSkillId: undefined,
  selectedDesignSystemId: undefined,
  selectedDirectionId: undefined,
  selectedAgentId: 'byok',
  questionAnswers: {},
  streamingSkillId: undefined,
  activeConversationId: undefined,

  setProject: (rec) => {
    if (!rec) {
      set({
        projectId: null,
        project: null,
        selectedSkillId: undefined,
        selectedDesignSystemId: undefined,
        selectedDirectionId: undefined,
        selectedAgentId: 'byok',
        questionAnswers: {},
        streamingSkillId: undefined,
        activeConversationId: undefined,
        isStreaming: false,
        pendingAssistant: '',
        streamStatus: 'idle',
        retryNote: undefined,
      });
      return;
    }
    const prev = get();
    const skillId = rec.skillId ?? prev.selectedSkillId;
    const synced = syncActiveSession(rec, skillId);
    const project = hydrateProject(synced);
    const session = getSkillSession(project, skillId);
    const streamingSkillId = Object.entries(project.skillSessions ?? {}).find(([, s]) => s.isStreaming)?.[0]
      ?? (session.isStreaming ? skillId : undefined)
      ?? (prev.projectId === project.id && prev.isStreaming ? prev.streamingSkillId : undefined);
    const stream = streamStateForSkill(
      streamingSkillId ? getSkillSession(project, streamingSkillId) : session,
      Boolean(streamingSkillId && streamingSkillId === skillId),
    );

    // Mid-send project patches (staged preview) must not drop the in-flight
    // conversation binding — otherwise all LLM deltas are discarded.
    const sessionConversationId = streamingSkillId
      ? getSkillSession(project, streamingSkillId).conversationId
      : getSkillSession(project, skillId).conversationId;
    const sameProject = prev.projectId === project.id;
    const activeConversationId = sessionConversationId
      ?? (sameProject ? prev.activeConversationId : undefined);

    // Keep the session conversationId in sync when we preserved a live binding.
    let projectOut = project;
    if (activeConversationId && skillId) {
      const sess = getSkillSession(projectOut, skillId);
      if (sess.conversationId !== activeConversationId) {
        projectOut = patchSkillSession(projectOut, skillId, { conversationId: activeConversationId });
      }
    }

    set({
      projectId: projectOut.id,
      project: projectOut,
      selectedSkillId: projectOut.skillId ?? prev.selectedSkillId,
      selectedDesignSystemId: projectOut.designSystemId,
      selectedDirectionId: projectOut.visualDirectionId,
      selectedAgentId: projectOut.agentId || 'byok',
      questionAnswers: {},
      streamingSkillId,
      activeConversationId,
      pendingAssistant: stream.pendingAssistant || (sameProject && streamingSkillId === skillId ? prev.pendingAssistant : ''),
      isStreaming: stream.isStreaming || Boolean(sameProject && prev.isStreaming && streamingSkillId),
      streamStatus: stream.streamStatus !== 'idle'
        ? stream.streamStatus
        : (sameProject && prev.isStreaming ? prev.streamStatus : 'idle'),
      retryNote: stream.retryNote ?? (sameProject ? prev.retryNote : undefined),
    });
    saveWorkspaceSnapshot({
      projectId: projectOut.id,
      skillId: projectOut.skillId ?? prev.selectedSkillId,
      route: useUI.getState().route,
    });
  },
  setDraft: (s) => set({ draft: s }),
  setSkill: (id) => {
    const st = get();
    if (!st.project) {
      set({ selectedSkillId: id, questionAnswers: {} });
      return;
    }
    if (st.selectedSkillId === id) {
      set({ questionAnswers: {} });
      return;
    }

    const fromId = st.selectedSkillId;
    const fromStream = {
      pendingAssistant: st.streamingSkillId === fromId
        ? st.pendingAssistant
        : getSkillSession(st.project, fromId).pendingAssistant,
      isStreaming: st.streamingSkillId === fromId && st.isStreaming,
      streamStatus: st.streamingSkillId === fromId ? st.streamStatus : getSkillSession(st.project, fromId).streamStatus,
      retryNote: st.streamingSkillId === fromId ? st.retryNote : getSkillSession(st.project, fromId).retryNote,
      conversationId: st.streamingSkillId === fromId
        ? (st.activeConversationId ?? getSkillSession(st.project, fromId).conversationId)
        : getSkillSession(st.project, fromId).conversationId,
    };

    let next = switchSkillSession(st.project, fromId, id, fromStream);
    next = { ...next, updatedAt: new Date().toISOString() };
    void window.renoir.saveProject(next);

    const toSession = getSkillSession(next, id);
    const stream = streamStateForSkill(toSession, st.streamingSkillId === id);

    set({
      selectedSkillId: id,
      questionAnswers: {},
      project: next,
      pendingAssistant: stream.pendingAssistant,
      isStreaming: stream.isStreaming,
      streamStatus: stream.streamStatus,
      retryNote: stream.retryNote,
      activeConversationId: st.streamingSkillId === id ? toSession.conversationId : st.activeConversationId,
    });
    saveWorkspaceSnapshot({ skillId: id, projectId: next.id, route: useUI.getState().route });
  },
  switchSkill: async (newSkillId) => {
    const st = get();
    if (!newSkillId || newSkillId === st.selectedSkillId) return;

    const pickProjectForSkill = async (saved?: ProjectRecord) => {
      const all = await window.renoir.listProjects();
      return all.find((p) => p.id !== saved?.id && projectHasSkillWork(p, newSkillId));
    };

    if (st.project) {
      const oldSkillId = st.selectedSkillId || st.project.skillId || 'web-prototype';
      let saved = syncActiveSession(st.project, oldSkillId);
      saved = { ...saved, updatedAt: new Date().toISOString() };
      await window.renoir.saveProject(saved);

      let loaded = clearInheritedStudyTitle(loadSession(saved, newSkillId), newSkillId);
      if (projectHasSkillWork(loaded, newSkillId)) {
        get().setProject(loaded);
        set({ questionAnswers: {}, draft: '' });
        return;
      }

      const other = await pickProjectForSkill(saved);
      if (other) {
        const opened = clearInheritedStudyTitle(loadSession(other, newSkillId), newSkillId);
        get().setProject(opened);
        set({ questionAnswers: {}, draft: '' });
        return;
      }

      get().setProject(loaded);
      set({ questionAnswers: {}, draft: '' });
      return;
    }

    const match = await pickProjectForSkill();
    if (match) {
      const opened = clearInheritedStudyTitle(loadSession(match, newSkillId), newSkillId);
      get().setProject(opened);
      set({ questionAnswers: {}, draft: '' });
    } else {
      set({ selectedSkillId: newSkillId, project: null, projectId: null, questionAnswers: {}, draft: '' });
    }
  },
  setSystem: (id) => set({ selectedDesignSystemId: id }),
  setDirection: (id) => set({ selectedDirectionId: id }),
  setAgent: (id) => {
    set({ selectedAgentId: id });
    // Persist agent choice to project immediately so it survives restarts.
    const st = useStudio.getState();
    if (st.project) {
      const next = { ...st.project, agentId: id, updatedAt: new Date().toISOString() };
      void window.renoir.saveProject(next);
      set({ project: next });
    }
  },
  setAnswer: (key, value) => set((s) => ({ questionAnswers: { ...s.questionAnswers, [key]: value } })),
  resetAnswers: () => set({ questionAnswers: {} }),

  bindConversation: (conversationId) => {
    const st = get();
    const skillId = st.streamingSkillId ?? st.selectedSkillId;
    if (!st.project || !skillId) return;
    let project = patchSkillSession(st.project, skillId, { conversationId });
    if (skillId !== st.selectedSkillId) project = applySession(project, st.selectedSkillId);
    void window.renoir.saveProject(project);
    set({ project, activeConversationId: conversationId });
  },

  startStreaming: () => {
    const st = get();
    const skillId = st.selectedSkillId;
    if (!skillId) {
      set({ isStreaming: true, pendingAssistant: '', streamStatus: 'streaming', retryNote: undefined });
      return;
    }
    let project = st.project
      ? patchSkillSession(st.project, skillId, {
        pendingAssistant: '',
        isStreaming: true,
        streamStatus: 'streaming',
        retryNote: undefined,
      })
      : st.project;
    set({
      isStreaming: true,
      streamingSkillId: skillId,
      pendingAssistant: '',
      streamStatus: 'streaming',
      retryNote: undefined,
      project,
    });
  },
  markStalled: (sinceMs) => {
    const st = get();
    const skillId = st.streamingSkillId;
    const retryNote = `No reply for ${Math.round(sinceMs / 1000)}s`;
    if (!skillId || !st.project) {
      set({ streamStatus: 'stalled', retryNote });
      return;
    }
    const project = patchSkillSession(st.project, skillId, { streamStatus: 'stalled', retryNote });
    const patch: Partial<StudioState> = { project };
    if (skillId === st.selectedSkillId) patch.streamStatus = 'stalled';
    patch.retryNote = retryNote;
    set(patch);
  },
  markRetry: (attempt, waitMs, reason) => {
    const st = get();
    const skillId = st.streamingSkillId;
    const retryNote = `Retry ${attempt}/2 in ${(waitMs / 1000).toFixed(1)}s · ${reason}`;
    if (!skillId || !st.project) {
      set({ streamStatus: 'retrying', retryNote });
      return;
    }
    const project = patchSkillSession(st.project, skillId, { streamStatus: 'retrying', retryNote });
    const patch: Partial<StudioState> = { project };
    if (skillId === st.selectedSkillId) patch.streamStatus = 'retrying';
    patch.retryNote = retryNote;
    set(patch);
  },
  appendAssistantDelta: (s) => {
    const st = get();
    const skillId = st.streamingSkillId;
    if (!skillId || !st.project) return;

    const session = getSkillSession(st.project, skillId);
    const pending = (session.pendingAssistant ?? '') + s;
    let project = patchSkillSession(st.project, skillId, { pendingAssistant: pending });

    const patch: Partial<StudioState> = { project };
    if (skillId === st.selectedSkillId) patch.pendingAssistant = pending;
    set(patch);

    queueMicrotask(() => {
      const cur = useStudio.getState();
      if (!cur.project || cur.streamingSkillId !== skillId) return;
      const now = Date.now();
      const last = (cur as StudioState & { __lastPersist?: number }).__lastPersist || 0;
      if (now - last < 1000) return;
      (cur as StudioState & { __lastPersist?: number }).__lastPersist = now;

      const sess = getSkillSession(cur.project, skillId);
      const base = conversationForSkill(cur.project, skillId, cur.selectedSkillId);
      const conv = withInProgressAssistant(base, sess.pendingAssistant ?? '');
      let saved = patchSkillSession(cur.project, skillId, { conversation: conv });
      if (skillId !== cur.selectedSkillId) saved = applySession(saved, cur.selectedSkillId);
      void window.renoir.saveProject(saved);
    });
  },
  finishStreaming: async () => {
    const st = get();
    const skillId = st.streamingSkillId ?? st.selectedSkillId;
    const viewingSkillId = st.selectedSkillId;
    if (!st.project || !skillId) {
      set({ isStreaming: false, pendingAssistant: '', streamStatus: 'idle', retryNote: undefined, streamingSkillId: undefined, activeConversationId: undefined });
      return;
    }

    const sess = getSkillSession(st.project, skillId);
    const pending = sess.pendingAssistant ?? st.pendingAssistant;
    const conv = conversationForSkill(st.project, skillId, viewingSkillId).slice();
    const tail = conv[conv.length - 1];
    const finalMsg: ProjectMessage = {
      role: 'assistant',
      content: pending,
      ts: new Date().toISOString(),
    };
    if (tail && (tail as ProjectMessage & { inProgress?: boolean }).inProgress) conv[conv.length - 1] = finalMsg;
    else conv.push(finalMsg);

    let project = patchSkillSession(st.project, skillId, {
      conversation: conv,
      pendingAssistant: '',
      isStreaming: false,
      streamStatus: 'idle',
      retryNote: undefined,
      conversationId: undefined,
    });

    const art = extractArtifact(finalMsg.content);
    if (art?.complete) {
      const html = art.html;
      const forSave = applySession(syncActiveSession({
        ...project,
        conversation: conv,
        versions: getSkillSession(project, skillId).versions,
      }, skillId), skillId);
      await window.renoir.saveProject(forSave);
      const verRes = await window.renoir.addVersion({ id: forSave.id, html, source: 'assistant', skillId });
      if (verRes.ok && verRes.project) {
        project = syncActiveSession(verRes.project, skillId);
        project = patchSkillSession(project, skillId, {
          conversation: conv,
          pendingAssistant: '',
          isStreaming: false,
          streamStatus: 'idle',
          retryNote: undefined,
          conversationId: undefined,
          versions: getSkillSession(project, skillId).versions,
          previewHtml: html,
        });
      }
      notifyArtifactImageReady({
        html: art.html,
        projectId: forSave.id,
        skillId,
        conversation: conv,
        productName: forSave.name,
      });
    } else {
      const forSave = skillId === viewingSkillId
        ? syncActiveSession({ ...project, conversation: conv }, skillId)
        : applySession(syncActiveSession(patchSkillSession(project, skillId, { conversation: conv }), skillId), viewingSkillId);
      await window.renoir.saveProject(forSave);
      project = forSave;
    }

    if (skillId !== viewingSkillId) project = applySession(project, viewingSkillId);

    const stillStreaming = Object.values(project.skillSessions ?? {}).some((s) => s.isStreaming);
    const nextStreamingSkill = stillStreaming
      ? Object.entries(project.skillSessions ?? {}).find(([, s]) => s.isStreaming)?.[0]
      : undefined;

    set({
      project,
      isStreaming: false,
      pendingAssistant: '',
      streamStatus: 'idle',
      retryNote: undefined,
      streamingSkillId: nextStreamingSkill,
      activeConversationId: nextStreamingSkill
        ? getSkillSession(project, nextStreamingSkill).conversationId
        : undefined,
    });
  },
  appendUser: async (content, attachments) => {
    const st = get();
    if (!st.project) return;
    const msg: ProjectMessage = {
      role: 'user',
      content,
      ts: new Date().toISOString(),
      ...(attachments?.length ? { attachments } : {}),
    };
    let next: ProjectRecord = {
      ...st.project,
      skillId: st.selectedSkillId ?? st.project.skillId,
      designSystemId: st.selectedDesignSystemId ?? st.project.designSystemId,
      agentId: st.selectedAgentId ?? st.project.agentId,
      conversation: [...st.project.conversation, msg],
    };
    next = syncActiveSession(next, st.selectedSkillId ?? next.skillId);
    await window.renoir.saveProject(next);
    set({ project: next, draft: '' });
    saveWorkspaceSnapshot({ projectId: next.id, skillId: st.selectedSkillId ?? next.skillId });
  },

  flushProject: async () => {
    const st = get();
    if (!st.project) return;
    const skillId = st.selectedSkillId ?? st.project.skillId;
    const activeStream =
      st.streamingSkillId === skillId
        ? {
            pendingAssistant: st.pendingAssistant,
            isStreaming: st.isStreaming,
            streamStatus: st.streamStatus,
            retryNote: st.retryNote,
            conversationId: st.activeConversationId,
          }
        : undefined;
    let project = syncActiveSession(st.project, skillId, activeStream);
    if (st.streamingSkillId && st.streamingSkillId !== skillId) {
      const bg = getSkillSession(project, st.streamingSkillId);
      project = patchSkillSession(project, st.streamingSkillId, {
        pendingAssistant: bg.pendingAssistant,
        isStreaming: bg.isStreaming,
        streamStatus: bg.streamStatus,
        retryNote: bg.retryNote,
        conversationId: bg.conversationId,
      });
    }
    project = { ...project, skillId: skillId ?? project.skillId };
    await window.renoir.saveProject(project);
    set({ project });
    saveWorkspaceSnapshot({
      projectId: project.id,
      skillId: skillId ?? project.skillId,
      route: useUI.getState().route,
    });
  },
}));
