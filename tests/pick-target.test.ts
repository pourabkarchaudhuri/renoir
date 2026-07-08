import { describe, it, expect } from 'vitest';
import { pickEditDraft, extractOdIdSnippet } from '../src/lib/pick-target';

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
});
