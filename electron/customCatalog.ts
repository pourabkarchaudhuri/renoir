// User-authored custom skills + design systems. Persisted as flat JSON
// alongside the workspace so they round-trip with the user's data.

import path from 'node:path';
import fs from 'node:fs';
import { workspaceRoot } from './workspace.js';

export interface CustomSkill {
  id: string;
  name: string;
  category: 'web' | 'mobile' | 'deck' | 'doc' | 'media' | 'system';
  blurb: string;
  emoji: string;
  primer: string;
  questions: { id: string; label: string; type: 'text' | 'textarea' | 'select'; options?: string[] }[];
}

export interface CustomDesignSystem {
  id: string;
  name: string;
  vibe: string;
  swatches: string[];
  font: string;
  tokens: { name: string; value: string }[];
}

export interface CustomDirection {
  id: string;
  name: string;
  vibe: string;
  swatches: string[];
  font: string;
  tagline: string;
}

function dir(): string {
  return path.join(workspaceRoot(), 'custom');
}
function skillsFile(): string     { return path.join(dir(), 'skills.json'); }
function systemsFile(): string    { return path.join(dir(), 'systems.json'); }
function directionsFile(): string { return path.join(dir(), 'directions.json'); }

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJson<T>(file: string, value: T): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

export const customCatalog = {
  listSkills(): CustomSkill[]   { return readJson<CustomSkill[]>(skillsFile(), []); },
  listSystems(): CustomDesignSystem[] { return readJson<CustomDesignSystem[]>(systemsFile(), []); },

  upsertSkill(rec: CustomSkill): CustomSkill {
    const all = customCatalog.listSkills();
    const idx = all.findIndex((s) => s.id === rec.id);
    if (idx >= 0) all[idx] = rec; else all.push(rec);
    writeJson(skillsFile(), all);
    return rec;
  },
  deleteSkill(id: string): void {
    writeJson(skillsFile(), customCatalog.listSkills().filter((s) => s.id !== id));
  },

  upsertSystem(rec: CustomDesignSystem): CustomDesignSystem {
    const all = customCatalog.listSystems();
    const idx = all.findIndex((s) => s.id === rec.id);
    if (idx >= 0) all[idx] = rec; else all.push(rec);
    writeJson(systemsFile(), all);
    return rec;
  },
  deleteSystem(id: string): void {
    writeJson(systemsFile(), customCatalog.listSystems().filter((s) => s.id !== id));
  },

  listDirections(): CustomDirection[] { return readJson<CustomDirection[]>(directionsFile(), []); },
  upsertDirection(rec: CustomDirection): CustomDirection {
    const all = customCatalog.listDirections();
    const idx = all.findIndex((d) => d.id === rec.id);
    if (idx >= 0) all[idx] = rec; else all.push(rec);
    writeJson(directionsFile(), all);
    return rec;
  },
  deleteDirection(id: string): void {
    writeJson(directionsFile(), customCatalog.listDirections().filter((d) => d.id !== id));
  },
};
