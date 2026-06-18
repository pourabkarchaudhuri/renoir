// LLM transport. Routes a chat turn over the right protocol depending on
// the user's BYOK config — and falls back to the Azure Foundry text
// deployment from .env when no BYOK key is set, so the app is usable out
// of the box.
//
// Supported shapes:
//   1. Anthropic — baseUrl on anthropic.com or model starting with `claude-`.
//      POST /v1/messages with x-api-key.
//   2. Azure (any host: openai.azure.com / cognitiveservices.azure.com /
//      services.ai.azure.com). POST chat/completions, header `api-key`.
//   3. OpenAI-compatible — anything else. POST /chat/completions, Bearer.
//   4. No BYOK — if AZURE_FOUNDRY_ENDPOINT is set, route via Azure.

import { BrowserWindow } from 'electron';
import { secrets } from './secrets.js';
import { store } from './store.js';
import { azureConfig, azureConfigured } from './env.js';
import { deriveAzureUrl } from './azure-url.js';

interface MessageAttachmentLite {
  id?: string;
  name: string;
  mime: string;
  kind: 'image' | 'text';
  dataUrl?: string;
  text?: string;
}

interface ChatMessageLite {
  role: 'system' | 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachmentLite[];
}

interface ChatStartReq {
  conversationId: string;
  messages: ChatMessageLite[];
  temperature?: number;
}

interface ActiveCall {
  ctrl: AbortController;
  lastDeltaAt: number;
  heartbeat: ReturnType<typeof setInterval>;
  attempt: number;
}
const active = new Map<string, ActiveCall>();
const CHAT_EVENT = 'renoir:chat:event';
const STALL_MS  = 30_000;
const MAX_RETRIES = 2;

function broadcast(payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(CHAT_EVENT, payload);
  }
}

function isAnthropic(baseUrl: string, model: string): boolean {
  const u = (baseUrl || '').toLowerCase();
  const m = (model || '').toLowerCase();
  return u.includes('anthropic.com') || m.startsWith('claude-');
}

function isAzureHost(baseUrl: string): boolean {
  const u = (baseUrl || '').toLowerCase();
  return u.includes('.openai.azure.com')
    || u.includes('.cognitiveservices.azure.com')
    || u.includes('.services.ai.azure.com');
}

/** Foundry "Projects v1" URLs end with /openai/v1/responses or expose the
 *  Responses API. Detect to switch protocol from chat-completions to responses. */
function looksLikeResponsesEndpoint(endpoint: string): boolean {
  const u = (endpoint || '').toLowerCase();
  return /\/openai\/v1(\/responses)?\/?$/.test(u) || u.includes('/openai/v1/responses');
}

type RouteKind = 'anthropic' | 'azure' | 'azure-responses' | 'openai';

interface ResolvedRoute {
  kind: RouteKind;
  url: string;
  apiKey: string;
  model: string;
  /** Display string for telemetry/error context */
  source: string;
}

