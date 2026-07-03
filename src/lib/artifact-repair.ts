import { normalizeArtifactDocument, type NormalizeArtifactOptions } from '@/lib/artifact-html';
import { fixArtifactLintFindings } from '@/lib/artifact-lint-fix';
import { injectDashboardShell, isDashboardArtifact } from '@shared/dashboard-layout';
import type { LintReport } from '@/types/global';

export interface ArtifactRepairOptions extends NormalizeArtifactOptions {
  title?: string;
}

export interface ArtifactRepairResult {
  html: string;
  changed: boolean;
  before: Pick<LintReport, 'score' | 'errors' | 'warnings' | 'findings'>;
  after: Pick<LintReport, 'score' | 'errors' | 'warnings' | 'findings'>;
  improved: boolean;
}

/** Normalize + apply deterministic lint repairs (and dashboard shell when needed). */
export function repairArtifactHtml(html: string, opts: ArtifactRepairOptions = {}): string {
  const title = opts.title?.trim() || 'Artifact';
  const dashboard = opts.dashboard || isDashboardArtifact(html);
  let out = normalizeArtifactDocument(html, {
    ...opts,
    title,
    viewportWidth: opts.viewportWidth ?? 1280,
    dashboard,
  });
  if (dashboard) {
    out = injectDashboardShell(out);
    out = fixArtifactLintFindings(out, { title, dashboard: true });
  }
  return out;
}

function lintImproved(before: LintReport, after: LintReport): boolean {
  return after.score > before.score
    || after.errors < before.errors
    || after.warnings < before.warnings;
}

/**
 * Repair artifact HTML when lint reports errors or warnings.
 * Pass `baselineHtml` (e.g. current preview document) to measure improvement.
 */
export async function repairArtifactIfNeeded(
  html: string,
  opts: ArtifactRepairOptions,
  lint: (html: string) => Promise<LintReport>,
  baselineHtml?: string,
): Promise<ArtifactRepairResult> {
  const before = await lint(baselineHtml ?? html);
  if (before.errors === 0 && before.warnings === 0) {
    return {
      html,
      changed: false,
      before,
      after: before,
      improved: false,
    };
  }

  let fixed = repairArtifactHtml(html, opts);
  if (opts.dashboard || isDashboardArtifact(fixed)) {
    fixed = injectDashboardShell(fixed);
  }
  fixed = fixArtifactLintFindings(fixed, {
    title: opts.title,
    dashboard: opts.dashboard || isDashboardArtifact(fixed),
  });

  const after = await lint(fixed);
  return {
    html: fixed,
    changed: fixed !== html,
    before,
    after,
    improved: lintImproved(before, after),
  };
}
