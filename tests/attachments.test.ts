import { describe, it, expect } from 'vitest';
import { classify, checkExtensionSafe, summarizeAttachments, Attachment } from '../src/lib/attachments';

describe('classify', () => {
  describe('diagram classification', () => {
    it('classifies .mmd files as diagram', () => {
      expect(classify('flowchart.mmd', 'text/plain')).toEqual({ kind: 'diagram' });
    });

    it('classifies .mmd files as diagram regardless of mime type', () => {
      expect(classify('diagram.mmd', '')).toEqual({ kind: 'diagram' });
      expect(classify('diagram.mmd', 'application/octet-stream')).toEqual({ kind: 'diagram' });
    });

    it('classifies .mmd case-insensitively via extension', () => {
      expect(classify('chart.MMD', 'text/plain')).toEqual({ kind: 'diagram' });
      expect(classify('chart.Mmd', '')).toEqual({ kind: 'diagram' });
    });
  });

  describe('dangerous extension rejection', () => {
    it('rejects .mmd.exe as dangerous', () => {
      const result = classify('file.mmd.exe', 'text/plain');
      expect(result.kind).toBeNull();
      expect(result.reason).toContain('exe');
    });

    it('rejects .mmd.bat as dangerous', () => {
      const result = classify('diagram.mmd.bat', 'text/plain');
      expect(result.kind).toBeNull();
      expect(result.reason).toContain('bat');
    });

    it('rejects .exe.mmd as dangerous (intermediate dangerous extension)', () => {
      const result = classify('file.exe.mmd', 'text/plain');
      expect(result.kind).toBeNull();
    });
  });

  describe('existing classification preservation', () => {
    it('classifies .png as image', () => {
      expect(classify('photo.png', 'image/png')).toEqual({ kind: 'image' });
    });

    it('classifies .jpg as image', () => {
      expect(classify('photo.jpg', 'image/jpeg')).toEqual({ kind: 'image' });
    });

    it('classifies .ts as text', () => {
      expect(classify('index.ts', 'text/plain')).toEqual({ kind: 'text' });
    });

    it('classifies .md as text', () => {
      expect(classify('readme.md', 'text/markdown')).toEqual({ kind: 'text' });
    });

    it('classifies .json as text', () => {
      expect(classify('config.json', 'application/json')).toEqual({ kind: 'text' });
    });

    it('classifies unknown text/* mime as text', () => {
      expect(classify('file.unknown', 'text/csv')).toEqual({ kind: 'text' });
    });

    it('rejects unsupported file types', () => {
      const result = classify('file.xyz', 'application/octet-stream');
      expect(result.kind).toBeNull();
    });
  });
});

describe('summarizeAttachments', () => {
  it('formats diagram attachments as [diagram · name · size]', () => {
    const attachments: Attachment[] = [
      { id: '1', name: 'flowchart.mmd', mime: 'text/vnd.mermaid', size: 256, kind: 'diagram', text: 'graph TD\n  A-->B' },
    ];
    const result = summarizeAttachments(attachments);
    expect(result).toBe('[diagram · flowchart.mmd · 256 B]');
  });

  it('formats mixed attachments correctly', () => {
    const attachments: Attachment[] = [
      { id: '1', name: 'photo.png', mime: 'image/png', size: 1024, kind: 'image', dataUrl: 'data:image/png;base64,abc' },
      { id: '2', name: 'flowchart.mmd', mime: 'text/vnd.mermaid', size: 512, kind: 'diagram', text: 'graph TD' },
      { id: '3', name: 'notes.txt', mime: 'text/plain', size: 100, kind: 'text', text: 'hello' },
    ];
    const result = summarizeAttachments(attachments);
    const lines = result.split('\n');
    expect(lines[0]).toBe('[image · photo.png · image/png · 1.0 KB]');
    expect(lines[1]).toBe('[diagram · flowchart.mmd · 512 B]');
    expect(lines[2]).toBe('[text · notes.txt · 100 B]');
  });

  it('returns empty string for no attachments', () => {
    expect(summarizeAttachments([])).toBe('');
  });
});
