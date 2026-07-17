import { describe, it, expect } from 'vitest';
import {
  addProjectTag,
  filterProjects,
  normalizeTag,
  projectMatchesQuery,
  removeProjectTag,
  sortProjects,
} from '../src/lib/project-search';
import type { ProjectRecord } from '../src/types/global';

function proj(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 'p1',
    name: 'Acme Landing',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    conversation: [{ role: 'user', content: 'Build a SaaS hero', ts: 1 }],
    artifacts: [],
    tags: ['client'],
    ...overrides,
  };
}

describe('project-search', () => {
  it('normalizes tags', () => {
    expect(normalizeTag('  Client Work  ')).toBe('client-work');
    expect(normalizeTag('')).toBeNull();
  });

  it('matches query across name and conversation', () => {
    expect(projectMatchesQuery(proj(), 'saas')).toBe(true);
    expect(projectMatchesQuery(proj(), 'missing')).toBe(false);
  });

  it('filters and sorts by pinned', () => {
    const a = proj({ id: 'a', pinned: true, updatedAt: '2026-01-01T00:00:00Z' });
    const b = proj({ id: 'b', name: 'Beta', updatedAt: '2026-01-03T00:00:00Z' });
    const out = filterProjects([a, b], { sort: 'pinned' });
    expect(out[0].id).toBe('a');
  });

  it('sorts by name', () => {
    const a = proj({ id: 'a', name: 'Zebra' });
    const b = proj({ id: 'b', name: 'Alpha' });
    expect(sortProjects([a, b], 'name').map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('adds and removes tags with cap', () => {
    let tags = addProjectTag([], 'deck');
    tags = addProjectTag(tags, 'deck');
    expect(tags).toEqual(['deck']);
    expect(removeProjectTag(tags, 'deck')).toEqual([]);
  });
});
