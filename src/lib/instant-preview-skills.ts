/**
 * Skills that formerly showed a staged template while awaiting the LLM.
 * Empty by design — pregenerated previews masked real generation and raced
 * stream event routing. Keep the helper so callers can stay feature-gated.
 */
export const INSTANT_PREVIEW_SKILL_IDS = new Set<string>();

export function usesInstantStagedPreview(skillId?: string): boolean {
  return Boolean(skillId && INSTANT_PREVIEW_SKILL_IDS.has(skillId));
}
