// Render an HTML artifact to PDF using Electron's offscreen webContents.
// No external dependency.
import { BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { ensureProjectDir } from './workspace.js';
export async function exportArtifactToPdf(req) {
    const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    try {
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(req.html));
        await new Promise((r) => setTimeout(r, 400));
        const buf = await win.webContents.printToPDF({
            pageSize: req.pageSize ?? 'A4',
            landscape: Boolean(req.landscape),
            printBackground: true,
        });
        const dir = ensureProjectDir(req.projectId);
        const filename = (req.filename || `artifact-${Date.now()}.pdf`).replace(/[^a-z0-9._-]/gi, '_');
        const savedPath = path.join(dir, filename);
        fs.writeFileSync(savedPath, buf);
        return { ok: true, savedPath };
    }
    catch (err) {
        return { ok: false, error: err?.message || String(err) };
    }
    finally {
        try {
            win.destroy();
        }
        catch { /* swallow */ }
    }
}
