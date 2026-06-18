import { useEffect, useState } from 'react';
import type { LintReport } from '@/types/global';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, ShieldAlert, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function LintBadge({ html }: { html: string | null }) {
  const [report, setReport] = useState<LintReport | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!html) { setReport(null); return; }
    window.renoir.lintArtifact(html).then((r) => { if (!cancelled) setReport(r); });
    return () => { cancelled = true; };
  }, [html]);

  if (!html || !report) return null;

  const tone = report.errors > 0 ? 'err' : report.warnings > 0 ? 'warn' : 'ok';
  const Icon = tone === 'err' ? ShieldAlert : tone === 'warn' ? AlertTriangle : ShieldCheck;
  // Theme-aware: light mode wants darker tints to read on near-white surface;
  // dark mode wants lighter tints to read on near-black.
  const color = tone === 'err'  ? 'text-red-700 dark:text-red-200 bg-red-500/15 ring-red-500/40'
              : tone === 'warn' ? 'text-amber-700 dark:text-amber-200 bg-amber-500/15 ring-amber-500/40'
              :                   'text-emerald-700 dark:text-emerald-200 bg-emerald-500/15 ring-emerald-500/40';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn('flex items-center gap-1.5 rounded-md ring-1 px-2 py-1 text-[11px]', color)}
        title={`Lint score ${report.score}`}
      >
        <Icon className="h-3 w-3" />
        <span className="font-medium">{report.score}</span>
        <span className="opacity-70">lint</span>
        <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 z-30 mt-1.5 w-[320px] plate rounded-xl p-3 shadow-plate"
          >
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Findings</div>
            <ul className="mt-2 space-y-1.5 max-h-[260px] overflow-y-auto scroll-thin">
              {report.findings.length === 0 && (
                <li className="text-[12px] text-emerald-700 dark:text-emerald-300">All clean.</li>
              )}
              {report.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-[11.5px] text-foreground">
                  <span className={cn(
                    'shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full',
                    f.level === 'error' ? 'bg-red-500'
                    : f.level === 'warn' ? 'bg-amber-500'
                    : 'bg-sky-500',
                  )} />
                  <span className="font-mono text-[10px] text-muted-foreground">{f.rule}</span>
                  <span className="flex-1">{f.message}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
