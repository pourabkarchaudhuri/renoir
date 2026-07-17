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

export default function App() {
  const route = useUI((s) => s.route);
  const theme = useUI((s) => s.theme);
  const refresh = useCatalog((s) => s.refresh);

  useEffect(() => { void refresh(); }, [refresh]);

  // Restore last open study + preview after relaunch.
  useEffect(() => {
    let cancelled = false;
    const flush = useStudio.getState().flushProject;

    void (async () => {
      const { loadWorkspaceSnapshot } = await import('@/lib/workspace-persist');
      const snap = loadWorkspaceSnapshot();
      if (cancelled) return;

      if (snap.projectId) {
        const project = await window.renoir.readProject(snap.projectId);
        if (project) {
          useStudio.getState().setProject(project);
          if (snap.skillId && snap.skillId !== project.skillId) {
            useStudio.getState().setSkill(snap.skillId);
          }
          if (snap.route && snap.route !== 'home') {
            useUI.getState().setRoute(snap.route);
          }
          return;
        }
      }

      const projects = await window.renoir.listProjects();
      if (!cancelled && projects.length && !useStudio.getState().project) {
        useStudio.getState().setProject(projects[0]);
      }
    })();

    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    const onUnload = () => { void flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);

    const autosave = setInterval(() => { void flush(); }, 20_000);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
      clearInterval(autosave);
      void flush();
    };
  }, []);

  // Persist workspace before Electron closes the window.
  useEffect(() => {
    const off = window.renoir.onFlushRequest(() => {
      void useStudio.getState().flushProject().finally(() => {
        void window.renoir.flushDone();
      });
    });
    return off;
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
    <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-background text-foreground relative">
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
