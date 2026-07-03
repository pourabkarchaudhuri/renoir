import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, Sparkles, Palette, Wand2, Cpu, Layers, Sun, Moon, Image as ImageIcon } from 'lucide-react';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import { cn } from '@/lib/cn';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon?: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPaletteOpen);
  const setRoute = useUI((s) => s.setRoute);
  const setTheme = useUI((s) => s.setTheme);
  const theme = useUI((s) => s.theme);

  const skills = useCatalog((s) => s.skills);
  const designSystems = useCatalog((s) => s.designSystems);
  const directions = useCatalog((s) => s.directions);
  const agents = useCatalog((s) => s.agents);

  const switchSkill = useStudio((s) => s.switchSkill);
  const setSystem = useStudio((s) => s.setSystem);
  const setDirection = useStudio((s) => s.setDirection);
  const setAgent = useStudio((s) => s.setAgent);

  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl + K opens, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  useEffect(() => { if (open) { setQ(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);

  const all = useMemo<Cmd[]>(() => {
    const out: Cmd[] = [];
    out.push(
      { id: 'go-home',     group: 'Go', label: 'Home',     icon: <ArrowRight className="h-3.5 w-3.5" />, run: () => setRoute('home') },
      { id: 'go-studio',   group: 'Go', label: 'Studio',   icon: <Sparkles className="h-3.5 w-3.5" />,   run: () => setRoute('studio') },
      { id: 'go-media',    group: 'Go', label: 'Media',    icon: <Wand2 className="h-3.5 w-3.5" />,      run: () => setRoute('media') },
      { id: 'go-gallery',  group: 'Go', label: 'Gallery',  icon: <Layers className="h-3.5 w-3.5" />,     run: () => setRoute('gallery') },
      { id: 'go-settings', group: 'Go', label: 'Settings', icon: <ImageIcon className="h-3.5 w-3.5" />,  run: () => setRoute('settings') },
    );
    out.push({
      id: 'theme-toggle', group: 'Theme',
      label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      icon: theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />,
      run: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    });
    skills.forEach((s) => out.push({
      id: 'skill:' + s.id, group: 'Skill', label: s.name, hint: s.blurb,
      icon: <Sparkles className="h-3.5 w-3.5" />,
      run: () => { void switchSkill(s.id); setRoute('studio'); },
    }));
    designSystems.forEach((d) => out.push({
      id: 'system:' + d.id, group: 'System', label: d.name, hint: d.vibe,
      icon: <Palette className="h-3.5 w-3.5" />,
      run: () => { setSystem(d.id); setRoute('studio'); },
    }));
    directions.forEach((d) => out.push({
      id: 'dir:' + d.id, group: 'Direction', label: d.name, hint: d.tagline,
      icon: <Wand2 className="h-3.5 w-3.5" />,
      run: () => { setDirection(d.id); setRoute('studio'); },
    }));
    agents.filter((a) => a.available).forEach((a) => out.push({
      id: 'agent:' + a.id, group: 'Agent', label: 'Route through ' + a.name, hint: a.blurb,
      icon: <Cpu className="h-3.5 w-3.5" />,
      run: () => { setAgent(a.id); setRoute('studio'); },
    }));
    out.push({
      id: 'agent:byok', group: 'Agent', label: 'Route through BYOK',
      icon: <Cpu className="h-3.5 w-3.5" />,
      run: () => { setAgent('byok'); setRoute('studio'); },
    });
    return out;
  }, [skills, designSystems, directions, agents, theme, setRoute, switchSkill, setSystem, setDirection, setAgent, setTheme]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((c) =>
      c.label.toLowerCase().includes(term) ||
      c.group.toLowerCase().includes(term) ||
      (c.hint || '').toLowerCase().includes(term)
    );
  }, [q, all]);

  const onPick = (cmd: Cmd) => { cmd.run(); setOpen(false); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[18vh] px-6"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="plate rounded-2xl w-full max-w-[680px] overflow-hidden shadow-plate"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 h-14 flex items-center gap-3 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setCursor(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(filtered.length - 1, c + 1)); }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
                  if (e.key === 'Enter' && filtered[cursor]) onPick(filtered[cursor]);
                }}
                placeholder="Jump to a skill, system, direction, agent…"
                className="flex-1 bg-transparent outline-none text-[14px]"
              />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-mono">
                ⌘K
              </span>
            </div>
            <div className="max-h-[58vh] overflow-y-auto scroll-thin py-1">
              {filtered.length === 0 && (
                <div className="px-5 py-10 text-center text-muted-foreground">Nothing matches "{q}".</div>
              )}
              {filtered.map((c, i) => (
                <button
                  key={c.id}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => onPick(c)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors',
                    cursor === i ? 'bg-primary/10' : 'hover:bg-accent',
                  )}
                >
                  <span className="h-6 w-6 grid place-items-center rounded-md bg-secondary text-muted-foreground">
                    {c.icon}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 w-[58px] shrink-0">
                    {c.group}
                  </span>
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="text-[11px] text-muted-foreground/70 max-w-[260px] truncate">{c.hint}</span>}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
