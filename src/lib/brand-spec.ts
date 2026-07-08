import type { BrandSpec, ProjectRecord } from '@/types/global';

function hasBrandContent(spec: BrandSpec | null | undefined): boolean {
  if (!spec) return false;
  return Boolean(
    spec.name || spec.voice || spec.audience ||
    spec.colors.length || spec.fonts.length || spec.values.length || spec.doNots.length,
  );
}

/** Conversation text used for brand extraction (user messages only). */
export function conversationBrandText(project: ProjectRecord): string {
  return project.conversation
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n\n');
}

/** Return cached brand spec or extract and optionally persist on project. */
export async function resolveBrandSpec(
  project: ProjectRecord,
  opts?: { refresh?: boolean },
): Promise<BrandSpec | undefined> {
  if (!opts?.refresh && hasBrandContent(project.brandSpec)) {
    return project.brandSpec;
  }
  const text = conversationBrandText(project);
  if (!text.trim()) return undefined;
  const spec = await window.renoir.brandExtract(text);
  if (!hasBrandContent(spec)) return undefined;
  return spec;
}

export { hasBrandContent };
