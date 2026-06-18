// Detached preview window — re-renders the latest artifact whenever the
// renderer broadcasts an update. Lives until the user closes it.
import { BrowserWindow } from 'electron';
let detached = null;
export function ensurePreviewWindow(html) {
    if (detached && !detached.isDestroyed()) {
        detached.webContents.send('renoir:preview:set', html);
        detached.focus();
        return { ok: true };
    }
    detached = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Renoir Preview',
        backgroundColor: '#0c0e14',
        autoHideMenuBar: true,
        webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Tiny shell that listens for IPC and renders the artifact in an iframe.
    // Loaded as a data URL so we don't depend on any packaged assets.
    const shell = `<!doctype html>
<html><head><meta charset="utf-8"><title>Renoir Preview</title>
<style>
  *,*::before,*::after { box-sizing: border-box; }
  html { overflow: hidden; height: 100%; }
  body {
    margin: 0; padding: 0;
    width: 100vw; height: 100vh;
    overflow: hidden;
    background: #0c0e14;
    color: #e8eaef;
  }
  /* Hide the native scrollbar — content scrolls inside the iframe instead. */
  html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
  iframe {
    display: block;
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    border: 0;
    background: white;
  }
</style></head>
<body>
  <iframe id="frame" sandbox="allow-scripts" srcdoc=""></iframe>
  <script>
    let last = '';
    setInterval(() => {
      const cur = window.__renoir_preview_html;
      if (typeof cur === 'string' && cur !== last) {
        last = cur;
        document.getElementById('frame').srcdoc = cur;
      }
    }, 250);
  </script>
</body></html>`;
    void detached.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(shell));
    detached.on('closed', () => { detached = null; });
    // Push initial html via executeJavaScript once loaded
    detached.webContents.once('did-finish-load', () => {
        if (!detached)
            return;
        void detached.webContents.executeJavaScript(`window.__renoir_preview_html = ${JSON.stringify(html)};`);
    });
    return { ok: true };
}
export function pushPreviewHtml(html) {
    if (!detached || detached.isDestroyed())
        return;
    void detached.webContents.executeJavaScript(`window.__renoir_preview_html = ${JSON.stringify(html)};`);
}
export function isPreviewOpen() {
    return Boolean(detached && !detached.isDestroyed());
}
