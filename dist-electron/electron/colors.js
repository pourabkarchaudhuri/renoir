// Extract a dominant-color palette from an image. Uses Electron's nativeImage
// to decode (PNG/JPEG/WebP/GIF), downsamples to a tiny bitmap, then runs a
// simple k-means in RGB space and converts the centroids to OKLch.
import { nativeImage } from 'electron';
function rgbToOklch(r, g, b) {
    // sRGB → linear
    const s2l = (v) => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    const lr = s2l(r), lg = s2l(g), lb = s2l(b);
    // linear → OKLab (per Björn Ottosson)
    const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    const c = Math.sqrt(a * a + b_ * b_);
    let h = (Math.atan2(b_, a) * 180) / Math.PI;
    if (h < 0)
        h += 360;
    return `oklch(${L.toFixed(2)} ${c.toFixed(2)} ${Math.round(h)})`;
}
function rgbToHex(r, g, b) {
    const t = (n) => n.toString(16).padStart(2, '0');
    return `#${t(r)}${t(g)}${t(b)}`;
}
function kmeans(pixels, k, maxIter = 12) {
    if (pixels.length === 0)
        return [];
    // Seed via spaced sampling
    const seeds = [];
    const step = Math.max(1, Math.floor(pixels.length / k));
    for (let i = 0; i < k; i++)
        seeds.push({ ...pixels[(i * step) % pixels.length] });
    let centroids = seeds;
    for (let iter = 0; iter < maxIter; iter++) {
        const buckets = Array.from({ length: k }, () => []);
        for (const p of pixels) {
            let best = 0;
            let bestD = Infinity;
            for (let j = 0; j < centroids.length; j++) {
                const c = centroids[j];
                const d = (c.r - p.r) ** 2 + (c.g - p.g) ** 2 + (c.b - p.b) ** 2;
                if (d < bestD) {
                    bestD = d;
                    best = j;
                }
            }
            buckets[best].push(p);
        }
        let moved = 0;
        centroids = centroids.map((c, j) => {
            const bucket = buckets[j];
            if (bucket.length === 0)
                return c;
            let r = 0, g = 0, b = 0;
            for (const p of bucket) {
                r += p.r;
                g += p.g;
                b += p.b;
            }
            const next = {
                r: Math.round(r / bucket.length),
                g: Math.round(g / bucket.length),
                b: Math.round(b / bucket.length),
            };
            if (Math.abs(next.r - c.r) + Math.abs(next.g - c.g) + Math.abs(next.b - c.b) > 2)
                moved++;
            return next;
        });
        if (moved === 0)
            break;
    }
    // Sort by luminance for a pleasing strip
    centroids.sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b));
    return centroids;
}
export function extractPalette(req) {
    try {
        const buf = Buffer.from(req.imageBase64, 'base64');
        let img = nativeImage.createFromBuffer(buf);
        if (img.isEmpty())
            return { ok: false, error: 'unsupported or empty image' };
        img = img.resize({ width: 96, quality: 'good' });
        const bitmap = img.toBitmap(); // BGRA on macOS/Linux, BGRA on Windows too
        const size = img.getSize();
        const w = size.width, h = size.height;
        const pixels = [];
        for (let i = 0; i + 3 < bitmap.length; i += 4) {
            // BGRA — bitmap[i]=B, bitmap[i+1]=G, bitmap[i+2]=R, bitmap[i+3]=A
            const a = bitmap[i + 3];
            if (a < 200)
                continue;
            pixels.push({ r: bitmap[i + 2], g: bitmap[i + 1], b: bitmap[i] });
        }
        if (pixels.length === 0)
            return { ok: false, error: 'no opaque pixels' };
        void w;
        void h;
        const k = Math.max(3, Math.min(8, req.k ?? 6));
        const centroids = kmeans(pixels, k);
        const swatches = centroids.map((c) => rgbToOklch(c.r, c.g, c.b));
        const hexes = centroids.map((c) => rgbToHex(c.r, c.g, c.b));
        return { ok: true, swatches, hexes };
    }
    catch (err) {
        return { ok: false, error: err?.message || String(err) };
    }
}
