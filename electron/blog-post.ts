import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  fillBlogPostTemplate,
  type BlogPostBrief,
} from '../shared/blog-post-template.js';

function skillsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'skills');
  }
  return path.join(process.cwd(), 'skills');
}

let templateCache: string | null = null;

function loadBlogPostTemplate(): string {
  if (templateCache) return templateCache;
  const file = path.join(skillsDir(), 'blog-post', 'example.html');
  templateCache = fs.readFileSync(file, 'utf8');
  return templateCache;
}

export function buildBlogPostFromBrief(brief: BlogPostBrief = {}): string {
  return fillBlogPostTemplate(loadBlogPostTemplate(), brief);
}
