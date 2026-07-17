import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  MAX_IMAGE_DIMENSION,
  clampImageSize,
  exceedsMaxImageDimension,
  parseImageSize,
  scaleToMaxDimension,
} from '../shared/image-size';

describe('scaleToMaxDimension', () => {
  it('leaves safe sizes unchanged', () => {
    expect(scaleToMaxDimension(800, 600)).toEqual({ width: 800, height: 600 });
    expect(scaleToMaxDimension(1024, 1024)).toEqual({ width: 1024, height: 1024 });
  });

  it('scales landscape down proportionally', () => {
    expect(scaleToMaxDimension(1536, 1024)).toEqual({ width: 1024, height: 683 });
  });

  it('scales portrait down proportionally', () => {
    expect(scaleToMaxDimension(1024, 1536)).toEqual({ width: 683, height: 1024 });
  });

  it('never exceeds max on either axis', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8000 }),
        fc.integer({ min: 1, max: 8000 }),
        (w, h) => {
          const out = scaleToMaxDimension(w, h);
          expect(out.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
          expect(out.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('clampImageSize', () => {
  it('maps oversized Azure sizes to 1024x1024', () => {
    expect(clampImageSize('1536x1024')).toBe('1024x1024');
    expect(clampImageSize('1024x1536')).toBe('1024x1024');
  });

  it('keeps 1024x1024', () => {
    expect(clampImageSize('1024x1024')).toBe('1024x1024');
  });

  it('defaults auto / undefined / unknown to 1024x1024', () => {
    expect(clampImageSize('auto')).toBe('1024x1024');
    expect(clampImageSize(undefined)).toBe('1024x1024');
    expect(clampImageSize('not-a-size')).toBe('1024x1024');
  });

  it('always returns a size within the per-axis cap', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom('1024x1024', '1024x1536', '1536x1024', 'auto', undefined, null),
          fc.tuple(fc.integer({ min: 1, max: 4000 }), fc.integer({ min: 1, max: 4000 })).map(
            ([w, h]) => `${w}x${h}`
          )
        ),
        (size) => {
          const clamped = clampImageSize(size as string | null | undefined);
          const parsed = parseImageSize(clamped)!;
          expect(parsed.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
          expect(parsed.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('exceedsMaxImageDimension', () => {
  it('detects oversized requests', () => {
    expect(exceedsMaxImageDimension('1536x1024')).toBe(true);
    expect(exceedsMaxImageDimension('1024x1024')).toBe(false);
    expect(exceedsMaxImageDimension('auto')).toBe(false);
  });
});
