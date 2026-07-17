import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Sparkles, Palette, Wand2, ChevronDown, ChevronLeft, ChevronRight, Search, Check, Plus, MessageSquare, Pin, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandSpecPanel } from './BrandSpecPanel';
import { A11yPanel, a11yHtmlFromArtifact } from './A11yPanel';
import { FlowMapPanel } from './FlowMapPanel';
import { iconForSkill } from '@/lib/skill-icons';
import { filterProjects } from '@/lib/project-search';
import { loadSession, projectHasSkillWork, skillDisplayName, setSkillSessionName, syncActiveSession, previewHtmlForSkill } from '@/lib/skill-sessions';
import { extractArtifact } from '@/lib/prompt';
import { AgentPicker } from './AgentPicker';
import { ByokInline } from './ByokInline';
import type { ProjectRecord } from '@/types/global';
import { ConfirmDialog } from '@/components/chrome/ConfirmDialog';

/**
 * Compact studio sidebar — three compact pickers (Skill / System / Direction)
 * stacked vertically. Each opens a searchable popover so the 30+ skills,
 * 70+ systems, and 5+ directions don't dominate the rail.
 */
export function LeftRail() {
  const skills        = useCatalog((s) => s.skills);
  const designSystems = useCatalog((s) => s.designSystems);
  const directions    = useCatalog((s) => s.directions);
  const skillId       = useStudio((s) => s.selectedSkillId);
  const systemId      = useStudio((s) => s.selectedDesignSystemId);
  const directionId   = useStudio((s) => s.selectedDirectionId);
  const setSkill      = useStudio((s) => s.setSkill);
  const switchSkill   = useStudio((s) => s.switchSkill);
  const setSystem     = useStudio((s) => s.setSystem);
  const setDirection  = useStudio((s) => s.setDirection);
  const setDraft      = useStudio((s) => s.setDraft);
  const project       = useStudio((s) => s.project);
  const setProject    = useStudio((s) => s.setProject);
  const toast         = useUI((s) => s.toast);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [pendingDelete, setPendingDelete] = useState<ProjectRecord | null>(null);

  const refreshProjects = async () => {
    const list = await window.renoir.listProjects();
    setProjects(list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
  };

  const openNewPromptTab = async (activeSkill?: string) => {
    const skill = activeSkill || skillId || 'web-prototype';
    const rec = await window.renoir.createProject({
      name: 'Untitled prompt',
      skillId: skill,
      conversation: [],
      artifacts: [],
      skillSessions: {},
    });
    setProject(loadSession(rec, skill));
    setSkill(skill);
    await refreshProjects();
    return rec;
  };

  // Default selections.
  useEffect(() => {
    if (!skillId && skills[0]) setSkill(skills[0].id);
    if (!systemId && designSystems[0]) setSystem(designSystems[0].id);
  }, [skills, designSystems, skillId, systemId, setSkill, setSystem]);
  useEffect(() => { void refreshProjects(); }, []);
  useEffect(() => { void refreshProjects(); }, [project?.id, project?.updatedAt]);

  const skill     = skills.find((s) => s.id === skillId);
  const system    = designSystems.find((s) => s.id === systemId);
  const direction = directions.find((d) => d.id === directionId);
  const SkillIcon = skill ? iconForSkill(skill.id) : Sparkles;

  const selectSkill = (id: string) => {
    if (id === skillId) return;
    const next = skills.find((s) => s.id === id);
    void (async () => {
      await switchSkill(id);
      if (next) toast(`Switched to ${next.name}`, 'info');
    })();
  };

  const skillProjects = useMemo(() => {
    if (!skillId) return projects;
    return projects.filter((p) =>
      projectHasSkillWork(p, skillId) ||
      (project?.id === p.id && project.skillId === skillId),
    );
  }, [projects, skillId, project?.id, project?.skillId]);

  const activeStudy = project && skillId && project.skillId === skillId ? project : undefined;
  const collapsed = useUI((s) => s.railCollapsed);
  const toggleRail = useUI((s) => s.toggleRail);

  const a11yArtifactHtml = useMemo(() => {
    if (!project || !skillId) return null;
    const cached = previewHtmlForSkill(project, skillId);
    if (cached) return cached;
    const last = project.conversation.findLast((m) => m.role === 'assistant');
    if (!last) return null;
    return extractArtifact(last.content)?.html ?? null;
  }, [project, skillId]);

  if (collapsed) {
    return (
      <aside className="w-[44px] shrink-0 border-r border-border bg-background/40 backdrop-blur-md flex flex-col items-center py-3 gap-1.5">
        <button
          onClick={toggleRail}
          className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="h-px w-6 bg-border my-1" />
        <CollapsedTile icon={<SkillIcon className="h-4 w-4" strokeWidth={1.6} />} label={skill?.name || 'Skill'}     onClick={toggleRail} />
        <CollapsedTile icon={system?.swatches?.length ? <SwatchSquare swatches={system.swatches} /> : <Palette className="h-4 w-4" strokeWidth={1.6} />} label={system?.name || 'System'} onClick={toggleRail} />
        <CollapsedTile icon={direction?.swatches?.length ? <SwatchSquare swatches={direction.swatches} /> : <Wand2 className="h-4 w-4" strokeWidth={1.6} />} label={direction?.name || 'Direction'} onClick={toggleRail} />
      </aside>
    );
  }

  return (
    <aside className="w-[280px] shrink-0 border-r border-border bg-background/40 backdrop-blur-md flex flex-col min-h-0">
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">Study</div>
          <button
            onClick={toggleRail}
            className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
        <RailRename project={activeStudy} skillId={skillId} />
        <RailActions />
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-3 py-3 space-y-2 min-h-0">
        <Picker
          label="Skill"
          eyebrow={<SkillIcon className="h-3 w-3 text-primary" strokeWidth={1.6} />}
          value={skill?.name}
          subtitle={skill?.blurb}
          accent={null}
          options={skills.map((s) => ({
            id: s.id, name: s.name, blurb: s.blurb,
            icon: iconForSkill(s.id),
          }))}
          selectedId={skillId}
          onSelect={selectSkill}
        />
        <Picker
          label="System"
          eyebrow={<Palette className="h-3 w-3 text-primary" strokeWidth={1.6} />}
          value={system?.name}
          subtitle={system?.vibe}
          accent={system ? <SwatchRow swatches={system.swatches} /> : null}
          options={designSystems.map((d) => ({
            id: d.id, name: d.name, blurb: d.vibe,
            swatches: d.swatches,
          }))}
          selectedId={systemId}
          onSelect={setSystem}
        />
        <Picker
          label="Direction"
          eyebrow={<Wand2 className="h-3 w-3 text-primary" strokeWidth={1.6} />}
          value={direction?.name || '— none —'}
          subtitle={direction?.tagline || 'Optional palette + font hint'}
          accent={direction ? <SwatchRow swatches={direction.swatches} /> : null}
          options={[
            { id: '', name: '— none —', blurb: 'No direction injected' },
            ...directions.map((d) => ({
              id: d.id, name: d.name, blurb: d.tagline,
              swatches: d.swatches,
            })),
          ]}
          selectedId={directionId || ''}
          onSelect={(id) => setDirection(id || undefined)}
        />
        <ByokInline />
        <PromptTabs
          projects={skillProjects}
          skillId={skillId}
          activeProjectId={project?.id}
          onOpen={async (p) => {
            if (!skillId || !projectHasSkillWork(p, skillId)) return;
            const fresh = await window.renoir.readProject(p.id);
            const base = fresh ?? p;
            const loaded = loadSession(base, skillId);
            if (!base.skillSessions && (base.conversation?.length ?? 0) > 0) {
              let synced = syncActiveSession(loaded, skillId);
              if (base.name?.trim()) {
                synced = setSkillSessionName(synced, skillId, base.name.trim());
              }
              await window.renoir.saveProject(synced);
              setProject(synced);
            } else {
              setProject(loaded);
            }
            setSkill(skillId);
          }}
          onCreate={async () => {
            await openNewPromptTab();
          }}
          onDelete={(p) => { setPendingDelete(p); }}
          onRenamed={refreshProjects}
        />
      </div>
      <A11yPanel
        html={a11yHtmlFromArtifact(a11yArtifactHtml, {
          title: project?.name?.trim() || 'Artifact',
          skillId,
        })}
      />
      <FlowMapPanel
        artifactHtml={a11yArtifactHtml}
        onNavigate={(screenId) => {
          window.dispatchEvent(new CustomEvent('renoir:flow-nav-request', { detail: { screenId } }));
        }}
      />
      <BrandSpecPanel />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete prompt tab?"
        message={pendingDelete ? `This will permanently delete "${pendingDelete.name}".` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const p = pendingDelete;
          setPendingDelete(null);
          if (!p) return;
          void (async () => {
            await window.renoir.deleteProject(p.id);
            if (project?.id === p.id) {
              const rest = (await window.renoir.listProjects()).filter((x) => x.id !== p.id);
              const next = rest[0];
              if (next) {
                const activeSkill = skillId || next.skillId || 'web-prototype';
                setProject(loadSession(next, activeSkill));
                setSkill(activeSkill);
              } else {
                await openNewPromptTab(skillId || 'web-prototype');
              }
            }
            await refreshProjects();
          })();
        }}
      />
    </aside>
  );
}

