// Persistent render-asset listing. Walks the project's workspace folders and
// returns URLs that the renderer can plug into <img>/<video>/<audio> via
// our custom `renoir-asset://` protocol (registered in main.ts).

import path from 'node:path';
import fs from 'node:fs';
import { projectDir as getProjectDir, workspaceRoot } from './workspace.js';

export interface AssetImage {  url: string; savedPath: string; createdAt: string; sizeBytes: number; }
export interface AssetMedia {  url: string; savedPath: string; createdAt: string; sizeBytes: number; }
export interface AssetStoryboard {
  dir: string;
  zipPath?: string;
  thumbnails: { url: string; savedPath: string; shot: number }[];
  createdAt: string;
}
export interface AssetHyperframe {
  dir: string;
  videoPath?: string;
  videoUrl?: string;
  firstFrameUrl?: string;
  firstFramePath?: string;
  createdAt: string;
}

export interface ProjectAssets {
  images:      AssetImage[];
  videos:      AssetMedia[];
  audio:       AssetMedia[];
  storyboards: AssetStoryboard[];
  hyperframes: AssetHyperframe[];
}

function projectRoot(projectId: string): string {
  return getProjectDir(projectId);
}

/** Convert an absolute path under workspaceRoot() to a `renoir-asset://` URL. */
function urlFor(absPath: string): string {
  const base = workspaceRoot();
  let rel = path.relative(base, absPath);
  if (process.platform === 'win32') rel = rel.replace(/\\/g, '/');
  return `renoir-asset://${rel}`;
}

function listFiles(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && exts.some((x) => e.name.toLowerCase().endsWith(x)))
      .map((e) => path.join(dir, e.name));
  } catch { return []; }
}

function statSafe(p: string) {
  try { return fs.statSync(p); }
  catch { return null; }
}

export function listProjectAssets(projectId: string, opts?: { imagesLimit?: number }): ProjectAssets {
  const root = projectRoot(projectId);
  if (!fs.existsSync(root)) {
    return { images: [], videos: [], audio: [], storyboards: [], hyperframes: [] };
  }

  const imgDir = path.join(root, 'images');
  const vidDir = path.join(root, 'video');
  const audDir = path.join(root, 'audio');

  const images: AssetImage[] = listFiles(imgDir, ['.png', '.jpg', '.jpeg', '.webp'])
    .map((p) => {
      const st = statSafe(p);
      return st ? {
        url: urlFor(p), savedPath: p,
        createdAt: st.mtime.toISOString(), sizeBytes: st.size,
      } : null;
    })
    .filter(Boolean) as AssetImage[];
  images.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const videos: AssetMedia[] = listFiles(vidDir, ['.mp4', '.webm', '.mov'])
    .map((p) => {
      const st = statSafe(p);
      return st ? { url: urlFor(p), savedPath: p, createdAt: st.mtime.toISOString(), sizeBytes: st.size } : null;
    })
    .filter(Boolean) as AssetMedia[];
  videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const audio: AssetMedia[] = listFiles(audDir, ['.mp3', '.wav', '.opus', '.ogg', '.m4a'])
    .map((p) => {
      const st = statSafe(p);
      return st ? { url: urlFor(p), savedPath: p, createdAt: st.mtime.toISOString(), sizeBytes: st.size } : null;
    })
    .filter(Boolean) as AssetMedia[];
  audio.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const storyboards: AssetStoryboard[] = [];
  const hyperframes: AssetHyperframe[] = [];
  try {
    for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const full = path.join(root, ent.name);
      if (ent.name.startsWith('storyboard-')) {
        const shots = listFiles(full, ['.png']).sort();
        const zip = listFiles(full, ['.zip'])[0];
        const st = statSafe(full);
        storyboards.push({
          dir: full,
          zipPath: zip,
          thumbnails: shots.slice(0, 8).map((p, i) => ({
            url: urlFor(p), savedPath: p, shot: i + 1,
          })),
          createdAt: st?.mtime?.toISOString?.() ?? new Date().toISOString(),
        });
      } else if (ent.name.startsWith('hyperframe-')) {
        const framesDir = path.join(full, 'frames');
        const frames    = listFiles(framesDir, ['.png']).sort();
        const videoPath = listFiles(full, ['.mp4'])[0];
        const st = statSafe(full);
        hyperframes.push({
          dir: full,
          videoPath,
          videoUrl: videoPath ? urlFor(videoPath) : undefined,
          firstFramePath: frames[0],
          firstFrameUrl:  frames[0] ? urlFor(frames[0]) : undefined,
          createdAt: st?.mtime?.toISOString?.() ?? new Date().toISOString(),
        });
      }
    }
  } catch { /* swallow */ }
  storyboards.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  hyperframes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    images: images.slice(0, opts?.imagesLimit ?? 60),
    videos, audio, storyboards, hyperframes,
  };
}
