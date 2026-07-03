// Image generation via Azure Foundry. Endpoint+key+deployment come from .env
// (loaded by env.ts) — never exposed to renderer.
import path from 'node:path';
import fs from 'node:fs';
import { azureConfig, azureImageConfigured } from './env.js';
import { deriveAzureUrl } from './azure-url.js';
import { projectDir, workspaceRoot } from './workspace.js';
function workspaceDir(projectId) {
    if (projectId) {
        return path.join(projectDir(projectId), 'images');
    }
    return path.join(workspaceRoot(), 'images');
}
function safeName(prompt) {
    const base = prompt.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 48) || 'image';
    return `${base}-${Date.now()}`;
}
export async function editImage(req) {
    if (!azureImageConfigured())
        return { ok: false, error: 'AZURE_NOT_CONFIGURED' };
    const cfg = azureConfig();
    const url = deriveAzureUrl({
        endpoint: cfg.imageEndpoint, apiVersion: cfg.apiVersion,
        deployment: cfg.imageModel, op: 'images/edits',
    });
    if (!url)
        return { ok: false, error: `Could not derive image-edit URL` };
    // multipart/form-data assembly
    const boundary = '----renoir-' + Math.random().toString(36).slice(2);
    const parts = [];
    const push = (s) => parts.push(Buffer.from(s, 'utf8'));
    const pushField = (name, value) => {
        push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
    };
    const pushFile = (name, filename, mime, b64) => {
        push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`);
        parts.push(Buffer.from(b64, 'base64'));
        push('\r\n');
    };
    pushField('model', cfg.imageModel);
    pushField('prompt', req.prompt);
    pushField('size', req.size || '1024x1024');
    pushField('n', String(Math.max(1, Math.min(4, req.n ?? 1))));
    pushFile('image', 'image.png', req.imageMime || 'image/png', req.imageBase64);
    if (req.maskBase64)
        pushFile('mask', 'mask.png', 'image/png', req.maskBase64);
    push(`--${boundary}--\r\n`);
    const body = Buffer.concat(parts);
    let res;
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
    }
    catch (err) {
        return { ok: false, error: `network: ${err?.message || String(err)}` };
    }
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `Azure ${res.status}: ${text.slice(0, 320)}` };
    }
    const json = await res.json().catch(() => null);
    const data = Array.isArray(json?.data) ? json.data : [];
    if (!data.length)
        return { ok: false, error: 'no images returned' };
    const dir = workspaceDir(req.projectId);
    fs.mkdirSync(dir, { recursive: true });
    const stem = safeName(req.prompt);
    const images = await Promise.all(data.map(async (entry, i) => {
        let buf = null;
        if (entry.b64_json)
            buf = Buffer.from(entry.b64_json, 'base64');
        else if (entry.url) {
            try {
                const r = await fetch(entry.url);
                buf = Buffer.from(await r.arrayBuffer());
            }
            catch {
                buf = null;
            }
        }
        if (!buf)
            return null;
        const filename = `${stem}-edit-${i}.png`;
        const savedPath = path.join(dir, filename);
        fs.writeFileSync(savedPath, buf);
        return { dataUrl: `data:image/png;base64,${buf.toString('base64')}`, savedPath };
    }));
    const ok = images.filter(Boolean);
    if (!ok.length)
        return { ok: false, error: 'failed to decode any image' };
    return { ok: true, images: ok };
}
export async function generateImage(req) {
    if (!azureImageConfigured()) {
        return { ok: false, error: 'AZURE_NOT_CONFIGURED' };
    }
    const cfg = azureConfig();
    const url = deriveAzureUrl({
        endpoint: cfg.imageEndpoint,
        apiVersion: cfg.apiVersion,
        deployment: cfg.imageModel,
        op: 'images/generations',
    });
    if (!url) {
        return { ok: false, error: `Could not derive image URL from endpoint "${cfg.imageEndpoint}"` };
    }
    const body = {
        model: cfg.imageModel,
        prompt: req.prompt,
        size: req.size ?? '1024x1024',
        n: Math.max(1, Math.min(4, req.n ?? 1)),
        output_format: 'png',
        output_compression: 100,
    };
    if (req.quality)
        body.quality = req.quality;
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cfg.imageApiKey}`,
            },
            body: JSON.stringify(body),
        });
    }
    catch (err) {
        return { ok: false, error: `network: ${err?.message || String(err)}` };
    }
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `Azure ${res.status}: ${text.slice(0, 320)}` };
    }
    const json = await res.json().catch(() => null);
    const data = Array.isArray(json?.data) ? json.data : [];
    if (!data.length)
        return { ok: false, error: 'no images returned' };
    const dir = workspaceDir(req.projectId);
    fs.mkdirSync(dir, { recursive: true });
    const stem = safeName(req.prompt);
    const images = await Promise.all(data.map(async (entry, i) => {
        let buf = null;
        let mime = 'image/png';
        if (entry.b64_json) {
            buf = Buffer.from(entry.b64_json, 'base64');
        }
        else if (entry.url) {
            try {
                const r = await fetch(entry.url);
                const a = await r.arrayBuffer();
                buf = Buffer.from(a);
                mime = r.headers.get('content-type') || mime;
            }
            catch {
                buf = null;
            }
        }
        if (!buf)
            return null;
        const filename = `${stem}-${i}.png`;
        const savedPath = path.join(dir, filename);
        try {
            fs.writeFileSync(savedPath, buf);
        }
        catch { /* best-effort */ }
        const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
        return { dataUrl, savedPath };
    }));
    const ok = images.filter(Boolean);
    if (!ok.length)
        return { ok: false, error: 'failed to decode any image' };
    return { ok: true, images: ok };
}
