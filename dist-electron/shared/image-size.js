/**
 * Image generation size helpers.
 * Hard rule: neither width nor height may exceed MAX_IMAGE_DIMENSION.
 */
export const MAX_IMAGE_DIMENSION = 1024;
/** Azure / Foundry sizes that satisfy the max-1024-per-axis rule. */
export const SAFE_IMAGE_SIZES = ['1024x1024'];
/**
 * Scale width/height so neither axis exceeds `max`, preserving aspect ratio.
 * Already-safe sizes are returned unchanged.
 */
export function scaleToMaxDimension(width, height, max = MAX_IMAGE_DIMENSION) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w <= max && h <= max)
        return { width: w, height: h };
    const scale = Math.min(max / w, max / h);
    return {
        width: Math.max(1, Math.round(w * scale)),
        height: Math.max(1, Math.round(h * scale)),
    };
}
/**
 * Parse a size string like "1536x1024" or "auto".
 * Returns null for unparseable / auto values.
 */
export function parseImageSize(size) {
    if (!size || size === 'auto')
        return null;
    const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim());
    if (!m)
        return null;
    const width = Number(m[1]);
    const height = Number(m[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
        return null;
    }
    return { width, height };
}
/**
 * Clamp any requested generation size so neither axis exceeds MAX_IMAGE_DIMENSION.
 * Azure discrete sizes larger than the limit (1024×1536 / 1536×1024) map to 1024×1024.
 * `auto` and unknown values also resolve to 1024×1024.
 */
export function clampImageSize(size) {
    const parsed = parseImageSize(size);
    if (!parsed)
        return '1024x1024';
    const clamped = scaleToMaxDimension(parsed.width, parsed.height);
    // Only 1024×1024 is both an Azure size and within the per-axis cap.
    if (clamped.width <= MAX_IMAGE_DIMENSION && clamped.height <= MAX_IMAGE_DIMENSION) {
        if (clamped.width === 1024 && clamped.height === 1024)
            return '1024x1024';
    }
    return '1024x1024';
}
/** True when a size string would exceed the per-axis maximum before clamping. */
export function exceedsMaxImageDimension(size) {
    const parsed = parseImageSize(size);
    if (!parsed)
        return false;
    return parsed.width > MAX_IMAGE_DIMENSION || parsed.height > MAX_IMAGE_DIMENSION;
}
