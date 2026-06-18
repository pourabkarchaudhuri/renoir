import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/lib/store';
import {
  Loader2, FileText, Presentation, Package, X, CheckCircle2, AlertTriangle, FolderOpen,
  Image as ImageIcon, Film, Music2, Layers3, Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const KIND_ICON: Record<string, typeof FileText> = {
  pdf:         FileText,
  pptx:        Presentation,
  zip:         Package,
  image:       ImageIcon,
  'image-edit': ImageIcon,
  audio:       Music2,
  video:       Film,
  storyboard:  Clapperboard,
  hyperframe:  Layers3,
};

export function ExportSnackbar() {
  const jobs = useUI((s) => s.jobs);
  const dismiss = useUI((s) => s.dismissJob);
  // Show running jobs always; show recently-completed only for ~10s.
  const visible = jobs.filter((j) => j.status === 'running' || (j.endedAt && Date.now() - j.endedAt < 10_000));

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {visible.map((x) => {
          const Icon = KIND_ICON[x.kind] || FileText;
          const tone = x.status === 'ok' ? 'ok' : x.status === 'err' ? 'err' : 'running';
          return (
            <motion.div
              key={x.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'pointer-events-auto plate rounded-xl pl-3 pr-2 py-2.5 flex items-center gap-3 min-w-[320px] max-w-[460px] shadow-plate',
                tone === 'ok'  && 'ring-1 ring-emerald-500/40',
                tone === 'err' && 'ring-1 ring-red-500/40',
              )}
            >
              <div className={cn(
                'h-8 w-8 rounded-lg grid place-items-center shrink-0',
                tone === 'ok'  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : tone === 'err' ? 'bg-red-500/10 text-red-600 dark:text-red-300'
                : 'bg-primary/10 text-primary',
              )}>
                {tone === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
                {tone === 'ok'      && <CheckCircle2 className="h-4 w-4" />}
                {tone === 'err'     && <AlertTriangle className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-medium tracking-tight">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
                  <span>{x.label}</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {tone === 'running' && (x.phase || 'working…')}
                  {tone === 'ok'      && (x.savedPath ? <span className="font-mono">{x.savedPath}</span> : 'Done.')}
                  {tone === 'err'     && (x.error || 'Failed')}
                </div>
                {tone === 'running' && (
                  <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-ember-400 to-ember-600"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ width: '40%' }}
                    />
                  </div>
                )}
              </div>
              {tone === 'ok' && x.savedPath && (
                <button
                  onClick={() => window.renoir.openWorkspace()}
                  className="btn-ghost text-[11px] py-0.5 h-7"
                  title="Open workspace folder"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => dismiss(x.id)}
                className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