const PINNED_KEY = 'renoir.pinnedPrompts';

function readPinnedIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

function writePinnedIds(ids: string[]) {
  try { localStorage.setItem(PINNED_KEY, JSON.stringify(ids)); } catch { /* swallow */ }
}

function PromptTabs({
  projects, skillId, activeProjectId, onOpen, onCreate, onDelete, onRenamed,
}: {
  projects: ProjectRecord[];
  skillId?: string;
  activeProjectId?: string;
  onOpen: (p: ProjectRecord) => void | Promise<void>;
  onCreate: () => void | Promise<void>;
  onDelete: (p: ProjectRecord) => void | Promise<void>;
  onRenamed?: () => void | Promise<void>;
}) {
  const setProject = useStudio((s) => s.setProject);
  const [pinnedIds, setPinnedIds] = useState<string[]>(readPinnedIds);
  const [menuFor, setMenuFor] = useState<{ id: string; top: number; left: number } | null>(null);
  const [renaming, setRenaming] = useState<ProjectRecord | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuAnchorRef = useRef<HTMLElement | null>(null);
  const renameBackdropDown = useRef(false);

  const sorted = useMemo(() => {
    const pinSet = new Set(pinnedIds);
    return filterProjects(projects, { query: searchQuery, sort: 'pinned', pinnedIds: [...pinSet] });
  }, [projects, pinnedIds, searchQuery]);

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writePinnedIds(next);
      return next;
    });
  };

  const startRename = (p: ProjectRecord) => {
    if (!skillId) return;
    setRenaming(p);
    setRenameDraft(skillDisplayName(p, skillId));
  };

  const saveRename = async () => {
    if (!renaming || !skillId) return;
    const nextName = renameDraft.trim();
    setRenaming(null);
    const prevName = skillDisplayName(renaming, skillId);
    if (!nextName || nextName === prevName) return;
    const fresh = await window.renoir.readProject(renaming.id);
    const base = fresh ?? renaming;
    const hydrated = loadSession(base, skillId);
    const next = setSkillSessionName(hydrated, skillId, nextName);
    await window.renoir.saveProject(next);
    if (activeProjectId === renaming.id) setProject(loadSession(next, skillId));
    await onRenamed?.();
  };

  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (menuAnchorRef.current?.contains(t)) return;
      setMenuFor(null);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuFor(null); };
    const timer = window.setTimeout(() => {
      window.addEventListener('mousedown', onDown);
    }, 0);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [menuFor]);

  const openMenu = (p: ProjectRecord, anchor: HTMLElement) => {
    if (menuFor?.id === p.id) {
      setMenuFor(null);
      menuAnchorRef.current = null;
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuW = 190;
    const menuH = 132;
    const left = Math.min(rect.right + 6, window.innerWidth - menuW - 8);
    const top = Math.min(rect.top, window.innerHeight - menuH - 8);
    menuAnchorRef.current = anchor;
    setMenuFor({ id: p.id, left: Math.max(8, left), top: Math.max(8, top) });
  };

  const menuProject = menuFor ? projects.find((p) => p.id === menuFor.id) : null;

  return (
    <div className="plate-soft rounded-xl px-2.5 py-2 mt-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">Prompts</div>
        <button
          onClick={() => void onCreate()}
          className="ml-auto h-6 w-6 rounded-md grid place-items-center hover:bg-accent text-muted-foreground hover:text-foreground"
          title="New prompt tab"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {projects.length > 2 && (
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter prompts…"
          className="w-full mb-2 text-[11px] px-2 py-1 rounded border border-border bg-background"
        />
      )}
      <div className="space-y-1 max-h-[170px] overflow-y-auto scroll-thin">
        {!projects.length && (
          <p className="text-[11px] text-muted-foreground px-2 py-2 leading-relaxed">
            No prompts for this skill yet. Use + to start one.
          </p>
        )}
        {sorted.map((p) => {
          const active = p.id === activeProjectId;
          const isPinned = pinnedIds.includes(p.id);
          const menuOpen = menuFor?.id === p.id;
          const tabName = skillId ? skillDisplayName(p, skillId) : p.name;
          return (
            <div
              key={p.id}
              className={cn(
                'group relative rounded-md border border-transparent transition-colors',
                active ? 'bg-primary/10 border-primary/30' : 'hover:bg-accent',
              )}
            >
              <button
                type="button"
                onClick={() => void onOpen(p)}
                className="w-full text-left rounded-md px-2 py-1.5 pr-14"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className={cn('text-[11.5px] font-medium truncate', active && 'text-primary')}>
                    {tabName}
                  </span>
                  {isPinned && (
                    <Pin className="h-2.5 w-2.5 text-primary shrink-0 opacity-80" />
                  )}
                </div>
              </button>

              <div
                className={cn(
                  'absolute right-1 top-1/2 -translate-y-1/2 z-10 flex items-center gap-0.5 transition-opacity',
                  menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); togglePin(p.id); }}
                  className={cn(
                    'h-6 w-6 rounded-md grid place-items-center hover:bg-background/60',
                    isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                  title={isPinned ? 'Unpin chat' : 'Pin chat'}
                >
                  <Pin className="h-3 w-3" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openMenu(p, e.currentTarget);
                  }}
                  className={cn(
                    'h-6 w-6 rounded-md grid place-items-center hover:bg-background/60',
                    menuOpen ? 'text-foreground bg-background/40' : 'text-muted-foreground hover:text-foreground',
                  )}
                  title="More options"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {projects.length === 0 && (
          <div className="text-[11px] text-muted-foreground italic px-1 py-2">No prompts yet.</div>
        )}
      </div>

      {menuFor && menuProject && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[200] w-[190px] plate rounded-xl p-1 shadow-plate border border-border"
          style={{ left: menuFor.left, top: menuFor.top }}
        >
          <button
            type="button"
            className="w-full text-left rounded-md px-2.5 py-1.5 text-[12px] hover:bg-accent flex items-center gap-2"
            onClick={() => {
              startRename(menuProject);
              setMenuFor(null);
              menuAnchorRef.current = null;
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            Rename
          </button>
          <button
            type="button"
            className="w-full text-left rounded-md px-2.5 py-1.5 text-[12px] hover:bg-accent flex items-center gap-2"
            onClick={() => { togglePin(menuProject.id); setMenuFor(null); menuAnchorRef.current = null; }}
          >
            <Pin className="h-3.5 w-3.5 text-muted-foreground" />
            {pinnedIds.includes(menuProject.id) ? 'Unpin chat' : 'Pin chat'}
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="w-full text-left rounded-md px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-accent flex items-center gap-2"
            onClick={() => { onDelete(menuProject); setMenuFor(null); menuAnchorRef.current = null; }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>,
        document.body,
      )}

      {renaming && createPortal(
        <div
          className="fixed inset-0 z-[210] grid place-items-center bg-black/55 backdrop-blur-sm p-6"
          onMouseDown={(e) => {
            renameBackdropDown.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (renameBackdropDown.current && e.target === e.currentTarget) setRenaming(null);
            renameBackdropDown.current = false;
          }}
        >
          <div
            className="plate rounded-2xl w-full max-w-[440px] overflow-hidden shadow-plate"
            onMouseDown={(e) => {
              renameBackdropDown.current = false;
              e.stopPropagation();
            }}
          >
            <header className="px-5 py-3.5 border-b border-border">
              <div className="font-display italic text-xl">Rename</div>
            </header>
            <div className="px-5 py-4">
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveRename();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="Prompt name"
              />
            </div>
            <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setRenaming(null)} className="btn-quiet">Cancel</button>
              <button
                type="button"
                onClick={() => void saveRename()}
                className="btn-ember"
                disabled={!renameDraft.trim()}
              >
                Rename
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

interface PickerOption {
  id: string;
  name: string;
  blurb?: string;
  icon?: typeof Sparkles;
  swatches?: string[];
}

function Picker({
  label, eyebrow, value, subtitle, accent, options, selectedId, onSelect,
}: {
  label: string;
  eyebrow: React.ReactNode;
  value?: string;
  subtitle?: string;
  accent: React.ReactNode | null;
  options: PickerOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) =>
      o.name.toLowerCase().includes(term) ||
      (o.blurb || '').toLowerCase().includes(term),
    );
  }, [q, options]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setQ(''); }}
        className={cn(
          'w-full plate-soft rounded-xl px-3 py-2 text-left transition-colors',
          'hover:bg-accent',
          open && 'ring-1 ring-primary/40',
        )}
      >
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {eyebrow}
          {label}
          <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform', open && 'rotate-180')} />
        </div>
        <div className="text-[13px] font-medium tracking-tight mt-0.5 truncate">{value ?? '—'}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground leading-snug break-words">{subtitle}</div>}
        {accent && <div className="mt-1.5">{accent}</div>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute z-30 left-0 right-0 mt-1 plate rounded-xl shadow-plate overflow-hidden"
          >
            <div className="px-2.5 py-2 border-b border-border flex items-center gap-2">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="flex-1 bg-transparent outline-none text-[12.5px]"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto scroll-thin">
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-[11.5px] text-muted-foreground italic">
                  Nothing matches "{q}".
                </div>
              )}
              {filtered.map((o) => {
                const Icon = o.icon;
                const active = (selectedId ?? '') === o.id;
                return (
                  <button
                    key={o.id || '__none'}
                    onClick={() => { onSelect(o.id); setOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors text-[12.5px]',
                      active ? 'bg-primary/10' : 'hover:bg-accent',
                    )}
                  >
                    {Icon ? (
                      <div className="h-7 w-7 rounded-md grid place-items-center shrink-0 bg-primary/10 ring-1 ring-primary/20">
                        <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.6} />
                      </div>
                    ) : o.swatches ? (
                      <div className="shrink-0">
                        <SwatchRow swatches={o.swatches} compact />
                      </div>
                    ) : (
                      <div className="h-7 w-7" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium tracking-tight truncate">{o.name}</div>
                      {o.blurb && (
                        <div className="text-[11px] text-muted-foreground leading-snug break-words">{o.blurb}</div>
                      )}
                    </div>
                    {active && <Check className="h-3.5 w-3.5 text-primary mt-1.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwatchRow({ swatches, compact }: { swatches: string[]; compact?: boolean }) {
  return (
    <div className={cn('flex gap-0.5', compact ? 'h-5' : 'h-3.5')}>
      {swatches.slice(0, 6).map((c, i) => (
        <span
          key={i}
          className={cn(compact ? 'w-3' : 'flex-1', 'rounded-[3px]')}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function RailRename({ project, skillId }: { project?: ProjectRecord; skillId?: string }) {
  const setProject = useStudio((s) => s.setProject);
  const [editing, setEditing] = useState(false);
  const label = project && skillId ? skillDisplayName(project, skillId) : 'Untitled';
  const [draft, setDraft] = useState(label);
  useEffect(() => { setDraft(label); }, [label]);

  if (!project || !skillId) {
    return <div className="font-display italic text-2xl text-muted-foreground">Untitled</div>;
  }

  const save = async () => {
    setEditing(false);
    if (!draft.trim() || draft.trim() === label) return;
    const hydrated = loadSession(project, skillId);
    const next = setSkillSessionName(hydrated, skillId, draft.trim());
    await window.renoir.saveProject(next);
    setProject(loadSession(next, skillId));
  };

  return editing ? (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') { setEditing(false); setDraft(label); }
      }}
      className="w-full bg-transparent outline-none border-b border-primary/40 font-display italic text-2xl pb-1"
    />
  ) : (
    <button
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="w-full text-left font-display italic text-2xl hover:text-primary transition-colors block truncate"
    >
      {label}
    </button>
  );
}

function RailActions() {
  return (
    <div className="mt-3 flex items-center">
      <div className="ml-auto"><AgentPicker /></div>
    </div>
  );
}

function SwatchSquare({ swatches }: { swatches: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-px h-4 w-4 rounded overflow-hidden ring-1 ring-border">
      {swatches.slice(0, 4).map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </div>
  );
}

function CollapsedTile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-9 w-9 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
      title={label}
    >
      {icon}
    </button>
  );
}
