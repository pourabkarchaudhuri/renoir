import { describe, expect, it } from 'vitest';
import { marketingBriefFromStudioContext } from '../src/lib/marketing-site-preview';
import { usesInstantStagedPreview, INSTANT_PREVIEW_SKILL_IDS } from '../src/lib/instant-preview-skills';

describe('marketingBriefFromStudioContext', () => {
  it('parses product and tagline from em-dash prompt', () => {
    const brief = marketingBriefFromStudioContext('Acme — Ship 3x faster without breaking things');
    expect(brief.productName).toBe('Acme');
    expect(brief.tagline).toBe('Ship 3x faster without breaking things');
  });

  it('merges question-form answers', () => {
    const brief = marketingBriefFromStudioContext('ignored', {
      questionAnswers: { product: 'Vellum — Docs', scope: 'AI-native knowledge base' },
    });
    expect(brief.productName).toBe('Vellum');
    expect(brief.tagline).toBe('AI-native knowledge base');
  });
});

describe('instant-preview-skills', () => {
  it('keeps staged/pregenerated previews disabled', () => {
    expect(INSTANT_PREVIEW_SKILL_IDS.size).toBe(0);
    expect(usesInstantStagedPreview('blog-post')).toBe(false);
    expect(usesInstantStagedPreview('saas-landing')).toBe(false);
    expect(usesInstantStagedPreview('web-prototype')).toBe(false);
  });
});
