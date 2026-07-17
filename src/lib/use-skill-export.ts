import { useCallback } from 'react';
import { useUI, useStudio, useCatalog } from '@/lib/store';
import {
  buildSkillExportDocument,
  defaultExportFilename,
  hasExportableContent,
} from '@/lib/skill-export';
import type { ExportFormat, ExportDocument } from '@shared/export/types';
import { EXPORT_FORMAT_LABELS } from '@shared/export/types';

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: 'Exporting PDF',
  docx: 'Exporting Word document',
  markdown: 'Exporting Markdown',
};

export function useSkillExport(skillId: string | undefined, streaming = false) {
  const project = useStudio((s) => s.project);
  const questionAnswers = useStudio((s) => s.questionAnswers);
  const skills = useCatalog((s) => s.skills);
  const designSystems = useCatalog((s) => s.designSystems);
  const directions = useCatalog((s) => s.directions);
  const selectedDesignSystemId = useStudio((s) => s.selectedDesignSystemId);
  const selectedDirectionId = useStudio((s) => s.selectedDirectionId);
  const toast = useUI((s) => s.toast);

  const skill = skills.find((s) => s.id === skillId);
  const canExport = Boolean(project && skillId && hasExportableContent(project, skillId) && !streaming);

  const runExport = useCallback(async (format: ExportFormat, retryParams?: Record<string, unknown>) => {
    if (!project || !skillId || !skill) return;

    const ds = designSystems.find((d) => d.id === selectedDesignSystemId);
    const dir = directions.find((d) => d.id === selectedDirectionId);
    const theme = ds?.tokens?.length
      ? { tokens: ds.tokens, font: ds.font, directionSwatches: dir?.swatches }
      : undefined;

    let document = retryParams?.document as ExportDocument | undefined;
    let defaultFilename = retryParams?.defaultFilename as string | undefined;

    const jobKind = format === 'markdown' ? 'markdown' : format === 'docx' ? 'docx' : 'pdf';
    const jobId = useUI.getState().pushJob({
      kind: jobKind,
      label: FORMAT_LABEL[format],
      params: { format, projectId: project.id, skillId },
    });

    try {
      useUI.getState().updateJob(jobId, { phase: 'Preparing document…' });

      if (!document) {
        document = await Promise.resolve(buildSkillExportDocument({
          project,
          skillId,
          skillName: skill.name,
          skillBlurb: skill.blurb,
          questionAnswers,
          theme,
        }));
        defaultFilename = defaultExportFilename(skill.name, project.name, format);
      }

      useUI.getState().updateJob(jobId, {
        phase: `Rendering ${EXPORT_FORMAT_LABELS[format]}…`,
        params: { format, document, defaultFilename, projectId: project.id, skillId },
      });

      const res = await window.renoir.exportDocument({
        format,
        document,
        defaultFilename,
        projectId: project.id,
      });

      if (res.ok) {
        useUI.getState().completeJob(jobId, { ok: true, savedPath: res.savedPath });
        toast(`${EXPORT_FORMAT_LABELS[format]} saved`, 'ok');
      } else if (res.error === 'cancelled') {
        useUI.getState().dismissJob(jobId);
      } else {
        useUI.getState().completeJob(jobId, { ok: false, error: res.error ?? 'Export failed' });
        toast(res.error ?? 'Export failed', 'err', {
          label: 'Retry',
          onClick: () => { void runExport(format, { document, defaultFilename }); },
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      useUI.getState().completeJob(jobId, { ok: false, error: message });
      toast(message, 'err', {
        label: 'Retry',
        onClick: () => { void runExport(format); },
      });
    }
  }, [
    project,
    skillId,
    skill,
    questionAnswers,
    designSystems,
    directions,
    selectedDesignSystemId,
    selectedDirectionId,
    toast,
  ]);

  return { canExport, exportSkill: runExport };
}
