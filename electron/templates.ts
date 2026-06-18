// Reusable artifact templates. The user "saves" the current artifact as a
// template; future studies can seed a new conversation from it. Stored as
// flat JSON on disk so they round-trip with the workspace folder.

import path from 'node:path';
import fs from 'node:fs';
import { workspaceRoot } from './workspace.js';

export interface TemplateRecord {
  id: string;
  name: string;
  category: string;
  notes?: string;
  body: string;
  createdAt: string;
}

function dir(): string {
  return path.join(workspaceRoot(), 'templates');
}

export function listTemplates(): TemplateRecord[] {
  fs.mkdirSync(dir(), { recursive: true });
  const out: TemplateRecord[] = [];
  for (const name of fs.readdirSync(dir())) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = fs.readFileSync(path.join(dir(), name), 'utf8');
      const rec = JSON.parse(raw) as TemplateRecord;
      out.push(rec);
    } catch { /* skip */ }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveTemplate(rec: Omit<TemplateRecord, 'id' | 'createdAt'>): TemplateRecord {
  const id = (Math.random().toString(36).slice(2) + Date.now().toString(36));
  const full: TemplateRecord = {
    id, ...rec, createdAt: new Date().toISOString(),
  };
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), `${id}.json`), JSON.stringify(full, null, 2));
  return full;
}

export function deleteTemplate(id: string): void {
  const target = path.join(dir(), `${id}.json`);
  try { fs.unlinkSync(target); } catch { /* ignore */ }
}
