import { describe, it, expect } from 'vitest';
import { probeFindingsToLint } from '../src/lib/a11y-probe-findings';

describe('a11y-probe-findings', () => {
  it('flags low contrast from probe report', () => {
    const findings = probeFindingsToLint({
      contrasts: [{ selector: '.title', ratio: 2.1, fg: '#ccc', bg: '#fff', passesAA: false }],
      focusables: [],
      headings: [],
    });
    expect(findings.some((f) => f.rule === 'contrast-probe')).toBe(true);
    expect(findings[0].source).toBe('probe');
  });
});
