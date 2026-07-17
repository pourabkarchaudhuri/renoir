import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  fillChangelogTemplate,
  type ChangelogBrief,
} from '../shared/changelog-template.js';

function skillsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'skills');
  }
  return path.join(process.cwd(), 'skills');
}

let templateCache: string | null = null;

function loadChangelogTemplate(): string {
  if (templateCache) return templateCache;
  const file = path.join(skillsDir(), 'changelog', 'example.html');
  templateCache = fs.readFileSync(file, 'utf8');
  return templateCache;
}

export function buildChangelogFromBrief(brief: ChangelogBrief = {}): string {
  return fillChangelogTemplate(loadChangelogTemplate(), brief);
}
