import type { SkillExportProvider } from '@shared/export/skill-content';

const providers = new Map<string, SkillExportProvider>();

export function registerSkillExportProvider(provider: SkillExportProvider): void {
  providers.set(provider.skillId, provider);
}

export function getSkillExportProvider(skillId: string): SkillExportProvider | undefined {
  return providers.get(skillId);
}
