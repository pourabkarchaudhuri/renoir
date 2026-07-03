// Renderer-side types for the bridge surface exposed by preload.cjs.

export interface ByokConfig {
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

export interface AzureStatus {
  configured: boolean;
  imageDeployment?: string;
  textDeployment?: string;
  audioDeployment?: string;
  videoDeployment?: string;
  endpoint?: string;
}

export interface SkillSummary {
  id: string;
  name: string;
  category: 'web' | 'mobile' | 'deck' | 'doc' | 'media' | 'system';
  blurb: string;
  emoji: string;
}

export interface DesignSystemSummary {
  id: string;
  name: string;
  vibe: string;
  swatches: string[];
  font: string;
}

export interface PromptTemplate {
  id: string;
  kind: 'image' | 'video' | 'audio' | 'hyperframe';
  name: string;
  blurb: string;
  body: string;
  tags: string[];
}

export interface VisualDirection {
  id: string;
  name: string;
  vibe: string;
  swatches: string[];
  font: string;
  tagline: string;
}

export interface AgentRecord {
  id: string;
  name: string;
  bin: string;
  available: boolean;
  resolvedPath?: string;
  blurb: string;
}

export interface LintFinding {
  level: 'error' | 'warn' | 'info';
  rule: string;
  message: string;
}

export interface LintReport {
  score: number;
  errors: number;
  warnings: number;
  findings: LintFinding[];
}

export interface BrandSpec {
  name?: string;
  voice?: string;
  audience?: string;
  colors: string[];
  fonts: string[];
  doNots: string[];
  values: string[];
}

export interface TemplateRecord {
  id: string;
  name: string;
  category: string;
  notes?: string;
  body: string;
  createdAt: string;
}

export interface ProjectArtifact {
  id: string;
  filename: string;
  createdAt: string;
  kind: 'html' | 'image' | 'json';
}

export interface MessageAttachment {
  id: string;
  name: string;
  mime: string;
  kind: 'image' | 'text' | 'diagram';
  /** image only — base64 data URL kept for re-rendering thumbnails on reload */
  dataUrl?: string;
  /** text and diagram */
  text?: string;
}

export interface ProjectMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: string;
  attachments?: MessageAttachment[];
}

export interface ArtifactVersion {
  id: string;
  html: string;
  source: 'assistant' | 'fork' | 'restore';
  note?: string;
  createdAt: string;
}

export interface ProjectAssetImage {
  url: string; savedPath: string; createdAt: string; sizeBytes: number;
}
export interface ProjectAssetMedia {
  url: string; savedPath: string; createdAt: string; sizeBytes: number;
}
export interface ProjectAssetStoryboard {
  dir: string; zipPath?: string;
  thumbnails: { url: string; savedPath: string; shot: number }[];
  createdAt: string;
}
export interface ProjectAssetHyperframe {
  dir: string; videoPath?: string; videoUrl?: string;
  firstFramePath?: string; firstFrameUrl?: string;
  createdAt: string;
}
export interface ProjectAssets {
  images:      ProjectAssetImage[];
  videos:      ProjectAssetMedia[];
  audio:       ProjectAssetMedia[];
  storyboards: ProjectAssetStoryboard[];
  hyperframes: ProjectAssetHyperframe[];
}

export interface SkillSession {
  conversation: ProjectMessage[];
  versions?: ArtifactVersion[];
  activeVersionId?: string;
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
  conversation: ProjectMessage[];
  artifacts: ProjectArtifact[];
  versions?: ArtifactVersion[];
  activeVersionId?: string;
  skillSessions?: Record<string, SkillSession>;
}

export type ChatStreamEvent =
  | { type: 'delta';   conversationId: string; text: string }
  | { type: 'done';    conversationId: string; finishReason?: string }
  | { type: 'error';   conversationId: string; message: string }
  | { type: 'stalled'; conversationId: string; sinceMs: number }
  | { type: 'retry';   conversationId: string; attempt: number; waitMs: number; reason: string };

export interface RenoirAPI {
  byokGet: () => Promise<ByokConfig>;
  byokSet: (cfg: { baseUrl?: string; model?: string; apiKey?: string }) => Promise<{ ok: boolean }>;
  byokClear: () => Promise<{ ok: boolean }>;

