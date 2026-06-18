// Loads skills from the `skills/` directory at runtime.
// Each skill is a folder with a SKILL.md file containing YAML front-matter
// and a markdown body that serves as the primer/system-prompt for the agent.

import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface LoadedSkill {
  id: string;
  name: string;
  category: 'web' | 'mobile' | 'deck' | 'doc' | 'media' | 'system';
  blurb: string;
  emoji: string;
  primer: string;
  questions: { id: string; label: string; type: 'text' | 'textarea' | 'select'; options?: string[] }[];
  /** Original triggers from SKILL.md for keyword matching */
  triggers?: string[];
}

/** Resolve the skills directory — in dev it's at project root, in prod it's bundled. */
function skillsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'skills');
  }
  return path.join(process.cwd(), 'skills');
}

/** Simple YAML front-matter parser (no dependency needed for basic key: value). */
function parseFrontMatter(content: string): { meta: Record<string, any>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const raw = match[1];
  const body = match[2];
  const meta: Record<string, any> = {};

  // Parse simple YAML (key: value, key: | multiline, key: [array])
  let currentKey = '';
  let multiline = false;
  let multilineValue = '';

  for (const line of raw.split('\n')) {
    if (multiline) {
      if (line.startsWith('  ') || line.startsWith('\t')) {
        multilineValue += line.trim() + ' ';
        continue;
      } else {
        meta[currentKey] = multilineValue.trim();
        multiline = false;
      }
    }

    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      if (value === '|' || value === '>') {
        currentKey = key;
        multiline = true;
        multilineValue = '';
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array
        meta[key] = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      } else if (value.startsWith('"') || value.startsWith("'")) {
        meta[key] = value.replace(/^["']|["']$/g, '');
      } else {
        meta[key] = value || true;
      }
    } else if (line.startsWith('  - ')) {
      // Array continuation
      const item = line.replace(/^\s*-\s*/, '').replace(/^["']|["']$/g, '');
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      (meta[currentKey] as string[]).push(item);
    }
  }
  if (multiline) meta[currentKey] = multilineValue.trim();

  return { meta, body };
}

/** Infer category from skill metadata or name. */
function inferCategory(meta: Record<string, any>, id: string): LoadedSkill['category'] {
  const platform = meta.od?.platform || meta.platform || '';
  const mode = meta.od?.mode || meta.mode || '';
  const scenario = meta.od?.scenario || meta.scenario || '';

  if (platform === 'mobile') return 'mobile';
  if (id.includes('deck') || id.includes('ppt')) return 'deck';
  if (id.includes('video') || id.includes('audio') || id.includes('motion') || id.includes('sprite') || id.includes('hyperframe')) return 'media';
  if (id.includes('doc') || id.includes('blog') || id.includes('report') || id.includes('notes') || id.includes('runbook') || id.includes('spec') || id.includes('okr') || id.includes('invoice') || id.includes('meeting')) return 'doc';
  if (scenario === 'design' || mode === 'prototype') return 'web';
  return 'web';
}

/** Infer emoji from skill name/id. */
function inferEmoji(id: string, name: string): string {
  const map: Record<string, string> = {
    'saas-landing': '🚀', 'dashboard': '📊', 'mobile-app': '📱', 'pricing': '💵',
    'blog': '✍️', 'invoice': '🧾', 'email': '📧', 'social': '📱', 'kanban': '📌',
    'wireframe': '✏️', 'finance': '📈', 'meeting': '📝', 'okr': '🎯', 'poster': '🖼️',
    'gamif': '🎮', 'guide': '📖', 'onboarding': '🚪', 'runbook': '🔧', 'docs': '📚',
    'deck': '🎤', 'ppt': '📽️', 'video': '🎬', 'audio': '🎵', 'motion': '🎞️',
    'prototype': '🌐', 'web': '🌐', 'landing': '🚀', 'dating': '💕',
    'changelog': '🗒️', 'admin': '🛠️', 'critique': '🔍', 'brief': '📋',
    'weekly': '📅', 'pet': '🐾', 'image': '🖼️', 'hyperframe': '⚡',
    'live': '⚡', 'sprite': '🎨', 'carousel': '🎠', 'tweaks': '🔧',
  };
  for (const [key, emoji] of Object.entries(map)) {
    if (id.includes(key) || name.toLowerCase().includes(key)) return emoji;
  }
  return '✨';
}

let cache: LoadedSkill[] | null = null;

export function loadSkillsFromDisk(force = false): LoadedSkill[] {
  if (cache && !force) return cache;

  const dir = skillsDir();
  if (!fs.existsSync(dir)) {
    cache = [];
    return cache;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const skills: LoadedSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillMd = path.join(dir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    try {
      const content = fs.readFileSync(skillMd, 'utf8');
      const { meta, body } = parseFrontMatter(content);

      const id = meta.name || entry.name;
      const name = (meta.name || entry.name)
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      const description = typeof meta.description === 'string' ? meta.description.trim() : '';
      const triggers = Array.isArray(meta.triggers) ? meta.triggers : [];

      skills.push({
        id,
        name,
        category: inferCategory(meta, id),
        blurb: description || `${name} skill from Open Design.`,
        emoji: inferEmoji(id, name),
        primer: body.trim(),
        questions: [
          { id: 'audience', label: 'Who is this for?', type: 'text' },
          { id: 'tone', label: 'Tone', type: 'select', options: ['minimal', 'editorial', 'energetic', 'technical', 'playful', 'warm'] },
          { id: 'scope', label: 'What must be present?', type: 'textarea' },
        ],
        triggers,
      });
    } catch {
      // Skip malformed skills silently
    }
  }

  cache = skills;
  return cache;
}
