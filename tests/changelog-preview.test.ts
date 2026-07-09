import { describe, expect, it } from 'vitest';
import { changelogBriefFromStudioContext } from '../src/lib/changelog-preview';

describe('changelogBriefFromStudioContext', () => {
  it('parses product from em-dash prompt', () => {
    const brief = changelogBriefFromStudioContext(
      'Filebase — release notes for sync engine v2.4',
    );
    expect(brief.productName).toBe('Filebase');
  });

  it('merges question-form answers over freeform text', () => {
    const brief = changelogBriefFromStudioContext('ignored', {
      questionAnswers: { product: 'Acme — Docs' },
    });
    expect(brief.productName).toBe('Acme');
  });
});
