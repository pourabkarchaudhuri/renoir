import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchExportImage } from '../../electron/export/image-assets';

describe('fetchExportImage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'renoir-export-img-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('decodes inline data URLs', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const src = `data:image/png;base64,${png.toString('base64')}`;
    const result = await fetchExportImage(src);
    expect(result?.mime).toBe('image/png');
    expect(result?.data.byteLength).toBe(png.length);
  });

  it('resolves renoir-asset:// with an absolute file path', async () => {
    const filePath = path.join(tmpDir, 'hero.png');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    fs.writeFileSync(filePath, bytes);

    const result = await fetchExportImage(`renoir-asset://${filePath}`);
    expect(result?.mime).toBe('image/png');
    expect(result?.data).toEqual(Uint8Array.from(bytes));
  });

  it('resolves renoir-asset:// relative to the project workspace root', async () => {
    const imagesDir = path.join(tmpDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    const filePath = path.join(imagesDir, 'hero.png');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    fs.writeFileSync(filePath, bytes);

    const result = await fetchExportImage('renoir-asset://images/hero.png', tmpDir);
    expect(result?.mime).toBe('image/png');
    expect(result?.data).toEqual(Uint8Array.from(bytes));
  });

  it('returns null for missing renoir-asset files', async () => {
    const result = await fetchExportImage('renoir-asset://images/missing.png', tmpDir);
    expect(result).toBeNull();
  });
});
