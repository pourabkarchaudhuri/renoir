/**
 * AutoContinueController — pure logic for detecting LLM stream truncation
 * and deciding whether to automatically resume generation.
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AutoContinueState {
  enabled: boolean;
  attempts: number;
  maxAttempts: number;
  isAutoContinuing: boolean;
}

export interface AutoContinueConfig {
  maxAttempts: number;       // default: 5, range 1-10
  continuePrompt: string;   // default: "Continue from where you stopped. Complete the artifact."
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_AUTO_CONTINUE_CONFIG: AutoContinueConfig = {
  maxAttempts: 8,
  continuePrompt: 'Continue from where you stopped. Finish the artifact in full. Do not repeat what you already wrote.',
};

/**
 * Creates a fresh AutoContinueState with sensible defaults.
 */
export function createInitialAutoState(): AutoContinueState {
  return {
    enabled: true,
    attempts: 0,
    maxAttempts: DEFAULT_AUTO_CONTINUE_CONFIG.maxAttempts,
    isAutoContinuing: false,
  };
}

// ─── Pure Predicate ──────────────────────────────────────────────────────────

/**
 * Determines whether the system should automatically continue LLM generation.
 *
 * Returns `true` if ALL of:
 * 1. `state.enabled === true`
 * 2. `state.attempts < state.maxAttempts`
 * 3. The artifact appears incomplete (no closing `</artifact>` tag)
 * 4. At least one trigger condition:
 *    a. `finishReason === 'length'` (token limit hit)
 *    b. Content has `<artifact>` without `</artifact>` (incomplete artifact)
 *    c. `finishReason === 'stop'` and content has `<artifact>` (model stopped mid-artifact)
 *
 * No side effects — pure predicate.
 */
export function shouldAutoContinue(
  finishReason: string | undefined,
  pendingAssistant: string,
  state: AutoContinueState,
): boolean {
  if (!state.enabled) return false;
  if (state.attempts >= state.maxAttempts) return false;

  const lower = pendingAssistant.toLowerCase();
  const hasClosingTag = lower.includes('</artifact>');

  // If the artifact is already complete, no need to continue
  if (hasClosingTag) return false;

  // Continue if: finish reason is 'length' (token limit hit)
  if (finishReason === 'length') return true;

  // Continue if: there's an actual opening <artifact> tag (not just the word in prose)
  // Must be at the start of a line or after whitespace, followed by > to be a real tag
  if (lower.includes('<artifact>') || lower.includes('<artifact ')) return true;

  return false;
}

// ─── Overlap Detection ───────────────────────────────────────────────────────

/**
 * Trims overlapping content between the end of `existing` and the beginning
 * of `continuation`. Uses a sliding window approach to find the longest suffix
 * of `existing` that matches a prefix of `continuation`.
 *
 * @param existing - The content accumulated so far
 * @param continuation - The new content from the continuation response
 * @param windowSize - Maximum overlap to check (default: 200 chars)
 * @returns The continuation with any overlapping prefix removed
 */
export function trimOverlap(
  existing: string,
  continuation: string,
  windowSize: number = 200,
): string {
  if (!existing || !continuation) return continuation;

  // Look at the tail of existing (up to windowSize chars)
  const tailLength = Math.min(existing.length, windowSize);
  const tail = existing.slice(-tailLength);

  // Find the longest suffix of `tail` that matches a prefix of `continuation`
  let bestOverlap = 0;

  for (let len = 1; len <= Math.min(tail.length, continuation.length); len++) {
    const suffix = tail.slice(tail.length - len);
    const prefix = continuation.slice(0, len);
    if (suffix === prefix) {
      bestOverlap = len;
    }
  }

  if (bestOverlap > 0) {
    return continuation.slice(bestOverlap);
  }

  return continuation;
}
