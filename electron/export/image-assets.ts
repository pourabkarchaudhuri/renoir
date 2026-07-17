import fs from 'node:fs';
import path from 'node:path';
import { inferMimeFromBytes } from '../../shared/export/image-bytes.js';

function parseDataUrl(src: string): { mime: string; data: Uint8Array } | null {
  const m = src.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], data: Uint8Array.from(Buffer.from(m[2], 'base64')) };
}

function mimeFromPath(filePath: string, data?: Uint8Array): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return data ? inferMimeFromBytes(data) : 'image/png';
}

function readImageFile(filePath: string): { data: Uint8Array; mime: string } | null {
  try {
    const raw = fs.readFileSync(filePath);
    const data = Uint8Array.from(raw);
    return { data, mime: mimeFromPath(filePath, data) };
  } catch {
    return null;
  }
}

function resolveRenoirAssetPath(src: string, workspaceRoot?: string): string | null {
  const rest = decodeURIComponent(src.slice('renoir-asset://'.length));
  if (!rest) return null;
  if (path.isAbsolute(rest)) return rest;
  if (!workspaceRoot) return null;
  return path.join(workspaceRoot, rest.replace(/^\/+/, ''));
}

export async function fetchExportImage(
  src: string,
  workspaceRoot?: string,
): Promise<{ data: Uint8Array; mime: string } | null> {
  if (!src) return null;

  const dataUrl = parseDataUrl(src);
  if (dataUrl) return dataUrl;

  if (src.startsWith('renoir-asset://')) {
    const filePath = resolveRenoirAssetPath(src, workspaceRoot);
    if (filePath && fs.existsSync(filePath)) return readImageFile(filePath);
    return null;
  }

  if (src.startsWith('file://')) {
    try {
      const filePath = decodeURIComponent(src.replace(/^file:\/\//, ''));
      return readImageFile(filePath);
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(src)) {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const data = new Uint8Array(buf);
      const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || inferMimeFromBytes(data);
      return { data, mime };
    } catch {
      return null;
    }
  }

  if (workspaceRoot && !src.includes('://')) {
    const rel = src.replace(/^\//, '');
    const filePath = path.join(workspaceRoot, rel);
    if (fs.existsSync(filePath)) return readImageFile(filePath);
  }

  return null;
}

export function createImageFetcher(workspaceRoot?: string) {
  return async (src: string): Promise<Uint8Array | null> => {
    const result = await fetchExportImage(src, workspaceRoot);
    return result?.data ?? null;
  };
}
