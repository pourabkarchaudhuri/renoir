import { useEffect, useMemo, useState } from 'react';
import {
  Eye, EyeOff, Save, Trash2, FolderOpen, KeyRound, ImageIcon, Sun, Moon,
  Plus, Sparkles, Palette, Pencil, Wand2, Pipette, AudioLines, Film,
} from 'lucide-react';
import { useCatalog, useUI } from '@/lib/store';
import type { CustomSkill, CustomDesignSystem, CustomDirection } from '@/types/global';
import { ColorExtractor } from '@/components/settings/ColorExtractor';
import { DirectionEditor } from '@/components/settings/DirectionEditor';
import { SettingsShell, openSettingsSection, parseSettingsSection, type SettingsSectionId } from '@/components/settings/SettingsShell';
import { SettingsSection, Field, ReadonlyField } from '@/components/settings/SettingsSection';
import { SkillEditor } from '@/components/settings/editors/SkillEditor';
import { SystemEditor } from '@/components/settings/editors/SystemEditor';
import { cn } from '@/lib/cn';

export function Settings() {
  const refresh = useCatalog((s) => s.refresh);
  const azure = useCatalog((s) => s.azure);
  const byok = useCatalog((s) => s.byok);
  const toast = useUI((s) => s.toast);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);

  const [section, setSection] = useState<SettingsSectionId>(() => parseSettingsSection(window.location.hash));
  const [workspacePath, setWorkspacePath] = useState('');

  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([]);
  const [customSystems, setCustomSystems] = useState<CustomDesignSystem[]>([]);
  const [customDirections, setCustomDirections] = useState<CustomDirection[]>([]);
  const [editingSkill, setEditingSkill] = useState<CustomSkill | null>(null);
  const [editingSystem, setEditingSystem] = useState<CustomDesignSystem | null>(null);
  const [editingDirection, setEditingDirection] = useState<CustomDirection | null>(null);

  const reloadCustom = async () => {
    const [skills, systems, directions] = await Promise.all([
      window.renoir.listCustomSkills(),
      window.renoir.listCustomSystems(),
      window.renoir.listCustomDirections(),
    ]);
    setCustomSkills(skills);
    setCustomSystems(systems);
    setCustomDirections(directions);
  };

  useEffect(() => {
    void refresh();
    void reloadCustom();
    void window.renoir.getWorkspace().then((r) => setWorkspacePath(r.path));
  }, [refresh]);

  useEffect(() => {
    if (byok) {
      setBaseUrl(byok.baseUrl || '');
      setModel(byok.model || '');
    }
  }, [byok]);

  useEffect(() => {
    const onHash = () => setSection(parseSettingsSection(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goSection = (next: SettingsSectionId) => {
    setSection(next);
    openSettingsSection(next);
  };

  const llmReady = Boolean(byok?.hasKey && byok?.baseUrl);
  const keySourceLabel = byok?.keySource === 'env' ? 'From .env' : byok?.keySource === 'keychain' ? 'From keychain' : 'Unset';
  const imageReady = Boolean(azure?.imageConfigured ?? azure?.configured);
  const textReady = Boolean(azure?.configured);
  const audioReady = Boolean(azure?.audioDeployment || azure?.textDeployment);
  const videoReady = Boolean(azure?.videoDeployment);

  const azureRows = useMemo(() => ([
    {
      key: 'Foundry connection',
      icon: <ImageIcon className="h-4 w-4" />,
      ready: textReady,
      detail: azure?.endpoint || 'Set AZURE_FOUNDRY_ENDPOINT in .env',
      meta: textReady ? 'Key detected in main process' : 'Needs endpoint + API key',
    },
    {
      key: 'Image generation',
      icon: <Sparkles className="h-4 w-4" />,
      ready: imageReady,
      detail: azure?.imageDeployment || 'gpt-image-2',
      meta: azure?.imageEndpoint && azure.imageEndpoint !== azure.endpoint ? azure.imageEndpoint : 'Uses Foundry endpoint by default',
    },
    {
      key: 'Text fallback',
      icon: <Wand2 className="h-4 w-4" />,
      ready: textReady,
      detail: azure?.textDeployment || 'gpt-5.4',
      meta: 'Used when no BYOK key is active',
    },
    {
      key: 'Audio',
      icon: <AudioLines className="h-4 w-4" />,
      ready: audioReady,
      detail: azure?.audioDeployment || 'AZURE_AUDIO_DEPLOYMENT',
      meta: azure?.audioDeployment ? 'Enabled in Media' : 'Falls back to text deployment when available',
    },
    {
      key: 'Video',
      icon: <Film className="h-4 w-4" />,
      ready: videoReady,
      detail: azure?.videoDeployment || 'AZURE_VIDEO_DEPLOYMENT',
      meta: videoReady ? 'Enabled in Media' : 'Add deployment in .env to enable',
    },
  ]), [audioReady, azure?.audioDeployment, azure?.endpoint, azure?.imageDeployment, azure?.imageEndpoint, azure?.textDeployment, azure?.videoDeployment, imageReady, textReady, videoReady]);

  const saveByok = async () => {
    try {
      await window.renoir.byokSet({
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        apiKey: apiKey || undefined,
      });
      setApiKey('');
      await refresh();
      toast('LLM credentials saved', 'ok');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save credentials', 'err');
    }
  };

  const clearByok = async () => {
    try {
      await window.renoir.byokClear();
      setBaseUrl('');
      setModel('');
      setApiKey('');
      await refresh();
      toast('LLM credentials cleared', 'info');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to clear credentials', 'err');
    }
  };

  const openWorkspace = async () => {
    const r = await window.renoir.openWorkspace();
    if (r.ok) toast(`Workspace at ${r.path}`, 'info');
  };

  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin">
      <div className="max-w-[1180px] mx-auto px-8 pt-12 pb-24">
        <div className="mb-8 max-w-[720px]">
          <div className="page-eyebrow">Configuration</div>
          <h1 className="page-title text-4xl mt-1">Settings</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            Renoir keeps secrets on your machine, syncs theme to the shell, and reads Azure deployments from <span className="font-mono text-foreground/80">.env</span>.
          </p>
        </div>

        <SettingsShell section={section} onSectionChange={goSection}>
          <div className="space-y-6">
            {section === 'llm' && (
              <SettingsSection
                icon={<KeyRound className="h-4 w-4 text-primary" />}
                eyebrow="LLM"
                title="Bring your own key"
                subtitle="OpenAI-compatible endpoints work best here. Base URL and model can come from settings or .env defaults; the key itself stays local."
              >
                <div className="flex flex-wrap gap-2">
                  <span className={cn('pill', llmReady ? 'pill-ok' : 'pill-warn')}>{llmReady ? 'LLM ready' : 'LLM incomplete'}</span>
                  <span className={cn('pill', byok?.hasKey ? 'pill-ok' : 'pill-warn')}>{keySourceLabel}</span>
                </div>
                <Field label="Base URL">
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="input-base font-mono text-[12.5px]" />
                </Field>
                <Field label="Model id">
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o, claude-opus-4-7, gpt-5.4, llama3.3" className="input-base font-mono text-[12.5px]" />
                </Field>
                <Field
                  label={byok?.hasKey ? 'API key (already set — fill to replace)' : 'API key'}
                  hint={byok?.keySource === 'env' ? 'This key currently comes from .env. Clearing stored credentials will not remove the .env value.' : undefined}
                >
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={byok?.hasKey ? '•••• stored locally ••••' : 'sk-…'}
                      className="input-base pr-10 font-mono text-[12.5px]"
                    />
                    <button onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </Field>
                <div className="flex gap-2 pt-1 flex-wrap">
                  <button onClick={saveByok} className="btn-ember">
                    <Save className="h-4 w-4" />
                    Save
                  </button>
                  {byok?.hasKey && (
                    <button onClick={clearByok} className="btn-quiet text-red-300 hover:text-red-200 dark:text-red-300">
                      <Trash2 className="h-4 w-4" />
                      Clear stored key
                    </button>
                  )}
                </div>
              </SettingsSection>
            )}

            {section === 'azure' && (
              <SettingsSection
                icon={<ImageIcon className="h-4 w-4 text-primary" />}
                eyebrow="Image"
                title="Azure Foundry"
                subtitle="Azure settings live in .env and stay in the main process. Renoir exposes status here so you can see what media capabilities are actually wired."
              >
                <ReadonlyField label="Endpoint" value={azure?.endpoint || '— unset —'} mono />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {azureRows.map((row) => (
                    <div key={row.key} className="plate-soft rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {row.icon}
                          {row.key}
                        </div>
                        <span className={cn('pill', row.ready ? 'pill-ok' : 'pill-warn')}>
                          {row.ready ? 'Ready' : 'Needs setup'}
                        </span>
                      </div>
                      <div className="mt-3 font-mono text-[12px] break-all text-foreground/85">{row.detail}</div>
                      <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{row.meta}</div>
                    </div>
                  ))}
                </div>
              </SettingsSection>
            )}

            {section === 'appearance' && (
              <SettingsSection
                icon={theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
                eyebrow="Appearance"
                title="Theme"
                subtitle="Renoir stays dark-first, but light mode keeps the same hierarchy and chrome. Theme changes sync to the window frame."
              >
                <div className="inline-flex gap-2 rounded-xl border border-border bg-secondary/60 p-1 w-fit">
                  <button onClick={() => setTheme('dark')} className={cn('btn-ghost rounded-lg px-3 py-2', theme === 'dark' && 'bg-primary/10 text-primary border border-primary/25')}>
                    <Moon className="h-4 w-4" />
                    Dark
                  </button>
                  <button onClick={() => setTheme('light')} className={cn('btn-ghost rounded-lg px-3 py-2', theme === 'light' && 'bg-primary/10 text-primary border border-primary/25')}>
                    <Sun className="h-4 w-4" />
                    Light
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ThemePreviewCard title="Dark" active={theme === 'dark'} surfaceClass="bg-[#0f1118] border-white/5" lineClass="bg-white/70" accentClass="bg-orange-400" />
                  <ThemePreviewCard title="Light" active={theme === 'light'} surfaceClass="bg-[#fbfaf7] border-slate-300/70" lineClass="bg-slate-700/80" accentClass="bg-orange-500" />
                </div>
              </SettingsSection>
            )}

            {section === 'skills' && (
              <SettingsSection icon={<Sparkles className="h-4 w-4 text-primary" />} eyebrow="Custom" title="My skills" subtitle="Skills are primers plus question forms. Add your own alongside Renoir's built-ins.">
                <CatalogList
                  empty="No custom skills yet."
                  items={customSkills.map((s) => ({
                    id: s.id,
                    leading: <span className="text-base">{s.emoji || '✨'}</span>,
                    title: s.name,
                    subtitle: s.blurb,
                    onEdit: () => setEditingSkill(s),
                    onDelete: async () => { await window.renoir.deleteCustomSkill(s.id); await reloadCustom(); await refresh(); toast('Skill removed', 'info'); },
                  }))}
                />
                <button onClick={() => setEditingSkill({ id: 'sk_' + Math.random().toString(36).slice(2, 8), name: 'New skill', category: 'web', emoji: '✨', blurb: 'A fresh skill.', primer: 'Output …', questions: [{ id: 'audience', label: 'Who is this for?', type: 'text' }] })} className="btn-ember w-fit mt-2">
                  <Plus className="h-4 w-4" />
                  New skill
                </button>
              </SettingsSection>
            )}

            {section === 'systems' && (
              <SettingsSection icon={<Palette className="h-4 w-4 text-primary" />} eyebrow="Custom" title="My design systems" subtitle="OKLch-tokenized systems. Define swatches and a font stack; Renoir injects tokens into generation prompts.">
                <CatalogList
                  empty="No custom systems yet."
                  items={customSystems.map((d) => ({
                    id: d.id,
                    leading: <div className="flex gap-0.5">{d.swatches.slice(0, 4).map((c, i) => <span key={i} className="h-4 w-2 rounded-[2px]" style={{ background: c }} />)}</div>,
                    title: d.name,
                    subtitle: d.vibe,
                    onEdit: () => setEditingSystem(d),
                    onDelete: async () => { await window.renoir.deleteCustomSystem(d.id); await reloadCustom(); await refresh(); toast('System removed', 'info'); },
                  }))}
                />
                <button onClick={() => setEditingSystem({ id: 'sys_' + Math.random().toString(36).slice(2, 8), name: 'New system', vibe: 'Custom', font: 'Inter / Inter', swatches: ['oklch(0.16 0.02 264)', 'oklch(0.22 0.03 264)', 'oklch(0.74 0.18 50)', 'oklch(0.62 0.22 36)', 'oklch(0.85 0.04 80)', 'oklch(0.96 0.01 80)'], tokens: [{ name: 'bg', value: 'oklch(0.16 0.02 264)' }, { name: 'surface', value: 'oklch(0.22 0.03 264)' }, { name: 'fg', value: 'oklch(0.96 0.01 80)' }, { name: 'accent', value: 'oklch(0.74 0.18 50)' }, { name: 'muted', value: 'oklch(0.62 0.04 264)' }] })} className="btn-ember w-fit mt-2">
                  <Plus className="h-4 w-4" />
                  New design system
                </button>
              </SettingsSection>
            )}

            {section === 'directions' && (
              <SettingsSection icon={<Wand2 className="h-4 w-4 text-primary" />} eyebrow="Custom" title="My visual directions" subtitle="Directions are quick palette and font picks when a brand does not exist yet.">
                <CatalogList
                  empty="No custom directions yet."
                  items={customDirections.map((d) => ({
                    id: d.id,
                    leading: <div className="flex gap-0.5">{d.swatches.slice(0, 4).map((c, i) => <span key={i} className="h-4 w-2 rounded-[2px]" style={{ background: c }} />)}</div>,
                    title: d.name,
                    subtitle: d.tagline,
                    onEdit: () => setEditingDirection(d),
                    onDelete: async () => { await window.renoir.deleteCustomDirection(d.id); await reloadCustom(); await refresh(); toast('Direction removed', 'info'); },
                  }))}
                />
                <button onClick={() => setEditingDirection({ id: 'dir_' + Math.random().toString(36).slice(2, 8), name: 'New direction', vibe: 'Custom', tagline: 'A short why-this-direction line.', font: 'Inter / Inter', swatches: ['oklch(0.18 0.02 264)', 'oklch(0.22 0.03 264)', 'oklch(0.74 0.18 50)', 'oklch(0.96 0.01 80)'] })} className="btn-ember w-fit mt-2">
                  <Plus className="h-4 w-4" />
                  New direction
                </button>
              </SettingsSection>
            )}

            {section === 'tools' && (
              <SettingsSection icon={<Pipette className="h-4 w-4 text-primary" />} eyebrow="Tools" title="Color extractor" subtitle="Drop an image. Renoir downsamples it, runs k-means, and turns the dominant tones into an OKLch system.">
                <ColorExtractor onSaved={reloadCustom} />
              </SettingsSection>
            )}

            {section === 'workspace' && (
              <SettingsSection icon={<FolderOpen className="h-4 w-4 text-primary" />} eyebrow="Storage" title="Workspace" subtitle="Projects, artifacts, and rendered media live on disk in the Renoir workspace.">
                <ReadonlyField label="Workspace path" value={workspacePath || 'Loading…'} mono />
                <button onClick={openWorkspace} className="btn-quiet w-fit">
                  <FolderOpen className="h-4 w-4" />
                  Reveal workspace folder
                </button>
              </SettingsSection>
            )}
          </div>
        </SettingsShell>

        <SkillEditor skill={editingSkill} onClose={() => setEditingSkill(null)} onSave={async (rec) => { await window.renoir.saveCustomSkill(rec); await reloadCustom(); await refresh(); toast('Skill saved', 'ok'); }} />
        <SystemEditor system={editingSystem} onClose={() => setEditingSystem(null)} onSave={async (rec) => { await window.renoir.saveCustomSystem(rec); await reloadCustom(); await refresh(); toast('System saved', 'ok'); }} />
        <DirectionEditor direction={editingDirection} onClose={() => setEditingDirection(null)} onSave={async (rec) => { await window.renoir.saveCustomDirection(rec); await reloadCustom(); await refresh(); toast('Direction saved', 'ok'); }} />
      </div>
    </div>
  );
}

function CatalogList({
  items,
  empty,
}: {
  items: { id: string; leading: React.ReactNode; title: string; subtitle: string; onEdit: () => void; onDelete: () => Promise<void>; }[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-[12.5px] text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="plate-soft rounded-xl px-3 py-2.5 flex items-center gap-3">
          <div className="shrink-0">{item.leading}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">{item.title}</div>
            <div className="text-[11px] text-muted-foreground truncate">{item.subtitle}</div>
          </div>
          <button onClick={item.onEdit} className="btn-ghost text-[11px]"><Pencil className="h-3 w-3" />Edit</button>
          <button onClick={() => void item.onDelete()} className="btn-ghost text-[11px] text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
        </div>
      ))}
    </div>
  );
}

function ThemePreviewCard({
  title,
  active,
  surfaceClass,
  lineClass,
  accentClass,
}: {
  title: string;
  active: boolean;
  surfaceClass: string;
  lineClass: string;
  accentClass: string;
}) {
  return (
    <div className={cn('rounded-2xl border p-3 transition-colors', active ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/35')}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className={cn('pill', active ? 'pill-on' : '')}>{active ? 'Active' : 'Preview'}</span>
      </div>
      <div className={cn('mt-3 rounded-xl border p-3', surfaceClass)}>
        <div className={cn('h-2 w-20 rounded-full', lineClass)} />
        <div className={cn('mt-3 h-8 w-full rounded-lg', accentClass)} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="h-10 rounded-lg bg-white/10" />
          <div className="h-10 rounded-lg bg-white/10" />
          <div className="h-10 rounded-lg bg-white/10" />
        </div>
      </div>
    </div>
  );
}
