// Renderer-side job runners. Each call pushes a job into the UI store, awaits
// the IPC, and updates the job — so the result survives tab switches and a
// Snackbar / Jobs panel can surface progress globally.

import { useUI } from '@/lib/store';

interface ImageReq {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  n?: number;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  projectId?: string;
}

interface ImageEditReq {
  prompt: string;
  imageBase64: string;
  imageMime?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  n?: number;
  projectId?: string;
}

interface VideoReq {
  prompt: string;
  durationSec?: number;
  size?: '720x1280' | '1280x720' | '1024x1024';
  projectId?: string;
}

interface AudioReq {
  prompt: string;
  text?: string;
  voice?: string;
  format?: 'mp3' | 'wav' | 'opus';
  projectId?: string;
}

interface StoryboardReq {
  projectId: string;
  shots: string[];
  styleSuffix?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
}

interface HyperframeReq {
  projectId: string;
  html: string;
  durationSec: number;
  fps?: number;
  width?: number;
  height?: number;
}

const ui = () => useUI.getState();

function shortPrompt(s: string): string {
  return (s || '').replace(/\s+/g, ' ').slice(0, 64);
}

export async function runImageJob(req: ImageReq): Promise<string> {
  const id = ui().pushJob({ kind: 'image', label: `Image · ${shortPrompt(req.prompt)}`, params: { ...req } });
  ui().updateJob(id, { phase: 'rendering on Foundry…' });
  const res = await window.renoir.imageGenerate(req).catch((err) => ({
    ok: false as const, error: err?.message || String(err),
  } as { ok: false; error: string }));
  if (res.ok && (res as any).images) {
    const images = (res as any).images as { dataUrl: string; savedPath?: string }[];
    ui().completeJob(id, {
      ok: true,
      dataUrls:   images.map((i) => i.dataUrl),
      savedPaths: images.map((i) => i.savedPath || '').filter(Boolean),
    });
  } else {
    ui().completeJob(id, { ok: false, error: (res as any).error || 'image generation failed' });
  }
  return id;
}

export async function runImageEditJob(req: ImageEditReq): Promise<string> {
  const id = ui().pushJob({ kind: 'image-edit', label: `Image edit · ${shortPrompt(req.prompt)}`, params: { ...req, imageBase64: '<elided>' } });
  ui().updateJob(id, { phase: 'editing image…' });
  const res = await window.renoir.imageEdit(req).catch((err) => ({ ok: false as const, error: err?.message || String(err) }));
  if (res.ok && (res as any).images) {
    const images = (res as any).images as { dataUrl: string; savedPath?: string }[];
    ui().completeJob(id, { ok: true, dataUrls: images.map((i) => i.dataUrl), savedPaths: images.map((i) => i.savedPath || '').filter(Boolean) });
  } else {
    ui().completeJob(id, { ok: false, error: (res as any).error || 'image edit failed' });
  }
  return id;
}

export async function runVideoJob(req: VideoReq): Promise<string> {
  const id = ui().pushJob({ kind: 'video', label: `Video · ${shortPrompt(req.prompt)}`, params: { ...req } });
  ui().updateJob(id, { phase: 'rendering video…' });
  const res = await window.renoir.videoGenerate(req).catch((err) => ({ ok: false as const, error: err?.message || String(err) }));
  if (res.ok && (res as any).files?.[0]) {
    ui().completeJob(id, { ok: true, savedPath: (res as any).files[0].savedPath, savedPaths: (res as any).files.map((f: any) => f.savedPath) });
  } else {
    ui().completeJob(id, { ok: false, error: (res as any).error || 'video generation failed' });
  }
  return id;
}

export async function runAudioJob(req: AudioReq): Promise<string> {
  const id = ui().pushJob({ kind: 'audio', label: `Audio · ${shortPrompt(req.text || req.prompt)}`, params: { ...req } });
  ui().updateJob(id, { phase: 'synthesizing…' });
  const res = await window.renoir.audioGenerate(req).catch((err) => ({ ok: false as const, error: err?.message || String(err) }));
  if (res.ok && (res as any).files?.[0]) {
    ui().completeJob(id, { ok: true, savedPath: (res as any).files[0].savedPath });
  } else {
    ui().completeJob(id, { ok: false, error: (res as any).error || 'audio generation failed' });
  }
  return id;
}

export async function runStoryboardJob(req: StoryboardReq): Promise<string> {
  const id = ui().pushJob({ kind: 'storyboard', label: `Storyboard · ${req.shots.length} shots`, params: { shots: req.shots.length } });
  ui().updateJob(id, { phase: `rendering ${req.shots.length} shots…` });
  const res = await window.renoir.storyboardRender(req).catch((err) => ({ ok: false as const, error: err?.message || String(err) }));
  if (res.ok && (res as any).frames) {
    ui().completeJob(id, {
      ok: true,
      dataUrls:   (res as any).frames.map((f: any) => f.dataUrl),
      savedPaths: (res as any).frames.map((f: any) => f.savedPath),
      savedPath:  (res as any).zipPath,
    });
  } else {
    ui().completeJob(id, { ok: false, error: (res as any).error || 'storyboard failed' });
  }
  return id;
}

export async function runHyperframeJob(req: HyperframeReq): Promise<string> {
  const id = ui().pushJob({ kind: 'hyperframe', label: `HyperFrame · ${req.durationSec}s`, params: { duration: req.durationSec, fps: req.fps } });
  ui().updateJob(id, { phase: 'capturing frames…' });
  const res = await window.renoir.hyperframesRender(req).catch((err) => ({ ok: false as const, error: err?.message || String(err) }));
  if (res.ok) {
    ui().completeJob(id, {
      ok: true,
      videoPath:  (res as any).videoPath,
      framesDir:  (res as any).framesDir,
      savedPath:  (res as any).videoPath || (res as any).framesDir,
    });
  } else {
    ui().completeJob(id, { ok: false, error: (res as any).error || 'hyperframe failed' });
  }
  return id;
}
