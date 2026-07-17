import { useEffect, useState } from 'react';
import type { LintReport } from '@/types/global';
import { ShieldCheck, AlertTriangle, ShieldAlert, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUI } from '@/lib/store';
export function LintBadge({ html }: { html: string | null }) {
  const [report, setReport] = useState<LintReport | null>(null);
  const setA11yOpen = useUI((s) => s.setA11yPanelOpen);

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
        onClick={() => setA11yOpen(true)}
        className={cn('flex items-center gap-1.5 rounded-md ring-1 px-2 py-1 text-[11px]', color)}
        title={`Lint score ${report.score} — open accessibility panel`}
      >
        <Icon className="h-3 w-3" />
        <span className="font-medium">{report.score}</span>
        <span className="opacity-70">a11y</span>
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
