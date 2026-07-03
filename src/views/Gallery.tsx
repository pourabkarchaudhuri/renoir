import { useEffect, useState } from 'react';
import type { ProjectRecord, TemplateRecord } from '@/types/global';
import { useStudio, useUI, useCatalog } from '@/lib/store';
import { motion } from 'framer-motion';
import { Trash2, ArrowRight, FolderOpen, Upload, LibraryBig, LayoutGrid, Search, Combine } from 'lucide-react';
import { RemixDialog } from '@/components/gallery/RemixDialog';
import { ConfirmDialog } from '@/components/chrome/ConfirmDialog';
import { extractArtifact } from '@/lib/prompt';
import { loadSession } from '@/lib/skill-sessions';
import { cn } from '@/lib/cn';

export function Gallery() {
  const setProject = useStudio((s) => s.setProject);
  const setRoute = useUI((s) => s.setRoute);
  const toast = useUI((s) => s.toast);
  const templates = useCatalog((s) => s.templates);
  const refreshCatalog = useCatalog((s) => s.refresh);
  const refreshTemplates = useCatalog((s) => s.refreshTemplates);

  const [items, setItems] = useState<ProjectRecord[]>([]);
  const [tab, setTab]     = useState<'projects' | 'templates'>('projects');
  const [query, setQuery] = useState('');
  const [showRemix, setShowRemix] = useState(false);
  const [pendingDiscard, setPendingDiscard] = useState<{ kind: 'project' | 'template'; id: string; name: string } | null>(null);

  const refresh = async () => {
    const list = await window.renoir.listProjects();
    setItems(list);
    await refreshTemplates();
  };
  useEffect(() => { void refresh(); }, []);

  const importZip = async () => {
    const r = await window.renoir.importProject();
    if (r.ok && r.project) {
      toast('Project imported', 'ok');
      await refresh();
    } else if (r.error && r.error !== 'cancelled') {
      toast(r.error, 'err');
    }
  };
  const removeTemplate = async (id: string) => {
    await window.renoir.deleteTemplate(id);
    await refreshTemplates();
    toast('Template removed', 'info');
  };
  const requestDiscard = (kind: 'project' | 'template', id: string, name: string) => {
    setPendingDiscard({ kind, id, name });
  };
  const performDiscard = async () => {
    if (!pendingDiscard) return;
    if (pendingDiscard.kind === 'project') {
      await window.renoir.deleteProject(pendingDiscard.id);
      toast('Study removed', 'info');
      void refresh();
    } else {
      await removeTemplate(pendingDiscard.id);
    }
    setPendingDiscard(null);
  };

  // First user message becomes the contextual subtitle for project cards.
  const subtitleFor = (p: ProjectRecord): string => {
    const firstUser = p.conversation.find((m) => m.role === 'user')?.content || '';
    const firstAssistant = p.conversation.find((m) => m.role === 'assistant')?.content || '';
    const text = (firstUser || firstAssistant)
      .replace(/<artifact>[\s\S]*?<\/artifact>/g, '')
      .replace(/<question-form>[\s\S]*?<\/question-form>/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#*_>`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 220) || 'A study with no exchange yet.';
  };

  const open = (p: ProjectRecord) => {
    const skill = p.skillId || 'web-prototype';
    setProject(loadSession(p, skill));
    useStudio.getState().setSkill(skill);
    setRoute('studio');
  };

  const remove = async (id: string) => {
    await window.renoir.deleteProject(id);
    toast('Study removed', 'ok');
    void refresh();
  };

  const openFolder = async () => {
    const r = await window.renoir.openWorkspace();
    if (r.ok) toast(`Workspace at ${r.path}`, 'info');
  };

  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin">
      <div className="max-w-[1100px] mx-auto px-10 pt-12 pb-20">
        <header className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Library</div>
            <h1 className="font-display italic text-4xl mt-1">Studies and templates.</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRemix(true)} className="btn-quiet" title="Mash skill + system + artifact from different studies">
              <Combine className="h-4 w-4" />
              Remix
            </button>
            <button onClick={importZip} className="btn-quiet">
              <Upload className="h-4 w-4" />
              Import zip
            </button>
            <button onClick={openFolder} className="btn-quiet">
              <FolderOpen className="h-4 w-4" />
              Open workspace
            </button>
          </div>
        </header>

        <div className="mt-6 flex items-center gap-1 plate rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('projects')}
            className={cn(
              'h-8 px-3 rounded-lg flex items-center gap-2 text-[12.5px] transition-colors',
              tab === 'projects' ? 'bg-primary/10 ring-1 ring-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.5} />
            Studies
          </button>
          <button
            onClick={() => setTab('templates')}
            className={cn(
              'h-8 px-3 rounded-lg flex items-center gap-2 text-[12.5px] transition-colors',
              tab === 'templates' ? 'bg-primary/10 ring-1 ring-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <LibraryBig className="h-3.5 w-3.5" strokeWidth={1.5} />
            Templates ({templates.length})
          </button>
        </div>

        {tab === 'projects' && (
          <div className="mt-5 relative w-[320px]">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter studies…"
              className="input-base pl-8 py-1.5 text-[12.5px]"
            />
          </div>
        )}

        {tab === 'templates' ? (
          <TemplatesPanel templates={templates.filter((t) => !query.trim() || t.name.toLowerCase().includes(query.toLowerCase()))} onDelete={(id) => {
            const t = templates.find((x) => x.id === id);
            requestDiscard('template', id, t?.name || 'template');
          }} />
        ) : (() => {
          const term = query.trim().toLowerCase();
          const filteredItems = !term ? items : items.filter((p) =>
            p.name.toLowerCase().includes(term)
            || p.conversation.some((m) => m.content.toLowerCase().includes(term)));
          if (filteredItems.length === 0 && !term) return <Empty />;
          if (filteredItems.length === 0) return (
            <div className="mt-12 text-center text-muted-foreground">No studies match "{query}".</div>
          );
          return (
          <div className="mt-8 columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
            {filteredItems.map((p, i) => {
              const last = p.conversation.findLast((m) => m.role === 'assistant')?.content;
              const hasArtifact = Boolean(last && extractArtifact(last));
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="plate rounded-2xl p-5 group mb-4 break-inside-avoid"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="font-display italic text-2xl truncate">{p.name}</h3>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70 mt-1 flex items-center gap-2 flex-wrap">
                        <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>{p.conversation.length} msgs</span>
                        {hasArtifact && (<><span>·</span><span className="text-primary/80">artifact</span></>)}
                      </div>
                    </div>
                  </div>
                  <p className="text-[12.5px] text-muted-foreground mt-3 leading-relaxed">
                    {subtitleFor(p)}
                  </p>
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => requestDiscard('project', p.id, p.name)}
                      className="btn-ghost text-[12px] text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Discard
                    </button>
                    <button onClick={() => open(p)} className="btn-quiet">
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
          );
        })()}
      </div>
      <RemixDialog open={showRemix} onClose={() => setShowRemix(false)} />
      <ConfirmDialog
        open={!!pendingDiscard}
        destructive
        title={pendingDiscard?.kind === 'template' ? 'Discard template?' : 'Discard this study?'}
        message={
          <>
            <span className="text-foreground font-medium">{pendingDiscard?.name}</span> will be removed from the library.
            The on-disk workspace files stay intact — you can recover them from the workspace folder.
          </>
        }
        confirmLabel="Discard"
        onCancel={() => setPendingDiscard(null)}
        onConfirm={performDiscard}
      />
    </div>
  );
}

function TemplatesPanel({
  templates,
  onDelete,
}: { templates: TemplateRecord[]; onDelete: (id: string) => void }) {
  if (templates.length === 0) {
    return (
      <div className="mt-8 plate rounded-2xl p-10 text-center">
        <h3 className="font-display italic text-3xl">No templates saved.</h3>
        <p className="text-[12.5px] text-muted-foreground mt-2 max-w-[420px] mx-auto">
          Save the current artifact as a template from the Studio preview pane — they appear here for reuse.
        </p>
      </div>
    );
  }
  // Pull a contextual subtitle out of the template body — strip HTML, keep prose.
  const subtitleFor = (body: string): string => {
    const text = body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 220) || 'Saved artifact template.';
  };
  return (
    <div className="mt-8 columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
      {templates.map((t) => (
        <div key={t.id} className="plate rounded-2xl p-5 mb-4 break-inside-avoid">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display italic text-2xl truncate">{t.name}</h3>
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70 mt-1">
                {t.category} · {new Date(t.createdAt).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={() => onDelete(t.id)}
              className="btn-ghost text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
              title="Delete template"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-3 text-[12.5px] text-muted-foreground leading-relaxed">
            {subtitleFor(t.body)}
          </p>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="mt-16 plate rounded-3xl p-10 text-center grain relative overflow-hidden">
      <div className="ambient" />
      <div className="relative z-10">
        <h3 className="font-display italic text-3xl">No studies yet.</h3>
        <p className="text-[13px] text-muted-foreground mt-2 max-w-[420px] mx-auto">
          Begin one from Home — every chat, every artifact, and every saved image lands here.
        </p>
      </div>
    </div>
  );
}
