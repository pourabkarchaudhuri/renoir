// Image generation via Azure Foundry. Endpoint+key+deployment come from .env
// (loaded by env.ts) — never exposed to renderer.

import path from 'node:path';
import fs from 'node:fs';
import { azureConfig, azureImageConfigured } from './env.js';
import { deriveAzureUrl } from './azure-url.js';
import { projectDir, workspaceRoot } from './workspace.js';
import { clampImageSize } from '../shared/image-size.js';

export interface ImageGenRequest {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  n?: number;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  projectId?: string;
}

export interface ImageGenResult {
  ok: boolean;
  images?: { dataUrl: string; savedPath?: string }[];
  error?: string;
}

function workspaceDir(projectId?: string): string {
  if (projectId) {
    return path.join(projectDir(projectId), 'images');
  }
  return path.join(workspaceRoot(), 'images');
}

function safeName(prompt: string): string {
  const base = prompt.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 48) || 'image';
  return `${base}-${Date.now()}`;
}

export interface ImageEditRequest {
  prompt: string;
  imageBase64: string;       // raw base64 (no data: prefix)
  imageMime?: string;        // e.g. image/png
  maskBase64?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  n?: number;
  projectId?: string;
}

export async function editImage(req: ImageEditRequest): Promise<ImageGenResult> {
  if (!azureImageConfigured()) return { ok: false, error: 'AZURE_IMAGE_NOT_CONFIGURED' };
  const cfg = azureConfig();
  const url = deriveAzureUrl({
    endpoint: cfg.imageEndpoint, apiVersion: cfg.apiVersion,
    deployment: cfg.imageModel, op: 'images/edits',
  });
  if (!url) return { ok: false, error: `Could not derive image-edit URL` };

  // multipart/form-data assembly
  const boundary = '----renoir-' + Math.random().toString(36).slice(2);
  const parts: Buffer[] = [];
  const push = (s: string) => parts.push(Buffer.from(s, 'utf8'));
  const pushField = (name: string, value: string) => {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  };
  const pushFile = (name: string, filename: string, mime: string, b64: string) => {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`);
    parts.push(Buffer.from(b64, 'base64'));
    push('\r\n');
  };
  pushField('model', cfg.imageModel);
  pushField('prompt', req.prompt);
  pushField('size', clampImageSize(req.size));
  pushField('n', String(Math.max(1, Math.min(4, req.n ?? 1))));
  pushFile('image', 'image.png', req.imageMime || 'image/png', req.imageBase64);
  if (req.maskBase64) pushFile('mask', 'mask.png', 'image/png', req.maskBase64);
  push(`--${boundary}--\r\n`);
  const body = Buffer.concat(parts);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'api-key': cfg.imageApiKey,
        Authorization: `Bearer ${cfg.imageApiKey}`,
      },
      body,
    });
  } catch (err: any) {
    return { ok: false, error: `network: ${err?.message || String(err)}` };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `Azure ${res.status} @ ${url}: ${text}` };
  }
  const json = await res.json().catch(() => null) as any;
  const data = Array.isArray(json?.data) ? json.data : [];
  if (!data.length) return { ok: false, error: 'no images returned' };

  const dir = workspaceDir(req.projectId);
  fs.mkdirSync(dir, { recursive: true });
  const stem = safeName(req.prompt);
  const images = await Promise.all(data.map(async (entry: any, i: number) => {
    let buf: Buffer | null = null;
    if (entry.b64_json) buf = Buffer.from(entry.b64_json, 'base64');
    else if (entry.url) {
      try {
        const r = await fetch(entry.url);
        buf = Buffer.from(await r.arrayBuffer());
      } catch { buf = null; }
    }
    if (!buf) return null;
    const filename = `${stem}-edit-${i}.png`;
    const savedPath = path.join(dir, filename);
    fs.writeFileSync(savedPath, buf);
    return { dataUrl: `data:image/png;base64,${buf.toString('base64')}`, savedPath };
  }));
  const ok = images.filter(Boolean) as { dataUrl: string; savedPath?: string }[];
  if (!ok.length) return { ok: false, error: 'failed to decode any image' };
  return { ok: true, images: ok };
}

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  if (!azureImageConfigured()) {
    return { ok: false, error: 'AZURE_IMAGE_NOT_CONFIGURED' };
  }
  const cfg = azureConfig();
  const url = deriveAzureUrl({
    endpoint:   cfg.imageEndpoint,
    apiVersion: cfg.apiVersion,
    deployment: cfg.imageModel,
    op:         'images/generations',
  });
  if (!url) {
    return { ok: false, error: `Could not derive image URL from endpoint "${cfg.imageEndpoint}"` };
  }

  const body: Record<string, unknown> = {
    model:  cfg.imageModel,
    prompt: req.prompt,
    size:   clampImageSize(req.size),
    n:      Math.max(1, Math.min(4, req.n ?? 1)),
  };
  if (req.quality) body.quality = req.quality;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key':       cfg.imageApiKey,
        Authorization:  `Bearer ${cfg.imageApiKey}`, // works for v1 Foundry endpoints
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    return { ok: false, error: `network: ${err?.message || String(err)}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `Azure ${res.status} @ ${url}: ${text}` };
  }

  const json = await res.json().catch(() => null) as any;
  const data = Array.isArray(json?.data) ? json.data : [];
  if (!data.length) return { ok: false, error: 'no images returned' };

  const dir = workspaceDir(req.projectId);
  fs.mkdirSync(dir, { recursive: true });
  const stem = safeName(req.prompt);

  const images = await Promise.all(
    data.map(async (entry: any, i: number) => {
      let buf: Buffer | null = null;
      let mime = 'image/png';
      if (entry.b64_json) {
        buf = Buffer.from(entry.b64_json, 'base64');
      } else if (entry.url) {
        try {
          const r = await fetch(entry.url);
          const a = await r.arrayBuffer();
          buf = Buffer.from(a);
          mime = r.headers.get('content-type') || mime;
        } catch {
          buf = null;
        }
      }
      if (!buf) return null;
      const filename = `${stem}-${i}.png`;
      const savedPath = path.join(dir, filename);
      try { fs.writeFileSync(savedPath, buf); } catch { /* best-effort */ }
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      return { dataUrl, savedPath };
    })
  );

  const ok = images.filter(Boolean) as { dataUrl: string; savedPath?: string }[];
  if (!ok.length) return { ok: false, error: 'failed to decode any image' };
  return { ok: true, images: ok };
}
