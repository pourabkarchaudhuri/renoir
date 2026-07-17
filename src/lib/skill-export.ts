import { htmlToExportBlocks, sanitizeHtmlForExport } from '@shared/export/html-parser';
import {
  buildDefaultExportDocument,
  type SkillExportBuildInput,
} from '@shared/export/skill-content';
import type { ExportDocument } from '@shared/export/types';
import { normalizeArtifactDocument } from '@/lib/artifact-html';
import { extractBriefFromConversation } from '@/lib/prompt';
import {
  getSkillSession,
  previewHtmlForSkill,
  projectHasSkillWork,
  skillDisplayName,
} from '@/lib/skill-sessions';
import type { ProjectRecord } from '@/types/global';
import type { ThemeStyleOptions } from '@/lib/theme-tokens';
import { getSkillExportProvider } from '@/lib/skill-export-providers';

export interface BuildSkillExportOptions {
  project: ProjectRecord;
  skillId: string;
  skillName: string;
  skillBlurb?: string;
  questionAnswers?: Record<string, string>;
  theme?: ThemeStyleOptions;
}

function parseHtmlToBlocks(html: string, pageBreakBetweenSlides?: boolean) {
  const sanitized = sanitizeHtmlForExport(html);
  return htmlToExportBlocks(
    sanitized,
    (source) => new DOMParser().parseFromString(source, 'text/html'),
    { pageBreakBetweenSlides },
  );
}

function resolveDates(project: ProjectRecord, skillId: string): { createdAt: string; modifiedAt: string } {
  const session = getSkillSession(project, skillId);
  const versions = session.versions ?? project.versions ?? [];
  const activeId = session.activeVersionId ?? project.activeVersionId;
  const active = versions.find((v) => v.id === activeId) ?? versions[versions.length - 1];
  return {
    createdAt: project.createdAt,
    modifiedAt: active?.createdAt ?? project.updatedAt ?? project.createdAt,
  };
}

export function hasExportableContent(project: ProjectRecord | null | undefined, skillId?: string): boolean {
  if (!project || !skillId) return false;
  if (!projectHasSkillWork(project, skillId)) return false;
  return Boolean(previewHtmlForSkill(project, skillId)?.trim());
}

export function buildSkillExportDocument(opts: BuildSkillExportOptions): ExportDocument | Promise<ExportDocument> {
  const { project, skillId, skillName, skillBlurb, questionAnswers, theme } = opts;
  const artifactHtml = previewHtmlForSkill(project, skillId);
  if (!artifactHtml?.trim()) {
    throw new Error('No exportable content for this skill.');
  }

  const normalized = normalizeArtifactDocument(artifactHtml, {
    title: skillDisplayName(project, skillId) || project.name || skillName,
    theme,
    dashboard: skillId === 'dashboard',
    productDeck: skillId === 'product-deck',
    productName: project.name,
    productDeckFinalize: true,
  });

  const briefFromConvo = extractBriefFromConversation(
    getSkillSession(project, skillId).conversation ?? project.conversation ?? [],
  );
  const briefAnswers = { ...briefFromConvo, ...(questionAnswers ?? {}) };

  const { createdAt, modifiedAt } = resolveDates(project, skillId);

  const input: SkillExportBuildInput = {
    skillId,
    skillName,
    skillBlurb,
    projectId: project.id,
    projectName: project.name,
    sessionName: skillDisplayName(project, skillId),
    artifactHtml: normalized,
    briefAnswers: Object.keys(briefAnswers).length ? briefAnswers : undefined,
    createdAt,
    modifiedAt,
    pageBreakBetweenSlides: skillId === 'product-deck',
  };

  const provider = getSkillExportProvider(skillId);
  if (provider) {
    return Promise.resolve(provider.buildDocument(input, (html) => parseHtmlToBlocks(html, input.pageBreakBetweenSlides)))
      .then((doc) => ({ previewHtml: normalized, ...doc }));
  }

  const blocks = parseHtmlToBlocks(normalized, input.pageBreakBetweenSlides);
  const doc = buildDefaultExportDocument(input, blocks);
  doc.previewHtml = normalized;
  return doc;
}

export function defaultExportFilename(
  skillName: string,
  projectName: string,
  format: 'pdf' | 'docx' | 'markdown',
): string {
  const ext = format === 'markdown' ? 'md' : format;
  const date = new Date().toISOString().slice(0, 10);
  const safe = (s: string) => s.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40);
  return `${safe(skillName)}-${safe(projectName)}-${date}.${ext}`;
}
