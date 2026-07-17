import { describe, it, expect } from 'vitest';
import {
  REVISION_PROMPT_ADDENDUM,
  hasCompleteArtifact,
  isRevisionTurn,
  withLatestArtifact,
} from '../src/lib/artifact-revision';
import { composeSystemPrompt } from '../src/lib/prompt';

describe('hasCompleteArtifact', () => {
  it('is true when previewHtml is set', () => {
    expect(hasCompleteArtifact({
      conversation: [],
      previewHtml: '<html><body>Hi</body></html>',
    })).toBe(true);
  });

  it('is true when versions contain html', () => {
    expect(hasCompleteArtifact({
      conversation: [],
      versions: [{ id: 'v1', html: '<html></html>', source: 'assistant', createdAt: '2024-01-01' }],
    })).toBe(true);
  });

  it('is true when last assistant has a complete artifact', () => {
    expect(hasCompleteArtifact({
      conversation: [
        { role: 'user', content: 'Build', ts: '1' },
        { role: 'assistant', content: 'Done.\n<artifact><html>x</html></artifact>', ts: '2' },
      ],
    })).toBe(true);
  });

  it('is false when empty', () => {
    expect(hasCompleteArtifact({ conversation: [] })).toBe(false);
  });

  it('is false for incomplete artifact', () => {
    expect(hasCompleteArtifact({
      conversation: [
        { role: 'assistant', content: '<artifact><html>partial', ts: '1' },
      ],
    })).toBe(false);
  });
});

describe('isRevisionTurn', () => {
  const withArtifact = {
    conversation: [
      { role: 'user', content: 'Build a page' },
      { role: 'assistant', content: 'Here.\n<artifact><html>ok</html></artifact>' },
      { role: 'user', content: 'Make the hero shorter' },
    ],
    previewHtml: '<html>ok</html>',
  };

  it('is true for follow-ups when an artifact already exists', () => {
    expect(isRevisionTurn(withArtifact)).toBe(true);
  });

  it('is false during auto-continue', () => {
    expect(isRevisionTurn({ ...withArtifact, isAutoContinue: true })).toBe(false);
  });

  it('is false on first generation', () => {
    expect(isRevisionTurn({
      conversation: [{ role: 'user', content: 'Build a page' }],
    })).toBe(false);
  });
});

describe('withLatestArtifact', () => {
  it('replaces the last assistant artifact body with latestHtml', () => {
    const msgs = [
      { role: 'user', content: 'Build' },
      { role: 'assistant', content: 'Done.\n<artifact>\nold html\n</artifact>' },
      { role: 'user', content: 'Tweak it' },
    ];
    const out = withLatestArtifact(msgs, '<html>fresh</html>');
    expect(out[1].content).toContain('<html>fresh</html>');
    expect(out[1].content).not.toContain('old html');
    expect(out[1].content).toContain('Done.');
  });

  it('wraps latestHtml when the last assistant has no artifact tag', () => {
    const msgs = [
      { role: 'assistant', content: 'Intent only.' },
    ];
    const out = withLatestArtifact(msgs, '<html>x</html>');
    expect(out[0].content).toContain('<artifact>');
    expect(out[0].content).toContain('<html>x</html>');
    expect(out[0].content).toContain('Intent only.');
  });

  it('is a no-op when latestHtml is empty', () => {
    const msgs = [{ role: 'assistant', content: '<artifact>a</artifact>' }];
    expect(withLatestArtifact(msgs, '')).toEqual(msgs);
    expect(withLatestArtifact(msgs, null)).toEqual(msgs);
  });

  it('does not touch earlier assistant turns', () => {
    const msgs = [
      { role: 'assistant', content: '<artifact>old</artifact>' },
      { role: 'user', content: 'again' },
      { role: 'assistant', content: '<artifact>mid</artifact>' },
    ];
    const out = withLatestArtifact(msgs, 'NEW');
    expect(out[0].content).toContain('old');
    expect(out[2].content).toContain('NEW');
    expect(out[2].content).not.toContain('mid');
  });
});

describe('REVISION_PROMPT_ADDENDUM', () => {
  it('mentions surgical revision rules', () => {
    expect(REVISION_PROMPT_ADDENDUM).toContain('Revision turn');
    expect(REVISION_PROMPT_ADDENDUM).toContain('ONLY the user');
    expect(REVISION_PROMPT_ADDENDUM).toContain('data-od-id');
  });

  it('is appended when composeSystemPrompt({ revision: true })', () => {
    const withRev = composeSystemPrompt({ revision: true });
    const without = composeSystemPrompt({});
    expect(withRev.system).toContain('Revision turn');
    expect(without.system).not.toContain('Revision turn');
  });
});
