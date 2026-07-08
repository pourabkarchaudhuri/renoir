import type { ProjectRecord } from '@/types/global';

export type ProjectSortKey = 'updated' | 'created' | 'name' | 'pinned';

export interface ProjectSearchOptions {
  query?: string;
  tag?: string | null;
  sort?: ProjectSortKey;
  /** Extra pinned ids from local UI (e.g. prompt tabs). */
  pinnedIds?: string[];
}

const MAX_TAGS = 8;

export function normalizeTag(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 32);
  if (!t || !/^[\w-]+$/.test(t)) return null;
  return t;
}

export function projectSearchText(p: ProjectRecord): string {
  const firstUser = p.conversation.find((m) => m.role === 'user')?.content ?? '';
  const tags = (p.tags ?? []).join(' ');
  return `${p.name} ${firstUser} ${tags}`.toLowerCase();
}

export function projectMatchesQuery(p: ProjectRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = projectSearchText(p);
  return q.split(/\s+/).every((term) => hay.includes(term));
}

export function projectMatchesTag(p: ProjectRecord, tag: string | null | undefined): boolean {
  if (!tag) return true;
  const t = normalizeTag(tag);
  if (!t) return true;
  return (p.tags ?? []).includes(t);
}

export function sortProjects(
  projects: ProjectRecord[],
  sort: ProjectSortKey = 'updated',
  pinnedIds: string[] = [],
): ProjectRecord[] {
  const pinSet = new Set(pinnedIds);
  return [...projects].sort((a, b) => {
    const ap = (a.pinned || pinSet.has(a.id)) ? 1 : 0;
    const bp = (b.pinned || pinSet.has(b.id)) ? 1 : 0;
    if (sort === 'pinned' || ap !== bp) {
      if (ap !== bp) return bp - ap;
    }
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'created') return +new Date(b.createdAt) - +new Date(a.createdAt);
    return +new Date(b.updatedAt) - +new Date(a.updatedAt);
  });
}

export function filterProjects(
  projects: ProjectRecord[],
  opts: ProjectSearchOptions = {},
): ProjectRecord[] {
  const { query = '', tag = null, sort = 'updated', pinnedIds = [] } = opts;
  const filtered = projects.filter(
    (p) => projectMatchesQuery(p, query) && projectMatchesTag(p, tag),
  );
  return sortProjects(filtered, sort, pinnedIds);
}

export function collectAllTags(projects: ProjectRecord[]): string[] {
  const set = new Set<string>();
  for (const p of projects) {
    for (const t of p.tags ?? []) set.add(t);
  }
  return [...set].sort();
}

export function addProjectTag(tags: string[] | undefined, raw: string): string[] {
  const t = normalizeTag(raw);
  if (!t) return tags ?? [];
  const next = [...(tags ?? [])];
  if (next.includes(t)) return next;
  if (next.length >= MAX_TAGS) return next;
  next.push(t);
  return next;
}

export function removeProjectTag(tags: string[] | undefined, tag: string): string[] {
  return (tags ?? []).filter((t) => t !== tag);
}

export { MAX_TAGS };
