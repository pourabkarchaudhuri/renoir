import { useEffect } from 'react';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import { TitleBar } from '@/components/chrome/TitleBar';
import { Dock } from '@/components/chrome/Dock';
import { Toaster } from '@/components/chrome/Toaster';
import { CommandPalette } from '@/components/chrome/CommandPalette';
import { DropZone } from '@/components/chrome/DropZone';
import { ShortcutsSheet } from '@/components/chrome/ShortcutsSheet';
import { ExportSnackbar } from '@/components/chrome/ExportSnackbar';
import { Home } from '@/views/Home';
import { Studio } from '@/views/Studio';
import { Gallery } from '@/views/Gallery';
import { Settings } from '@/views/Settings';
import { Media } from '@/views/Media';
import { AnimatePresence, motion } from 'framer-motion';
import { loadSession, projectHasSkillWork } from '@/lib/skill-sessions';

export default function App() {
  const route = useUI((s) => s.route);
  const theme = useUI((s) => s.theme);
  const refresh = useCatalog((s) => s.refresh);

  useEffect(() => { void refresh(); }, [refresh]);

  // Restore the most recently active project so context survives a quit/relaunch.
  useEffect(() => {
    let cancelled = false;
    void window.renoir.listProjects().then((projects) => {
      if (cancelled) return;
      if (projects.length && !useStudio.getState().project) {
        const skill = useStudio.getState().selectedSkillId || projects[0].skillId || 'web-prototype';
        const match = projects.find((p) => projectHasSkillWork(p, skill));
        if (match) {
          useStudio.getState().setProject(loadSession(match, skill));
          useStudio.getState().setSkill(skill);
        } else {
          useStudio.getState().setSkill(skill);
        }
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Apply theme on root + sync Windows titlebar overlay
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark',  theme === 'dark');
    void window.renoir.themeSet?.(theme);
  }, [theme]);

  // Esc exits full-view preview
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useUI.getState().previewFull) useUI.getState().setPreviewFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground relative">
      <div className="ambient" />
      <TitleBar />
      <div className="flex-1 flex min-h-0 relative z-10">
        <Dock />
        <main className="flex-1 min-w-0 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={route}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 overflow-hidden"
            >
              {route === 'home' && <Home />}
              {route === 'studio' && <Studio />}
              {route === 'media' && <Media />}
              {route === 'gallery' && <Gallery />}
              {route === 'settings' && <Settings />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toaster />
      <CommandPalette />
      <DropZone />
      <ShortcutsSheet />
      <ExportSnackbar />
    </div>
  );
}
