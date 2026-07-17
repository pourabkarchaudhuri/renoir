import type { DocumentExporter, ExportContext } from './exporter.js';
import type { ExportDocument, ExportFormat } from './types.js';

const exporters = new Map<ExportFormat, DocumentExporter>();

export function registerExporter(exporter: DocumentExporter): void {
  exporters.set(exporter.format, exporter);
}

export function getExporter(format: ExportFormat): DocumentExporter | undefined {
  return exporters.get(format);
}

export function listRegisteredFormats(): ExportFormat[] {
  return [...exporters.keys()];
}

export async function exportDocument(
  format: ExportFormat,
  doc: ExportDocument,
  ctx: ExportContext,
): Promise<Uint8Array | string> {
  const exporter = exporters.get(format);
  if (!exporter) {
    throw new Error(`No exporter registered for format "${format}". Registered: ${listRegisteredFormats().join(', ') || 'none'}`);
  }
  return exporter.export(doc, ctx);
}
