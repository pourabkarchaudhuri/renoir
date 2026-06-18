// Project export/import as ZIP. Round-trips the project record + every
// artifact file in its workspace dir.

import path from 'node:path';
import fs from 'node:fs';
import { dialog } from 'electron';
import { store, ProjectRecord } from './store.js';
import { writeZipToFile, readZipFromFile, ZipEntry } from './zipio.js';
import { projectDir } from './workspace.js';

const MANIFEST_NAME = 'renoir-project.json';

function projectWorkspace(projectId: string): string {
  return projectDir(projectId);
}

function walk(root: string, base = ''): { fsPath: string; rel: string }[] {
  const out: { fsPath: string; rel: string }[] = [];
  if (!fs.existsSync(root)) return out;
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    const fsPath = path.join(root, ent.name);
    const rel    = path.posix.join(base, ent.name);
    if (ent.isDirectory()) out.push(...walk(fsPath, rel));
    else if (ent.isFile()) out.push({ fsPath, rel });
  }
  return out;
}

export async function exportProject(projectId: string): Promise<{ ok: boolean; savedPath?: string; error?: string }> {
  const rec = store.getProject(projectId);
  if (!rec) return { ok: false, error: 'project not found' };

  const ws = projectWorkspace(projectId);
  const files = walk(ws);

  const entries: ZipEntry[] = [];
  entries.push({
    name: MANIFEST_NAME,
    data: Buffer.from(JSON.stringify({ project: rec, exportedAt: new Date().toISOString() }, null, 2), 'utf8'),
  });
  for (const f of files) {
    entries.push({ name: `workspace/${f.rel}`, data: fs.readFileSync(f.fsPath) });
  }

  const win = (await import('electron')).BrowserWindow.getFocusedWindow();
  const safeName = (rec.name || 'project').replace(/[^a-z0-9._-]/gi, '_');
  const result = await dialog.showSaveDialog(win || undefined as any, {
    defaultPath: `${safeName}-${rec.id.slice(0, 6)}.renoir.zip`,
    filters: [{ name: 'Renoir project', extensions: ['zip'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, error: 'cancelled' };

  writeZipToFile(result.filePath, entries);
  return { ok: true, savedPath: result.filePath };
}

export async function importProject(): Promise<{ ok: boolean; project?: ProjectRecord; error?: string }> {
  const win = (await import('electron')).BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win || undefined as any, {
    properties: ['openFile'],
    filters: [{ name: 'Renoir / Open-Design project', extensions: ['zip'] }],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, error: 'cancelled' };

  const entries = readZipFromFile(result.filePaths[0]);
  const manifestEntry = entries.find((e) => e.name === MANIFEST_NAME);

  let rec: ProjectRecord;
  if (manifestEntry) {
    const parsed = JSON.parse(manifestEntry.data.toString('utf8'));
    rec = parsed.project as ProjectRecord;
    rec.id = `${rec.id || ''}_imp_${Math.random().toString(36).slice(2, 7)}`;
    rec.updatedAt = new Date().toISOString();
  } else {
    // Generic ZIP — synthesize a project that just bundles the contents.
    rec = {
      id: `imp_${Date.now().toString(36)}`,
      name: path.basename(result.filePaths[0], '.zip'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conversation: [],
      artifacts: [],
    };
  }

  // Land workspace files
  const ws = projectWorkspace(rec.id);
  fs.mkdirSync(ws, { recursive: true });
  for (const e of entries) {
    if (e.name === MANIFEST_NAME) continue;
    let target = e.name;
    if (target.startsWith('workspace/')) target = target.slice('workspace/'.length);
    const out = path.join(ws, target);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, e.data);
  }

  store.upsertProject(rec);
  return { ok: true, project: rec };
}
