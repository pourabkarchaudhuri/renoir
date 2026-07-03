import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/lib/store';
import { cn } from '@/lib/cn';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { ExpandableMessage } from './ExpandableMessage';

type ToastTone = 'info' | 'ok' | 'warn' | 'err';

interface ToastItem {
  id: string;
  tone: ToastTone;
  text: string;
  action?: { label: string; onClick: () => void };
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const refreshDismiss = useUI((s) => s.refreshToastDismiss);
  const isExpandable = !toast.action && (toast.tone === 'err' || toast.tone === 'warn'
    || toast.text.length > 72 || /\n/.test(toast.text));

  const runAction = () => {
    toast.action?.onClick();
    onDismiss();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'pointer-events-auto plate rounded-xl pl-3 pr-2 py-2.5 flex gap-2.5 shadow-plate',
        isExpandable ? 'items-start max-w-[min(92vw,36rem)]' : 'items-center min-w-[280px] max-w-[420px]',
      )}
    >
      <span className={cn('shrink-0', isExpandable && 'mt-0.5')}>
        <Icon tone={toast.tone} />
      </span>
      <div className="flex-1 min-w-0">
        {toast.tone === 'err' || toast.tone === 'warn' ? (
          <ExpandableMessage
            text={toast.text}
            tone={toast.tone}
            textClassName="text-sm text-foreground"
            copyLabel="Copy error"
            expandLabel="Show full message"
            onExpand={() => refreshDismiss(toast.id)}
          />
        ) : (
          <ExpandableMessage
            text={toast.text}
            tone="neutral"
            showCopy={false}
            textClassName="text-sm text-foreground"
          />
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={runAction}
          className="shrink-0 text-[12px] font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/10"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className={cn(
          'h-6 w-6 shrink-0 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent',
          isExpandable && 'mt-0.5',
        )}
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

function Icon({ tone }: { tone: ToastTone }) {
  if (tone === 'ok')   return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (tone === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  if (tone === 'err')  return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
}
