import { Check, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { PreviewGenerationProgress } from '@/lib/preview-generation-progress';

export function PreviewLoading({
  phase,
  progress,
}: {
  phase: string;
  progress?: PreviewGenerationProgress | null;
}) {
  const fraction = progress?.fraction ?? 0.12;
  const completed = progress?.completedCount ?? 0;
  const total = progress?.totalCount ?? 0;
  const displayPhase = progress?.phase || phase;
  const steps = progress?.steps ?? [];

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[480px] py-16 px-8"
    >
      <div className="plate rounded-2xl p-8 grain relative overflow-hidden text-center">
        <div className="ambient opacity-60" />
        <div className="relative z-10">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 ring-1 ring-primary/30 grid place-items-center">
            <Sparkles className="h-6 w-6 text-primary animate-pulse" strokeWidth={1.5} />
          </div>
          <h3 className="font-display italic text-2xl mt-5 tracking-tight">Composing your artifact</h3>
          <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">{displayPhase}</p>

          <div className="mt-6 max-w-[280px] mx-auto">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
              <span>Progress</span>
              {total > 0 ? (
                <span className="font-mono tracking-normal normal-case text-muted-foreground">
                  {completed}/{total} steps
                </span>
              ) : null}
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-ember-400 to-ember-600"
                initial={false}
                animate={{ width: `${Math.max(8, Math.round(fraction * 100))}%` }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          {steps.length > 0 ? (
            <ol className="mt-6 space-y-2 text-left max-w-[280px] mx-auto">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className={cn(
                    'flex items-center gap-2.5 text-[12px]',
                    step.status === 'done' && 'text-muted-foreground',
                    step.status === 'active' && 'text-foreground font-medium',
                    step.status === 'pending' && 'text-muted-foreground/55',
                  )}
                >
                  <span
                    className={cn(
                      'h-5 w-5 rounded-full grid place-items-center shrink-0 ring-1',
                      step.status === 'done' && 'bg-emerald-500/15 ring-emerald-500/40 text-emerald-600 dark:text-emerald-400',
                      step.status === 'active' && 'bg-primary/15 ring-primary/40 text-primary',
                      step.status === 'pending' && 'bg-secondary ring-border text-muted-foreground/50',
                    )}
                    aria-hidden
                  >
                    {step.status === 'done' ? (
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    ) : step.status === 'active' ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    )}
                  </span>
                  <span>{step.label}</span>
                  {step.status === 'active' ? (
                    <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-primary/80">
                      Now
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60 mt-5">
            Preview unlocks when the artifact is complete
          </p>
        </div>
      </div>
    </motion.div>
  );
}
