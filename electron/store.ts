// Tiny JSON-backed store for non-secret app state (projects, last-used skill, etc).
// Secrets (BYOK API key) live in keytar instead.

import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

type State = {
  byok: {
    baseUrl?: string;
    model?: string;
  };
  projects: ProjectRecord[];
  lastSkillId?: string;
  lastDesignSystemId?: string;
};

export interface ArtifactVersion {
  id: string;
  html: string;
  source: 'assistant' | 'fork' | 'restore';
  note?: string;
  createdAt: string;
}

export interface SkillSession {
  conversation: { role: 'user' | 'assistant' | 'system'; content: string; ts: string }[];
  versions?: ArtifactVersion[];
  activeVersionId?: string;
  previewHtml?: string;
  pendingAssistant?: string;
  isStreaming?: boolean;
  streamStatus?: 'idle' | 'streaming' | 'stalled' | 'retrying';
  retryNote?: string;
  conversationId?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  skillId?: string;
  designSystemId?: string;
  visualDirectionId?: string;
  agentId?: string;
  preview?: string;
  conversation: { role: 'user' | 'assistant' | 'system'; content: string; ts: string }[];
  artifacts: { id: string; filename: string; createdAt: string; kind: 'html' | 'image' | 'json' }[];
  versions?: ArtifactVersion[];
  /** When set, the preview should render this version even if a newer
   *  assistant version exists. Cleared on the next assistant turn. */
  activeVersionId?: string;
  skillSessions?: Record<string, SkillSession>;
}

const DEFAULT: State = {
  byok: {},
  projects: [],
};

let cache: State | null = null;

function file(): string {
  return path.join(app.getPath('userData'), 'renoir-store.json');
}

function load(): State {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(file(), 'utf8');
    cache = { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    cache = JSON.parse(JSON.stringify(DEFAULT));
  }
  return cache!;
}

function flush(): void {
  if (!cache) return;
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8');
}

export const store = {
  getByok(): { baseUrl?: string; model?: string } {
    const s = load();
    const cfg = { ...s.byok };
    // In dev, allow .env to provide defaults when nothing is configured via UI.
    // This avoids having to open Settings every time you restart.
    if (!cfg.baseUrl && process.env.BYOK_BASE_URL) cfg.baseUrl = process.env.BYOK_BASE_URL;
    if (!cfg.model   && process.env.BYOK_MODEL)    cfg.model   = process.env.BYOK_MODEL;
    return cfg;
  },
  setByok(cfg: { baseUrl?: string; model?: string }): void {
    const s = load();
    s.byok = { ...s.byok, ...cfg };
    flush();
  },
  clearByok(): void {
    load().byok = {};
    flush();
  },
  listProjects(): ProjectRecord[] {
    return load().projects.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  getProject(id: string): ProjectRecord | undefined {
    return load().projects.find((p) => p.id === id);
  },
  upsertProject(record: ProjectRecord): void {
    const s = load();
    const idx = s.projects.findIndex((p) => p.id === record.id);
    if (idx >= 0) s.projects[idx] = record;
    else s.projects.push(record);
    flush();
  },
  deleteProject(id: string): void {
    const s = load();
    s.projects = s.projects.filter((p) => p.id !== id);
    flush();
  },
  setLast(skillId?: string, designSystemId?: string): void {
    const s = load();
    if (skillId) s.lastSkillId = skillId;
    if (designSystemId) s.lastDesignSystemId = designSystemId;
    flush();
  },
  getLast(): { skillId?: string; designSystemId?: string } {
    const s = load();
    return { skillId: s.lastSkillId, designSystemId: s.lastDesignSystemId };
  },
};
