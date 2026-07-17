import { describe, expect, it } from 'vitest';
import { blogBriefFromStudioContext, blogPostPromptSource, resolveStudioTheme } from '../src/lib/blog-post-preview';

describe('blogBriefFromStudioContext', () => {
  it('parses company and headline from em-dash prompt', () => {
    const brief = blogBriefFromStudioContext(
      'Filebase — why we rewrote our sync engine in Rust',
    );
    expect(brief.companyName).toBe('Filebase');
    expect(brief.headline).toBe('why we rewrote our sync engine in Rust');
  });

  it('merges question-form answers over freeform text', () => {
    const brief = blogBriefFromStudioContext('ignored', {
      questionAnswers: { product: 'Acme — Docs', article_topic: 'Shipping faster' },
    });
    expect(brief.companyName).toBe('Acme');
    expect(brief.headline).toBe('Shipping faster');
  });

  it('includes tagline from prompt after em-dash', () => {
    const brief = blogBriefFromStudioContext('Acme — How we cut deploy time by 90%');
    expect(brief.headline).toBe('How we cut deploy time by 90%');
    expect(brief.tagline).toBe('How we cut deploy time by 90%');
  });
});

describe('resolveStudioTheme', () => {
  const systems = [{ id: 'ember', name: 'Ember', vibe: '', swatches: [], font: 'Inter', tokens: [{ name: 'bg', value: '#111' }] }];
  const dirs = [{ id: 'vd-bold', name: 'Bold', vibe: '', swatches: ['#f00'], font: 'Inter', tagline: '' }];

  it('falls back to first design system when none selected', () => {
    const { designSystem } = resolveStudioTheme(systems, dirs);
    expect(designSystem?.id).toBe('ember');
  });
});

describe('blogPostPromptSource', () => {
  const conv = [
    { role: 'user', content: 'Sent prompt' },
    { role: 'assistant', content: 'Done' },
  ];

  it('prefers draft before send', () => {
    expect(blogPostPromptSource('typing…', conv, false, false)).toBe('typing…');
  });

  it('prefers last user message while awaiting artifact', () => {
    expect(blogPostPromptSource('', conv, true, false)).toBe('Sent prompt');
  });
});
