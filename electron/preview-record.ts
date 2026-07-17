// Offscreen preview recording — static, scroll walkthrough, or present slides.

import { BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { existsSync } from 'node:fs';
import { projectDir as getProjectDir } from './workspace.js';

export type PreviewSurface = 'phone' | 'tablet' | 'desktop' | 'ultrawide';
export type PreviewRecordMode = 'static' | 'scroll' | 'present';

export interface PreviewRecordRequest {
  projectId: string;
  html: string;
  mode: PreviewRecordMode;
  surface?: PreviewSurface;
  durationSec?: number;
  fps?: number;
  slideCount?: number;
}

export interface PreviewRecordResult {
  ok: boolean;
  framesDir?: string;
  videoPath?: string;
  pngPath?: string;
  encoder?: 'ffmpeg' | 'none';
  error?: string;
}

const SURFACES: Record<PreviewSurface, { w: number; h: number }> = {
  phone: { w: 390, h: 844 },
  tablet: { w: 820, h: 1180 },
  desktop: { w: 1280, h: 800 },
  ultrawide: { w: 1920, h: 1080 },
};

function frameSize(surface: PreviewSurface, mode: 'scroll' | 'present') {
  const spec = SURFACES[surface];
  if (mode === 'present') {
    return { w: spec.w, h: Math.round(spec.w * 9 / 16) };
  }
  return spec;
}

function whichSync(bin: string): string | null {
  const isWin = process.platform === 'win32';
  const exts = isWin ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  const sep = isWin ? ';' : ':';
  const dirs = (process.env.PATH || '').split(sep).filter(Boolean);
  for (const d of dirs) {
    for (const ext of exts) {
      const p1 = path.join(d, bin + ext.toLowerCase());
      if (existsSync(p1)) return p1;
      const p2 = path.join(d, bin + ext.toUpperCase());
      if (existsSync(p2)) return p2;
    }
  }
  return null;
}

async function encodeFfmpeg(framesDir: string, fps: number, outPath: string): Promise<boolean> {
  const ffmpeg = whichSync('ffmpeg');
  if (!ffmpeg) return false;
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      ffmpeg,
      [
        '-y',
        '-framerate', String(fps),
        '-i', path.join(framesDir, 'frame-%05d.png'),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        outPath,
      ],
      { stdio: ['ignore', 'ignore', 'ignore'] },
    );
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  return true;
}

export async function recordPreview(req: PreviewRecordRequest): Promise<PreviewRecordResult> {
  const surface = req.surface ?? 'desktop';
  const recordMode = req.mode;
  const viewportMode = recordMode === 'present' ? 'present' : 'scroll';
  const { w, h } = frameSize(surface, viewportMode);
  const fps = Math.max(1, Math.min(30, req.fps ?? 12));
  const durationSec = Math.max(1, Math.min(60, req.durationSec ?? 6));

  const projDir = getProjectDir(req.projectId);
  const stem = `recording-${Date.now()}`;
  const outDir = path.join(projDir, 'recordings', stem);
  const framesDir = path.join(outDir, 'frames');
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

  const captures: Buffer[] = [];

  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(req.html));
    await new Promise((r) => setTimeout(r, 400));

    if (recordMode === 'present') {
      await win.webContents.executeJavaScript(`window.postMessage({ type: 'renoir:set-mode', mode: 'present' }, '*');`);
      await new Promise((r) => setTimeout(r, 200));
      const count = Math.max(1, req.slideCount ?? await win.webContents.executeJavaScript(`
        (function () {
          var slides = document.querySelectorAll('[data-slide], section.slide, .deck > section');
          return Math.max(1, slides.length || 1);
        })();
      `) as number);

      for (let i = 0; i < count; i++) {
        await win.webContents.executeJavaScript(`window.postMessage({ type: 'renoir:nav', idx: ${i} }, '*');`);
        await new Promise((r) => setTimeout(r, 350));
        const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
        captures.push(img.toPNG());
      }
    } else if (recordMode === 'scroll') {
      const scrollMax = await win.webContents.executeJavaScript(`
        Math.max(0, (document.documentElement.scrollHeight || document.body.scrollHeight || 0) - ${h});
      `) as number;
      const total = Math.max(2, Math.round(durationSec * fps));
      for (let i = 0; i < total; i++) {
        const y = scrollMax > 0 ? Math.round((i / Math.max(1, total - 1)) * scrollMax) : 0;
        await win.webContents.executeJavaScript(`window.scrollTo(0, ${y});`);
        await new Promise((r) => setTimeout(r, 1000 / fps));
        const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
        captures.push(img.toPNG());
      }
    } else {
      const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
      captures.push(img.toPNG());
    }
  } finally {
    try { win.destroy(); } catch { /* swallow */ }
  }

  if (captures.length === 1 && recordMode === 'static') {
    const pngPath = path.join(outDir, 'preview.png');
    fs.writeFileSync(pngPath, captures[0]);
    return { ok: true, encoder: 'none', pngPath, framesDir: outDir };
  }

  captures.forEach((png, i) => {
    fs.writeFileSync(path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`), png);
  });

  const videoPath = path.join(outDir, `${stem}.mp4`);
  const encoded = await encodeFfmpeg(framesDir, fps, videoPath).catch(() => false);
  if (encoded) {
    return { ok: true, encoder: 'ffmpeg', framesDir, videoPath };
  }

  return {
    ok: true,
    encoder: 'none',
    framesDir,
    error: 'ffmpeg not on PATH — frames saved as PNG sequence.',
  };
}
