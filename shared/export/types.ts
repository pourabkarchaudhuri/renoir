/** Format-agnostic document model for skill exports. */

export type ExportFormat = 'pdf' | 'docx' | 'markdown';

export interface ExportInput {
  label: string;
  value: string;
}

export interface ExportDocument {
  title: string;
  subtitle?: string;
  description?: string;
  skillId?: string;
  skillName?: string;
  projectId?: string;
  createdAt: string;
  modifiedAt: string;
  inputs?: ExportInput[];
  blocks: ExportBlock[];
  metadata?: Record<string, string>;
  /**
   * Full normalized artifact HTML as shown in the app preview.
   * When present, visual formats (PDF) render this directly so the export
   * matches the in-app layout; structured formats (DOCX/Markdown) use blocks.
   */
  previewHtml?: string;
}

export type ExportInline =
  | { type: 'text'; text: string; bold?: boolean; italic?: boolean; code?: boolean }
  | { type: 'link'; text: string; href: string };

export interface ExportListItem {
  inlines: ExportInline[];
  nested?: ExportBlock[];
}

export type ExportBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: 'paragraph'; inlines: ExportInline[] }
  | { type: 'bulletList'; items: ExportListItem[] }
  | { type: 'orderedList'; items: ExportListItem[] }
  | { type: 'checklist'; items: { text: string; checked: boolean }[] }
  | { type: 'table'; headers?: string[]; rows: string[][] }
  | { type: 'code'; language?: string; code: string }
  | { type: 'blockquote'; inlines: ExportInline[] }
  | { type: 'image'; src: string; alt?: string; caption?: string; widthPx?: number; placeholder?: boolean }
  | { type: 'pageBreak' }
  | { type: 'horizontalRule' };

export const EXPORT_FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  pdf: 'pdf',
  docx: 'docx',
  markdown: 'md',
};

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: 'PDF',
  docx: 'Word Document',
  markdown: 'Markdown',
};
