import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, Smartphone, Tablet, Monitor, Loader2, Code,
  BookmarkPlus, ScanSearch, FileText, GitFork, ExternalLink, MoreHorizontal,
  Maximize2, Minimize2, ChevronLeft, ChevronRight, Presentation, ScrollText, Presentation as PresentIcon,
  Upload, FileDown, Save as SaveIcon,
} from 'lucide-react';
import { useStudio, useUI, useCatalog } from '@/lib/store';
import { VersionStrip } from './VersionStrip';
import { DiffDialog } from './DiffDialog';
import { cn } from '@/lib/cn';
import { motion, AnimatePresence } from 'framer-motion';
import { LintBadge } from './LintBadge';
import { PreviewLoading } from './PreviewLoading';
import { defaultModeForSkill, wrapWithBridge, type PreviewMode } from '@/lib/preview-modes';

type Surface = 'phone' | 'tablet' | 'desktop';

const SURFACE_SIZES: Record<Surface, { w: number; h: number; label: string }> = {
  phone:   { w: 390,  h: 844,  label: 'iPhone' },
  tablet:  { w: 820,  h: 1180, label: 'iPad' },
  desktop: { w: 1280, h: 800,  label: 'Desktop' },
};

export function PreviewPane({
  artifact,
  loading = false,
  loadingPhase = 'Composing your artifact…',
  imageGenProgress = null,
}: {
  artifact: string | null;
  loading?: boolean;
  loadingPhase?: string;
  imageGenProgress?: { done: number; total: number } | null;
}) {
  const [surface, setSurface] = useState<Surface>('desktop');
  const [showCode, setShowCode] = useState(false);
  const project = useStudio((s) => s.project);
  const skillId = useStudio((s) => s.selectedSkillId);
  const toast = useUI((s) => s.toast);
  const refreshTemplates = useCatalog((s) => s.refreshTemplates);
  const [diff, setDiff] = useState<{ a: string; b: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Preview mode — default per skill, user can override.
  const [modeOverride, setModeOverride] = useState<PreviewMode | 'auto'>('auto');
  const effectiveMode: PreviewMode = modeOverride === 'auto' ? defaultModeForSkill(skillId) : modeOverride;
  const [navState, setNavState] = useState<{ idx: number; total: number }>({ idx: 0, total: 1 });

  const baseHtml = useMemo(() => {
    if (!artifact) return null;
    if (/^<!doctype/i.test(artifact) || /<html[\s>]/i.test(artifact)) return artifact;
    return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head><body>${artifact}</body></html>`;
  }, [artifact]);
  // Always inject the bridge so mode can be flipped without remounting the
  // iframe (which used to break the layout briefly mid-switch).
  const srcDoc = useMemo(() => (baseHtml ? wrapWithBridge(baseHtml) : null), [baseHtml]);

  // Listen for nav-state messages from the iframe bridge.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d?.type === 'renoir:nav-state') setNavState({ idx: d.idx ?? 0, total: d.total ?? 1 });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const post = (msg: unknown) =>
    iframeRef.current?.contentWindow?.postMessage(msg, '*');

  const syncPreviewMode = () => {
    post({ type: 'renoir:set-mode', mode: effectiveMode });
    post({ type: 'renoir:probe' });
  };

  const navSlide = (dir: 'prev' | 'next' | { idx: number }) => {
    if (effectiveMode !== 'present') {
      post({ type: 'renoir:set-mode', mode: 'present' });
    }
    if (typeof dir === 'object') post({ type: 'renoir:nav', idx: dir.idx });
    else post({ type: 'renoir:nav', dir });
  };

  // Tell the iframe what mode is active whenever it (re)loads or mode changes.
  useEffect(() => {
    if (!srcDoc) return;
    const id = setTimeout(syncPreviewMode, 50);
    return () => clearTimeout(id);
  }, [srcDoc, effectiveMode, surface]);

  // Keyboard nav for present/pages
  useEffect(() => {
    if (effectiveMode === 'scroll') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (t && (t as any).isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown')                { e.preventDefault(); navSlide('next'); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp')                               { e.preventDefault(); navSlide('prev'); }
      else if (e.key === 'Home')                                                          { e.preventDefault(); navSlide({ idx: 0 }); }
      else if (e.key === 'End')                                                           { e.preventDefault(); navSlide({ idx: 999 }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [effectiveMode]);

  const downloadHtml = async () => {
    if (!artifact || !project) return;
    const filename = `artifact-${Date.now()}.html`;
    const res = await window.renoir.writeArtifact({
      projectId: project.id, filename, content: baseHtml!,
    });
    if (res.ok) toast(`Saved ${filename}`, 'ok');
    else toast(res.error || 'Save failed', 'err');
  };

  const exportPdf = async () => {
    if (!artifact || !project) return;
    const id = useUI.getState().pushExport({ kind: 'pdf', label: 'Exporting PDF' });
    try {
      useUI.getState().updateExport(id, { phase: 'rendering offscreen…' });
      const res = await window.renoir.exportPdf({ projectId: project.id, html: baseHtml! });
      if (res.ok) useUI.getState().completeExport(id, { savedPath: res.savedPath, ok: true });
      else useUI.getState().completeExport(id, { ok: false, error: res.error });
    } catch (err: any) {
      useUI.getState().completeExport(id, { ok: false, error: err?.message || String(err) });
    }
  };

  const exportPptx = async () => {
    if (!artifact || !project) return;
    const id = useUI.getState().pushExport({ kind: 'pptx', label: 'Exporting PPTX' });
    try {
      useUI.getState().updateExport(id, { phase: 'capturing slides…' });
      const res = await window.renoir.exportPptx({ projectId: project.id, html: baseHtml! });
      if (res.ok) useUI.getState().completeExport(id, { savedPath: res.savedPath, ok: true });
      else useUI.getState().completeExport(id, { ok: false, error: res.error });
    } catch (err: any) {
      useUI.getState().completeExport(id, { ok: false, error: err?.message || String(err) });
    }
  };

  const runCritique = async () => {
    if (!artifact || !project) return;
    const id = `${project.id}-critique-${Date.now()}`;
    const userMsg = '/critique — review the latest artifact across hierarchy, typography, contrast, spacing, affordance.';
    await useStudio.getState().appendUser(userMsg);
    useStudio.getState().startStreaming();
    const lastUserBrief = project.conversation.find((m) => m.role === 'user')?.content || '';
    const res = await window.renoir.critiqueStart({ conversationId: id, artifactHtml: srcDoc!, brief: lastUserBrief });
    if (!res.ok) {
      toast(res.error || 'critique failed', 'err');
      void useStudio.getState().finishStreaming();
    }
  };

  useEffect(() => {
    const h = () => { void runCritique(); };
    window.addEventListener('renoir:run-critique', h);
    return () => window.removeEventListener('renoir:run-critique', h);
  });

  // Push to detached preview window whenever the artifact changes.
  useEffect(() => {
    if (!srcDoc) return;
    void window.renoir.previewIsOpen().then((open) => {
      if (open) void window.renoir.pushPreview(srcDoc);
    });
  }, [srcDoc]);

  const fork = async () => {
    if (!project || !artifact) return;
    const res = await window.renoir.forkProject({ fromId: project.id });
    if (res.ok && res.project) {
      useStudio.getState().setProject(res.project);
      toast(`Forked → ${res.project.name}`, 'ok');
    } else {
      toast(res.error || 'fork failed', 'err');
    }
  };

  const detach = async () => {
    if (!srcDoc) return;
    await window.renoir.openPreview(srcDoc);
    toast('Detached preview opened', 'ok');
  };

  const saveAsTemplate = async () => {
    if (!artifact || !project) return;
    const name = window.prompt('Template name?', `${project.name} template`) || '';
    if (!name) return;
    await window.renoir.saveTemplate({ name, category: 'artifact', body: baseHtml! });
    await refreshTemplates();
    toast('Saved as template', 'ok');
  };

  const setProject = useStudio((s) => s.setProject);
  const exportProjectZip = async () => {
    if (!project) return;
    const r = await window.renoir.exportProject(project.id);
    if (r.ok) toast(`Exported to ${r.savedPath}`, 'ok');
    else if (r.error !== 'cancelled') toast(r.error || 'Export failed', 'err');
  };
  const importProjectZip = async () => {
    const r = await window.renoir.importProject();
    if (r.ok && r.project) {
      setProject(r.project);
      toast('Project imported', 'ok');
    } else if (r.error && r.error !== 'cancelled') {
      toast(r.error, 'err');
    }
  };

  const sz = SURFACE_SIZES[surface];

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-canvas/50">
      <VersionStrip onCompare={(a, b) => setDiff({ a, b })} />
      <div className="px-3 py-2 border-b border-border flex items-center gap-1.5">
        {loading && (
          <span className="flex items-center gap-1.5 px-1.5 h-6 rounded text-[10px] uppercase tracking-[0.18em] text-primary bg-primary/10 ring-1 ring-primary/30">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            live
          </span>
        )}
        {imageGenProgress && (
          <span className="flex items-center gap-1.5 px-1.5 h-6 rounded text-[10px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating images: {imageGenProgress.done}/{imageGenProgress.total}
          </span>
        )}
        <ModeTabs mode={effectiveMode} onChange={setModeOverride} />
        <SurfaceTab id="phone"   surface={surface} setSurface={setSurface} icon={<Smartphone className="h-3.5 w-3.5" strokeWidth={1.6} />} />
        <SurfaceTab id="tablet"  surface={surface} setSurface={setSurface} icon={<Tablet className="h-3.5 w-3.5" strokeWidth={1.6} />} />
        <SurfaceTab id="desktop" surface={surface} setSurface={setSurface} icon={<Monitor className="h-3.5 w-3.5" strokeWidth={1.6} />} />
        <span className="ml-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
          {sz.w}×{sz.h}
        </span>
        {effectiveMode === 'present' && (
          <SlideNav nav={navState} onPrev={() => navSlide('prev')} onNext={() => navSlide('next')} />
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {artifact && <LintBadge html={baseHtml} />}
          <FullViewToggle />
          <OverflowMenu
            items={[
              { label: 'Save as HTML',      icon: <SaveIcon className="h-3.5 w-3.5" strokeWidth={1.6} />,     onClick: downloadHtml,       disabled: !artifact, group: 'save' },
              { label: 'Export PDF',        icon: <FileText className="h-3.5 w-3.5" strokeWidth={1.6} />,     onClick: exportPdf,          disabled: !artifact, group: 'save' },
              { label: 'Export PPTX',       icon: <PresentIcon className="h-3.5 w-3.5" strokeWidth={1.6} />,  onClick: exportPptx,         disabled: !artifact, group: 'save' },
              { label: 'Save as template',  icon: <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={1.6} />, onClick: saveAsTemplate,     disabled: !artifact, group: 'save' },
              { label: 'Toggle source',     icon: <Code className="h-3.5 w-3.5" strokeWidth={1.6} />,         active: showCode, onClick: () => setShowCode((v) => !v), disabled: !artifact, group: 'view' },
              { label: 'Detach preview',    icon: <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />, onClick: detach,             disabled: !artifact, group: 'view' },
              { label: 'Critique (5-dim)',  icon: <ScanSearch className="h-3.5 w-3.5" strokeWidth={1.6} />,   onClick: runCritique,        disabled: !artifact, group: 'view' },
              { label: 'Fork as new study', icon: <GitFork className="h-3.5 w-3.5" strokeWidth={1.6} />,      onClick: fork,               disabled: !artifact, group: 'project' },
              { label: 'Import project',    icon: <Upload className="h-3.5 w-3.5" strokeWidth={1.6} />,       onClick: importProjectZip,   group: 'project' },
              { label: 'Export project',    icon: <FileDown className="h-3.5 w-3.5" strokeWidth={1.6} />,     onClick: exportProjectZip,   group: 'project' },
            ]}
          />
        </div>
      </div>

      <div className="flex-1 relative overflow-auto p-6 grain flex items-start justify-center">
        <AnimatePresence mode="wait">
          {loading && !srcDoc ? (
            <PreviewLoading key="loading" phase={loadingPhase} />
          ) : !srcDoc ? (
            <PreviewEmpty key="empty" />
          ) : showCode ? (
            <motion.pre
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="plate rounded-xl p-4 w-full max-w-full text-[11px] font-mono leading-relaxed overflow-auto whitespace-pre-wrap"
            >
              {srcDoc}
            </motion.pre>
          ) : (
            <motion.div
              key="frame"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="plate rounded-2xl p-2 shadow-plate"
              style={
                effectiveMode === 'scroll'
                  ? { width: '100%', maxWidth: surface === 'desktop' ? '100%' : sz.w + 32 }
                  : { width: '100%', maxWidth: sz.w + 32 }
              }
            >
              <iframe
                ref={iframeRef}
                title="preview"
                srcDoc={srcDoc}
                sandbox="allow-scripts"
                onLoad={syncPreviewMode}
                style={
                  effectiveMode === 'scroll'
                    ? {
                        width: '100%',
                        maxWidth: surface === 'desktop' ? '100%' : sz.w,
                        height: sz.h,
                        background: 'transparent',
                        borderRadius: 12,
                        border: 0,
                        display: 'block',
                      }
                    : {
                        width: sz.w,
                        height: sz.h,
                        background: 'transparent',
                        borderRadius: 12,
                        border: 0,
                        display: 'block',
                        maxWidth: '100%',
                      }
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DiffDialog
        open={Boolean(diff)}
        aId={diff?.a ?? null}
        bId={diff?.b ?? null}
        onClose={() => setDiff(null)}
      />
    </section>
  );
}

interface OverflowItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  group?: 'save' | 'view' | 'project';
}

function OverflowMenu({ items }: { items: OverflowItem[] }) {
  const [open, setOpen] = useState(false);
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

  // Group items into separators inside the popover.
  const groups: { id: string; label: string; items: OverflowItem[] }[] = [
    { id: 'save',    label: 'Save & export', items: items.filter((i) => i.group === 'save') },
    { id: 'view',    label: 'View',          items: items.filter((i) => i.group === 'view') },
    { id: 'project', label: 'Project',       items: items.filter((i) => i.group === 'project') },
  ];
  const ungrouped = items.filter((i) => !i.group);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-quiet text-[12px] h-7 py-0 w-8 px-0 grid place-items-center"
        title="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 mt-1.5 w-[260px] plate rounded-xl p-1 shadow-plate z-30"
          >
            {groups.map((g, gi) => (
              g.items.length === 0 ? null : (
                <div key={g.id} className={gi > 0 ? 'mt-1 pt-1 border-t border-border' : ''}>
                  <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                    {g.label}
                  </div>
                  {g.items.map((it) => (
                    <button
                      key={it.label}
                      onClick={() => { setOpen(false); it.onClick(); }}
                      disabled={it.disabled}
                      className={cn(
                        'w-full text-left rounded-md px-2.5 py-1.5 flex items-center gap-2 text-[12.5px] transition-colors',
                        it.active ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground',
                        it.disabled && 'opacity-40 pointer-events-none',
                      )}
                    >
                      <span className="text-muted-foreground">{it.icon}</span>
                      <span>{it.label}</span>
                    </button>
                  ))}
                </div>
              )
            ))}
            {ungrouped.length > 0 && (
              <div className="mt-1 pt-1 border-t border-border">
                {ungrouped.map((it) => (
                  <button
                    key={it.label}
                    onClick={() => { setOpen(false); it.onClick(); }}
                    disabled={it.disabled}
                    className={cn(
                      'w-full text-left rounded-md px-2.5 py-1.5 flex items-center gap-2 text-[12.5px] transition-colors',
                      it.active ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground',
                      it.disabled && 'opacity-40 pointer-events-none',
                    )}
                  >
                    <span className="text-muted-foreground">{it.icon}</span>
                    <span>{it.label}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeTabs({ mode, onChange }: { mode: PreviewMode; onChange: (m: PreviewMode | 'auto') => void }) {
  const tabs: { id: PreviewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'scroll',  icon: <ScrollText className="h-3.5 w-3.5" strokeWidth={1.6} />,    label: 'Scroll' },
    { id: 'present', icon: <Presentation className="h-3.5 w-3.5" strokeWidth={1.6} />,  label: 'Slide' },
  ];
  return (
    <div className="flex items-center gap-0.5 mr-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'h-7 w-7 grid place-items-center rounded-md transition-colors',
            mode === t.id
              ? 'bg-primary/10 ring-1 ring-primary/30 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function SlideNav({ nav, onPrev, onNext }: { nav: { idx: number; total: number }; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-1 ml-1">
      <button
        onClick={onPrev}
        disabled={nav.idx === 0}
        className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
        title="Previous (←)"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-[11px] tabular-nums font-mono px-1.5 text-muted-foreground min-w-[44px] text-center">
        {nav.idx + 1}/{nav.total}
      </span>
      <button
        onClick={onNext}
        disabled={nav.idx >= nav.total - 1}
        className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
        title="Next (→ / Space)"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function FullViewToggle() {
  const full           = useUI((s) => s.previewFull);
  const setFull        = useUI((s) => s.setPreviewFull);
  const railCollapsed  = useUI((s) => s.railCollapsed);
  const toggleRail     = useUI((s) => s.toggleRail);
  const Icon           = full ? Minimize2 : Maximize2;

  const handle = () => {
    const next = !full;
    setFull(next);
    // Going full-view: also collapse the rail so preview owns the screen.
    // Restoring: bring the rail back if we collapsed it ourselves.
    if (next && !railCollapsed)      toggleRail();
    else if (!next && railCollapsed) toggleRail();
  };

  return (
    <button
      onClick={handle}
      className="btn-ghost text-[12px] h-7 py-0 w-7 px-0 grid place-items-center"
      title={full ? 'Restore split (Esc)' : 'Full-view preview'}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
    </button>
  );
}

function SurfaceTab({
  id, surface, setSurface, icon,
}: { id: Surface; surface: Surface; setSurface: (s: Surface) => void; icon: React.ReactNode }) {
  const active = surface === id;
  return (
    <button
      onClick={() => setSurface(id)}
      className={cn(
        'h-7 w-7 rounded-md grid place-items-center transition-colors',
        active ? 'bg-primary/10 ring-1 ring-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
      title={SURFACE_SIZES[id].label}
    >
      {icon}
    </button>
  );
}

function PreviewEmpty() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center max-w-[360px] py-20"
    >
      <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 ring-1 ring-primary/30 grid place-items-center">
        <Monitor className="h-5 w-5 text-primary" strokeWidth={1.5} />
      </div>
      <h3 className="font-display italic text-2xl mt-3">Preview waits.</h3>
      <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
        Start by sending a prompt.
      </p>
    </motion.div>
  );
}
