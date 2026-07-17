import { describe, it, expect } from 'vitest';
import {
  fillMarketingSiteTemplate,
  inferProductNameFromText,
  inferTaglineFromText,
} from '../shared/marketing-site-template';
import { generationBudgetForSkill } from '../shared/generation-budgets';

describe('marketing-site-template', () => {
  it('replaces product name in template', () => {
    const out = fillMarketingSiteTemplate('<title>Filebase — x</title><p>Filebase rocks</p>', {
      productName: 'Acme',
    });
    expect(out).not.toContain('Filebase');
    expect(out).toContain('Acme');
  });

  it('infers product and tagline from brief text', () => {
    expect(inferProductNameFromText('Acme — sync for video teams')).toBe('Acme');
    expect(inferTaglineFromText('Acme — sync for video teams')).toBe('sync for video teams');
  });
});

describe('generation-budgets', () => {
  it('caps saas-landing tokens and auto-continue', () => {
    const b = generationBudgetForSkill('saas-landing');
    expect(b.maxTokens).toBe(4096);
    expect(b.maxAutoContinue).toBe(2);
  });
});
