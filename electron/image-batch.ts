// Batch image generation with concurrency control, caching, and progress events.
// Main-process module — uses Node.js crypto for hashing and fs for file checks.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { generateImage } from './image.js';
import { clampImageSize } from '../shared/image-size.js';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface BatchImageItem {
  id: string;
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

export interface BatchImageRequest {
  items: BatchImageItem[];
  projectId: string;
  concurrency?: number;
}

export interface BatchImageResultItem {
  id: string;
  ok: boolean;
  dataUrl?: string;
  savedPath?: string;
  error?: string;
}

export interface BatchImageResult {
  ok: boolean;
  results: BatchImageResultItem[];
}

export interface CacheEntry {
  promptHash: string;
  size: string;
  quality: string;
  savedPath: string;
  dataUrl?: string;
  createdAt: string;
}

export interface ImageCacheStore {
  entries: CacheEntry[];
  maxEntries: number;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

/** In-memory per-project caches. Key = projectId */
const projectCaches = new Map<string, ImageCacheStore>();

const MAX_CACHE_ENTRIES = 200;

export function computePromptHash(prompt: string, size: string, quality: string): string {
  return crypto.createHash('sha256').update(`${prompt}|${size}|${quality}`).digest('hex');
}

function getCache(projectId: string): ImageCacheStore {
  let cache = projectCaches.get(projectId);
  if (!cache) {
    cache = { entries: [], maxEntries: MAX_CACHE_ENTRIES };
    projectCaches.set(projectId, cache);
  }
  return cache;
}

function lookupCache(projectId: string, promptHash: string): CacheEntry | undefined {
  const cache = getCache(projectId);
  const idx = cache.entries.findIndex((e) => e.promptHash === promptHash);
  if (idx === -1) return undefined;

  const entry = cache.entries[idx];

  // Stale detection: verify file exists on disk
  if (!fs.existsSync(entry.savedPath)) {
    // Remove stale entry
    cache.entries.splice(idx, 1);
    return undefined;
  }

  // Move to end for LRU (most recently used at the end)
  cache.entries.splice(idx, 1);
  cache.entries.push(entry);
  return entry;
}

function insertCache(projectId: string, entry: CacheEntry): void {
  const cache = getCache(projectId);

  // LRU eviction: remove oldest entries if at capacity
  while (cache.entries.length >= cache.maxEntries) {
    cache.entries.shift();
  }

  cache.entries.push(entry);
}

/** Exposed for testing — clears all caches */
export function clearAllCaches(): void {
  projectCaches.clear();
}

/** Exposed for testing — get cache state */
export function getCacheForProject(projectId: string): ImageCacheStore {
  return getCache(projectId);
}

// ─── Semaphore ───────────────────────────────────────────────────────────────

class Semaphore {
  private _count: number;
  private _queue: Array<() => void> = [];

  constructor(max: number) {
    this._count = max;
  }

  async acquire(): Promise<void> {
    if (this._count > 0) {
      this._count--;
      return;
    }
    return new Promise<void>((resolve) => {
      this._queue.push(resolve);
    });
  }

  release(): void {
    const next = this._queue.shift();
    if (next) {
      next();
    } else {
      this._count++;
    }
  }

  get available(): number {
    return this._count;
  }
}

// ─── Progress Broadcasting ───────────────────────────────────────────────────

function broadcastProgress(completed: number, total: number, itemId: string, ok: boolean): void {
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('renoir:image:batchProgress', {
        completed,
        total,
        itemId,
        ok,
      });
    }
  } catch {
    // Best-effort — don't crash if windows are closed
  }
}

// ─── Main Function ───────────────────────────────────────────────────────────

const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 6;

export async function batchGenerateImages(req: BatchImageRequest): Promise<BatchImageResult> {
  const { items, projectId } = req;
  const concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, req.concurrency ?? DEFAULT_CONCURRENCY));

  if (!items || items.length === 0) {
    return { ok: false, results: [] };
  }

  const semaphore = new Semaphore(concurrency);
  const results: BatchImageResultItem[] = new Array(items.length);
  let completed = 0;
  let anySuccess = false;

  const tasks = items.map(async (item, index) => {
    const size = clampImageSize(item.size);
    const quality = item.quality ?? 'auto';
    const promptHash = computePromptHash(item.prompt, size, quality);

    // Check cache first
    const cached = lookupCache(projectId, promptHash);
    if (cached) {
      const resultItem: BatchImageResultItem = {
        id: item.id,
        ok: true,
        savedPath: cached.savedPath,
        dataUrl: cached.dataUrl,
      };

      // If no dataUrl in cache, read from disk
      if (!resultItem.dataUrl && cached.savedPath) {
        try {
          const buf = fs.readFileSync(cached.savedPath);
          resultItem.dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
        } catch {
          // File read failed — treat as cache miss, fall through to generation
          results[index] = await generateSingle(item, size, quality, promptHash, projectId, semaphore);
          completed++;
          anySuccess = anySuccess || results[index].ok;
          broadcastProgress(completed, items.length, item.id, results[index].ok);
          return;
        }
      }

      results[index] = resultItem;
      completed++;
      anySuccess = true;
      broadcastProgress(completed, items.length, item.id, true);
      return;
    }

    // Cache miss — generate via Azure API with semaphore
    results[index] = await generateSingle(item, size, quality, promptHash, projectId, semaphore);
    completed++;
    anySuccess = anySuccess || results[index].ok;
    broadcastProgress(completed, items.length, item.id, results[index].ok);
  });

  await Promise.all(tasks);

  return {
    ok: anySuccess,
    results,
  };
}

async function generateSingle(
  item: BatchImageItem,
  size: string,
  quality: string,
  promptHash: string,
  projectId: string,
  semaphore: Semaphore,
): Promise<BatchImageResultItem> {
  await semaphore.acquire();
  try {
    const genResult = await generateImage({
      prompt: item.prompt,
      size: size as any,
      quality: quality as any,
      n: 1,
      projectId,
    });

    if (!genResult.ok || !genResult.images?.length) {
      return {
        id: item.id,
        ok: false,
        error: genResult.error || 'Image generation failed',
      };
    }

    const image = genResult.images[0];

    // Cache the result
    insertCache(projectId, {
      promptHash,
      size,
      quality,
      savedPath: image.savedPath || '',
      dataUrl: image.dataUrl,
      createdAt: new Date().toISOString(),
    });

    return {
      id: item.id,
      ok: true,
      dataUrl: image.dataUrl,
      savedPath: image.savedPath,
    };
  } catch (err: any) {
    return {
      id: item.id,
      ok: false,
      error: err?.message || String(err),
    };
  } finally {
    semaphore.release();
  }
}
