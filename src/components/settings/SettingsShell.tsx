import { cn } from '@/lib/cn';

export type SettingsSectionId = 'llm' | 'azure' | 'appearance' | 'skills' | 'systems' | 'directions' | 'tools' | 'workspace';

const ITEMS: { id: SettingsSectionId; label: string; eyebrow: string }[] = [
  { id: 'llm', label: 'Bring your own key', eyebrow: 'LLM' },
  { id: 'azure', label: 'Azure Foundry', eyebrow: 'Image' },
  { id: 'appearance', label: 'Theme', eyebrow: 'Appearance' },
  { id: 'skills', label: 'My skills', eyebrow: 'Custom' },
  { id: 'systems', label: 'Design systems', eyebrow: 'Custom' },
  { id: 'directions', label: 'Visual directions', eyebrow: 'Custom' },
  { id: 'tools', label: 'Color extractor', eyebrow: 'Tools' },
  { id: 'workspace', label: 'Workspace', eyebrow: 'Storage' },
];

export function parseSettingsSection(hash: string): SettingsSectionId {
  const match = hash.match(/settings(?:\/|:)([a-z-]+)/i);
  const value = match?.[1]?.toLowerCase() as SettingsSectionId | undefined;
  return ITEMS.some((item) => item.id === value) ? value! : 'llm';
}

export function openSettingsSection(id: SettingsSectionId) {
  window.location.hash = `settings/${id}`;
}

export function SettingsShell({
  section,
  onSectionChange,
  children,
}: {
  section: SettingsSectionId;
  onSectionChange: (next: SettingsSectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <aside className="plate-soft rounded-2xl p-3 lg:sticky lg:top-0">
        <div className="px-2 py-2">
          <div className="page-eyebrow">Configuration</div>
          <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
            Secrets stay local. This panel only tunes Renoir&apos;s shell and backend connections.
          </p>
        </div>
        <nav className="mt-2 flex flex-col gap-1">
          {ITEMS.map((item) => {
            const active = item.id === section;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-left transition-colors border',
                  active
                    ? 'bg-primary/10 text-foreground border-primary/30'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/70',
                )}
              >
                <div className="text-[10px] uppercase tracking-[0.26em] text-primary/75">{item.eyebrow}</div>
                <div className="text-[13px] font-medium mt-1">{item.label}</div>
              </button>
            );
          })}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
