import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Sparkles, Palette, Wand2, ChevronDown, ChevronLeft, ChevronRight, Search, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandSpecPanel } from './BrandSpecPanel';
import { iconForSkill } from '@/lib/skill-icons';
import { AgentPicker } from './AgentPicker';
import { ByokInline } from './ByokInline';

/**
 * Compact studio sidebar — three compact pickers (Skill / System / Direction)
 * stacked vertically. Each opens a searchable popover so the 30+ skills,
 * 70+ systems, and 5+ directions don't dominate the rail.
 */
export function LeftRail() {
  const skills        = useCatalog((s) => s.skills);
  const designSystems = useCatalog((s) => s.designSystems);
  const directions    = useCatalog((s) => s.directions);
  const skillId       = useStudio((s) => s.selectedSkillId);
  const systemId      = useStudio((s) => s.selectedDesignSystemId);
  const directionId   = useStudio((s) => s.selectedDirectionId);
  const setSkill      = useStudio((s) => s.setSkill);
  const setSystem     = useStudio((s) => s.setSystem);
  const setDirection  = useStudio((s) => s.setDirection);
  const project       = useStudio((s) => s.project);

  // Default selections.
  useEffect(() => {
    if (!skillId && skills[0]) setSkill(skills[0].id);
    if (!systemId && designSystems[0]) setSystem(designSystems[0].id);
  }, [skills, designSystems, skillId, systemId, setSkill, setSystem]);

  const skill     = skills.find((s) => s.id === skillId);
  const system    = designSystems.find((s) => s.id === systemId);
  const direction = directions.find((d) => d.id === directionId);
  const SkillIcon = skill ? iconForSkill(skill.id) : Sparkles;
  const collapsed = useUI((s) => s.railCollapsed);
  const toggleRail = useUI((s) => s.toggleRail);

  if (collapsed) {
    return (
      <aside className="w-[44px] shrink-0 border-r border-border bg-background/40 backdrop-blur-md flex flex-col items-center py-3 gap-1.5">
        <button
          onClick={toggleRail}
          className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="h-px w-6 bg-border my-1" />
        <CollapsedTile icon={<SkillIcon className="h-4 w-4" strokeWidth={1.6} />} label={skill?.name || 'Skill'}     onClick={toggleRail} />
        <CollapsedTile icon={system?.swatches?.length ? <SwatchSquare swatches={system.swatches} /> : <Palette className="h-4 w-4" strokeWidth={1.6} />} label={system?.name || 'System'} onClick={toggleRail} />
        <CollapsedTile icon={direction?.swatches?.length ? <SwatchSquare swatches={direction.swatches} /> : <Wand2 className="h-4 w-4" strokeWidth={1.6} />} label={direction?.name || 'Direction'} onClick={toggleRail} />
      </aside>
    );
  }

  return (
    <aside className="w-[280px] shrink-0 border-r border-border bg-background/40 backdrop-blur-md flex flex-col min-h-0">
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">Study</div>
          <button
            onClick={toggleRail}
            className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
        <RailRename project={project ?? undefined} />
        <RailActions />
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-3 py-3 space-y-2 min-h-0">
        <Picker
          label="Skill"
          eyebrow={<SkillIcon className="h-3 w-3 text-primary" strokeWidth={1.6} />}
          value={skill?.name}
          subtitle={skill?.blurb}
          accent={null}
          options={skills.map((s) => ({
            id: s.id, name: s.name, blurb: s.blurb,
            icon: iconForSkill(s.id),
          }))}
          selectedId={skillId}
          onSelect={setSkill}
        />
        <Picker
          label="System"
          eyebrow={<Palette className="h-3 w-3 text-primary" strokeWidth={1.6} />}
          value={system?.name}
          subtitle={system?.vibe}
          accent={system ? <SwatchRow swatches={system.swatches} /> : null}
          options={designSystems.map((d) => ({
            id: d.id, name: d.name, blurb: d.vibe,
            swatches: d.swatches,
          }))}
          selectedId={systemId}
          onSelect={setSystem}
        />
        <Picker
          label="Direction"
          eyebrow={<Wand2 className="h-3 w-3 text-primary" strokeWidth={1.6} />}
          value={direction?.name || '— none —'}
          subtitle={direction?.tagline || 'Optional palette + font hint'}
          accent={direction ? <SwatchRow swatches={direction.swatches} /> : null}
          options={[
            { id: '', name: '— none —', blurb: 'No direction injected' },
            ...directions.map((d) => ({
              id: d.id, name: d.name, blurb: d.tagline,
              swatches: d.swatches,
            })),
          ]}
          selectedId={directionId || ''}
          onSelect={(id) => setDirection(id || undefined)}
        />
        <ByokInline />
      </div>
      <BrandSpecPanel />
    </aside>
  );
}

