import { describe, it, expect } from 'vitest';
import { zipBuffer, unzipBuffer } from '../electron/zipio';

describe('zipio round-trip', () => {
  it('writes and reads back text entries', () => {
    const entries = [
      { name: 'a.txt', data: Buffer.from('hello world', 'utf8') },
      { name: 'b/c.txt', data: Buffer.from('nested file', 'utf8') },
    ];
    const buf = zipBuffer(entries);
    const out = unzipBuffer(buf);
    expect(out).toHaveLength(2);
    const a = out.find((e) => e.name === 'a.txt')!;
    const c = out.find((e) => e.name === 'b/c.txt')!;
    expect(a.data.toString('utf8')).toBe('hello world');
    expect(c.data.toString('utf8')).toBe('nested file');
  });

  it('handles empty buffer', () => {
    const buf = zipBuffer([]);
    expect(buf.length).toBeGreaterThan(0);
    expect(unzipBuffer(buf)).toEqual([]);
  });

  it('handles large incompressible content', () => {
    const data = Buffer.from(
      Array.from({ length: 4096 }, () => Math.floor(Math.random() * 256)),
    );
    const buf = zipBuffer([{ name: 'rand.bin', data }]);
    const out = unzipBuffer(buf);
    expect(out[0].data.equals(data)).toBe(true);
  });
});
