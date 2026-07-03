import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, FolderOpen, ImageIcon } from 'lucide-react';
import { iconForSkill } from '@/lib/skill-icons';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import { loadSession } from '@/lib/skill-sessions';
import type { ProjectRecord } from '@/types/global';
import { cn } from '@/lib/cn';

export function Home() {
  const skills = useCatalog((s) => s.skills);
  const azure  = useCatalog((s) => s.azure);
  const byok   = useCatalog((s) => s.byok);
  const setRoute = useUI((s) => s.setRoute);
  const setProject = useStudio((s) => s.setProject);
  const setSkill = useStudio((s) => s.setSkill);

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
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

  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin">
      <div className="max-w-[1100px] mx-auto px-10 pt-14 pb-24">
        <Hero onStart={() => startNew()} byokReady={Boolean(byok?.hasKey)} azureReady={Boolean(azure?.configured)} />

        {projects.length > 0 && (
          <section className="mt-12">
            <SectionTitle eyebrow="Continue" title="Recent studies" />
            <div className="grid grid-cols-2 gap-4 mt-6">
              {projects.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    const skill = p.skillId || 'web-prototype';
                    setProject(loadSession(p, skill));
                    setSkill(skill);
                    setRoute('studio');
                  }}
                  className="plate rounded-xl p-4 text-left group hover:-translate-y-[1px] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <span className="font-medium tracking-tight text-[13px]">{p.name}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                      {timeAgo(p.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground line-clamp-1">
                    {p.conversation.at(-1)?.content?.slice(0, 120) || 'No messages yet.'}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <SectionTitle eyebrow="Begin" title="Pick a starting point" />
          <div className="grid grid-cols-3 gap-4 mt-6">
            {skills.slice(0, 12).map((sk, i) => {
              const Icon = iconForSkill(sk.id);
              return (
                <motion.button
                  key={sk.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => startNew(sk.id)}
                  className={cn(
                    'plate rounded-2xl p-5 text-left group transition-all relative overflow-hidden',
                    'hover:-translate-y-[2px] hover:shadow-glow',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-xl grid place-items-center shrink-0 transition-colors"
                      style={{
                        background: 'hsl(var(--primary) / 0.08)',
                        boxShadow: 'inset 0 0 0 1px hsl(var(--primary) / 0.18)',
                      }}
                    >
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
          {skills.length > 12 && (
            <div className="text-center mt-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">
              {skills.length - 12} more in the studio sidebar
            </div>
          )}
        </section>

        {!byok?.hasKey && (
          <section className="mt-14">
            <div className="plate rounded-2xl p-5 flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Bring your own LLM key to begin</div>
                <div className="text-[12px] text-muted-foreground mt-1">
                  Renoir streams chat through any OpenAI-compatible endpoint. Keys stay encrypted on your machine — Azure
                  Foundry stays for image generation only.
                </div>
              </div>
              <button onClick={() => setRoute('settings')} className="btn-ember">
                Configure
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">{eyebrow}</div>
        <h2 className="font-display text-3xl mt-1 italic tracking-tight">{title}</h2>
      </div>
    </div>
  );
}

function Hero({
  onStart, byokReady, azureReady,
}: { onStart: () => void; byokReady: boolean; azureReady: boolean }) {
  return (
    <div className="relative overflow-hidden plate rounded-3xl px-9 py-10 grain">
      <div className="ambient" />
      <div className="relative z-10 flex items-center justify-between gap-8">
        <div className="max-w-[600px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Renoir · 0.1</div>
          <h1 className="font-display text-[54px] leading-[1.05] tracking-tight mt-1">
            <span className="italic">Sketch, render,</span>
            <br />
            <span className="text-primary">ship the look.</span>
          </h1>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[480px] mt-4">
            A local-first design studio that turns a brief into runnable artifacts —
            web prototypes, mobile screens, decks. BYOK for the model that talks; Azure Foundry
            handles the pictures.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <button onClick={onStart} className="btn-ember">
              Start a study
              <span className="caret">▍</span>
            </button>
            <span className="pill">{byokReady ? 'LLM ready' : 'LLM unset'}</span>
            <span className="pill">{azureReady ? 'Image ready' : 'Image unset'}</span>
          </div>
        </div>

        <HeroArt />
      </div>
    </div>
  );
}

function HeroArt() {
  return (
    <div className="hidden md:block relative h-[200px] w-[260px] shrink-0">
      <motion.div
        initial={{ rotate: -6, y: 4 }}
        animate={{ rotate: -6, y: 0 }}
        transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        className="absolute inset-0 rounded-2xl plate-soft"
        style={{
          background:
            'linear-gradient(135deg, hsl(22 92% 60% / 0.18), hsl(280 60% 50% / 0.10) 60%, transparent)',
        }}
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
                  'oklch(0.74 0.18 50)', 'oklch(0.62 0.22 36)', 'oklch(0.85 0.04 80)',
                  'oklch(0.18 0.02 264)', 'oklch(0.45 0.16 280)', 'oklch(0.96 0.01 80)',
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
    </div>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