async function resolveRoute(): Promise<{ ok: true; route: ResolvedRoute } | { ok: false; reason: string }> {
  const cfg = store.getByok();
  const byokKey = await secrets.getByokKey();

  // 1. BYOK with key wins.
  if (cfg.baseUrl && cfg.model && byokKey) {
    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    if (isAnthropic(baseUrl, cfg.model)) {
      return { ok: true, route: { kind: 'anthropic', url: `${baseUrl}/messages`, apiKey: byokKey, model: cfg.model, source: 'BYOK Anthropic' } };
    }
    if (isAzureHost(baseUrl)) {
      const useResponses = looksLikeResponsesEndpoint(baseUrl);
      const url = deriveAzureUrl({
        endpoint:   baseUrl,
        apiVersion: '2024-12-01-preview',
        deployment: cfg.model,
        op:         useResponses ? 'responses' : 'chat/completions',
      });
      if (url) return {
        ok: true,
        route: {
          kind: useResponses ? 'azure-responses' : 'azure',
          url, apiKey: byokKey, model: cfg.model,
          source: `BYOK Azure${useResponses ? ' (Responses)' : ''}`,
        },
      };
    }
    return { ok: true, route: { kind: 'openai', url: `${baseUrl}/chat/completions`, apiKey: byokKey, model: cfg.model, source: 'BYOK OpenAI-compat' } };
  }

  // 2. No BYOK — fall back to Azure text deployment if available.
  if (azureConfigured()) {
    const az = azureConfig();
    const model = az.textModel;
    if (model) {
      const useResponses = looksLikeResponsesEndpoint(az.endpoint);
      const url = deriveAzureUrl({
        endpoint: az.endpoint, apiVersion: az.apiVersion, deployment: model,
        op: useResponses ? 'responses' : 'chat/completions',
      });
      if (url) return {
        ok: true,
        route: {
          kind: useResponses ? 'azure-responses' : 'azure',
          url, apiKey: az.apiKey, model,
          source: `Azure ${model}${useResponses ? ' (Responses)' : ''}`,
        },
      };
    }
  }

  return {
    ok: false,
    reason: 'No LLM configured. Either set a BYOK key in Settings, or add AZURE_FOUNDRY_ENDPOINT + AZURE_FOUNDRY_API_KEY + AZURE_TEXT_DEPLOYMENT to .env.',
  };
}

function shouldRetry(err: unknown, status?: number): boolean {
  if (status && status >= 500 && status < 600) return true;
  if (err && typeof err === 'object') {
    const msg = String((err as Error).message || '').toLowerCase();
    if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('fetch failed') ||
        msg.includes('network') || msg.includes('socket')) return true;
  }
  return false;
}

