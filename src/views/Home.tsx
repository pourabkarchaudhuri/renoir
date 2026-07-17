import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Search, Settings2, Zap, ImageIcon, AudioLines, Film, Library } from 'lucide-react';
import { iconForSkill } from '@/lib/skill-icons';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import { loadSession } from '@/lib/skill-sessions';
import { ProjectStudiesSection } from '@/components/projects/ProjectStudiesSection';
import type { ProjectRecord, SkillSummary } from '@/types/global';
import { cn } from '@/lib/cn';
import { openSettingsSection } from '@/components/settings/SettingsShell';
import { audioOk, imageOk, llmOk, videoOk } from '@/lib/settings-status';

const CATEGORY_ORDER: Array<SkillSummary['category'] | 'all'> = ['all', 'web', 'mobile', 'deck', 'doc', 'media', 'system'];
/** Last built-in skill shown on Home; the rest live in Studio's Skills menu. */
const HOME_SKILL_CUTOFF_ID = 'all-hands-deck';

function featuredHomeSkills(skills: SkillSummary[]): SkillSummary[] {
  const idx = skills.findIndex((s) => s.id === HOME_SKILL_CUTOFF_ID);
  if (idx === -1) return skills;
  return skills.slice(0, idx + 1);
}

export function Home() {
  const skills = useCatalog((s) => s.skills);
  const azure = useCatalog((s) => s.azure);
  const byok = useCatalog((s) => s.byok);
  const setRoute = useUI((s) => s.setRoute);
  const setProject = useStudio((s) => s.setProject);
  const setSkill = useStudio((s) => s.setSkill);

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SkillSummary['category'] | 'all'>('all');

  useEffect(() => { window.renoir.listProjects().then(setProjects); }, []);

  const startNew = async (skillId?: string) => {
    const rec = await window.renoir.createProject({
      name: 'Untitled study',
      skillId,
      conversation: [],
      artifacts: [],
    });
    setProject(rec);
    if (skillId) setSkill(skillId);
    setRoute('studio');
  };

  const openProject = (p: ProjectRecord) => {
    const skill = p.skillId || p.lastSkillId || 'web-prototype';
    setProject(loadSession(p, skill));
    setSkill(skill);
    setRoute('studio');
  };

  const saveProjectMeta = async (p: ProjectRecord) => {
    await window.renoir.saveProject(p);
    const list = await window.renoir.listProjects();
    setProjects(list);
  };

  const openSettings = (section: 'llm' | 'azure') => {
    setRoute('settings');
    openSettingsSection(section);
  };

  const setup = useMemo(() => {
    const imageReady = imageOk(azure);
    const audioReady = audioOk(azure);
    const videoReady = videoOk(azure);
    const llmReady = llmOk(byok);
    return [
      { id: 'llm', label: 'LLM', ready: llmReady, onClick: () => openSettings('llm') },
      { id: 'image', label: 'Image', ready: imageReady, onClick: () => openSettings('azure') },
      { id: 'audio', label: 'Audio', ready: audioReady, onClick: () => openSettings('azure') },
      { id: 'video', label: 'Video', ready: videoReady, onClick: () => openSettings('azure') },
    ];
  }, [azure, byok]);

  const missing = setup.filter((item) => !item.ready);
  const homeSkills = useMemo(() => featuredHomeSkills(skills), [skills]);
  const hasMoreSkills = skills.length > homeSkills.length;
  const filteredSkills = useMemo(
    () => homeSkills.filter((skill) => (category === 'all' || skill.category === category) && `${skill.name} ${skill.blurb}`.toLowerCase().includes(query.trim().toLowerCase())),
    [category, query, homeSkills],
  );

  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin">
      <div className="max-w-[1180px] mx-auto px-8 pt-12 pb-24">
        <Hero onStart={() => startNew()} setup={setup} onOpenLibrary={() => setRoute('gallery')} onOpenSettings={() => setRoute('settings')} />

        {missing.length > 0 && (
          <section className="mt-8">
            <div className="plate rounded-2xl p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="page-eyebrow">Setup</div>
                <div className="text-lg font-medium mt-1">Finish configuration before you branch out.</div>
                <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-[560px]">
                  Missing: {missing.map((item) => item.label).join(', ')}. Renoir can still start studies now, but media and chat quality improve once your connections are wired.
                </p>
              </div>
              <button onClick={missing[0]?.id === 'llm' ? () => openSettings('llm') : () => openSettings('azure')} className="btn-ember w-fit">
                Configure {missing[0]?.label}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        <ProjectStudiesSection
          projects={projects}
          onOpen={openProject}
          onSaveProject={saveProjectMeta}
          emptyMessage="No studies yet — start one below."
        />

        <section className="mt-12">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="page-eyebrow">Begin</div>
              <h2 className="page-title text-3xl mt-1">Pick a starting point</h2>
            </div>
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills" className="input-base pl-9" />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={cn('pill', category === item && 'pill-on')}>
                {item === 'all' ? 'All' : item}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {filteredSkills.map((sk, i) => {
              const Icon = iconForSkill(sk.id);
              return (
                <motion.button
                  key={sk.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 * i, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => startNew(sk.id)}
                  className={cn('plate rounded-2xl p-5 text-left group transition-all relative overflow-hidden', 'hover:-translate-y-[2px] hover:shadow-glow')}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0 transition-colors" style={{ background: 'hsl(var(--primary) / 0.08)', boxShadow: 'inset 0 0 0 1px hsl(var(--primary) / 0.18)' }}>
                      <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium tracking-tight">{sk.name}</div>
                      <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{sk.blurb}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="pill">{sk.category}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {filteredSkills.length === 0 && (
            <div className="plate-soft rounded-2xl p-5 mt-6 text-[13px] text-muted-foreground">
              No skills match your filters. Try a different category or clear the search.
            </div>
          )}

          {hasMoreSkills && (
            <p className="text-center mt-6 text-[12px] text-muted-foreground">
              Find others in the{' '}
              <button type="button" onClick={() => setRoute('studio')} className="text-primary hover:underline">
                Skills menu
              </button>
              {' '}in Studio.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Hero({
  onStart,
  setup,
  onOpenLibrary,
  onOpenSettings,
}: {
  onStart: () => void;
  setup: { id: string; label: string; ready: boolean; onClick: () => void }[];
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="relative overflow-hidden plate rounded-3xl px-8 py-9 grain">
      <div className="ambient" />
      <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-[620px]">
          <div className="page-eyebrow">Renoir · 0.1</div>
          <h1 className="page-title text-5xl leading-[1.04] mt-2">
            Sketch, render,
            <br />
            <span className="text-primary">ship the look.</span>
          </h1>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[520px] mt-4">
            A local-first design studio that turns a brief into runnable artifacts — web prototypes, mobile screens, decks, and the media that supports them.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button onClick={onStart} className="btn-ember">
              Start a study
              <span className="caret">▍</span>
            </button>
            <button onClick={onOpenLibrary} className="btn-quiet">
              <Library className="h-4 w-4" />
              Open Library
            </button>
            <button onClick={onOpenSettings} className="btn-quiet">
              <Settings2 className="h-4 w-4" />
              Configure
            </button>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {setup.map((item) => (
              <button key={item.id} onClick={item.onClick} className={cn('pill transition-colors', item.ready ? 'pill-ok' : 'pill-warn')}>
                {item.label} {item.ready ? 'ready' : 'unset'}
              </button>
            ))}
          </div>
        </div>

        <HeroArt />
      </div>
    </div>
  );
}

function HeroArt() {
  return (
    <div className="hidden md:block relative h-[210px] w-[280px] shrink-0">
      <motion.div
        initial={{ rotate: -6, y: 4 }}
        animate={{ rotate: -6, y: 0 }}
        transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        className="absolute inset-0 rounded-2xl plate-soft"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(280 60% 50% / 0.10) 60%, transparent)' }}
      />
      <motion.div
        initial={{ rotate: 5, x: -4 }}
        animate={{ rotate: 5, x: 4 }}
        transition={{ duration: 7, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        className="absolute inset-3 rounded-2xl plate"
      >
        <div className="p-3 grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-md"
              style={{
                background: [
                  'hsl(var(--primary) / 0.92)', 'hsl(18 90% 50%)', 'hsl(35 25% 82%)',
                  'hsl(230 18% 22%)', 'hsl(280 52% 52%)', 'hsl(var(--foreground) / 0.88)',
                ][i],
              }}
            />
          ))}
        </div>
        <div className="px-3 pb-3 flex items-center gap-2">
          <Zap className="h-3 w-3 text-primary" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Ember</span>
        </div>
      </motion.div>
      <motion.div
        initial={{ rotate: 0, scale: 1 }}
        animate={{ rotate: 0, scale: 1.02 }}
        transition={{ duration: 5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        className="absolute right-2 -bottom-2 h-12 w-12 rounded-xl grid place-items-center plate"
      >
        <ImageIcon className="h-5 w-5 text-primary" />
      </motion.div>
      <motion.div className="absolute left-4 -bottom-5 flex gap-2">
        <span className="pill pill-ok"><AudioLines className="h-3 w-3" />Audio</span>
        <span className="pill pill-warn"><Film className="h-3 w-3" />Video</span>
      </motion.div>
    </div>
  );
}
