import { useEffect, useMemo, useState } from 'react';
import { Palette, Save } from 'lucide-react';
import type { CustomDesignSystem } from '@/types/global';
import { Field } from '@/components/settings/SettingsSection';

export function SystemEditor({
  system, onClose, onSave,
}: {
  system: CustomDesignSystem | null;
  onClose: () => void;
  onSave: (rec: CustomDesignSystem) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CustomDesignSystem | null>(system);
  useEffect(() => { setDraft(system); }, [system]);
  const update = <K extends keyof CustomDesignSystem>(k: K, v: CustomDesignSystem[K]) => draft && setDraft({ ...draft, [k]: v });

  const error = useMemo(() => {
    if (!draft) return '';
    if (!draft.name.trim()) return 'Name is required.';
    if (draft.swatches.filter(Boolean).length < 2) return 'Add at least two swatches.';
    return '';
  }, [draft]);

  if (!draft) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="plate rounded-2xl w-full max-w-[640px] max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="font-display italic text-xl">Design system editor</span>
          <button onClick={onClose} className="btn-ghost ml-auto text-[12px]">Close</button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name"><input className="input-base" value={draft.name} onChange={(e) => update('name', e.target.value)} /></Field>
            <Field label="Font stack"><input className="input-base" value={draft.font} onChange={(e) => update('font', e.target.value)} /></Field>
          </div>
          <Field label="Vibe"><input className="input-base" value={draft.vibe} onChange={(e) => update('vibe', e.target.value)} /></Field>
          <Field label="Swatches (one OKLch per line)">
            <textarea
              className="input-base font-mono text-[12px]"
              rows={6}
              value={draft.swatches.join('\n')}
              onChange={(e) => update('swatches', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
            />
            <div className="mt-2 flex gap-1">
              {draft.swatches.map((c, i) => <span key={i} className="h-5 flex-1 rounded-[3px]" style={{ background: c }} />)}
            </div>
          </Field>
          <Field label="Tokens (one per line, format: name=value)">
            <textarea
              className="input-base font-mono text-[12px]"
              rows={5}
              value={draft.tokens.map((t) => `${t.name}=${t.value}`).join('\n')}
              onChange={(e) => {
                const ts = e.target.value.split('\n').map((line) => {
                  const idx = line.indexOf('=');
                  if (idx < 1) return null;
                  return { name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
                }).filter(Boolean) as CustomDesignSystem['tokens'];
                update('tokens', ts);
              }}
            />
          </Field>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>
        <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-quiet">Cancel</button>
          <button onClick={async () => { if (!error) { await onSave(draft); onClose(); } }} className="btn-ember" disabled={Boolean(error)}>
            <Save className="h-4 w-4" />
            Save system
          </button>
        </footer>
      </div>
    </div>
  );
}
