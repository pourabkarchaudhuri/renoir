/**
 * Step-based progress for preview generation.
 *
 * Derives a checklist from streaming / auto-continue / image-gen signals
 * so the preview loading surface can show completed vs remaining work.
 */

export type PreviewGenerationStepStatus = 'pending' | 'active' | 'done';

export type PreviewGenerationStepId =
  | 'prepare'
  | 'draft'
  | 'build'
  | 'continue'
  | 'images'
  | 'unlock';

export interface PreviewGenerationStep {
  id: PreviewGenerationStepId;
  label: string;
  status: PreviewGenerationStepStatus;
}

export interface PreviewGenerationProgress {
  steps: PreviewGenerationStep[];
  completedCount: number;
  totalCount: number;
  /** 0–1 bar fill. Active step contributes partial credit. */
  fraction: number;
  phase: string;
}

export interface PreviewGenerationProgressInput {
  /** Flavor string from inferPhase — used while drafting/building. */
  phase: string;
  isStreaming: boolean;
  isAutoContinuing?: boolean;
  /** Open <artifact> detected in the live buffer (may still be incomplete). */
  hasOpenArtifact?: boolean;
  /** Closed </artifact> — artifact body is complete. */
  artifactComplete?: boolean;
  /** Preview HTML is available to render. */
  previewReady?: boolean;
  imageGen?: { done: number; total: number } | null;
}

function fractionForSteps(
  steps: PreviewGenerationStep[],
  imageGen?: { done: number; total: number } | null,
): number {
  if (steps.length === 0) return 0;
  let sum = 0;
  for (const step of steps) {
    if (step.status === 'done') {
      sum += 1;
      continue;
    }
    if (step.status !== 'active') continue;
    if (step.id === 'images' && imageGen && imageGen.total > 0) {
      sum += Math.min(1, imageGen.done / imageGen.total);
    } else {
      sum += 0.45;
    }
  }
  return Math.min(1, sum / steps.length);
}

function phaseForActive(
  active: PreviewGenerationStep | undefined,
  phase: string,
  previewReady: boolean,
): string {
  if (!active) return previewReady ? 'Preview ready' : phase;
  if (active.id === 'draft' || active.id === 'build') return phase;
  if (active.id === 'images') return active.label;
  if (active.id === 'continue') return 'Continuing the artifact…';
  if (active.id === 'unlock') return 'Unlocking preview…';
  return `${active.label}…`;
}

/**
 * Build a checklist of generation steps for the preview loading card.
 */
export function buildPreviewGenerationProgress(
  input: PreviewGenerationProgressInput,
): PreviewGenerationProgress {
  const {
    phase,
    isStreaming,
    isAutoContinuing = false,
    hasOpenArtifact = false,
    artifactComplete = false,
    previewReady = false,
    imageGen = null,
  } = input;

  const generating = isStreaming || isAutoContinuing || Boolean(imageGen);
  const includeContinue = isAutoContinuing;
  const includeImages = Boolean(imageGen);

  const prepareDone = generating || hasOpenArtifact || artifactComplete || previewReady;
  const draftDone = hasOpenArtifact || artifactComplete || previewReady;
  // Auto-continue means at least one build pass already finished (or truncated).
  const buildDone = artifactComplete || previewReady || isAutoContinuing;
  const continueDone = artifactComplete || previewReady;
  const imagesDone = Boolean(
    imageGen && imageGen.total > 0 && imageGen.done >= imageGen.total,
  );
  const unlockDone = previewReady && (!imageGen || imagesDone);

  const raw: Array<{ id: PreviewGenerationStepId; label: string; done: boolean }> = [
    { id: 'prepare', label: 'Prepare', done: prepareDone },
    { id: 'draft', label: 'Draft', done: draftDone },
    { id: 'build', label: 'Build', done: buildDone },
  ];

  if (includeContinue) {
    raw.push({ id: 'continue', label: 'Continue', done: continueDone });
  }

  if (includeImages) {
    raw.push({
      id: 'images',
      label: imageGen && imageGen.total > 0
        ? `Images (${imageGen.done}/${imageGen.total})`
        : 'Images',
      done: imagesDone,
    });
  }

  raw.push({ id: 'unlock', label: 'Unlock', done: unlockDone });

  const firstIncomplete = raw.findIndex((s) => !s.done);
  const steps: PreviewGenerationStep[] = raw.map((s, i) => {
    if (s.done) return { id: s.id, label: s.label, status: 'done' };
    if (!unlockDone && i === firstIncomplete) {
      return { id: s.id, label: s.label, status: 'active' };
    }
    return { id: s.id, label: s.label, status: 'pending' };
  });

  const completedCount = steps.filter((s) => s.status === 'done').length;
  const active = steps.find((s) => s.status === 'active');

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    fraction: unlockDone ? 1 : fractionForSteps(steps, imageGen),
    phase: phaseForActive(active, phase, previewReady),
  };
}
