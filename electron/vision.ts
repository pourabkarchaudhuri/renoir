// Image-vision module. Accepts a base64 image + a prompt, returns a description.
// Routes to Anthropic /v1/messages when BYOK is Anthropic-shaped, otherwise to
// an OpenAI-compatible /chat/completions with image_url content blocks.

import { secrets } from './secrets.js';
import { store } from './store.js';

interface VisionReq {
  imageBase64: string;     // raw, no data: prefix
  imageMime?: string;      // image/png by default
  prompt?: string;         // user instruction; defaults to a structured brief
  maxTokens?: number;
}

export interface VisionResult {
  ok: boolean;
  description?: string;
  error?: string;
}

const DEFAULT_PROMPT = `Describe this image as a brand reference. Return:
- Subjects + composition
- Mood + lighting
- Color palette (approximate hex)
- Type style if any
- Single suggested visual direction (one sentence)
Keep it under 180 words.`;

function isAnthropic(baseUrl: string, model: string): boolean {
  const u = (baseUrl || '').toLowerCase();
  const m = (model || '').toLowerCase();
  return u.includes('anthropic.com') || m.startsWith('claude-');
}

export async function describeImage(req: VisionReq): Promise<VisionResult> {
  const cfg = store.getByok();
  const key = await secrets.getByokKey();
  if (!cfg.baseUrl || !cfg.model || !key) {
    return { ok: false, error: 'BYOK not configured. Set base URL, model, and API key in Settings.' };
  }

  const mime   = req.imageMime || 'image/png';
  const prompt = req.prompt?.trim() || DEFAULT_PROMPT;
  const max    = req.maxTokens ?? 700;

  const useAnthropic = isAnthropic(cfg.baseUrl, cfg.model);
  const url = useAnthropic
    ? `${cfg.baseUrl.replace(/\/+$/, '')}/messages`
    : `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let bodyJson: Record<string, unknown>;

  if (useAnthropic) {
    headers['x-api-key']         = key;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
    bodyJson = {
      model: cfg.model,
      max_tokens: max,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: req.imageBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    };
  } else {
    headers.Authorization = `Bearer ${key}`;
    bodyJson = {
      model: cfg.model,
      max_tokens: max,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${req.imageBase64}` } },
          { type: 'text', text: prompt },
        ],
      }],
    };
  }

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(bodyJson) });
  } catch (err: any) {
    return { ok: false, error: `network: ${err?.message || String(err)}` };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `LLM ${res.status}: ${text.slice(0, 320)}` };
  }
  const json = await res.json().catch(() => null) as any;
  let description = '';
  if (useAnthropic) {
    const blocks = Array.isArray(json?.content) ? json.content : [];
    description = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
  } else {
    description = (json?.choices?.[0]?.message?.content || '').trim();
  }
  if (!description) return { ok: false, error: 'no description returned' };
  return { ok: true, description };
}
