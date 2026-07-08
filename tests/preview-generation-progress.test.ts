import { describe, expect, it } from 'vitest';
import { buildPreviewGenerationProgress } from '../src/lib/preview-generation-progress';

describe('buildPreviewGenerationProgress', () => {
  it('marks draft active once streaming starts', () => {
    const progress = buildPreviewGenerationProgress({
      phase: 'Thinking…',
      isStreaming: true,
    });
    expect(progress.steps.map((s) => s.id)).toEqual(['prepare', 'draft', 'build', 'unlock']);
    expect(progress.steps[0].status).toBe('done'); // prepare done once streaming
    expect(progress.steps[1].status).toBe('active');
    expect(progress.completedCount).toBe(1);
    expect(progress.totalCount).toBe(4);
    expect(progress.fraction).toBeGreaterThan(0);
    expect(progress.fraction).toBeLessThan(1);
  });

  it('advances to build once an open artifact appears', () => {
    const progress = buildPreviewGenerationProgress({
      phase: 'Drawing the hero…',
      isStreaming: true,
      hasOpenArtifact: true,
    });
    expect(progress.steps.find((s) => s.id === 'draft')?.status).toBe('done');
    expect(progress.steps.find((s) => s.id === 'build')?.status).toBe('active');
    expect(progress.completedCount).toBe(2);
    expect(progress.phase).toBe('Drawing the hero…');
  });

  it('includes a continue step while auto-continuing', () => {
    const progress = buildPreviewGenerationProgress({
      phase: 'Closing the footer…',
      isStreaming: true,
      isAutoContinuing: true,
      hasOpenArtifact: true,
    });
    expect(progress.steps.map((s) => s.id)).toContain('continue');
    expect(progress.steps.find((s) => s.id === 'continue')?.status).toBe('active');
    expect(progress.phase).toBe('Continuing the artifact…');
  });

  it('marks unlock done when preview is ready', () => {
    const progress = buildPreviewGenerationProgress({
      phase: 'Done',
      isStreaming: false,
      hasOpenArtifact: true,
      artifactComplete: true,
      previewReady: true,
    });
    expect(progress.completedCount).toBe(progress.totalCount);
    expect(progress.fraction).toBe(1);
    expect(progress.steps.every((s) => s.status === 'done')).toBe(true);
  });

  it('tracks image generation as a numbered step', () => {
    const progress = buildPreviewGenerationProgress({
      phase: 'Composing imagery…',
      isStreaming: false,
      artifactComplete: true,
      previewReady: true,
      imageGen: { done: 1, total: 3 },
    });
    const images = progress.steps.find((s) => s.id === 'images');
    expect(images?.label).toBe('Images (1/3)');
    expect(images?.status).toBe('active');
    expect(progress.steps.find((s) => s.id === 'unlock')?.status).toBe('pending');
    expect(progress.fraction).toBeGreaterThan(0.5);
    expect(progress.fraction).toBeLessThan(1);
  });

  it('completes images then unlock', () => {
    const progress = buildPreviewGenerationProgress({
      phase: 'Done',
      isStreaming: false,
      artifactComplete: true,
      previewReady: true,
      imageGen: { done: 3, total: 3 },
    });
    expect(progress.steps.find((s) => s.id === 'images')?.status).toBe('done');
    expect(progress.steps.find((s) => s.id === 'unlock')?.status).toBe('done');
    expect(progress.fraction).toBe(1);
  });
});
