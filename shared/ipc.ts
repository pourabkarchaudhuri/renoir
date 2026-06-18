// IPC channel contracts shared between main and renderer.
// Keep this file dependency-free so both bundles can import it.

export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface BYOKConfig {
  baseUrl: string;          // e.g. https://api.openai.com/v1
  model: string;            // e.g. gpt-4o, claude-opus-4-7, gpt-5.4
  hasKey: boolean;          // never expose key to renderer
}

export interface ImageGenRequest {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  n?: number;
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

export interface ImageGenResult {
  ok: boolean;
  images?: { dataUrl: string; savedPath?: string }[];
  error?: string;
}

export interface AzureStatus {
  configured: boolean;
  imageDeployment?: string;
  textDeployment?: string;
  endpoint?: string;
}

export interface ChatStartRequest {
  conversationId: string;
  messages: LLMMessage[];
  temperature?: number;
}

export type ChatStreamEvent =
  | { type: 'delta'; conversationId: string; text: string }
  | { type: 'done';  conversationId: string; finishReason?: string }
  | { type: 'error'; conversationId: string; message: string };

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  skillId?: string;
  designSystemId?: string;
  preview?: string; // dataUrl
}

export interface SkillSummary {
  id: string;
  name: string;
  category: 'web' | 'mobile' | 'deck' | 'doc' | 'media';
  blurb: string;
  emoji: string;
}

export interface DesignSystemSummary {
  id: string;
  name: string;
  vibe: string;
  swatches: string[]; // OKLch
  font: string;
}

export const IPC = {
  // Settings / BYOK
  byokGet:    'renoir:byok:get',
  byokSet:    'renoir:byok:set',
  byokClear:  'renoir:byok:clear',

  // Azure status
  azureStatus: 'renoir:azure:status',

  // Skills + design systems
  skillsList:        'renoir:skills:list',
  designSystemsList: 'renoir:design:list',

  // Chat (LLM)
  chatStart:  'renoir:chat:start',
  chatCancel: 'renoir:chat:cancel',
  chatEvent:  'renoir:chat:event', // main → renderer, broadcast

  // Image
  imageGenerate: 'renoir:image:generate',
  imageBatchGenerate: 'renoir:image:generateBatch',

  // Projects
  projectsList:   'renoir:projects:list',
  projectCreate:  'renoir:projects:create',
  projectSave:    'renoir:projects:save',
  projectDelete:  'renoir:projects:delete',
  projectRead:    'renoir:projects:read',

  // Workspace
  workspaceOpen:  'renoir:workspace:open',
  workspaceWrite: 'renoir:workspace:write',
} as const;

export type IpcChannel = typeof IPC[keyof typeof IPC];
