import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck, Wrench, ScanSearch, Radar } from 'lucide-react';
import { useStudio, useUI } from '@/lib/store';
import { repairArtifactIfNeeded } from '@/lib/artifact-repair';
import { normalizeArtifactDocument } from '@/lib/artifact-html';
import { applySession, getSkillSession, patchSkillSession } from '@/lib/skill-sessions';
import { mergeLintWithProbe, probeFindingsToLint, type A11yProbeReport } from '@/lib/a11y-probe-findings';
import { isFeatureEnabled } from '@/lib/features';
import type { LintFinding, LintReport } from '@/types/global';
import { cn } from '@/lib/cn';

type LintCategory = NonNullable<LintFinding['category']>;

const CATEGORIES: { id: LintCategory; label: string }[] = [
  { id: 'structure', label: 'Structure' },
  { id: 'forms', label: 'Forms' },
  { id: 'images', label: 'Images' },
  { id: 'contrast', label: 'Contrast' },
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'dashboard', label: 'Dashboard' },
];

export function A11yPanel({ html }: { html: string | null }) {
  const [report, setReport] = useState<LintReport | null>(null);
  const [probeFindings, setProbeFindings] = useState<LintFinding[]>([]);
  const [probing, setProbing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const project = useStudio((s) => s.project);
  const skillId = useStudio((s) => s.selectedSkillId);
  const setProject = useStudio((s) => s.setProject);
  const toast = useUI((s) => s.toast);
  const open = useUI((s) => s.a11yPanelOpen);
  const setOpen = useUI((s) => s.setA11yPanelOpen);

  useEffect(() => {
    let cancelled = false;
    if (!html) { setReport(null); return; }
    window.renoir.lintArtifact(html).then((r) => { if (!cancelled) setReport(r); });
    return () => { cancelled = true; };
  }, [html]);

  useEffect(() => {
    const onResult = (e: Event) => {
      const detail = (e as CustomEvent).detail as A11yProbeReport;
      setProbeFindings(probeFindingsToLint(detail));
      setProbing(false);
    };
    window.addEventListener('renoir:a11y-probe-result', onResult);
    return () => window.removeEventListener('renoir:a11y-probe-result', onResult);
  }, []);

  const allFindings = useMemo(() => {
    if (!report) return probeFindings;
    return mergeLintWithProbe(report.findings, probeFindings);
  }, [report, probeFindings]);

  const grouped = useMemo(() => {
    const map = new Map<string, LintFinding[]>();
    for (const f of allFindings) {
      const cat = f.category ?? 'structure';
      const list = map.get(cat) ?? [];
      list.push(f);
      map.set(cat, list);
    }
    return map;
  }, [allFindings]);

  const fixableCount = allFindings.filter((f) => f.fixable).length;

  const runFixAll = useCallback(async () => {
    if (!html || !project || fixableCount === 0) return;
    setFixing(true);
    try {
      const title = project.name?.trim() || 'Artifact';
      const repair = await repairArtifactIfNeeded(
        html,
        {
          title,
          viewportWidth: 1280,
          dashboard: skillId === 'dashboard',
          productDeck: skillId === 'product-deck',
          productName: title,
          productDeckFinalize: true,
        },
        window.renoir.lintArtifact,
      );
      if (!repair.improved) {
        toast('No auto-fixes available', 'info');
        return;
      }
      const fixedCount = repair.before.findings.length - repair.after.findings.length;
      const verRes = await window.renoir.addVersion({
        id: project.id,
        html: repair.html,
        source: 'assistant',
        skillId,
        note: `A11y auto-fix: ${fixedCount} finding(s)`,
      });
      if (verRes.ok && verRes.project) {
        let next = patchSkillSession(verRes.project, skillId, {
          previewHtml: repair.html,
          versions: getSkillSession(verRes.project, skillId).versions,
        });
        if (skillId === useStudio.getState().selectedSkillId) {
          next = applySession(next, skillId);
        }
        setProject(next);
        toast(`Fixed ${fixedCount} issue${fixedCount === 1 ? '' : 's'}`, 'ok');
        window.dispatchEvent(new CustomEvent('renoir:reload-preview'));
      }
    } finally {
      setFixing(false);
    }
  }, [html, project, skillId, fixableCount, setProject, toast, fixing]);

  if (!open) return null;

  const score = report?.score ?? 0;
  const tone = (report?.errors ?? 0) > 0 ? 'err' : (report?.warnings ?? 0) > 0 ? 'warn' : 'ok';

  return (
    <div className="border-t border-border px-3 py-3 shrink-0 max-h-[280px] overflow-y-auto scroll-thin">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">Accessibility</div>
        <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground">
          Hide
        </button>
      </div>

      {!html ? (
        <p className="text-[11px] text-muted-foreground">Generate an artifact to run checks.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <div
              className={cn(
                'h-10 w-10 rounded-full grid place-items-center text-[13px] font-semibold ring-2',
                tone === 'err' && 'ring-red-500/50 text-red-600 dark:text-red-300',
                tone === 'warn' && 'ring-amber-500/50 text-amber-600 dark:text-amber-300',
                tone === 'ok' && 'ring-emerald-500/50 text-emerald-600 dark:text-emerald-300',
              )}
            >
              {score}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium">Lint score</div>
              <div className="text-[10px] text-muted-foreground">
                {report?.errors ?? 0} errors · {report?.warnings ?? 0} warnings
              </div>
            </div>
            {tone === 'ok' ? (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            )}
          </div>

          <div className="flex gap-1.5 mb-3">
            <button
              type="button"
              disabled={fixing || fixableCount === 0}
              onClick={() => void runFixAll()}
              className="btn-quiet text-[10px] h-7 px-2 flex items-center gap-1 disabled:opacity-40"
            >
              <Wrench className="h-3 w-3" />
              Fix auto-fixable
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('renoir:run-critique'))}
              className="btn-quiet text-[10px] h-7 px-2 flex items-center gap-1"
            >
              <ScanSearch className="h-3 w-3" />
              Critique
            </button>
            {isFeatureEnabled('a11yProbe') && (
              <button
                type="button"
                disabled={probing}
                onClick={() => {
                  setProbing(true);
                  window.dispatchEvent(new CustomEvent('renoir:run-a11y-probe'));
                }}
                className="btn-quiet text-[10px] h-7 px-2 flex items-center gap-1 disabled:opacity-40"
              >
                <Radar className="h-3 w-3" />
                Live probe
              </button>
            )}
          </div>

          {CATEGORIES.map(({ id, label }) => {
            const items = grouped.get(id);
            if (!items?.length) return null;
            return (
              <div key={id} className="mb-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">{label}</div>
                <ul className="space-y-1">
                  {items.map((f, i) => (
                    <li key={`${f.rule}-${i}`} className="text-[11px] flex gap-1.5 items-start">
                      <span className={cn(
                        'shrink-0 mt-1 h-1.5 w-1.5 rounded-full',
                        f.level === 'error' ? 'bg-red-500' : f.level === 'warn' ? 'bg-amber-500' : 'bg-sky-500',
                      )} />
                      <span className="flex-1">{f.message}</span>
                      {f.fixable && <span className="text-[9px] text-primary shrink-0">fix</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {allFindings.length === 0 && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">All checks passed.</p>
          )}

          <p className="text-[9px] text-muted-foreground/60 mt-2 italic">
            Live probe uses computed styles in the preview iframe. Phase 3: full WCAG automation.
          </p>
        </>
      )}
    </div>
  );
}

/** Resolve normalized preview HTML for lint from raw artifact. */
export function a11yHtmlFromArtifact(
  artifact: string | null,
  opts: { title: string; skillId?: string },
): string | null {
  if (!artifact) return null;
  return normalizeArtifactDocument(artifact, {
    title: opts.title,
    viewportWidth: 1280,
    dashboard: opts.skillId === 'dashboard',
    productDeck: opts.skillId === 'product-deck',
    productName: opts.title,
    productDeckFinalize: true,
  });
}
