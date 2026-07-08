import type { LintFinding } from '@/types/global';

export interface A11yProbeReport {
  contrasts: { selector: string; ratio: number; fg: string; bg: string; passesAA: boolean }[];
  focusables: { selector: string; tabIndex: number }[];
  headings: { level: number; text: string }[];
}

export function probeFindingsToLint(report: A11yProbeReport): LintFinding[] {
  const out: LintFinding[] = [];

  for (const c of report.contrasts) {
    if (c.passesAA) continue;
    out.push({
      level: 'warn',
      rule: 'contrast-probe',
      message: `${c.selector}: contrast ${c.ratio}:1 (needs 4.5:1)`,
      category: 'contrast',
      selector: c.selector,
      source: 'probe',
    });
  }

  const positiveTab = report.focusables.filter((f) => f.tabIndex > 0);
  if (positiveTab.length) {
    out.push({
      level: 'warn',
      rule: 'tabindex-probe',
      message: `${positiveTab.length} focusable element(s) with tabindex > 0`,
      category: 'keyboard',
      source: 'probe',
    });
  }

  const h1s = report.headings.filter((h) => h.level === 1);
  if (h1s.length > 1) {
    out.push({
      level: 'warn',
      rule: 'multiple-h1-probe',
      message: `Live probe found ${h1s.length} h1 headings`,
      category: 'structure',
      source: 'probe',
    });
  }

  return out;
}

export function mergeLintWithProbe(
  staticFindings: LintFinding[],
  probeFindings: LintFinding[],
): LintFinding[] {
  const staticRules = new Set(staticFindings.map((f) => f.rule));
  const extra = probeFindings.filter((f) => !staticRules.has(f.rule.replace('-probe', '')));
  return [...staticFindings, ...extra];
}
