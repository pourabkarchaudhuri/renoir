// Render an HTML artifact to PDF using Electron's offscreen webContents.
// No external dependency.

import { BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { ensureProjectDir } from './workspace.js';
import { loadHtmlIntoWindow } from './load-html.js';

export interface PdfRequest {
  projectId: string;
  html: string;
  filename?: string;
  pageSize?: 'A4' | 'Letter' | 'Legal' | 'Tabloid';
  landscape?: boolean;
}

export interface PdfResult { ok: boolean; savedPath?: string; error?: string; }

export async function exportArtifactToPdf(req: PdfRequest): Promise<PdfResult> {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await loadHtmlIntoWindow(win, req.html);
    await new Promise((r) => setTimeout(r, 400));
    const buf = await win.webContents.printToPDF({
      pageSize:    req.pageSize ?? 'A4',
      landscape:   Boolean(req.landscape),
      printBackground: true,
    });
    const dir = ensureProjectDir(req.projectId);
    const filename = (req.filename || `artifact-${Date.now()}.pdf`).replace(/[^a-z0-9._-]/gi, '_');
    const savedPath = path.join(dir, filename);
    fs.writeFileSync(savedPath, buf);
    return { ok: true, savedPath };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  } finally {
    try { win.destroy(); } catch { /* swallow */ }
  }
}
