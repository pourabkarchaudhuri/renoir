// Audio (TTS) and video (Seedance-style) routes via Azure Foundry deployments.
// Both follow the same pattern as image: derive URL, POST, save the bytes.
// If no deployment is configured for the requested mode, we return a clean
// disabled-state error that the renderer can show as a friendly empty state.
import path from 'node:path';
import fs from 'node:fs';
import { azureConfig, azureConfigured } from './env.js';
import { deriveAzureUrl } from './azure-url.js';
import { projectDir, workspaceRoot } from './workspace.js';
function dirFor(kind, projectId) {
    if (projectId) {
        return path.join(projectDir(projectId), kind);
    }
    return path.join(workspaceRoot(), kind);
}
function safeStem(prompt) {
    const base = (prompt || 'media').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
    return `${base || 'media'}-${Date.now()}`;
}
export async function generateAudio(req) {
    if (!azureConfigured())
        return { ok: false, error: 'AZURE_NOT_CONFIGURED' };
    const cfg = azureConfig();
    const deployment = process.env.AZURE_AUDIO_DEPLOYMENT || cfg.textModel;
    if (!deployment)
        return { ok: false, error: 'AZURE_AUDIO_DEPLOYMENT not set' };
    const url = deriveAzureUrl({
        endpoint: cfg.endpoint,
        apiVersion: cfg.apiVersion,
        deployment,
        op: 'audio/speech',
    });
    if (!url)
        return { ok: false, error: 'Could not derive audio URL' };
    const body = {
        model: deployment,
        input: req.text || req.prompt,
        voice: req.voice || 'alloy',
        response_format: req.format || 'mp3',
    };
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': cfg.apiKey,
                Authorization: `Bearer ${cfg.apiKey}`,
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
    const bytes = Buffer.from(await res.arrayBuffer());
    const dir = dirFor('audio', req.projectId);
    fs.mkdirSync(dir, { recursive: true });
    const savedPath = path.join(dir, `${safeStem(req.prompt)}.${req.format || 'mp3'}`);
    fs.writeFileSync(savedPath, bytes);
    return { ok: true, files: [{ savedPath, mime: `audio/${req.format || 'mpeg'}`, bytes: bytes.length }] };
}
export async function generateVideo(req) {
    if (!azureConfigured())
        return { ok: false, error: 'AZURE_NOT_CONFIGURED' };
    const cfg = azureConfig();
    const deployment = process.env.AZURE_VIDEO_DEPLOYMENT || '';
    if (!deployment)
        return { ok: false, error: 'AZURE_VIDEO_DEPLOYMENT not set in .env' };
    const url = deriveAzureUrl({
        endpoint: cfg.endpoint,
        apiVersion: cfg.apiVersion,
        deployment,
        op: 'video/generations',
    });
    if (!url)
        return { ok: false, error: 'Could not derive video URL' };
    const body = {
        model: deployment,
        prompt: req.prompt,
        duration: req.durationSec ?? 4,
        size: req.size || '1280x720',
    };
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': cfg.apiKey,
                Authorization: `Bearer ${cfg.apiKey}`,
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
    // Some video routes return JSON with a URL, others return raw bytes.
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const dir = dirFor('video', req.projectId);
    fs.mkdirSync(dir, { recursive: true });
    const stem = safeStem(req.prompt);
    if (ct.includes('application/json')) {
        const json = await res.json().catch(() => null);
        const dataUrl = json?.data?.[0]?.url || json?.url;
        if (!dataUrl)
            return { ok: false, error: 'video response had no url' };
        const r = await fetch(dataUrl);
        const bytes = Buffer.from(await r.arrayBuffer());
        const savedPath = path.join(dir, `${stem}.mp4`);
        fs.writeFileSync(savedPath, bytes);
        return { ok: true, files: [{ savedPath, mime: 'video/mp4', bytes: bytes.length }] };
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const savedPath = path.join(dir, `${stem}.mp4`);
    fs.writeFileSync(savedPath, bytes);
    return { ok: true, files: [{ savedPath, mime: ct || 'video/mp4', bytes: bytes.length }] };
}
