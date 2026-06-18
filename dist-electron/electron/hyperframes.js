// HyperFrames — render an HTML artifact in an offscreen window, capture
// frames, and either return them raw (if no encoder is available) or hand
// them to ffmpeg for an MP4. We deliberately do not bundle ffmpeg; if the
// user has it on PATH we use it, otherwise we save the frames as PNGs and
// tell them how to encode.
import { BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { existsSync } from 'node:fs';
import { projectDir as getProjectDir } from './workspace.js';
function whichSync(bin) {
    const isWin = process.platform === 'win32';
    const exts = isWin ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
    const sep = isWin ? ';' : ':';
    const dirs = (process.env.PATH || '').split(sep).filter(Boolean);
    for (const d of dirs) {
        for (const ext of exts) {
            const p1 = path.join(d, bin + ext.toLowerCase());
            if (existsSync(p1))
                return p1;
            const p2 = path.join(d, bin + ext.toUpperCase());
            if (existsSync(p2))
                return p2;
        }
    }
    return null;
}
export async function renderHyperFrames(req) {
    const fps = Math.max(1, Math.min(60, req.fps ?? 24));
    const w = req.width ?? 1280;
    const h = req.height ?? 720;
    const total = Math.max(1, Math.round(req.durationSec * fps));
    const projDir = getProjectDir(req.projectId);
    const stem = `hyperframe-${Date.now()}`;
    const framesDir = path.join(projDir, stem, 'frames');
    fs.mkdirSync(framesDir, { recursive: true });
    const win = new BrowserWindow({
        show: false,
        width: w,
        height: h,
        webPreferences: {
            offscreen: true,
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    try {
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(req.html));
        // Allow the page to settle before capture.
        await new Promise((r) => setTimeout(r, 250));
        for (let i = 0; i < total; i++) {
            const t = i / Math.max(1, total - 1);
            // Inject the current normalized time so animations keyed off it can play.
            try {
                await win.webContents.executeJavaScript(`window.__renoir_t = ${t};`);
            }
            catch { /* swallow — page may not opt-in */ }
            await new Promise((r) => setTimeout(r, 1000 / fps));
            const img = await win.webContents.capturePage();
            const png = img.toPNG();
            fs.writeFileSync(path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`), png);
        }
    }
    finally {
        try {
            win.destroy();
        }
        catch { /* swallow */ }
    }
    const ffmpeg = whichSync('ffmpeg');
    if (!ffmpeg) {
        return {
            ok: true,
            encoder: 'none',
            framesDir,
            error: 'ffmpeg not on PATH — frames saved as PNGs. Install ffmpeg to assemble into MP4.',
        };
    }
    const videoPath = path.join(projDir, `${stem}.mp4`);
    await new Promise((resolve, reject) => {
        const proc = spawn(ffmpeg, [
            '-y',
            '-framerate', String(fps),
            '-i', path.join(framesDir, 'frame-%05d.png'),
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'medium',
            videoPath,
        ], { stdio: ['ignore', 'ignore', 'ignore'] });
        proc.on('error', reject);
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    }).catch((err) => {
        return Promise.resolve({ /* fallthrough */}).then(() => { throw err; });
    });
    return { ok: true, encoder: 'ffmpeg', framesDir, videoPath };
}