interface PickerOption {
  id: string;
  name: string;
  blurb?: string;
  icon?: typeof Sparkles;
  swatches?: string[];
}

function Picker({
  label, eyebrow, value, subtitle, accent, options, selectedId, onSelect,
}: {
  label: string;
  eyebrow: React.ReactNode;
  value?: string;
  subtitle?: string;
  accent: React.ReactNode | null;
  options: PickerOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) =>
      o.name.toLowerCase().includes(term) ||
      (o.blurb || '').toLowerCase().includes(term),
    );
  }, [q, options]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setQ(''); }}
        className={cn(
          'w-full plate-soft rounded-xl px-3 py-2 text-left transition-colors',
          'hover:bg-accent',
          open && 'ring-1 ring-primary/40',
        )}
      >
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {eyebrow}
          {label}
          <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform', open && 'rotate-180')} />
        </div>
        <div className="text-[13px] font-medium tracking-tight mt-0.5 truncate">{value ?? '—'}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground leading-snug break-words">{subtitle}</div>}
        {accent && <div className="mt-1.5">{accent}</div>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute z-30 left-0 right-0 mt-1 plate rounded-xl shadow-plate overflow-hidden"
          >
            <div className="px-2.5 py-2 border-b border-border flex items-center gap-2">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="flex-1 bg-transparent outline-none text-[12.5px]"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto scroll-thin">
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-[11.5px] text-muted-foreground italic">
                  Nothing matches "{q}".
                </div>
              )}
              {filtered.map((o) => {
                const Icon = o.icon;
                const active = (selectedId ?? '') === o.id;
                return (
                  <button
                    key={o.id || '__none'}
                    onClick={() => { onSelect(o.id); setOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors text-[12.5px]',
                      active ? 'bg-primary/10' : 'hover:bg-accent',
                    )}
                  >
                    {Icon ? (
                      <div className="h-7 w-7 rounded-md grid place-items-center shrink-0 bg-primary/10 ring-1 ring-primary/20">
                        <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.6} />
                      </div>
                    ) : o.swatches ? (
                      <div className="shrink-0">
                        <SwatchRow swatches={o.swatches} compact />
                      </div>
                    ) : (
                      <div className="h-7 w-7" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium tracking-tight truncate">{o.name}</div>
                      {o.blurb && (
                        <div className="text-[11px] text-muted-foreground leading-snug break-words">{o.blurb}</div>
                      )}
                    </div>
                    {active && <Check className="h-3.5 w-3.5 text-primary mt-1.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwatchRow({ swatches, compact }: { swatches: string[]; compact?: boolean }) {
  return (
    <div className={cn('flex gap-0.5', compact ? 'h-5' : 'h-3.5')}>
      {swatches.slice(0, 6).map((c, i) => (
        <span
          key={i}
          className={cn(compact ? 'w-3' : 'flex-1', 'rounded-[3px]')}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function RailRename({ project }: { project?: { id: string; name: string } }) {
  const setProject = useStudio((s) => s.setProject);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project?.name ?? '');
  useEffect(() => { setDraft(project?.name ?? ''); }, [project?.name]);

  if (!project) return <div className="font-display italic text-2xl text-muted-foreground">Untitled</div>;

  const save = async () => {
    setEditing(false);
    if (!draft.trim() || draft.trim() === project.name) return;
    const r = await window.renoir.renameProject({ id: project.id, name: draft.trim() });
    if (r.ok && r.project) setProject(r.project);
  };

  return editing ? (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') { setEditing(false); setDraft(project.name); }
      }}
      className="w-full bg-transparent outline-none border-b border-primary/40 font-display italic text-2xl pb-1"
    />
  ) : (
    <button
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="w-full text-left font-display italic text-2xl hover:text-primary transition-colors block truncate"
    >
      {project.name}
    </button>
  );
}

function RailActions() {
  return (
    <div className="mt-3 flex items-center">
      <div className="ml-auto"><AgentPicker /></div>
    </div>
  );
}

function SwatchSquare({ swatches }: { swatches: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-px h-4 w-4 rounded overflow-hidden ring-1 ring-border">
      {swatches.slice(0, 4).map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </div>
  );
}

function CollapsedTile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-9 w-9 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
      title={label}
    >
      {icon}
    </button>
  );
}
