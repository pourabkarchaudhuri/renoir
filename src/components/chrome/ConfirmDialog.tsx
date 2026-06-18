import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive, onConfirm, onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/55 backdrop-blur-sm p-6"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="plate rounded-2xl w-full max-w-[440px] overflow-hidden shadow-plate"
          >
            <header className="px-5 py-3.5 border-b border-border flex items-center gap-2.5">
              <div className={cn(
                'h-7 w-7 rounded-md grid place-items-center',
                destructive
                  ? 'bg-red-500/10 text-red-600 dark:text-red-300 ring-1 ring-red-500/30'
                  : 'bg-primary/10 text-primary ring-1 ring-primary/30',
              )}>
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.6} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/80">
                  {destructive ? 'Confirm' : 'Heads up'}
                </div>
                <div className="font-display italic text-xl truncate">{title}</div>
              </div>
              <button
                onClick={onCancel}
                className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>
            {message && (
              <div className="px-5 py-4 text-[12.5px] text-muted-foreground leading-relaxed">
                {message}
              </div>
            )}
            <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
              <button onClick={onCancel} className="btn-quiet">{cancelLabel}</button>
              <button
                onClick={() => { onConfirm(); }}
                className={cn(
                  destructive
                    ? 'inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium bg-red-500/90 hover:bg-red-500 text-white shadow-[0_0_0_1px_rgba(239,68,68,0.4)]'
                    : 'btn-ember',
                )}
              >
                {confirmLabel}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
