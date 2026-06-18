import { useEffect, useState } from 'react';
import type { BrandSpec, ProjectMessage } from '@/types/global';
import { useStudio } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

export function BrandSpecPanel() {
  const project = useStudio((s) => s.project);
  const [spec, setSpec] = useState<BrandSpec | null>(null);
  const [open, setOpen] = useState(true);

  // Recompute whenever a new user message arrives.
  useEffect(() => {
    let cancelled = false;
    if (!project) { setSpec(null); return; }
    const userMsgs = project.conversation.filter((m: ProjectMessage) => m.role === 'user');
    if (!userMsgs.length) { setSpec(null); return; }
    const text = userMsgs.map((m) => m.content).join('\n\n');
    void window.renoir.brandExtract(text).then((res) => {
      if (!cancelled) setSpec(res);
    });
    return () => { cancelled = true; };
  }, [project?.conversation.length]);

  if (!project) return null;
  const empty =
    !spec ||
    (!spec.name && !spec.voice && !spec.audience &&
     spec.colors.length === 0 && spec.fonts.length === 0 &&
     spec.values.length === 0 && spec.doNots.length === 0);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Sparkles className="h-3 w-3 text-primary" />
        Brand spec
        <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {empty ? (
                <p className="text-[11px] text-muted-foreground italic">
                  Drop colors, fonts, voice, audience, values, or do-nots into a message — they'll surface here.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {spec!.name     && <Row label="Brand"    value={spec!.name!} />}
                  {spec!.audience && <Row label="Audience" value={spec!.audience!} />}
                  {spec!.voice    && <Row label="Voice"    value={spec!.voice!} />}
                  {spec!.fonts.length    > 0 && <Row label="Fonts"  value={spec!.fonts.join(', ')} />}
                  {spec!.values.length   > 0 && <Row label="Values" value={spec!.values.join(', ')} />}
                  {spec!.doNots.length   > 0 && <Row label="Avoid"  value={spec!.doNots.join('; ')} />}
                  {spec!.colors.length   > 0 && (
                    <li>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Colors</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {spec!.colors.map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 plate-soft rounded px-1.5 py-0.5 text-[10px] font-mono"
                            title={c}
                          >
                            <span className="h-3 w-3 rounded-sm ring-1 ring-border" style={{ background: c }} />
                            {c}
                          </span>
                        ))}
                      </div>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{label}</div>
      <div className="text-[12px] leading-snug">{value}</div>
    </li>
  );
}
