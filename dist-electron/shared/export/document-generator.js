const exporters = new Map();
export function registerExporter(exporter) {
    exporters.set(exporter.format, exporter);
}
export function getExporter(format) {
    return exporters.get(format);
}
export function listRegisteredFormats() {
    return [...exporters.keys()];
}
export async function exportDocument(format, doc, ctx) {
    const exporter = exporters.get(format);
    if (!exporter) {
        throw new Error(`No exporter registered for format "${format}". Registered: ${listRegisteredFormats().join(', ') || 'none'}`);
    }
    return exporter.export(doc, ctx);
}
