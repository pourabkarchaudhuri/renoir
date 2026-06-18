import { useCatalog, useStudio } from '@/lib/store';
import { cn } from '@/lib/cn';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';

export function DirectionStrip() {
  const dirs = useCatalog((s) => s.directions);
  const selected = useStudio((s) => s.selectedDirectionId);
  const setDirection = useStudio((s) => s.setDirection);

  if (!dirs.length) return null;
  return (
    <div className="px-4 py-2.5 border-b border-border bg-background/40 flex items-center gap-3 overflow-x-auto scroll-thin">
      <div className="flex items-center gap-1.5 shrink-0 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
        <Wand2 className="h-3 w-3 text-primary" />
        Direction
      </div>
      <div className="flex items-center gap-2">
        {dirs.map((d) => {
          const active = selected === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setDirection(active ? undefined : d.id)}
              className={cn(
                'relative px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-all shrink-0',
                active ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-accent',
              )}
              title={d.tagline}
            >
              <div className="flex gap-0.5 h-3.5">
                {d.swatches.slice(0, 4).map((c, i) => (
                  <span key={i} className="w-2.5 rounded-[2px]" style={{ background: c }} />
                ))}
              </div>
              <span className="text-[12px] font-medium tracking-tight">{d.name}</span>
              {active && (
                <motion.span
                  layoutId="direction-active"
                  className="absolute -inset-px rounded-md ring-1 ring-primary/40 bg-primary/5 pointer-events-none"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
