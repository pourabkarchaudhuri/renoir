import type { ExportDocument, ExportFormat } from './types.js';
import type { ExportTheme } from './theme.js';

export interface ExportContext {
  theme: ExportTheme;
  assets?: {
    fetchImage?(src: string): Promise<Uint8Array | null>;
  };
}

export interface DocumentExporter {
  format: ExportFormat;
  export(doc: ExportDocument, ctx: ExportContext): Promise<Uint8Array | string>;
}
