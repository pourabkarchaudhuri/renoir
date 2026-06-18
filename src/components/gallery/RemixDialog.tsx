import { useEffect, useState } from 'react';
import { X, Combine, Sparkles, Palette, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProjectRecord } from '@/types/global';
import { useStudio, useUI } from '@/lib/store';
import { cn } from '@/lib/cn';
import { extractArtifact } from '@/lib/prompt';

export function RemixDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<ProjectRecord[]>([]);
  const [skillFromId, setSkillFromId]       = useState<string | undefined>();
  const [systemFromId, setSystemFromId]     = useState<string | undefined>();
  const [artifactFromId, setArtifactFromId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const setProject = useStudio((s) => s.setProject);
  const setRoute = useUI((s) => s.setRoute);
  const toast = useUI((s) => s.toast);

  useEffect(() => { if (open) window.renoir.listProjects().then(setItems); }, [open]);

  const skillCandidates    = items.filter((p) => p.skillId);
  const systemCandidates   = items.filter((p) => p.designSystemId);
  const artifactCandidates = items.filter((p) =>
    p.conversation.some((m) => m.role === 'assistant' && extractArtifact(m.content)));

  const run = async () => {
    if (!skillFromId && !systemFromId && !artifactFromId) {
      toast('Pick at least one source', 'warn');
      return;
    }
    const res = await window.renoir.remixProject({
      skillFromId, systemFromId, artifactFromId,
      name: name.trim() || undefined,
    });
    if (res.ok && res.project) {
      setProject(res.project);
      setRoute('studio');
      toast('Remix created', 'ok');
      onClose();
    } else {
      toast(res.error || 'remix failed', 'err');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="plate rounded-2xl w-full max-w-[820px] max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Combine className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Remix</div>
                <h3 className="font-display italic text-2xl leading-tight">Mash three studies into one.</h3>
              </div>
              <button onClick={onClose} className="btn-ghost"><X className="h-4 w-4" /></button>
            </header>

            <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 grid grid-cols-3 gap-4">
              <Column
                icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
                title="Skill from"
                items={skillCandidates}
                selected={skillFromId}
                onSelect={setSkillFromId}
                meta={(p) => p.skillId || '—'}
              />
              <Column
                icon={<Palette className="h-3.5 w-3.5 text-primary" />}
                title="System from"
                items={systemCandidates}
                selected={systemFromId}
                onSelect={setSystemFromId}
                meta={(p) => p.designSystemId || '—'}
              />
              <Column
                icon={<ImageIcon className="h-3.5 w-3.5 text-primary" />}
                title="Artifact from"
                items={artifactCandidates}
                selected={artifactFromId}
                onSelect={setArtifactFromId}
                meta={(p) => `${p.conversation.length} msgs`}
              />
            </div>

            <footer className="px-5 py-3 border-t border-border flex items-center gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New study name (optional)"
                className="input-base flex-1 text-[12.5px]"
              />
              <button onClick={onClose} className="btn-quiet">Cancel</button>
              <button onClick={run} className="btn-ember">
                <Combine className="h-4 w-4" />
                Remix
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Column<T extends ProjectRecord>({
  icon, title, items, selected, onSelect, meta,
}: {
  icon: React.ReactNode;
  title: string;
  items: T[];
  selected?: string;
  onSelect: (id?: string) => void;
  meta: (p: T) => string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {icon}
        {title}
      </div>
      <button
        onClick={() => onSelect(undefined)}
        className={cn(
          'rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors mb-1',
          !selected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-accent text-muted-foreground',
        )}
      >
        — none —
      </button>
      <div className="flex-1 overflow-y-auto scroll-thin space-y-1">
        {items.length === 0 && (
          <div className="text-[11px] text-muted-foreground/70 italic px-1 py-2">No candidates yet.</div>
        )}
        {items.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              'w-full text-left rounded-md px-2.5 py-1.5 transition-colors',
              selected === p.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-accent',
            )}
          >
            <div className="text-[12.5px] font-medium truncate">{p.name}</div>
            <div className="text-[10.5px] text-muted-foreground/70 font-mono truncate">{meta(p)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
