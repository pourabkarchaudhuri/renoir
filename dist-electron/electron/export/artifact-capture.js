/**
 * Offscreen artifact raster capture for skill exports.
 * Supports present (multi-frame), fullpage, and viewport modes.
 */
import { BrowserWindow } from 'electron';
import { inlineResolvableImagesInHtml } from '../../shared/export/inline-export-images.js';
import { wrapForExportCapture, EXPORT_CAPTURE_FREEZE_SCRIPT, EXPORT_SLIDE_FREEZE_FN, } from '../../shared/preview-nav-bridge.js';
import { loadHtmlIntoWindow } from '../load-html.js';
const DEFAULT_W = 1280;
const DEFAULT_H = 720;
const NAV_SETTLE_MS = 80;
const FREEZE_SETTLE_MS = 50;
const LOAD_SETTLE_MS = 400;
const MAX_FULLPAGE_H = 40_000;
/** 2× raster capture for sharp exports. */
export const EXPORT_CAPTURE_SCALE = 2;
const FULLPAGE_FREEZE_SCRIPT = `(function () {
  if (typeof freezeActiveSlideForCapture === 'function') {
    freezeActiveSlideForCapture();
  } else {
    ${EXPORT_SLIDE_FREEZE_FN}
    freezeActiveSlideForCapture();
  }
  var STYLE_ID = '__renoir_fullpage_freeze';
  var st = document.getElementById(STYLE_ID);
  if (!st) {
    st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = '*{animation:none!important;transition:none!important;}';
    document.head.appendChild(st);
  }
  document.querySelectorAll('[class*="anim-"], .anim-stagger-list > *').forEach(function (el) {
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('filter', 'none', 'important');
    el.style.setProperty('clip-path', 'none', 'important');
  });
})();`;
async function prepareCaptureHtml(doc, ctx) {
    const raw = doc.captureHtml ?? doc.previewHtml ?? '';
    if (!raw.trim())
        throw new Error('No HTML available for capture.');
    const fetchImage = ctx.assets?.fetchImage;
    const inlined = fetchImage
        ? await inlineResolvableImagesInHtml(raw, fetchImage)
        : raw;
    if (doc.captureMode === 'present') {
        if (inlined.includes('id="__renoir_mode_style"') || inlined.includes('renoir:nav-state')) {
            return inlined;
        }
        return wrapForExportCapture(inlined);
    }
    return inlined;
}
async function querySlideCount(win) {
    const count = await win.webContents.executeJavaScript(`
    (function () {
      var slides = document.querySelectorAll('[data-slide], section.slide, .deck > section, [data-screen-id]');
      return Math.max(1, slides.length || 1);
    })();
  `);
    return Math.max(1, Number(count) || 1);
}
async function waitForSlidePaint(win) {
    await win.webContents.executeJavaScript(`
    (async function () {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise(function (r) {
        requestAnimationFrame(function () { requestAnimationFrame(r); });
      });
    })();
  `);
}
function createCaptureWindow(width, height) {
    return new BrowserWindow({
        show: false,
        width,
        height,
        webPreferences: {
            offscreen: true,
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
}
async function freezeForCapture(win, mode) {
    const script = mode === 'present' ? EXPORT_CAPTURE_FREEZE_SCRIPT : FULLPAGE_FREEZE_SCRIPT;
    await win.webContents.executeJavaScript(script);
    await new Promise((r) => setTimeout(r, FREEZE_SETTLE_MS));
}
/** Capture a rectangular region as PNG, optionally at higher pixel density. */
async function captureRegionPng(win, width, height, scaleFactor, captureBeyondViewport = false) {
    if (scaleFactor <= 1) {
        await waitForSlidePaint(win);
        const img = await win.webContents.capturePage({ x: 0, y: 0, width, height });
        return img.toPNG();
    }
    const wc = win.webContents;
    const dbg = wc.debugger;
    let attached = false;
    try {
        if (!dbg.isAttached()) {
            dbg.attach('1.3');
            attached = true;
        }
        await dbg.sendCommand('Page.enable');
        await waitForSlidePaint(win);
        const result = await dbg.sendCommand('Page.captureScreenshot', {
            format: 'png',
            fromSurface: true,
            captureBeyondViewport,
            clip: { x: 0, y: 0, width, height, scale: scaleFactor },
        });
        return Buffer.from(result.data, 'base64');
    }
    catch {
        await wc.enableDeviceEmulation({
            screenPosition: 'desktop',
            screenSize: { width, height },
            viewPosition: { x: 0, y: 0 },
            deviceScaleFactor: scaleFactor,
            viewSize: { width, height },
            scale: 1,
        });
        try {
            await waitForSlidePaint(win);
            const img = await wc.capturePage({ x: 0, y: 0, width, height });
            return img.toPNG();
        }
        finally {
            try {
                wc.disableDeviceEmulation();
            }
            catch { /* swallow */ }
        }
    }
    finally {
        if (attached) {
            try {
                dbg.detach();
            }
            catch { /* swallow */ }
        }
    }
}
/** Capture each slide/screen in present mode as a PNG buffer. */
export async function capturePresentSlides(opts) {
    const width = opts.width ?? DEFAULT_W;
    const height = opts.height ?? DEFAULT_H;
    const scaleFactor = opts.scaleFactor ?? 1;
    const extraSettleMs = opts.settleMs ?? 0;
    const win = createCaptureWindow(width, height);
    const out = [];
    try {
        await loadHtmlIntoWindow(win, opts.html);
        await new Promise((r) => setTimeout(r, LOAD_SETTLE_MS));
        await win.webContents.executeJavaScript(`window.postMessage({ type: 'renoir:set-mode', mode: 'present' }, '*');`);
        await new Promise((r) => setTimeout(r, 200));
        const total = Math.max(1, opts.slideCount ?? await querySlideCount(win));
        for (let i = 0; i < total; i += 1) {
            await win.webContents.executeJavaScript(`window.postMessage({ type: 'renoir:nav', idx: ${i} }, '*');`);
            await new Promise((r) => setTimeout(r, NAV_SETTLE_MS));
            await freezeForCapture(win, 'present');
            if (extraSettleMs > 0) {
                await new Promise((r) => setTimeout(r, extraSettleMs));
            }
            out.push(await captureRegionPng(win, width, height, scaleFactor));
        }
    }
    finally {
        try {
            win.destroy();
        }
        catch { /* swallow */ }
    }
    return out;
}
async function captureFullPagePng(html, width, scaleFactor) {
    const win = createCaptureWindow(width, DEFAULT_H);
    try {
        await loadHtmlIntoWindow(win, html);
        await new Promise((r) => setTimeout(r, LOAD_SETTLE_MS));
        await freezeForCapture(win, 'fullpage');
        const height = await win.webContents.executeJavaScript(`
      Math.min(${MAX_FULLPAGE_H}, Math.max(
        document.documentElement.scrollHeight || 0,
        document.body.scrollHeight || 0,
        document.documentElement.clientHeight || 0,
        ${DEFAULT_H}
      ));
    `);
        const h = Math.max(DEFAULT_H, Math.round(Number(height) || DEFAULT_H));
        return captureRegionPng(win, width, h, scaleFactor, true);
    }
    finally {
        try {
            win.destroy();
        }
        catch { /* swallow */ }
    }
}
async function captureViewportPng(html, width, height, scaleFactor) {
    const win = createCaptureWindow(width, height);
    try {
        await loadHtmlIntoWindow(win, html);
        await new Promise((r) => setTimeout(r, LOAD_SETTLE_MS));
        await freezeForCapture(win, 'viewport');
        return captureRegionPng(win, width, height, scaleFactor);
    }
    finally {
        try {
            win.destroy();
        }
        catch { /* swallow */ }
    }
}
/** Raster-capture an export document according to its capture profile. */
export async function captureArtifactPngs(doc, ctx) {
    const html = await prepareCaptureHtml(doc, ctx);
    const mode = doc.captureMode ?? 'present';
    const width = doc.captureWidth ?? DEFAULT_W;
    const height = doc.captureHeight ?? DEFAULT_H;
    const scaleFactor = EXPORT_CAPTURE_SCALE;
    switch (mode) {
        case 'present':
            return capturePresentSlides({
                html,
                width,
                height,
                slideCount: doc.slideCount,
                scaleFactor,
            });
        case 'fullpage':
            return [await captureFullPagePng(html, width, scaleFactor)];
        case 'viewport':
            return [await captureViewportPng(html, width, height, scaleFactor)];
        default:
            return capturePresentSlides({ html, width, height, slideCount: doc.slideCount, scaleFactor });
    }
}
/** @deprecated Use captureArtifactPngs */
export async function captureDeckSlidePngs(doc, ctx) {
    return captureArtifactPngs(doc, ctx);
}
/** Read PNG dimensions from IHDR chunk. */
export function pngDimensions(buf) {
    if (buf.length < 24)
        return { width: DEFAULT_W, height: DEFAULT_H };
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
