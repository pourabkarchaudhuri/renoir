import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RotateCcw, GitCompare, X } from 'lucide-react';
import { useStudio, useUI } from '@/lib/store';
import { cn } from '@/lib/cn';

export function VersionStrip({ onCompare }: { onCompare: (aId: string, bId: string) => void }) {
  const project = useStudio((s) => s.project);
  const setProject = useStudio((s) => s.setProject);
  const toast = useUI((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const versions = project?.versions || [];
  // Highlight the currently-active one. If activeVersionId is set use that;
  // otherwise the latest version (last in the list) is what's rendered.
  const activeId = project?.activeVersionId || versions[versions.length - 1]?.id;
  if (!versions.length) return null;

  const restore = async (vid: string) => {
    if (!project) return;
    const r = await window.renoir.restoreVersion({ id: project.id, versionId: vid });
    if (r.ok && r.project) {
      setProject(r.project);
      toast('Restored', 'ok');
    } else {
      toast(r.error || 'restore failed', 'err');
    }
  };

  const togglePick = (vid: string) => {
    setPicked((cur) => {
      if (cur.includes(vid)) return cur.filter((x) => x !== vid);
      const next = [...cur, vid];
      return next.slice(-2);
    });
  };

  return (
    <div className="border-b border-border bg-background/40 px-3 py-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Clock className="h-3 w-3 text-primary" />
        Versions ({versions.length})
        {picked.length === 2 && (
          <span className="ml-2 normal-case tracking-normal text-[11px] text-primary">2 picked</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 mt-2 overflow-x-auto scroll-thin pb-1.5 pr-1">
              {versions.slice().reverse().map((v, i) => {
                const isPicked = picked.includes(v.id);
                const isActive = activeId === v.id;
                return (
                  <div
                    key={v.id}
                    className={cn(
                      'plate-soft rounded-md px-2 py-1.5 shrink-0 flex items-center gap-2 transition-all',
                      isActive && 'ring-1 ring-primary/40 bg-primary/10',
                      isPicked && !isActive && 'ring-1 ring-sky-400/40',
                    )}
                    title={isActive ? 'Currently shown' : ''}
                  >
                    <button
                      onClick={() => togglePick(v.id)}
                      className="flex flex-col text-left"
                    >
                      <span className={cn('text-[10.5px] font-mono', isActive && 'text-primary')}>
                        v{versions.length - i}
                      </span>
                      <span className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/70">
                        {v.source}{isActive ? ' · active' : ''}
                      </span>
                    </button>
                    {!isActive && (
                      <button
                        onClick={() => restore(v.id)}
                        className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                        title="Restore this version"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              {picked.length === 1 && activeId && picked[0] !== activeId && (
                <button
                  onClick={() => onCompare(picked[0], activeId)}
                  className="btn-quiet text-[11px] shrink-0 ml-1"
                  title="Compare picked version with currently active"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  vs current
                </button>
              )}
              {picked.length === 2 && (
                <button
                  onClick={() => onCompare(picked[0], picked[1])}
                  className="btn-ember text-[11px] shrink-0 ml-2"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  Diff
                </button>
              )}
              {picked.length > 0 && (
                <button onClick={() => setPicked([])} className="btn-ghost text-[10px] shrink-0">
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
