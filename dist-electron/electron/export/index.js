import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import { EXPORT_FORMAT_EXTENSIONS, EXPORT_FORMAT_LABELS } from '../../shared/export/types.js';
import { exportDocument, registerExporter } from '../../shared/export/document-generator.js';
import { DEFAULT_EXPORT_THEME } from '../../shared/export/theme.js';
import { markdownExporter } from '../../shared/export/exporters/markdown.js';
import { docxExporter } from './docx-exporter.js';
import { createImageFetcher } from './image-assets.js';
import { exportDocumentToPrintHtml } from '../../shared/export/exporters/print-html.js';
import { inlineResolvableImagesInHtml } from '../../shared/export/inline-export-images.js';
import { projectDir } from '../workspace.js';
let exportersReady = false;
function ensureExporters() {
    if (exportersReady)
        return;
    registerExporter(markdownExporter);
    registerExporter(docxExporter);
    registerExporter({
        format: 'pdf',
        async export(doc, ctx) {
            // Prefer the artifact HTML shown in the app preview so the PDF matches
            // the in-app layout; fall back to the themed structured document.
            let html = doc.previewHtml?.trim()
                ? doc.previewHtml
                : exportDocumentToPrintHtml(doc, ctx.theme);
            const fetchImage = ctx.assets?.fetchImage;
            if (fetchImage) {
                html = await inlineResolvableImagesInHtml(html, fetchImage);
            }
            return htmlToPdfBuffer(html);
        },
    });
    exportersReady = true;
}
async function htmlToPdfBuffer(html, pageSize = 'A4') {
    const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    try {
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        await new Promise((r) => setTimeout(r, 500));
        const buf = await win.webContents.printToPDF({
            pageSize,
            printBackground: true,
        });
        return new Uint8Array(buf);
    }
    finally {
        try {
            win.destroy();
        }
        catch { /* swallow */ }
    }
}
function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_|_$/g, '') || 'export';
}
export async function exportDocumentToFile(req) {
    ensureExporters();
    const ext = EXPORT_FORMAT_EXTENSIONS[req.format];
    const label = EXPORT_FORMAT_LABELS[req.format];
    const defaultName = sanitizeFilename(req.defaultFilename ?? `${req.document.title}.${ext}`);
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win ?? undefined, {
        defaultPath: defaultName.endsWith(`.${ext}`) ? defaultName : `${defaultName}.${ext}`,
        filters: [{ name: label, extensions: [ext] }],
    });
    if (result.canceled || !result.filePath) {
        return { ok: false, error: 'cancelled' };
    }
    const workspaceRoot = req.projectId ? projectDir(req.projectId) : undefined;
    const fetchImage = createImageFetcher(workspaceRoot);
    try {
        const output = await exportDocument(req.format, req.document, {
            theme: DEFAULT_EXPORT_THEME,
            assets: { fetchImage },
        });
        const data = typeof output === 'string' ? Buffer.from(output, 'utf8') : Buffer.from(output);
        fs.writeFileSync(result.filePath, data);
        return { ok: true, savedPath: result.filePath };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
    }
}
/** Export print HTML for testing or internal PDF pipeline. */
export { htmlToPdfBuffer };
