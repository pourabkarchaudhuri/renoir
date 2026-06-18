import { useEffect, useState } from 'react';
import { useCatalog, useUI } from '@/lib/store';
import { Eye, EyeOff, Save, Trash2, FolderOpen, KeyRound, ImageIcon, Sun, Moon, Plus, Sparkles, Palette, Pencil, Wand2, Pipette } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { CustomSkill, CustomDesignSystem, CustomDirection } from '@/types/global';
import { ColorExtractor } from '@/components/settings/ColorExtractor';
import { DirectionEditor } from '@/components/settings/DirectionEditor';

export function Settings() {
  const refresh = useCatalog((s) => s.refresh);
  const azure = useCatalog((s) => s.azure);
  const byok  = useCatalog((s) => s.byok);
  const toast = useUI((s) => s.toast);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);

  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [customSkills,  setCustomSkills]  = useState<CustomSkill[]>([]);
  const [customSystems, setCustomSystems] = useState<CustomDesignSystem[]>([]);
  const [customDirections, setCustomDirections] = useState<CustomDirection[]>([]);
  const [editingSkill, setEditingSkill]   = useState<CustomSkill | null>(null);
  const [editingSystem, setEditingSystem] = useState<CustomDesignSystem | null>(null);
  const [editingDirection, setEditingDirection] = useState<CustomDirection | null>(null);

  const reloadCustom = async () => {
    const [s, d, dirs] = await Promise.all([
      window.renoir.listCustomSkills(),
      window.renoir.listCustomSystems(),
      window.renoir.listCustomDirections(),
    ]);
    setCustomSkills(s);
    setCustomSystems(d);
    setCustomDirections(dirs);
  };
  useEffect(() => { void reloadCustom(); }, []);

  useEffect(() => {
    if (byok) {
      setBaseUrl(byok.baseUrl || '');
      setModel(byok.model || '');
    }
  }, [byok]);

  const save = async () => {
    await window.renoir.byokSet({
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
      apiKey: apiKey || undefined,
    });
    setApiKey('');
    await refresh();
    toast('LLM credentials saved', 'ok');
  };

  const clearAll = async () => {
    await window.renoir.byokClear();
    setBaseUrl(''); setModel(''); setApiKey('');
    await refresh();
    toast('LLM credentials cleared', 'info');
  };

  const openWorkspace = async () => {
    const r = await window.renoir.openWorkspace();
    if (r.ok) toast(`Workspace at ${r.path}`, 'info');
  };

  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin">
      <div className="max-w-[820px] mx-auto px-10 pt-14 pb-24">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Configuration</div>
          <h1 className="font-display italic text-4xl mt-1">Settings</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose leading-relaxed">
            Renoir is opinionated about secrets. Your LLM key is stored in the OS keychain. Image generation
            uses Azure Foundry deployments configured in <span className="font-mono text-foreground/80">.env</span>.
          </p>
        </div>

        <Section
          icon={<KeyRound className="h-4 w-4 text-primary" />}
          eyebrow="LLM"
          title="Bring your own key"
          subtitle="OpenAI-compatible base URL. Anything that speaks /chat/completions works."
        >
          <Field label="Base URL">
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="input-base font-mono text-[12.5px]"
            />
          </Field>
          <Field label="Model id">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o, claude-opus-4-7, gpt-5.4, llama3.3"
              className="input-base font-mono text-[12.5px]"
            />
          </Field>
          <Field label={byok?.hasKey ? 'API key (already set — fill to replace)' : 'API key'}>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={byok?.hasKey ? '•••• stored in keychain ••••' : 'sk-…'}
                className="input-base pr-10 font-mono text-[12.5px]"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </Field>
          <div className="flex gap-2 pt-1">
            <button onClick={save} className="btn-ember">
              <Save className="h-4 w-4" />
              Save
            </button>
            {byok?.hasKey && (
              <button onClick={clearAll} className="btn-quiet text-red-300 hover:text-red-200">
                <Trash2 className="h-4 w-4" />
                Clear stored key
              </button>
            )}
          </div>
        </Section>

        <Section
          icon={<ImageIcon className="h-4 w-4 text-primary" />}
          eyebrow="Image"
          title="Azure Foundry"
          subtitle="Configured via .env. Image deployment is pre-wired to gpt-image-2."
        >
          <ReadonlyField label="Endpoint" value={azure?.endpoint || '— unset —'} mono />
          <div className="grid grid-cols-2 gap-3">
            <ReadonlyField label="Image deployment" value={azure?.imageDeployment || 'gpt-image-2'} mono />
            <ReadonlyField label="Text deployment (optional)" value={azure?.textDeployment || 'gpt-5.4'} mono />
          </div>
          <div className={cn(
            'rounded-lg px-3.5 py-2.5 text-[12.5px] flex items-start gap-2 mt-1',
            azure?.configured
              ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40 text-emerald-800 dark:text-emerald-100'
              : 'bg-amber-500/15 ring-1 ring-amber-500/40 text-amber-800 dark:text-amber-100',
          )}>
            <span className={cn(
              'mt-1 h-1.5 w-1.5 rounded-full',
              azure?.configured ? 'bg-emerald-500' : 'bg-amber-500',
            )} />
            <span>
              {azure?.configured
                ? 'Foundry endpoint reachable. Generations will save into the project workspace.'
                : 'Add AZURE_FOUNDRY_ENDPOINT and AZURE_FOUNDRY_API_KEY to .env, then restart Renoir.'}
            </span>
          </div>
        </Section>

        <Section
          icon={theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          eyebrow="Appearance"
          title="Theme"
          subtitle="Renoir is dark by default. Light mode tones the canvas to bone."
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme('dark')}
              className={cn('btn-quiet', theme === 'dark' && 'ring-1 ring-primary/40')}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
            <button
              onClick={() => setTheme('light')}
              className={cn('btn-quiet', theme === 'light' && 'ring-1 ring-primary/40')}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
          </div>
        </Section>

        <Section
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          eyebrow="Custom"
          title="My skills"
          subtitle="Skills are primers + question forms. Add yours; they show up alongside the built-ins."
        >
          <div className="flex flex-col gap-2">
            {customSkills.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground">No custom skills yet.</p>
            )}
            {customSkills.map((s) => (
              <div key={s.id} className="plate-soft rounded-lg px-3 py-2 flex items-center gap-3">
                <span className="text-base">{s.emoji || '✨'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{s.blurb}</div>
                </div>
                <button onClick={() => setEditingSkill(s)} className="btn-ghost text-[11px]">
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={async () => { await window.renoir.deleteCustomSkill(s.id); await reloadCustom(); await refresh(); toast('Skill removed', 'info'); }}
                  className="btn-ghost text-[11px] text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setEditingSkill({
              id: 'sk_' + Math.random().toString(36).slice(2, 8),
              name: 'New skill', category: 'web', emoji: '✨',
              blurb: 'A fresh skill.',
              primer: 'Output …',
              questions: [{ id: 'audience', label: 'Who is this for?', type: 'text' }],
            })}
            className="btn-ember w-fit mt-2"
          >
            <Plus className="h-4 w-4" />
            New skill
          </button>
        </Section>

        <Section
          icon={<Palette className="h-4 w-4 text-primary" />}
          eyebrow="Custom"
          title="My design systems"
          subtitle="OKLch-tokenized systems. Define swatches and a font stack; Renoir will inject tokens into the prompt."
        >
          <div className="flex flex-col gap-2">
            {customSystems.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground">No custom systems yet.</p>
            )}
            {customSystems.map((d) => (
              <div key={d.id} className="plate-soft rounded-lg px-3 py-2 flex items-center gap-3">
                <div className="flex gap-0.5">
                  {d.swatches.slice(0, 4).map((c, i) => (
                    <span key={i} className="h-4 w-2 rounded-[2px]" style={{ background: c }} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{d.vibe}</div>
                </div>
                <button onClick={() => setEditingSystem(d)} className="btn-ghost text-[11px]">
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={async () => { await window.renoir.deleteCustomSystem(d.id); await reloadCustom(); await refresh(); toast('System removed', 'info'); }}
                  className="btn-ghost text-[11px] text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setEditingSystem({
              id: 'sys_' + Math.random().toString(36).slice(2, 8),
              name: 'New system', vibe: 'Custom',
              font: 'Inter / Inter',
              swatches: ['oklch(0.16 0.02 264)', 'oklch(0.22 0.03 264)', 'oklch(0.74 0.18 50)', 'oklch(0.62 0.22 36)', 'oklch(0.85 0.04 80)', 'oklch(0.96 0.01 80)'],
              tokens: [
                { name: 'bg',      value: 'oklch(0.16 0.02 264)' },
                { name: 'surface', value: 'oklch(0.22 0.03 264)' },
                { name: 'fg',      value: 'oklch(0.96 0.01 80)' },
                { name: 'accent',  value: 'oklch(0.74 0.18 50)' },
                { name: 'muted',   value: 'oklch(0.62 0.04 264)' },
              ],
            })}
            className="btn-ember w-fit mt-2"
          >
            <Plus className="h-4 w-4" />
            New design system
          </button>
        </Section>

        <Section
          icon={<Wand2 className="h-4 w-4 text-primary" />}
          eyebrow="Custom"
          title="My visual directions"
          subtitle="A direction is a quick palette + font pick. Build yours when no brand exists."
        >
          <div className="flex flex-col gap-2">
            {customDirections.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground">No custom directions yet.</p>
            )}
            {customDirections.map((d) => (
              <div key={d.id} className="plate-soft rounded-lg px-3 py-2 flex items-center gap-3">
                <div className="flex gap-0.5">
                  {d.swatches.slice(0, 4).map((c, i) => (
                    <span key={i} className="h-4 w-2 rounded-[2px]" style={{ background: c }} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{d.tagline}</div>
                </div>
                <button onClick={() => setEditingDirection(d)} className="btn-ghost text-[11px]">
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={async () => { await window.renoir.deleteCustomDirection(d.id); await reloadCustom(); await refresh(); toast('Direction removed', 'info'); }}
                  className="btn-ghost text-[11px] text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setEditingDirection({
              id: 'dir_' + Math.random().toString(36).slice(2, 8),
              name: 'New direction', vibe: 'Custom', tagline: 'A short why-this-direction line.',
              font: 'Inter / Inter',
              swatches: ['oklch(0.18 0.02 264)', 'oklch(0.22 0.03 264)', 'oklch(0.74 0.18 50)', 'oklch(0.96 0.01 80)'],
            })}
            className="btn-ember w-fit mt-2"
          >
            <Plus className="h-4 w-4" />
            New direction
          </button>
        </Section>

        <Section
          icon={<Pipette className="h-4 w-4 text-primary" />}
          eyebrow="Tools"
          title="Color extractor"
          subtitle="Drop an image. Renoir downsamples it, runs k-means, and turns the dominant tones into an OKLch system."
        >
          <ColorExtractor onSaved={reloadCustom} />
        </Section>

        <Section
          icon={<FolderOpen className="h-4 w-4 text-primary" />}
          eyebrow="Storage"
          title="Workspace"
          subtitle="Projects, artifacts, and rendered images live on your disk."
        >
          <button onClick={openWorkspace} className="btn-quiet">
            <FolderOpen className="h-4 w-4" />
            Reveal workspace folder
          </button>
        </Section>

        <SkillEditor
          skill={editingSkill}
          onClose={() => setEditingSkill(null)}
          onSave={async (rec) => {
            await window.renoir.saveCustomSkill(rec);
            await reloadCustom();
            await refresh();
            toast('Skill saved', 'ok');
          }}
        />
        <SystemEditor
          system={editingSystem}
          onClose={() => setEditingSystem(null)}
          onSave={async (rec) => {
            await window.renoir.saveCustomSystem(rec);
            await reloadCustom();
            await refresh();
            toast('System saved', 'ok');
          }}
        />
        <DirectionEditor
          direction={editingDirection}
          onClose={() => setEditingDirection(null)}
          onSave={async (rec) => {
            await window.renoir.saveCustomDirection(rec);
            await reloadCustom();
            await refresh();
            toast('Direction saved', 'ok');
          }}
        />
      </div>
    </div>
  );
}

function SkillEditor({
  skill, onClose, onSave,
}: {
  skill: CustomSkill | null;
  onClose: () => void;
  onSave: (rec: CustomSkill) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CustomSkill | null>(skill);
  useEffect(() => { setDraft(skill); }, [skill]);
  if (!draft) return null;

  const update = <K extends keyof CustomSkill>(k: K, v: CustomSkill[K]) =>
    setDraft({ ...draft, [k]: v });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="plate rounded-2xl w-full max-w-[640px] max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="font-display italic text-xl">Skill editor</span>
          <button onClick={onClose} className="btn-ghost ml-auto text-[12px]">Close</button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Emoji"><input className="input-base" value={draft.emoji} onChange={(e) => update('emoji', e.target.value)} /></Field>
            <Field label="Name"><input className="input-base" value={draft.name} onChange={(e) => update('name', e.target.value)} /></Field>
            <Field label="Category">
              <select className="input-base" value={draft.category} onChange={(e) => update('category', e.target.value as any)}>
                {['web','mobile','deck','doc','media','system'].map((c) => <option key={c} value={c}>{c}</option>)}
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
              value={draft.questions.map((q) =>
                `${q.id}|${q.label}|${q.type}${q.options ? '|' + q.options.join(',') : ''}`).join('\n')}
              onChange={(e) => {
                const qs = e.target.value.split('\n').map((line) => {
                  const parts = line.split('|').map((s) => s.trim());
                  if (parts.length < 3 || !parts[0]) return null;
                  return {
                    id: parts[0],
                    label: parts[1],
                    type: (['text', 'textarea', 'select'].includes(parts[2]) ? parts[2] : 'text') as any,
                    options: parts[3] ? parts[3].split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                  };
                }).filter(Boolean) as CustomSkill['questions'];
                update('questions', qs);
              }}
            />
          </Field>
        </div>
        <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-quiet">Cancel</button>
          <button
            onClick={async () => { await onSave(draft); onClose(); }}
            className="btn-ember"
          >
            <Save className="h-4 w-4" />
            Save skill
          </button>
        </footer>
      </div>
    </div>
  );
}

function SystemEditor({
  system, onClose, onSave,
}: {
  system: CustomDesignSystem | null;
  onClose: () => void;
  onSave: (rec: CustomDesignSystem) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CustomDesignSystem | null>(system);
  useEffect(() => { setDraft(system); }, [system]);
  if (!draft) return null;
  const update = <K extends keyof CustomDesignSystem>(k: K, v: CustomDesignSystem[K]) =>
    setDraft({ ...draft, [k]: v });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="plate rounded-2xl w-full max-w-[640px] max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="font-display italic text-xl">Design system editor</span>
          <button onClick={onClose} className="btn-ghost ml-auto text-[12px]">Close</button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
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
              {draft.swatches.map((c, i) => (
                <span key={i} className="h-5 flex-1 rounded-[3px]" style={{ background: c }} />
              ))}
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
        </div>
        <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-quiet">Cancel</button>
          <button onClick={async () => { await onSave(draft); onClose(); }} className="btn-ember">
            <Save className="h-4 w-4" />
            Save system
          </button>
        </footer>
      </div>
    </div>
  );
}

function Section({
  icon, eyebrow, title, subtitle, children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="plate rounded-2xl p-6 mt-6"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.32em] text-primary/80">{eyebrow}</span>
      </div>
      <h2 className="font-display italic text-2xl mt-1">{title}</h2>
      <p className="text-[12.5px] text-muted-foreground mt-1 max-w-prose">{subtitle}</p>
      <div className="mt-5 flex flex-col gap-3">
        {children}
      </div>
    </motion.section>
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

function ReadonlyField({
  label, value, mono,
}: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className={cn(
        'rounded-md px-3 py-2 text-[12.5px] bg-secondary/60 border border-border text-foreground/80',
        mono && 'font-mono',
      )}>
        {value}
      </div>
    </div>
  );
}
