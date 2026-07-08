import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  fillMarketingSiteTemplate,
  type MarketingSiteBrief,
} from '../shared/marketing-site-template.js';

function skillsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'skills');
  }
  return path.join(process.cwd(), 'skills');
}

let templateCache: string | null = null;

function loadMarketingTemplate(): string {
  if (templateCache) return templateCache;
  const file = path.join(skillsDir(), 'saas-landing', 'example.html');
  templateCache = fs.readFileSync(file, 'utf8');
  return templateCache;
}

export function buildMarketingSiteFromBrief(brief: MarketingSiteBrief = {}): string {
  return fillMarketingSiteTemplate(loadMarketingTemplate(), brief);
}
