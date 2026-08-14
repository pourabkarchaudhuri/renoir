/** Per-skill LLM generation budgets — keeps latency predictable. */

export interface SkillGenerationBudget {
  /** Cap completion tokens (default in llm.ts is 16384). */
  maxTokens: number;
  /** Auto-continue attempts before giving up. */
  maxAutoContinue: number;
}

export const SKILL_GENERATION_BUDGETS: Record<string, SkillGenerationBudget> = {
  'saas-landing': { maxTokens: 4096, maxAutoContinue: 2 },
  'pricing-page': { maxTokens: 3072, maxAutoContinue: 2 },
  // 6-8 versioned entries plus inline CSS overruns a 3k cap and streams a truncated page.
  'changelog':    { maxTokens: 6144, maxAutoContinue: 3 },
  'blog-post':    { maxTokens: 6144, maxAutoContinue: 2 },
};

export const DEFAULT_MAX_TOKENS = 16384;
export const DEFAULT_MAX_AUTO_CONTINUE = 8;

export function generationBudgetForSkill(skillId?: string): SkillGenerationBudget {
  if (!skillId) {
    return { maxTokens: DEFAULT_MAX_TOKENS, maxAutoContinue: DEFAULT_MAX_AUTO_CONTINUE };
  }
  return SKILL_GENERATION_BUDGETS[skillId] ?? {
    maxTokens: DEFAULT_MAX_TOKENS,
    maxAutoContinue: DEFAULT_MAX_AUTO_CONTINUE,
  };
}

/** Skills that use a slim system frame instead of the full FRAME enrichment block. */
export const FAST_PATH_SKILL_IDS = new Set([
  'saas-landing',
  'pricing-page',
  'changelog',
  'blog-post',
]);
