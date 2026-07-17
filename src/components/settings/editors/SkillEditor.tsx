import { useEffect, useMemo, useState } from 'react';
import { Save, Wand2 } from 'lucide-react';
import type { CustomSkill } from '@/types/global';
import { Field } from '@/components/settings/SettingsSection';

export function SkillEditor({
  skill, onClose, onSave,
}: {
  skill: CustomSkill | null;
  onClose: () => void;
  onSave: (rec: CustomSkill) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CustomSkill | null>(skill);
  useEffect(() => { setDraft(skill); }, [skill]);
  const update = <K extends keyof CustomSkill>(k: K, v: CustomSkill[K]) => draft && setDraft({ ...draft, [k]: v });

  const error = useMemo(() => {
    if (!draft) return '';
    if (!draft.name.trim()) return 'Name is required.';
    if (!draft.primer.trim()) return 'Primer is required.';
    const validQuestions = draft.questions.filter((q) => q.id.trim() && q.label.trim());
    if (validQuestions.length === 0) return 'Add at least one question with an id and label.';
    return '';
  }, [draft]);

  if (!draft) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="plate rounded-2xl w-full max-w-[640px] max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="font-display italic text-xl">Skill editor</span>
          <button onClick={onClose} className="btn-ghost ml-auto text-[12px]">Close</button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Emoji"><input className="input-base" value={draft.emoji} onChange={(e) => update('emoji', e.target.value)} /></Field>
            <Field label="Name"><input className="input-base" value={draft.name} onChange={(e) => update('name', e.target.value)} /></Field>
            <Field label="Category">
              <select className="input-base" value={draft.category} onChange={(e) => update('category', e.target.value as CustomSkill['category'])}>
                {['web', 'mobile', 'deck', 'doc', 'media', 'system'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Blurb"><input className="input-base" value={draft.blurb} onChange={(e) => update('blurb', e.target.value)} /></Field>
          <Field label="Primer (system prompt fragment)">
            <textarea className="input-base font-mono text-[12.5px]" rows={6} value={draft.primer} onChange={(e) => update('primer', e.target.value)} />
          </Field>
          <Field label="Questions (one per line, format: id|label|type|opt1,opt2)">
            <textarea
              className="input-base font-mono text-[12px]"
              rows={6}
              value={draft.questions.map((q) => `${q.id}|${q.label}|${q.type}${q.options ? '|' + q.options.join(',') : ''}`).join('\n')}
              onChange={(e) => {
                const qs = e.target.value.split('\n').map((line) => {
                  const parts = line.split('|').map((s) => s.trim());
                  if (parts.length < 3 || !parts[0]) return null;
                  return {
                    id: parts[0],
                    label: parts[1],
                    type: (['text', 'textarea', 'select'].includes(parts[2]) ? parts[2] : 'text') as CustomSkill['questions'][number]['type'],
                    options: parts[3] ? parts[3].split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                  };
                }).filter(Boolean) as CustomSkill['questions'];
                update('questions', qs);
              }}
            />
          </Field>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>
        <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-quiet">Cancel</button>
          <button onClick={async () => { if (!error) { await onSave(draft); onClose(); } }} className="btn-ember" disabled={Boolean(error)}>
            <Save className="h-4 w-4" />
            Save skill
          </button>
        </footer>
      </div>
    </div>
  );
}
