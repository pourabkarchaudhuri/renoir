import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCompare, X } from 'lucide-react';
import { useStudio } from '@/lib/store';
import { extractArtifact } from '@/lib/prompt';
import { DiffDialog } from './DiffDialog';

type SourceKind = 'active' | 'latest' | 'pick';

export function VariantCompareDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const project = useStudio((s) => s.project);
  const [step, setStep] = useState<1 | 2>(1);
  const [aKind, setAKind] = useState<SourceKind>('active');
  const [aPick, setAPick] = useState('');
  const [bKind, setBKind] = useState<SourceKind>('pick');
  const [bPick, setBPick] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffIds, setDiffIds] = useState<{ a: string; b: string } | null>(null);

  const versions = project?.versions ?? [];

  const latestArtifactId = useMemo(() => {
    if (!project) return null;
    const last = [...project.conversation].reverse().find((m) => m.role === 'assistant');
    const art = last ? extractArtifact(last.content) : null;
    if (!art?.complete) return null;
    const match = versions.find((v) => v.html === art.html);
    return match?.id ?? versions[versions.length - 1]?.id ?? null;
  }, [project, versions]);

  const resolveId = (kind: SourceKind, pick: string): string | null => {
    if (kind === 'active') return project?.activeVersionId ?? versions[versions.length - 1]?.id ?? null;
    if (kind === 'latest') return latestArtifactId;
    return pick || null;
  };

  const startDiff = () => {
    const aId = resolveId(aKind, aPick);
    const bId = resolveId(bKind, bPick);
    if (!aId || !bId || aId === bId) return;
    setDiffIds({ a: aId, b: bId });
    setDiffOpen(true);
    onClose();
  };

  const reset = () => {
    setStep(1);
    setAKind('active');
    setBKind('pick');
    setAPick('');
    setBPick('');
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => { reset(); onClose(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="plate rounded-2xl w-full max-w-[440px] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <GitCompare className="h-4 w-4 text-primary" />
                <h3 className="font-display italic text-xl flex-1">Compare versions</h3>
                <button type="button" onClick={() => { reset(); onClose(); }} className="btn-ghost">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {step === 1 ? (
                <>
                  <p className="text-[12px] text-muted-foreground mb-3">Source A</p>
                  <SourcePicker kind={aKind} pick={aPick} versions={versions} onKind={setAKind} onPick={setAPick} />
                  <button
                    type="button"
                    className="btn-ember w-full mt-4"
                    disabled={!resolveId(aKind, aPick)}
                    onClick={() => setStep(2)}
                  >
                    Next — pick source B
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[12px] text-muted-foreground mb-3">Source B</p>
                  <SourcePicker kind={bKind} pick={bPick} versions={versions} onKind={setBKind} onPick={setBPick} />
                  <div className="flex gap-2 mt-4">
                    <button type="button" className="btn-quiet flex-1" onClick={() => setStep(1)}>Back</button>
                    <button
                      type="button"
                      className="btn-ember flex-1"
                      disabled={!resolveId(bKind, bPick) || resolveId(aKind, aPick) === resolveId(bKind, bPick)}
                      onClick={startDiff}
                    >
                      Compare
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <DiffDialog
        open={diffOpen}
        aId={diffIds?.a ?? null}
        bId={diffIds?.b ?? null}
        onClose={() => { setDiffOpen(false); setDiffIds(null); reset(); }}
      />
    </>
  );
}

function SourcePicker({
  kind,
  pick,
  versions,
  onKind,
  onPick,
}: {
  kind: SourceKind;
  pick: string;
  versions: { id: string; note?: string; createdAt: string; source: string }[];
  onKind: (k: SourceKind) => void;
  onPick: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[12px]">
        <input type="radio" checked={kind === 'active'} onChange={() => onKind('active')} />
        Active version
      </label>
      <label className="flex items-center gap-2 text-[12px]">
        <input type="radio" checked={kind === 'latest'} onChange={() => onKind('latest')} />
        Latest complete artifact
      </label>
      <label className="flex items-center gap-2 text-[12px]">
        <input type="radio" checked={kind === 'pick'} onChange={() => onKind('pick')} />
        Pick saved version
      </label>
      {kind === 'pick' && (
        <select
          value={pick}
          onChange={(e) => onPick(e.target.value)}
          className="w-full text-[12px] rounded-md border border-border bg-background px-2 py-1.5"
        >
          <option value="">Select version…</option>
          {[...versions].reverse().map((v) => (
            <option key={v.id} value={v.id}>
              {v.note || v.source} · {new Date(v.createdAt).toLocaleString()}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
