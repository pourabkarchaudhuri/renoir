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
import { captureArtifactPngs, pngDimensions } from './artifact-capture.js';
import { loadHtmlIntoWindow } from '../load-html.js';
import { buildPptxZipBuffer } from '../pptx.js';
const DEFAULT_PAGE_W = 1280;
const DEFAULT_PAGE_H = 720;
let exportersReady = false;
function pngToDataUrl(png) {
    return `data:image/png;base64,${png.toString('base64')}`;
}
function pageSizeMicrons(widthPx, heightPx) {
    return {
        width: Math.round((widthPx / 96) * 25.4 * 1000),
        height: Math.round((heightPx / 96) * 25.4 * 1000),
    };
}
function buildRasterPdfHtml(pngs) {
    const pages = pngs.map((png, i) => {
        const { width, height } = pngDimensions(png);
        const src = pngToDataUrl(png);
        const breakBefore = i > 0 ? 'page-break-before:always;' : '';
        return `<div class="page" style="${breakBefore}width:${width}px;height:${height}px;margin:0;padding:0;overflow:hidden;">` +
            `<img src="${src}" width="${width}" height="${height}" style="display:block;width:100%;height:100%;object-fit:contain;" alt="" />` +
            '</div>';
    }).join('\n');
    const first = pngs[0] ? pngDimensions(pngs[0]) : { width: DEFAULT_PAGE_W, height: DEFAULT_PAGE_H };
    return `<!doctype html><html><head><meta charset="utf-8"><style>` +
        `@page{size:${first.width}px ${first.height}px;margin:0;}` +
        `html,body{margin:0;padding:0;}` +
        `.page{box-sizing:border-box;}` +
        `</style></head><body>${pages}` +
        `<script>
      window.__renoirPdfReady = false;
      (async function () {
        const images = Array.from(document.images || []);
        const decodeImage = (img) => {
          if (typeof img.decode === 'function') {
            return img.decode().catch(() => {});
          }
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          });
        };
        await Promise.allSettled([
          document.fonts?.ready ?? Promise.resolve(),
          ...images.map(decodeImage),
        ]);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.__renoirPdfReady = true;
      })();
    </script>` +
        `</body></html>`;
}
function rasterPdfPageSize(pngs) {
    if (pngs.length === 1) {
        const dim = pngDimensions(pngs[0]);
        return pageSizeMicrons(dim.width, dim.height);
    }
    return pageSizeMicrons(DEFAULT_PAGE_W, DEFAULT_PAGE_H);
}
function ensureExporters() {
    if (exportersReady)
        return;
    registerExporter(markdownExporter);
    registerExporter(docxExporter);
    registerExporter({
        format: 'pdf',
        async export(doc, ctx) {
            if (doc.rasterExport) {
                const pngs = await captureArtifactPngs(doc, ctx);
                return htmlToPdfBuffer(buildRasterPdfHtml(pngs), rasterPdfPageSize(pngs));
            }
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
    registerExporter({
        format: 'pptx',
        async export(doc, ctx) {
            const pngs = await captureArtifactPngs(doc, ctx);
            return buildPptxZipBuffer(pngs);
        },
    });
    registerExporter({
        format: 'png',
        async export(doc, ctx) {
            const pngs = await captureArtifactPngs(doc, ctx);
            if (!pngs.length)
                throw new Error('No image captured.');
            return new Uint8Array(pngs[0]);
        },
    });
    exportersReady = true;
}
async function htmlToPdfBuffer(html, customPageSize) {
    const win = new BrowserWindow({
        show: false,
        width: DEFAULT_PAGE_W,
        height: DEFAULT_PAGE_H,
        webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    try {
        await loadHtmlIntoWindow(win, html);
        await waitForPrintReady(win);
        const buf = await win.webContents.printToPDF({
            pageSize: customPageSize ?? 'A4',
            printBackground: true,
            margins: { marginType: 'none' },
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
async function waitForPrintReady(win) {
    await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const finish = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
      const timeout = setTimeout(finish, 2500);
      const waitForImages = async () => {
        const images = Array.from(document.images || []);
        const decodeImage = (img) => {
          if (typeof img.decode === 'function') {
            return img.decode().catch(() => {});
          }
          if (img.complete) return Promise.resolve();
          return new Promise((done) => {
            img.addEventListener('load', () => done(), { once: true });
            img.addEventListener('error', () => done(), { once: true });
          });
        };
        await Promise.allSettled([
          document.fonts?.ready ?? Promise.resolve(),
          ...images.map(decodeImage),
        ]);
        clearTimeout(timeout);
        finish();
      };
      if (window.__renoirPdfReady === true) {
        clearTimeout(timeout);
        finish();
        return;
      }
      waitForImages();
    });
  `);
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
/** Export internals for testing or internal PDF pipeline. */
export { buildRasterPdfHtml, htmlToPdfBuffer };
