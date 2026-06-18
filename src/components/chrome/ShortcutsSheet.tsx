import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface Group {
  title: string;
  rows: { keys: string[]; label: string }[];
}

const GROUPS: Group[] = [
  { title: 'General', rows: [
    { keys: ['?'], label: 'Open this cheatsheet' },
    { keys: ['⌘', 'K'], label: 'Command palette' },
    { keys: ['Esc'], label: 'Close any modal' },
  ]},
  { title: 'Composer', rows: [
    { keys: ['⌘', '↩'], label: 'Send message' },
    { keys: ['/'], label: 'Slash menu (skill / system / direction / agent / critique)' },
    { keys: ['↑', '↓'], label: 'Navigate slash menu' },
    { keys: ['Tab'], label: 'Apply highlighted slash item' },
  ]},
  { title: 'Studio', rows: [
    { keys: ['Click title'], label: 'Rename project' },
    { keys: ['Hover message'], label: 'Edit / delete / regenerate' },
  ]},
  { title: 'Drag & drop', rows: [
    { keys: ['Drop .zip'], label: 'Import a Renoir / generic ZIP' },
    { keys: ['Drop image'], label: 'Vision describes it (Studio header), or extract palette (Settings)' },
  ]},
];

export function ShortcutsSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (t && (t as any).isContentEditable)) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55] grid place-items-center bg-black/50 backdrop-blur-sm p-6"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="plate rounded-2xl w-full max-w-[720px] max-h-[80vh] overflow-y-auto scroll-thin"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-6 py-4 border-b border-border flex items-center gap-3">
              <Keyboard className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Reference</div>
                <h3 className="font-display italic text-2xl">Shortcuts.</h3>
              </div>
              <button onClick={() => setOpen(false)} className="btn-ghost"><X className="h-4 w-4" /></button>
            </header>
            <div className="grid grid-cols-2 gap-6 p-6">
              {GROUPS.map((g) => (
                <section key={g.title}>
                  <h4 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">{g.title}</h4>
                  <ul className="space-y-2">
                    {g.rows.map((r, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          {r.keys.map((k, j) => (
                            <kbd key={j} className="plate-soft rounded px-1.5 py-0.5 text-[11px] font-mono">{k}</kbd>
                          ))}
                        </span>
                        <span className="text-[12.5px] text-muted-foreground">{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
