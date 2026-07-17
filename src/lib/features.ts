/** Lightweight feature flags for incremental Phase 2 rollout. */
export const features = {
  variantCompareWizard: true,
  scrollSyncDiff: true,
  a11yProbe: true,
  clickThrough: true,
  flowMap: true,
} as const;

export type FeatureKey = keyof typeof features;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return features[key];
}
