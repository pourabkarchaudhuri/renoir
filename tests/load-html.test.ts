import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadHtmlIntoWindow } from '../electron/load-html';

type FakeWindow = {
  loadURL: (url: string) => Promise<void>;
  loadFile: (filePath: string) => Promise<void>;
  on: (event: string, cb: () => void) => void;
};

const cleanupDirs = new Set<string>();

afterEach(async () => {
  await Promise.all([...cleanupDirs].map((dir) => fs.rm(dir, { recursive: true, force: true })));
  cleanupDirs.clear();
});

describe('loadHtmlIntoWindow', () => {
  it('falls back to a temp file for oversized data URLs', async () => {
    let closedHandler: (() => void) | undefined;
    let fileLoaded = '';

    const win: FakeWindow = {
      async loadURL() {
        throw new Error("ERR_INVALID_URL (-300) loading 'data:text/html,...'");
      },
      async loadFile(filePath) {
        fileLoaded = filePath;
      },
      on(event, cb) {
        if (event === 'closed') closedHandler = cb;
      },
    };

    await loadHtmlIntoWindow(win as never, '<!doctype html><html><body>ok</body></html>');

    expect(fileLoaded).toMatch(/index\.html$/);
    cleanupDirs.add(path.dirname(fileLoaded));
    await expect(fs.readFile(fileLoaded, 'utf8')).resolves.toContain('<body>ok</body>');
    expect(closedHandler).toBeTypeOf('function');
  });

  it('rethrows non URL failures', async () => {
    const win: FakeWindow = {
      async loadURL() {
        throw new Error('boom');
      },
      async loadFile() {
        throw new Error('should not reach loadFile');
      },
      on() {},
    };

    await expect(loadHtmlIntoWindow(win as never, '<html></html>')).rejects.toThrow('boom');
  });
});
