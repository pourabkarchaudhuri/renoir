import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/lib/store';
import {
  Loader2, FileText, Presentation, Package, X, CheckCircle2, AlertTriangle, FolderOpen,
  Image as ImageIcon, Film, Music2, Layers3, Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Job } from '@/lib/store';
import { ExpandableMessage } from './ExpandableMessage';

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
  const visible = jobs.filter((j) =>
    j.status === 'running'
    || (j.endedAt && Date.now() - j.endedAt < (j.status === 'err' ? 30_000 : 10_000)),
  );

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {visible.map((x) => (
          <JobRow key={x.id} job={x} onDismiss={() => dismiss(x.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function JobRow({ job, onDismiss }: { job: Job; onDismiss: () => void }) {
  const Icon = KIND_ICON[job.kind] || FileText;
  const tone = job.status === 'ok' ? 'ok' : job.status === 'err' ? 'err' : 'running';
  const errorText = job.error || 'Failed';
  const isErrorExpandable = tone === 'err';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'pointer-events-auto plate rounded-xl pl-3 pr-2 py-2.5 flex gap-3 shadow-plate',
        isErrorExpandable ? 'items-start max-w-[min(92vw,36rem)]' : 'items-center min-w-[320px] max-w-[460px]',
        tone === 'ok'  && 'ring-1 ring-emerald-500/40',
        tone === 'err' && 'ring-1 ring-red-500/40',
      )}
    >
      <div className={cn(
        'h-8 w-8 rounded-lg grid place-items-center shrink-0',
        isErrorExpandable && 'mt-0.5',
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
          <span>{job.label}</span>
        </div>
        {tone === 'err' ? (
          <ExpandableMessage
            text={errorText}
            tone="err"
            textClassName="text-[11px] text-muted-foreground mt-0.5"
            copyLabel="Copy error"
            expandLabel="Show full error"
            className="mt-0.5"
          />
        ) : (
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {tone === 'running' && (job.phase || 'working…')}
            {tone === 'ok'      && (job.savedPath ? <span className="font-mono">{job.savedPath}</span> : 'Done.')}
          </div>
        )}
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
      {tone === 'ok' && job.savedPath && (
        <button
          onClick={() => window.renoir.openWorkspace()}
          className={cn('btn-ghost text-[11px] py-0.5 h-7 shrink-0', isErrorExpandable && 'mt-0.5')}
          title="Open workspace folder"
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onDismiss}
        className={cn(
          'h-7 w-7 shrink-0 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent',
          isErrorExpandable && 'mt-0.5',
        )}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
