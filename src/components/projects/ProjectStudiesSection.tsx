import { useMemo, useState } from 'react';
import { FolderOpen, Pin, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  addProjectTag,
  collectAllTags,
  filterProjects,
  MAX_TAGS,
  normalizeTag,
  removeProjectTag,
  type ProjectSortKey,
} from '@/lib/project-search';
import type { ProjectRecord } from '@/types/global';

export function ProjectStudiesSection({
  projects,
  onOpen,
  onSaveProject,
}: {
  projects: ProjectRecord[];
  onOpen: (p: ProjectRecord) => void;
  onSaveProject: (p: ProjectRecord) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<ProjectSortKey>('updated');
  const [showAll, setShowAll] = useState(false);

  const allTags = useMemo(() => collectAllTags(projects), [projects]);
  const filtered = useMemo(
    () => filterProjects(projects, { query, tag: tagFilter, sort }),
    [projects, query, tagFilter, sort],
  );
  const visible = showAll ? filtered : filtered.slice(0, 6);

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Continue</div>
          <h2 className="font-display text-3xl mt-1 italic tracking-tight">Recent studies</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ProjectSortKey)}
            className="text-[11px] rounded-md border border-border bg-background px-2 py-1"
          >
            <option value="updated">Updated</option>
            <option value="created">Created</option>
            <option value="name">Name</option>
            <option value="pinned">Pinned first</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search studies, briefs, tags…"
            className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg border border-border bg-background/80"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={cn(
                  'pill text-[10px]',
                  tagFilter === t && 'ring-1 ring-primary/40 bg-primary/10 text-primary',
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        {visible.map((p) => (
          <ProjectStudyCard
            key={p.id}
            project={p}
            onOpen={() => onOpen(p)}
            onSave={onSaveProject}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-[12px] text-muted-foreground mt-4">No studies match your filters.</p>
      )}

      {filtered.length > 6 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 text-[12px] text-primary hover:underline"
        >
          Show all {filtered.length} studies
        </button>
      )}
    </section>
  );
}

function ProjectStudyCard({
  project: p,
  onOpen,
  onSave,
}: {
  project: ProjectRecord;
  onOpen: () => void;
  onSave: (p: ProjectRecord) => Promise<void>;
}) {
  const [tagDraft, setTagDraft] = useState('');
  const [editingTags, setEditingTags] = useState(false);

  const togglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onSave({ ...p, pinned: !p.pinned });
  };

  const addTag = async () => {
    const next = addProjectTag(p.tags, tagDraft);
    if (next.length === (p.tags?.length ?? 0)) return;
    setTagDraft('');
    await onSave({ ...p, tags: next });
  };

  const removeTag = async (tag: string) => {
    await onSave({ ...p, tags: removeProjectTag(p.tags, tag) });
  };

  return (
    <div className="plate rounded-xl p-4 text-left group hover:-translate-y-[1px] transition-transform relative">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <span className="font-medium tracking-tight text-[13px]">{p.name}</span>
          {p.pinned && <Pin className="h-3 w-3 text-primary ml-1" />}
          <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            {timeAgo(p.updatedAt)}
          </span>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground line-clamp-1">
          {p.conversation.at(-1)?.content?.slice(0, 120) || 'No messages yet.'}
        </div>
      </button>

      <div className="mt-2 flex flex-wrap gap-1 items-center">
        {(p.tags ?? []).map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
          >
            #{t}
            {editingTags && (
              <button type="button" onClick={() => void removeTag(t)} className="hover:text-foreground">
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setEditingTags((v) => !v)}
          className="text-[10px] text-muted-foreground hover:text-foreground ml-auto"
        >
          {editingTags ? 'Done' : 'Tags'}
        </button>
        <button
          type="button"
          onClick={togglePin}
          className="text-[10px] text-muted-foreground hover:text-foreground"
          title={p.pinned ? 'Unpin' : 'Pin'}
        >
          <Pin className={cn('h-3 w-3', p.pinned && 'text-primary fill-primary/20')} />
        </button>
      </div>

      {editingTags && (p.tags?.length ?? 0) < MAX_TAGS && (
        <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addTag();
              }
            }}
            placeholder="Add tag"
            className="flex-1 text-[11px] px-2 py-1 rounded border border-border bg-background"
          />
          <button type="button" onClick={() => void addTag()} className="btn-quiet text-[10px] px-2">
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
