import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export function PreviewLoading({ phase }: { phase: string }) {
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
          <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">{phase}</p>
          <div className="mt-6 h-1 rounded-full bg-secondary overflow-hidden max-w-[240px] mx-auto">
            <motion.div
              className="h-full bg-gradient-to-r from-ember-400 to-ember-600"
              initial={{ width: '8%' }}
              animate={{ width: ['12%', '68%', '42%', '88%', '55%'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60 mt-5">
            Preview unlocks when the artifact is complete
          </p>
        </div>
      </div>
    </motion.div>
  );
}
