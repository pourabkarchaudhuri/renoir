import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/lib/store';
import { cn } from '@/lib/cn';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'pointer-events-auto plate rounded-xl pl-3 pr-2 py-2.5 flex items-center gap-2.5 min-w-[280px] max-w-[420px] shadow-plate',
            )}
          >
            <Icon tone={t.tone} />
            <span className="text-sm flex-1">{t.text}</span>
            <button
              className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => dismiss(t.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Icon({ tone }: { tone: 'info' | 'ok' | 'warn' | 'err' }) {
  if (tone === 'ok')   return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (tone === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  if (tone === 'err')  return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
}
