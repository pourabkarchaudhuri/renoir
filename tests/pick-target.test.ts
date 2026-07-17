import { describe, it, expect } from 'vitest';
import { pickEditDraft, extractOdIdSnippet, pickEditDraftFromHtml } from '../src/lib/pick-target';

describe('pick-target', () => {
  it('builds edit draft from odId', () => {
    expect(pickEditDraft({ odId: 'hero', textPreview: 'Welcome' })).toContain('data-od-id="hero"');
    expect(pickEditDraft({ odId: 'hero', textPreview: 'Welcome' })).toContain('Welcome');
  });

  it('extracts snippet for data-od-id region', () => {
    const html = '<div data-od-id="hero"><h1>Hi</h1></div><div data-od-id="footer">End</div>';
    const snip = extractOdIdSnippet(html, 'hero');
    expect(snip).toContain('data-od-id="hero"');
    expect(snip).toContain('Hi');
  });

  it('enriches draft with markup snippet from artifact html', () => {
    const html = '<section data-od-id="hero"><h1>Welcome</h1></section>';
    const draft = pickEditDraftFromHtml({ odId: 'hero', textPreview: 'Welcome' }, html);
    expect(draft).toContain('```html');
    expect(draft).toContain('data-od-id="hero"');
    expect(draft).toContain('Change:');
  });
});