  azureStatus: () => Promise<AzureStatus>;

  listSkills:           () => Promise<SkillSummary[]>;
  getSkillPrimer:       (id: string) => Promise<string | null>;
  listDesignSystems:    () => Promise<DesignSystemSummary[]>;
  getDesignSystem:      (id: string) => Promise<{ id: string; name: string; tokens: { name: string; value: string }[] } | null>;
  listPromptTemplates:  () => Promise<PromptTemplate[]>;
  listVisualDirections: () => Promise<VisualDirection[]>;

  chatStart: (req: {
    conversationId: string;
    messages: {
      role: 'system' | 'user' | 'assistant';
      content: string;
      attachments?: MessageAttachment[];
    }[];
    temperature?: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  chatCancel: (id: string) => Promise<boolean>;
  onChatEvent: (cb: (e: ChatStreamEvent) => void) => () => void;
  chatRoute: () => Promise<{ ready: boolean; source: string; kind: 'anthropic' | 'azure' | 'azure-responses' | 'openai' | 'none' }>;
  themeSet: (t: 'dark' | 'light') => Promise<{ ok: boolean }>;

  listAgents:  () => Promise<AgentRecord[]>;
  invokeAgent: (req: { agentId: string; conversationId: string; prompt: string }) => Promise<{ ok: boolean; error?: string }>;
  cancelAgent: (id: string) => Promise<boolean>;

  imageGenerate: (req: {
    prompt: string;
    size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
    n?: number;
    quality?: 'low' | 'medium' | 'high' | 'auto';
    projectId?: string;
  }) => Promise<{ ok: boolean; images?: { dataUrl: string; savedPath?: string }[]; error?: string }>;

  imageBatchGenerate: (req: {
    items: { id: string; prompt: string; size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto'; quality?: 'low' | 'medium' | 'high' | 'auto' }[];
    projectId: string;
    concurrency?: number;
  }) => Promise<{ ok: boolean; results: { id: string; ok: boolean; dataUrl?: string; savedPath?: string; error?: string }[] }>;

  onImageBatchProgress: (cb: (e: { completed: number; total: number; itemId: string; ok: boolean }) => void) => () => void;

  audioGenerate: (req: {
    prompt: string; text?: string; voice?: string; format?: 'mp3' | 'wav' | 'opus'; projectId?: string;
  }) => Promise<{ ok: boolean; files?: { savedPath: string; mime: string; bytes: number }[]; error?: string }>;

  videoGenerate: (req: {
    prompt: string; durationSec?: number; size?: '720x1280' | '1280x720' | '1024x1024'; projectId?: string;
  }) => Promise<{ ok: boolean; files?: { savedPath: string; mime: string; bytes: number }[]; error?: string }>;

  hyperframesRender: (req: {
    projectId: string; html: string; durationSec: number; fps?: number; width?: number; height?: number;
  }) => Promise<{ ok: boolean; framesDir?: string; videoPath?: string; encoder?: 'ffmpeg' | 'none'; error?: string }>;

  lintArtifact: (html: string) => Promise<LintReport>;
  brandExtract: (text: string) => Promise<BrandSpec>;

  listTemplates:  () => Promise<TemplateRecord[]>;
  saveTemplate:   (rec: { name: string; category: string; notes?: string; body: string }) => Promise<TemplateRecord>;
  deleteTemplate: (id: string) => Promise<{ ok: boolean }>;

  listProjects:  () => Promise<ProjectRecord[]>;
  createProject: (meta: Partial<ProjectRecord>) => Promise<ProjectRecord>;
  saveProject:   (rec: ProjectRecord) => Promise<{ ok: boolean }>;
  deleteProject: (id: string) => Promise<{ ok: boolean }>;
  readProject:   (id: string) => Promise<ProjectRecord | null>;
  exportProject: (id: string) => Promise<{ ok: boolean; savedPath?: string; error?: string }>;
  importProject: () => Promise<{ ok: boolean; project?: ProjectRecord; error?: string }>;

  openWorkspace: () => Promise<{ ok: boolean; path: string }>;
  writeArtifact: (req: {
    projectId: string; filename: string; content: string; encoding?: 'utf8' | 'base64';
  }) => Promise<{ ok: boolean; path?: string; error?: string }>;

  imageEdit: (req: {
    prompt: string;
    imageBase64: string;
    imageMime?: string;
    maskBase64?: string;
    size?: '1024x1024' | '1024x1536' | '1536x1024';
    n?: number;
    projectId?: string;
  }) => Promise<{ ok: boolean; images?: { dataUrl: string; savedPath?: string }[]; error?: string }>;

  critiqueStart: (req: {
    conversationId: string; artifactHtml: string; brief?: string;
  }) => Promise<{ ok: boolean; error?: string }>;

  exportPdf: (req: {
    projectId: string; html: string; filename?: string;
    pageSize?: 'A4' | 'Letter' | 'Legal' | 'Tabloid'; landscape?: boolean;
  }) => Promise<{ ok: boolean; savedPath?: string; error?: string }>;

  exportPptx: (req: {
    projectId: string; html: string; filename?: string;
  }) => Promise<{ ok: boolean; savedPath?: string; error?: string }>;

  visionDescribe: (req: {
    imageBase64: string; imageMime?: string; prompt?: string; maxTokens?: number;
  }) => Promise<{ ok: boolean; description?: string; error?: string }>;

  storyboardRender: (req: {
    projectId: string; shots: string[]; styleSuffix?: string;
    size?: '1024x1024' | '1024x1536' | '1536x1024';
  }) => Promise<{
    ok: boolean;
    frames?: { shot: number; prompt: string; dataUrl: string; savedPath: string }[];
    zipPath?: string; error?: string;
  }>;

  forkProject: (req: { fromId: string; nameSuffix?: string }) =>
    Promise<{ ok: boolean; project?: ProjectRecord; error?: string }>;

  remixProject: (req: { skillFromId?: string; systemFromId?: string; artifactFromId?: string; name?: string }) =>
    Promise<{ ok: boolean; project?: ProjectRecord; error?: string }>;
  renameProject: (req: { id: string; name: string }) =>
    Promise<{ ok: boolean; project?: ProjectRecord; error?: string }>;
  addVersion: (req: { id: string; html: string; source?: 'assistant' | 'fork' | 'restore'; note?: string }) =>
    Promise<{ ok: boolean; project?: ProjectRecord; deduped?: boolean; error?: string }>;
  restoreVersion: (req: { id: string; versionId: string }) =>
    Promise<{ ok: boolean; project?: ProjectRecord; error?: string }>;

  colorsExtract: (req: { imageBase64: string; imageMime?: string; k?: number }) =>
    Promise<{ ok: boolean; swatches?: string[]; hexes?: string[]; error?: string }>;

  openPreview: (html: string) => Promise<{ ok: boolean }>;
  pushPreview: (html: string) => Promise<{ ok: boolean }>;
  previewIsOpen: () => Promise<boolean>;

  listCustomDirections:  () => Promise<CustomDirection[]>;
  saveCustomDirection:   (rec: CustomDirection) => Promise<CustomDirection>;
  deleteCustomDirection: (id: string) => Promise<{ ok: boolean }>;

  listCustomSkills:   () => Promise<CustomSkill[]>;
  saveCustomSkill:    (rec: CustomSkill) => Promise<CustomSkill>;
  deleteCustomSkill:  (id: string) => Promise<{ ok: boolean }>;
  listCustomSystems:  () => Promise<CustomDesignSystem[]>;
  saveCustomSystem:   (rec: CustomDesignSystem) => Promise<CustomDesignSystem>;
  deleteCustomSystem: (id: string) => Promise<{ ok: boolean }>;

  platform: NodeJS.Platform;
}

export interface CustomSkill {
  id: string;
  name: string;
  category: 'web' | 'mobile' | 'deck' | 'doc' | 'media' | 'system';
  blurb: string;
  emoji: string;
  primer: string;
  questions: { id: string; label: string; type: 'text' | 'textarea' | 'select'; options?: string[] }[];
}

export interface CustomDesignSystem {
  id: string;
  name: string;
  vibe: string;
  swatches: string[];
  font: string;
  tokens: { name: string; value: string }[];
}

export interface CustomDirection {
  id: string;
  name: string;
  vibe: string;
  swatches: string[];
  font: string;
  tagline: string;
}

declare global {
  interface Window { renoir: RenoirAPI; }
}

export {};
