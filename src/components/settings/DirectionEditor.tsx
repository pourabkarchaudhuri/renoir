import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Wand2 } from 'lucide-react';
import type { CustomDirection } from '@/types/global';

export function DirectionEditor({
  direction, onClose, onSave,
}: {
  direction: CustomDirection | null;
  onClose: () => void;
  onSave: (rec: CustomDirection) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CustomDirection | null>(direction);
  useEffect(() => { setDraft(direction); }, [direction]);

  const update = <K extends keyof CustomDirection>(k: K, v: CustomDirection[K]) =>
    draft && setDraft({ ...draft, [k]: v });

  const error = useMemo(() => {
    if (!draft) return '';
    if (!draft.name.trim()) return 'Name is required.';
    if (draft.swatches.filter(Boolean).length < 2) return 'Add at least two swatches.';
    return '';
  }, [draft]);

  return (
    <AnimatePresence>
      {draft && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="plate rounded-2xl w-full max-w-[640px] max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <span className="font-display italic text-xl">Direction editor</span>
              <button onClick={onClose} className="btn-ghost ml-auto text-[12px]">Close</button>
            </header>
            <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-3">
              <Field label="Name"><input className="input-base" value={draft.name} onChange={(e) => update('name', e.target.value)} /></Field>
              <Field label="Vibe"><input className="input-base" value={draft.vibe} onChange={(e) => update('vibe', e.target.value)} /></Field>
              <Field label="Tagline"><input className="input-base" value={draft.tagline} onChange={(e) => update('tagline', e.target.value)} /></Field>
              <Field label="Font stack"><input className="input-base" value={draft.font} onChange={(e) => update('font', e.target.value)} /></Field>
              <Field label="Swatches (one OKLch per line)">
                <textarea
                  rows={5}
                  className="input-base font-mono text-[12px]"
                  value={draft.swatches.join('\n')}
                  onChange={(e) => update('swatches', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                />
                <div className="mt-2 flex gap-1">
                  {draft.swatches.map((c, i) => (
                    <span key={i} className="h-5 flex-1 rounded-[3px]" style={{ background: c }} />
                  ))}
                </div>
              </Field>
              {error && <p className="text-[12px] text-destructive">{error}</p>}
            </div>
            <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
              <button onClick={onClose} className="btn-quiet">Cancel</button>
              <button onClick={async () => { if (!error) { await onSave(draft); onClose(); } }} className="btn-ember" disabled={Boolean(error)}>
                <Save className="h-4 w-4" />
                Save direction
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
