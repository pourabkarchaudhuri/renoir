import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, Film, Music2, Layers3, X, Search, Tag } from 'lucide-react';
import { useCatalog } from '@/lib/store';
import { cn } from '@/lib/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (body: string, kind: 'image' | 'video' | 'audio' | 'hyperframe') => void;
  defaultKind?: 'image' | 'video' | 'audio' | 'hyperframe';
}

const KIND_META = {
  image:      { label: 'Image',       icon: ImageIcon },
  video:      { label: 'Video',       icon: Film },
  audio:      { label: 'Audio',       icon: Music2 },
  hyperframe: { label: 'HyperFrame',  icon: Layers3 },
} as const;

export function PromptGallery({ open, onClose, onPick, defaultKind = 'image' }: Props) {
  const prompts = useCatalog((s) => s.promptTemplates);
  const [kind, setKind] = useState<'image' | 'video' | 'audio' | 'hyperframe'>(defaultKind);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return prompts.filter((p) => p.kind === kind && (
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.blurb.toLowerCase().includes(term) ||
      p.tags.some((t) => t.toLowerCase().includes(term))
    ));
  }, [prompts, kind, q]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="plate rounded-2xl w-full max-w-[1000px] max-h-[80vh] flex flex-col overflow-hidden"
          >
            <header className="px-6 py-4 border-b border-border flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Library</div>
                <h3 className="font-display italic text-2xl">Prompt templates.</h3>
              </div>
              <button onClick={onClose} className="btn-ghost">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="px-6 py-3 border-b border-border flex items-center gap-3">
              <div className="flex items-center gap-1">
                {(['image', 'video', 'audio', 'hyperframe'] as const).map((k) => {
                  const M = KIND_META[k];
                  const active = kind === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[12px] transition-colors',
                        active
                          ? 'bg-primary/10 ring-1 ring-primary/30 text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      )}
                    >
                      <M.icon className="h-3.5 w-3.5" />
                      {M.label}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="input-base pl-8 w-[260px] py-1.5 text-[12.5px]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5 grid grid-cols-2 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onPick(p.body, p.kind); onClose(); }}
                  className="plate rounded-xl p-4 text-left hover:-translate-y-[1px] hover:shadow-glow transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[12.5px] font-medium tracking-tight">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{p.blurb}</div>
                    </div>
                  </div>
                  <p className="font-mono text-[11px] mt-2 text-muted-foreground/80 line-clamp-3 leading-relaxed">
                    {p.body}
                  </p>
                  {p.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <span key={t} className="pill text-[10px] py-0">
                          <Tag className="h-2.5 w-2.5" />
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-2 text-center py-16 text-muted-foreground">
                  Nothing matches "{q}".
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