export async function startChat(req: ChatStartReq): Promise<{ ok: boolean; error?: string }> {
  const { conversationId, messages, temperature } = req;
  const resolved = await resolveRoute();
  if (!resolved.ok) {
    broadcast({ type: 'error', conversationId, message: resolved.reason });
    return { ok: false, error: resolved.reason };
  }
  const route = resolved.route;

  const ctrl = new AbortController();
  const call: ActiveCall = {
    ctrl,
    lastDeltaAt: Date.now(),
    attempt: 0,
    heartbeat: setInterval(() => {
      const stale = Date.now() - call.lastDeltaAt;
      if (stale > STALL_MS) {
        broadcast({ type: 'stalled', conversationId, sinceMs: stale });
      }
    }, 5_000),
  };
  active.set(conversationId, call);

  const cleanup = () => {
    clearInterval(call.heartbeat);
    active.delete(conversationId);
  };

  void (async () => {
    let attempts = 0;
    while (true) {
      try {
        const ok = await runOnce({ conversationId, route, messages, temperature, ctrl, call });
        if (ok) break;
        // runOnce returned false = transient error already handled with retry broadcast
        attempts++;
        if (attempts > MAX_RETRIES + 2) {
          broadcast({ type: 'error', conversationId, message: 'Too many retries' });
          break;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          broadcast({ type: 'done', conversationId, finishReason: 'aborted' });
          break;
        }
        if (call.attempt < MAX_RETRIES && shouldRetry(err)) {
          call.attempt += 1;
          const wait = 800 * Math.pow(2, call.attempt - 1);
          broadcast({ type: 'retry', conversationId, attempt: call.attempt, waitMs: wait, reason: String(err?.message || err) });
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        broadcast({ type: 'error', conversationId, message: `LLM request failed: ${err?.message || String(err)}` });
        break;
      }
      break;
    }
    cleanup();
  })();

  return { ok: true };
}

interface RunOnceArgs {
  conversationId: string;
  route: ResolvedRoute;
  messages: ChatStartReq['messages'];
  temperature?: number;
  ctrl: AbortController;
  call: ActiveCall;
}

/** Inline text attachments into the prose so non-vision models still see them. */
function inlineTextAttachments(content: string, attachments?: MessageAttachmentLite[]): string {
  if (!attachments?.length) return content;
  const blocks: string[] = [];
  for (const a of attachments) {
    if (a.kind === 'text' && a.text) {
      const truncated = a.text.length > 16_000 ? a.text.slice(0, 16_000) + '\n…[truncated]' : a.text;
      blocks.push(`<file name="${a.name}" type="${a.mime || 'text/plain'}">\n${truncated}\n</file>`);
    }
  }
  if (!blocks.length) return content;
  return content + (content.trim() ? '\n\n' : '') + blocks.join('\n\n');
}

function imageAttachments(attachments?: MessageAttachmentLite[]): MessageAttachmentLite[] {
  return (attachments || []).filter((a) => a.kind === 'image' && a.dataUrl);
}

/** Strip the `data:<mime>;base64,` prefix to bare base64. */
function dataUrlParts(dataUrl?: string): { mime: string; base64: string } | null {
  if (!dataUrl) return null;
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return m ? { mime: m[1], base64: m[2] } : null;
}

async function runOnce(args: RunOnceArgs): Promise<boolean> {
  const { conversationId, route, messages, temperature, ctrl, call } = args;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let bodyJson: Record<string, unknown>;

  // Pre-process messages: inline text attachments and collect image attachments
  const processedMessages = messages.map((m) => {
    const content = inlineTextAttachments(m.content, m.attachments);
    const images = imageAttachments(m.attachments);
    return { ...m, content, images };
  });

  if (route.kind === 'anthropic') {
    headers['x-api-key']         = route.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    const sys = processedMessages.find((m) => m.role === 'system')?.content;
    const rest = processedMessages.filter((m) => m.role !== 'system');
    bodyJson = {
      model: route.model,
      max_tokens: 16384,
      stream: true,
      temperature: temperature ?? 0.7,
      ...(sys ? { system: sys } : {}),
      messages: rest.map((m) => {
        const imgs = m.images;
        if (imgs.length > 0) {
          // Anthropic vision: content is an array of blocks
          const blocks: unknown[] = [];
          for (const img of imgs) {
            const parts = dataUrlParts(img.dataUrl);
            if (parts) {
              blocks.push({
                type: 'image',
                source: { type: 'base64', media_type: parts.mime, data: parts.base64 },
              });
            }
          }
          blocks.push({ type: 'text', text: m.content });
          return { role: m.role, content: blocks };
        }
        return { role: m.role, content: m.content };
      }),
    };
  } else if (route.kind === 'azure-responses') {
    // Azure Foundry Responses API — different body shape.
    headers['api-key']      = route.apiKey;
    headers.Authorization   = `Bearer ${route.apiKey}`;
    const sys = processedMessages.find((m) => m.role === 'system')?.content;
    const rest = processedMessages.filter((m) => m.role !== 'system');
    bodyJson = {
      model: route.model,
      stream: true,
      temperature: temperature ?? 0.7,
      ...(sys ? { instructions: sys } : {}),
      input: rest.map((m) => {
        const imgs = m.images;
        if (imgs.length > 0) {
          const content: unknown[] = [];
          for (const img of imgs) {
            const parts = dataUrlParts(img.dataUrl);
            if (parts) {
              content.push({
                type: 'input_image',
                image_url: img.dataUrl,
              });
            }
          }
          content.push({ type: 'input_text', text: m.content });
          return { role: m.role, content };
        }
        return { role: m.role, content: m.content };
      }),
    };
  } else if (route.kind === 'azure') {
    // Azure chat/completions — api-key header; model is the deployment name.
    headers['api-key']      = route.apiKey;
    headers.Authorization   = `Bearer ${route.apiKey}`;
    bodyJson = {
      model: route.model,
      messages: processedMessages.map((m) => {
        const imgs = m.images;
        if (imgs.length > 0) {
          const content: unknown[] = [];
          for (const img of imgs) {
            const parts = dataUrlParts(img.dataUrl);
            if (parts) {
              content.push({
                type: 'image_url',
                image_url: { url: img.dataUrl },
              });
            }
          }
          content.push({ type: 'text', text: m.content });
          return { role: m.role, content };
        }
        return { role: m.role, content: m.content };
      }),
      temperature: temperature ?? 0.7,
      stream: true,
    };
  } else {
    // OpenAI-compatible
    headers.Authorization = `Bearer ${route.apiKey}`;
    bodyJson = {
      model: route.model,
      messages: processedMessages.map((m) => {
        const imgs = m.images;
        if (imgs.length > 0) {
          const content: unknown[] = [];
          for (const img of imgs) {
            const parts = dataUrlParts(img.dataUrl);
            if (parts) {
              content.push({
                type: 'image_url',
                image_url: { url: img.dataUrl },
              });
            }
          }
          content.push({ type: 'text', text: m.content });
          return { role: m.role, content };
        }
        return { role: m.role, content: m.content };
      }),
      temperature: temperature ?? 0.7,
      stream: true,
    };
  }

    const res = await fetch(route.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyJson),
      signal: ctrl.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      const transient = shouldRetry(null, res.status);
      if (transient && call.attempt < MAX_RETRIES) {
        call.attempt += 1;
        const wait = 800 * Math.pow(2, call.attempt - 1);
        broadcast({ type: 'retry', conversationId, attempt: call.attempt, waitMs: wait, reason: `${res.status}: ${text.slice(0, 120)}` });
        await new Promise((r) => setTimeout(r, wait));
        return false;
      }
      broadcast({
        type: 'error',
        conversationId,
        message: `LLM error ${res.status} via ${route.source} at ${shortenUrl(route.url)}: ${text.slice(0, 240)}`,
      });
      return true;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let finishReason: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      call.lastDeltaAt = Date.now();
      buf += decoder.decode(value, { stream: true });

      // Process complete SSE events (separated by blank lines)
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trimEnd();
        buf = buf.slice(idx + 1);

        // Skip empty lines (event separators) and comments
        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') { finishReason = finishReason || 'stop'; continue; }

        try {
          const json = JSON.parse(payload);
          if (route.kind === 'anthropic') {
            if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
              broadcast({ type: 'delta', conversationId, text: json.delta.text });
              call.lastDeltaAt = Date.now();
            } else if (json.type === 'message_delta' && json.delta?.stop_reason) {
              finishReason = json.delta.stop_reason;
            }
          } else if (route.kind === 'azure-responses') {
            const t = json.type as string | undefined;
            if (t === 'response.output_text.delta' && typeof json.delta === 'string') {
              broadcast({ type: 'delta', conversationId, text: json.delta });
              call.lastDeltaAt = Date.now();
            } else if (t === 'response.content_part.delta' && json.delta?.text) {
              broadcast({ type: 'delta', conversationId, text: json.delta.text });
              call.lastDeltaAt = Date.now();
            } else if (t === 'response.completed' || t === 'response.done') {
              finishReason = json.response?.status ?? 'completed';
            } else if (t === 'response.failed' || t === 'error') {
              broadcast({ type: 'error', conversationId, message: JSON.stringify(json).slice(0, 240) });
            }
          } else {
            // OpenAI / Azure chat/completions format
            const delta = json.choices?.[0]?.delta?.content;
            const fr    = json.choices?.[0]?.finish_reason;
            if (typeof delta === 'string' && delta.length) {
              broadcast({ type: 'delta', conversationId, text: delta });
              call.lastDeltaAt = Date.now();
            }
            if (fr) finishReason = fr;
          }
        } catch {
          // ignore malformed line
        }
      }
    }

    broadcast({ type: 'done', conversationId, finishReason });
    return true;
}

export function cancelChat(conversationId: string): boolean {
  const call = active.get(conversationId);
  if (!call) return false;
  try { call.ctrl.abort(); } catch { /* swallow */ }
  clearInterval(call.heartbeat);
  active.delete(conversationId);
  // The AbortError in the fetch loop will broadcast the 'done' event.
  return true;
}

function shortenUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return u.length > 80 ? u.slice(0, 80) + '…' : u;
  }
}

/** Renderer-side hint: what's the active LLM source about to be used? */
export async function describeRoute(): Promise<{ ready: boolean; source: string; kind: RouteKind | 'none' }> {
  const r = await resolveRoute();
  if (!r.ok) return { ready: false, source: 'none', kind: 'none' };
  return { ready: true, source: r.route.source, kind: r.route.kind };
}
