import { create } from 'zustand';
import type {
  ProjectRecord, SkillSummary, DesignSystemSummary, ByokConfig, AzureStatus, ProjectMessage,
  PromptTemplate, VisualDirection, AgentRecord, TemplateRecord,
} from '@/types/global';

export type Route = 'home' | 'studio' | 'gallery' | 'settings' | 'media';

export type JobKind = 'pdf' | 'pptx' | 'zip' | 'image' | 'image-edit' | 'audio' | 'video' | 'storyboard' | 'hyperframe';

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

interface UIState {
  route: Route;
  setRoute: (r: Route) => void;
  toasts: { id: string; tone: 'info' | 'ok' | 'warn' | 'err'; text: string }[];
  toast: (text: string, tone?: 'info' | 'ok' | 'warn' | 'err') => void;
  dismissToast: (id: string) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  jobs: Job[];
  pushJob: (input: { kind: JobKind; label: string; params?: Record<string, unknown> }) => string;
  updateJob: (id: string, patch: Partial<Pick<Job, 'phase' | 'progress' | 'label'>>) => void;
  completeJob: (id: string, patch: {
    ok: boolean; savedPath?: string; savedPaths?: string[]; dataUrls?: string[];
    videoPath?: string; framesDir?: string; error?: string;
  }) => void;
  dismissJob: (id: string) => void;
  // legacy alias kept for ExportSnackbar (so older imports still resolve)
  pushExport: (e: { kind: 'pdf' | 'pptx' | 'zip'; label: string }) => string;
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

export const useUI = create<UIState>((set, get) => ({
  route: 'home',
  setRoute: (r) => set({ route: r }),
  toasts: [],
  toast: (text, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, tone, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3600);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
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
  pushExport: (e) => get().pushJob({ kind: e.kind, label: e.label }),
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

  setProject: (rec: ProjectRecord | null) => void;
  setDraft: (s: string) => void;
  setSkill: (id?: string) => void;
  setSystem: (id?: string) => void;
  setDirection: (id?: string) => void;
  setAgent: (id?: string) => void;
  setAnswer: (key: string, value: string) => void;
  resetAnswers: () => void;
  startStreaming: () => void;
  appendAssistantDelta: (s: string) => void;
  finishStreaming: () => Promise<void>;
  appendUser: (content: string, attachments?: any[]) => Promise<void>;
  markStalled: (sinceMs: number) => void;
  markRetry: (attempt: number, waitMs: number, reason: string) => void;
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

  setProject: (rec) => set({
    projectId: rec?.id ?? null,
    project: rec,
    selectedSkillId: rec?.skillId,
    selectedDesignSystemId: rec?.designSystemId,
    selectedDirectionId: rec?.visualDirectionId,
    selectedAgentId: rec?.agentId || 'byok',
    questionAnswers: {},
  }),
  setDraft: (s) => set({ draft: s }),
  setSkill: (id) => set({ selectedSkillId: id, questionAnswers: {} }),
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

  startStreaming: () => set({ isStreaming: true, pendingAssistant: '', streamStatus: 'streaming', retryNote: undefined }),
  markStalled: (sinceMs) => set({ streamStatus: 'stalled', retryNote: `No reply for ${Math.round(sinceMs / 1000)}s` }),
  markRetry: (attempt, waitMs, reason) => set({
    streamStatus: 'retrying',
    retryNote: `Retry ${attempt}/2 in ${(waitMs / 1000).toFixed(1)}s · ${reason.slice(0, 80)}`,
  }),
  appendAssistantDelta: (s) => {
    set((st) => ({ pendingAssistant: st.pendingAssistant + s }));
    // Throttled persistence — save in-progress text to disk every ~1s so a
    // crash or navigation does not lose the pending stream.
    queueMicrotask(() => {
      const st = useStudio.getState();
      if (!st.isStreaming || !st.project) return;
      const now = Date.now();
      const last = (st as any).__lastPersist || 0;
      if (now - last < 1000) return;
      (st as any).__lastPersist = now;
      const conv = st.project.conversation.slice();
      const tail = conv[conv.length - 1];
      const draftMsg = { role: 'assistant' as const, content: st.pendingAssistant, ts: new Date().toISOString(), inProgress: true };
      if (tail && (tail as any).inProgress) conv[conv.length - 1] = draftMsg;
      else conv.push(draftMsg);
      const next = { ...st.project, conversation: conv };
      void window.renoir.saveProject(next as any);
    });
  },
  finishStreaming: async () => {
    const st = get();
    if (!st.project) { set({ isStreaming: false, pendingAssistant: '' }); return; }
    // Replace any in-progress draft message with the final assistant message.
    const conv = st.project.conversation.slice();
    const tail = conv[conv.length - 1];
    const finalMsg: ProjectMessage = {
      role: 'assistant',
      content: st.pendingAssistant,
      ts: new Date().toISOString(),
    };
    if (tail && (tail as any).inProgress) conv[conv.length - 1] = finalMsg;
    else conv.push(finalMsg);
    let next: ProjectRecord = { ...st.project, conversation: conv };

    // Snapshot artifact if the assistant emitted one (only the closed form
    // is committed as a version — partials become versions on next assistant
    // turn that closes them).
    const m = finalMsg.content.match(/<artifact>([\s\S]*?)<\/artifact>/i);
    if (m) {
      const html = m[1].trim();
      const verRes = await window.renoir.addVersion({ id: next.id, html, source: 'assistant' });
      if (verRes.ok && verRes.project) next = verRes.project;
    } else {
      await window.renoir.saveProject(next);
    }
    set({ project: next, isStreaming: false, pendingAssistant: '', streamStatus: 'idle', retryNote: undefined });
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
    const next: ProjectRecord = {
      ...st.project,
      skillId: st.selectedSkillId ?? st.project.skillId,
      designSystemId: st.selectedDesignSystemId ?? st.project.designSystemId,
      agentId: st.selectedAgentId ?? st.project.agentId,
      conversation: [...st.project.conversation, msg],
    };
    await window.renoir.saveProject(next);
    set({ project: next, draft: '' });
  },
}));
