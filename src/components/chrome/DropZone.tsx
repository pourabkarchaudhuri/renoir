import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useUI, useStudio } from '@/lib/store';

export function DropZone() {
  const [hover, setHover] = useState(false);
  const toast = useUI((s) => s.toast);
  const setProject = useStudio((s) => s.setProject);
  const setRoute = useUI((s) => s.setRoute);

  useEffect(() => {
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) { depth++; setHover(true); }
    };
    const onLeave = () => { depth--; if (depth <= 0) { depth = 0; setHover(false); } };
    const onOver  = (e: DragEvent) => e.preventDefault();
    const onDrop  = async (e: DragEvent) => {
      e.preventDefault(); depth = 0; setHover(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!/\.(zip|renoir\.zip)$/i.test(file.name)) {
        toast('Drop a .zip — Renoir or generic', 'warn');
        return;
      }
      // Trigger the main-process file picker as a confirmation step;
      // dropping in Electron does not give us an absolute path reliably
      // across platforms, so we route through the same import dialog.
      const r = await window.renoir.importProject();
      if (r.ok && r.project) {
        setProject(r.project);
        setRoute('studio');
        toast('Project imported', 'ok');
      }
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover',  onOver);
    window.addEventListener('drop',      onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover',  onOver);
      window.removeEventListener('drop',      onDrop);
    };
  }, [toast, setProject, setRoute]);

  return (
    <AnimatePresence>
      {hover && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/60 backdrop-blur-sm pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            className="plate rounded-2xl p-12 text-center"
          >
            <div className="mx-auto h-12 w-12 grid place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display italic text-3xl mt-3">Drop to import.</h3>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              Renoir / Open-Design ZIPs land in the workspace.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
