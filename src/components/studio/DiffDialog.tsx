import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCompare } from 'lucide-react';
import { useStudio } from '@/lib/store';

interface Props {
  open: boolean;
  aId: string | null;
  bId: string | null;
  onClose: () => void;
}

export function DiffDialog({ open, aId, bId, onClose }: Props) {
  const project = useStudio((s) => s.project);
  const versions = project?.versions || [];
  const a = versions.find((v) => v.id === aId);
  const b = versions.find((v) => v.id === bId);

  const wrap = (html: string) =>
    /^<!doctype/i.test(html)
      ? html
      : `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head><body>${html}</body></html>`;

  return (
    <AnimatePresence>
      {open && a && b && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="plate rounded-2xl w-full max-w-[1280px] max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-3 border-b border-border flex items-center gap-3">
              <GitCompare className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Diff</div>
                <h3 className="font-display italic text-xl">Side by side.</h3>
              </div>
              <button onClick={onClose} className="btn-ghost"><X className="h-4 w-4" /></button>
            </header>
            <div className="grid grid-cols-2 gap-3 p-3 flex-1 min-h-0">
              <Pane label={`${a.source} · ${new Date(a.createdAt).toLocaleString()}`} html={wrap(a.html)} />
              <Pane label={`${b.source} · ${new Date(b.createdAt).toLocaleString()}`} html={wrap(b.html)} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Pane({ label, html }: { label: string; html: string }) {
  return (
    <div className="flex flex-col plate rounded-xl overflow-hidden">
      <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70 border-b border-border">
        {label}
      </div>
      <iframe
        title={label}
        srcDoc={html}
        sandbox="allow-scripts"
        className="flex-1 w-full bg-white"
      />
    </div>
  );
}
