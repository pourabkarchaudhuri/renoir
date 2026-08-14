import { inlineResolvableImagesInHtml } from '../../shared/export/inline-export-images.js';
import { wrapForExportCapture } from '../../shared/preview-nav-bridge.js';
import { zipBuffer } from '../zipio.js';
import { capturePresentSlides } from './slide-capture.js';
async function prepareCaptureHtml(doc, ctx) {
    const raw = doc.captureHtml ?? doc.previewHtml ?? '';
    if (!raw.trim())
        throw new Error('No HTML available for slide capture.');
    const fetchImage = ctx.assets?.fetchImage;
    const inlined = fetchImage
        ? await inlineResolvableImagesInHtml(raw, fetchImage)
        : raw;
    if (inlined.includes('id="__renoir_mode_style"') || inlined.includes('renoir:nav-state')) {
        return inlined;
    }
    return wrapForExportCapture(inlined);
}
export async function exportPngZip(doc, ctx) {
    const html = await prepareCaptureHtml(doc, ctx);
    const pngs = await capturePresentSlides({
        html,
        slideCount: doc.slideCount,
    });
    const entries = pngs.map((data, i) => ({
        name: `slide-${String(i + 1).padStart(2, '0')}.png`,
        data,
    }));
    return new Uint8Array(zipBuffer(entries));
}
export async function captureDeckSlidePngs(doc, ctx) {
    const html = await prepareCaptureHtml(doc, ctx);
    return capturePresentSlides({
        html,
        slideCount: doc.slideCount,
    });
}
