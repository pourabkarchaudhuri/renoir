import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  shouldAutoContinue,
  trimOverlap,
  createInitialAutoState,
  DEFAULT_AUTO_CONTINUE_CONFIG,
  type AutoContinueState,
} from '../src/lib/auto-continue';

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe('createInitialAutoState', () => {
  it('returns correct defaults', () => {
    const state = createInitialAutoState();
    expect(state.enabled).toBe(true);
    expect(state.attempts).toBe(0);
    expect(state.maxAttempts).toBe(8);
    expect(state.isAutoContinuing).toBe(false);
  });

  it('returns a fresh object each time', () => {
    const a = createInitialAutoState();
    const b = createInitialAutoState();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('DEFAULT_AUTO_CONTINUE_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_AUTO_CONTINUE_CONFIG.maxAttempts).toBe(8);
    expect(DEFAULT_AUTO_CONTINUE_CONFIG.continuePrompt).toBe(
      'Continue from where you stopped. Finish the artifact in full. Do not repeat what you already wrote.',
    );
  });
});

describe('shouldAutoContinue', () => {
  const baseState: AutoContinueState = {
    enabled: true,
    attempts: 0,
    maxAttempts: 5,
    isAutoContinuing: false,
  };

  describe('returns true when all conditions met', () => {
    it('basic case: enabled, length, no closing tag, under max', () => {
      expect(shouldAutoContinue('length', '<div>hello', baseState)).toBe(true);
    });

    it('with partial artifact content', () => {
      expect(shouldAutoContinue('length', '<artifact><div>partial content', baseState)).toBe(true);
    });
  });

  describe('returns false when state.enabled is false', () => {
    it('disabled state', () => {
      const state = { ...baseState, enabled: false };
      expect(shouldAutoContinue('length', '<div>hello', state)).toBe(false);
    });
  });

  describe('returns false when finishReason is not "length"', () => {
    it('finishReason === "stop"', () => {
      expect(shouldAutoContinue('stop', '<div>hello', baseState)).toBe(false);
    });

    it('finishReason === "aborted"', () => {
      expect(shouldAutoContinue('aborted', '<div>hello', baseState)).toBe(false);
    });

    it('finishReason === undefined', () => {
      expect(shouldAutoContinue(undefined, '<div>hello', baseState)).toBe(false);
    });

    it('finishReason === empty string', () => {
      expect(shouldAutoContinue('', '<div>hello', baseState)).toBe(false);
    });
  });

  describe('returns false when </artifact> tag is present', () => {
    it('lowercase closing tag', () => {
      expect(shouldAutoContinue('length', '<artifact>content</artifact>', baseState)).toBe(false);
    });

    it('uppercase closing tag', () => {
      expect(shouldAutoContinue('length', '<ARTIFACT>content</ARTIFACT>', baseState)).toBe(false);
    });

    it('mixed case closing tag', () => {
      expect(shouldAutoContinue('length', 'content</Artifact>', baseState)).toBe(false);
    });

    it('closing tag with surrounding whitespace in content', () => {
      expect(shouldAutoContinue('length', 'content </artifact> more', baseState)).toBe(false);
    });
  });

  describe('returns false when attempts >= maxAttempts', () => {
    it('attempts equal to maxAttempts', () => {
      const state = { ...baseState, attempts: 5, maxAttempts: 5 };
      expect(shouldAutoContinue('length', '<div>hello', state)).toBe(false);
    });

    it('attempts exceed maxAttempts', () => {
      const state = { ...baseState, attempts: 7, maxAttempts: 5 };
      expect(shouldAutoContinue('length', '<div>hello', state)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('empty pendingAssistant with length finish', () => {
      expect(shouldAutoContinue('length', '', baseState)).toBe(true);
    });

    it('attempts at maxAttempts - 1 (last allowed attempt)', () => {
      const state = { ...baseState, attempts: 4, maxAttempts: 5 };
      expect(shouldAutoContinue('length', '<div>hello', state)).toBe(true);
    });

    it('maxAttempts of 1', () => {
      const state = { ...baseState, attempts: 0, maxAttempts: 1 };
      expect(shouldAutoContinue('length', '<div>hello', state)).toBe(true);
    });

    it('maxAttempts of 1 with 1 attempt already', () => {
      const state = { ...baseState, attempts: 1, maxAttempts: 1 };
      expect(shouldAutoContinue('length', '<div>hello', state)).toBe(false);
    });
  });
});

describe('trimOverlap', () => {
  it('returns continuation unchanged when no overlap', () => {
    expect(trimOverlap('hello world', 'foo bar')).toBe('foo bar');
  });

  it('trims overlapping content', () => {
    expect(trimOverlap('hello world', 'world is great')).toBe(' is great');
  });

  it('handles full overlap of short continuation', () => {
    expect(trimOverlap('abcdef', 'def')).toBe('');
  });

  it('handles empty existing string', () => {
    expect(trimOverlap('', 'hello')).toBe('hello');
  });

  it('handles empty continuation string', () => {
    expect(trimOverlap('hello', '')).toBe('');
  });

  it('handles both empty strings', () => {
    expect(trimOverlap('', '')).toBe('');
  });

  it('respects windowSize parameter', () => {
    const existing = 'a'.repeat(300) + 'overlap';
    const continuation = 'overlap and more';
    // With default window (200), the overlap is within range
    expect(trimOverlap(existing, continuation)).toBe(' and more');
    // With tiny window (3), the overlap "overlap" won't be found
    expect(trimOverlap(existing, continuation, 3)).toBe('overlap and more');
  });

  it('finds longest overlap when multiple matches possible', () => {
    // "abab" ends with "ab" and "abab", continuation starts with "abab"
    expect(trimOverlap('xyzabab', 'ababc')).toBe('c');
  });

  it('handles multi-line overlap', () => {
    const existing = 'line1\nline2\nline3';
    const continuation = 'line3\nline4';
    expect(trimOverlap(existing, continuation)).toBe('\nline4');
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('Property-Based Tests', () => {
  /**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.8**
   *
   * Property 9: shouldAutoContinue correctness
   * For any combination of finishReason, pendingAssistant, and AutoContinueState,
   * shouldAutoContinue returns true if and only if: (a) state.enabled === true,
   * (b) finishReason === 'length' OR content has <artifact> without </artifact>,
   * (c) pendingAssistant does not contain '</artifact>' (case-insensitive),
   * and (d) state.attempts < state.maxAttempts.
   */
  it('Property 9: shouldAutoContinue correctness', () => {
    const finishReasonArb = fc.oneof(
      fc.constant('length'),
      fc.constant('stop'),
      fc.constant('aborted'),
      fc.constant(undefined as string | undefined),
      fc.string({ minLength: 0, maxLength: 20 }),
    );

    const pendingAssistantArb = fc.oneof(
      fc.string({ minLength: 0, maxLength: 500 }),
      // Ensure we sometimes generate strings with </artifact> in various cases
      fc.string({ minLength: 0, maxLength: 100 }).map((s) => s + '</artifact>' + s),
      fc.string({ minLength: 0, maxLength: 100 }).map((s) => s + '</ARTIFACT>'),
      fc.string({ minLength: 0, maxLength: 100 }).map((s) => s + '</Artifact>'),
      // Generate strings with <artifact> or <artifact  but no closing tag
      fc.string({ minLength: 0, maxLength: 100 }).map((s) => '<artifact>' + s),
      fc.string({ minLength: 0, maxLength: 100 }).map((s) => '<artifact ' + s),
    );

    const stateArb = fc.record({
      enabled: fc.boolean(),
      attempts: fc.nat({ max: 15 }),
      maxAttempts: fc.integer({ min: 1, max: 10 }),
      isAutoContinuing: fc.boolean(),
    });

    fc.assert(
      fc.property(finishReasonArb, pendingAssistantArb, stateArb, (finishReason, pending, state) => {
        const result = shouldAutoContinue(finishReason, pending, state);

        const lower = pending.toLowerCase();
        const condA = state.enabled === true;
        const condC = !lower.includes('</artifact>');
        const condD = state.attempts < state.maxAttempts;
        // Trigger on length OR incomplete artifact (actual tag, not just the word)
        const hasOpenTag = lower.includes('<artifact>') || lower.includes('<artifact ');
        const condB = finishReason === 'length' || (hasOpenTag && condC);

        const expected = condA && condB && condC && condD;

        expect(result).toBe(expected);
      }),
      { numRuns: 1000 },
    );
  });

  /**
   * **Validates: Requirements 6.4, 6.6**
   *
   * Property 10: Auto-continue terminates
   * For any sequence of done events, the auto-continue loop terminates after
   * at most maxAttempts iterations.
   */
  it('Property 10: Auto-continue terminates', () => {
    const maxAttemptsArb = fc.integer({ min: 1, max: 10 });

    // Generate a sequence of finish reasons (simulating multiple done events)
    const finishReasonSeqArb = fc.array(
      fc.oneof(
        fc.constant('length'),
        fc.constant('stop'),
        fc.constant('aborted'),
      ),
      { minLength: 1, maxLength: 20 },
    );

    fc.assert(
      fc.property(maxAttemptsArb, finishReasonSeqArb, (maxAttempts, finishReasons) => {
        let state: AutoContinueState = {
          enabled: true,
          attempts: 0,
          maxAttempts,
          isAutoContinuing: false,
        };

        // Simulate the auto-continue loop: pending never contains </artifact>
        // (worst case — the LLM never completes the artifact)
        const pendingWithoutClose = '<artifact><div>partial content that never closes';
        let continuations = 0;

        for (const reason of finishReasons) {
          if (shouldAutoContinue(reason, pendingWithoutClose, state)) {
            state = { ...state, attempts: state.attempts + 1, isAutoContinuing: true };
            continuations++;
          } else {
            // Loop terminates
            break;
          }
        }

        // The loop must terminate within maxAttempts iterations
        expect(continuations).toBeLessThanOrEqual(maxAttempts);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Additional property: trimOverlap never produces output longer than the continuation
   */
  it('trimOverlap output is never longer than continuation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 300 }),
        fc.string({ minLength: 0, maxLength: 300 }),
        fc.integer({ min: 1, max: 500 }),
        (existing, continuation, windowSize) => {
          const result = trimOverlap(existing, continuation, windowSize);
          expect(result.length).toBeLessThanOrEqual(continuation.length);
        },
      ),
      { numRuns: 500 },
    );
  });

  /**
   * Additional property: trimOverlap result + overlap prefix === original continuation
   */
  it('trimOverlap preserves content (trimmed prefix + result === continuation)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        (existing, continuation) => {
          const result = trimOverlap(existing, continuation);
          // The result should be a suffix of the continuation
          expect(continuation.endsWith(result)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});
