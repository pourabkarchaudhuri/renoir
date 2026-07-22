import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
function dataUrlForHtml(html) {
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
function shouldFallbackToTempFile(err) {
    const message = err instanceof Error ? err.message : String(err);
    return /ERR_INVALID_URL|ERR_INVALID_ARGUMENT/i.test(message);
}
async function writeTempHtml(html) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'renoir-html-'));
    const filePath = path.join(dir, 'index.html');
    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
}
/**
 * Load HTML into a BrowserWindow, falling back to a temp file when the
 * encoded data URL grows too large for Electron/Chromium to accept.
 */
export async function loadHtmlIntoWindow(win, html) {
    try {
        await win.loadURL(dataUrlForHtml(html));
        return;
    }
    catch (err) {
        if (!shouldFallbackToTempFile(err))
            throw err;
    }
    const tempPath = await writeTempHtml(html);
    win.on('closed', () => {
        void fs.rm(path.dirname(tempPath), { recursive: true, force: true });
    });
    await win.loadFile(tempPath);
}
