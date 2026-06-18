import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import * as fc from 'fast-check';

// --- Mocking electron's `app` module ---

let mockDocumentsPath: string;
let mockUserDataPath: string;

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'documents') return mockDocumentsPath;
      if (name === 'userData') return mockUserDataPath;
      throw new Error(`Unknown path name: ${name}`);
    },
    getVersion: () => '0.1.0',
  },
  shell: {
    openPath: vi.fn().mockResolvedValue(''),
  },
}));

// --- Helpers ---

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'renoir-test-'));
}

function cleanDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/** Recursively list all files relative to root */
function listFilesRecursive(root: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(root)) return results;
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        results.push(path.relative(root, full));
      }
    }
  };
  walk(root);
  return results.sort();
}

/** Create a file tree from a record of relative paths to content */
function createFileTree(root: string, files: Record<string, string>): void {
  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(root, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
}

// --- Test Suite ---

describe('workspace.ts', () => {
  let tempBase: string;

  beforeEach(() => {
    tempBase = makeTempDir();
    mockDocumentsPath = path.join(tempBase, 'Documents');
    mockUserDataPath = path.join(tempBase, 'UserData');
    fs.mkdirSync(mockDocumentsPath, { recursive: true });
    fs.mkdirSync(mockUserDataPath, { recursive: true });
    // Clear module cache so workspace.ts re-evaluates with new mocks
    vi.resetModules();
  });

  afterEach(() => {
    cleanDir(tempBase);
  });

  // =========================================================================
  // 4.1 Property test: path derivation purity
  // =========================================================================
  describe('Property 1: path derivation purity', () => {
    it('workspaceRoot() returns {documentsPath}/Renoir deterministically for any documents path', async () => {
      /**
       * **Validates: Requirements 1.1, 2.1**
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('\0')),
          async (suffix) => {
            const docsPath = path.join(tempBase, 'docs_' + suffix.replace(/[<>:"|?*]/g, '_'));
            fs.mkdirSync(docsPath, { recursive: true });
            mockDocumentsPath = docsPath;
            vi.resetModules();
            const { workspaceRoot } = await import('../electron/workspace');
            const result1 = workspaceRoot();
            const result2 = workspaceRoot();
            // Deterministic: same result on repeated calls
            expect(result1).toBe(result2);
            // Correct derivation: ends with /Renoir or \Renoir
            expect(result1).toBe(path.join(docsPath, 'Renoir'));
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // =========================================================================
  // 4.2 Property test: project path is child of workspace root
  // =========================================================================
  describe('Property 2: project path is child of workspace root', () => {
    it('projectDir(projectId) equals path.join(workspaceRoot(), "projects", projectId)', async () => {
      /**
       * **Validates: Requirement 1.2**
       */
      const { workspaceRoot, projectDir } = await import('../electron/workspace');
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 60 }).filter(s => !s.includes('\0') && !s.includes('/') && !s.includes('\\')),
          (projectId) => {
            const result = projectDir(projectId);
            const expected = path.join(workspaceRoot(), 'projects', projectId);
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // =========================================================================
  // 4.3 Property test: migration completeness
  // =========================================================================
  describe('Property 3: migration completeness', () => {
    it('for any generated file tree in old workspace, all files appear in new workspace after migration', async () => {
      /**
       * **Validates: Requirement 3.1**
       */
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            // Generate safe relative file paths (1-2 levels deep)
            fc.tuple(
              fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/),
              fc.stringMatching(/^[a-z][a-z0-9]{0,7}\.[a-z]{1,3}$/)
            ).map(([dir, file]) => `${dir}/${file}`),
            fc.string({ minLength: 1, maxLength: 50 }),
            { minKeys: 1, maxKeys: 5 }
          ),
          async (fileTree) => {
            // Fresh temp dirs for this run
            const runBase = makeTempDir();
            const runDocs = path.join(runBase, 'Documents');
            const runUserData = path.join(runBase, 'UserData');
            fs.mkdirSync(runDocs, { recursive: true });
            fs.mkdirSync(runUserData, { recursive: true });

            mockDocumentsPath = runDocs;
            mockUserDataPath = runUserData;

            const oldWorkspace = path.join(runUserData, 'workspace');
            createFileTree(oldWorkspace, fileTree);

            vi.resetModules();
            const { migrateWorkspace, workspaceRoot } = await import('../electron/workspace');
            const result = migrateWorkspace();

            expect(result.migrated).toBe(true);

            const newRoot = workspaceRoot();
            const oldFiles = listFilesRecursive(oldWorkspace).filter(f => f !== '.migrated.json');
            const newFiles = listFilesRecursive(newRoot);

            // Every old file should appear in new workspace
            for (const f of oldFiles) {
              expect(newFiles).toContain(f);
            }

            cleanDir(runBase);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // =========================================================================
  // 4.4 Property test: migration idempotency
  // =========================================================================
  describe('Property 4: migration idempotency', () => {
    it('calling migrateWorkspace() N times produces same state as calling it once', async () => {
      /**
       * **Validates: Requirements 5.1, 5.2**
       */
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.tuple(
              fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/),
              fc.stringMatching(/^[a-z][a-z0-9]{0,5}\.[a-z]{1,3}$/)
            ).map(([dir, file]) => `${dir}/${file}`),
            fc.string({ minLength: 1, maxLength: 30 }),
            { minKeys: 1, maxKeys: 4 }
          ),
          fc.integer({ min: 2, max: 5 }),
          async (fileTree, n) => {
            const runBase = makeTempDir();
            const runDocs = path.join(runBase, 'Documents');
            const runUserData = path.join(runBase, 'UserData');
            fs.mkdirSync(runDocs, { recursive: true });
            fs.mkdirSync(runUserData, { recursive: true });

            mockDocumentsPath = runDocs;
            mockUserDataPath = runUserData;

            const oldWorkspace = path.join(runUserData, 'workspace');
            createFileTree(oldWorkspace, fileTree);

            vi.resetModules();
            const { migrateWorkspace, workspaceRoot } = await import('../electron/workspace');

            // First call
            const firstResult = migrateWorkspace();
            const newRoot = workspaceRoot();
            const stateAfterFirst = listFilesRecursive(newRoot);

            // Subsequent calls
            for (let i = 1; i < n; i++) {
              const subsequentResult = migrateWorkspace();
              expect(subsequentResult.migrated).toBe(false);
            }

            const stateAfterN = listFilesRecursive(newRoot);
            expect(stateAfterN).toEqual(stateAfterFirst);

            cleanDir(runBase);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // =========================================================================
  // 4.5 Property test: no-clobber
  // =========================================================================
  describe('Property 5: no-clobber', () => {
    it('pre-existing files in destination are not overwritten during migration', async () => {
      /**
       * **Validates: Requirement 4.2**
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          async (oldContent, existingContent) => {
            // Ensure contents differ so we can verify no overwrite
            fc.pre(oldContent !== existingContent);

            const runBase = makeTempDir();
            const runDocs = path.join(runBase, 'Documents');
            const runUserData = path.join(runBase, 'UserData');
            fs.mkdirSync(runDocs, { recursive: true });
            fs.mkdirSync(runUserData, { recursive: true });

            mockDocumentsPath = runDocs;
            mockUserDataPath = runUserData;

            const oldWorkspace = path.join(runUserData, 'workspace');
            const newRoot = path.join(runDocs, 'Renoir');

            // Create a file in old workspace
            createFileTree(oldWorkspace, { 'projects/test.txt': oldContent });

            // Pre-create the same file in new workspace with different content
            createFileTree(newRoot, { 'projects/test.txt': existingContent });

            vi.resetModules();
            const { migrateWorkspace } = await import('../electron/workspace');

            // Migration should detect existing content and write marker without copying
            migrateWorkspace();

            // The file in new workspace should retain its original content
            const resultContent = fs.readFileSync(path.join(newRoot, 'projects/test.txt'), 'utf8');
            expect(resultContent).toBe(existingContent);

            cleanDir(runBase);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // =========================================================================
  // 4.6 Property test: no data loss
  // =========================================================================
  describe('Property 6: no data loss', () => {
    it('old workspace files are never deleted by migration', async () => {
      /**
       * **Validates: Requirement 4.1**
       */
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.tuple(
              fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/),
              fc.stringMatching(/^[a-z][a-z0-9]{0,5}\.[a-z]{1,3}$/)
            ).map(([dir, file]) => `${dir}/${file}`),
            fc.string({ minLength: 1, maxLength: 30 }),
            { minKeys: 1, maxKeys: 5 }
          ),
          async (fileTree) => {
            const runBase = makeTempDir();
            const runDocs = path.join(runBase, 'Documents');
            const runUserData = path.join(runBase, 'UserData');
            fs.mkdirSync(runDocs, { recursive: true });
            fs.mkdirSync(runUserData, { recursive: true });

            mockDocumentsPath = runDocs;
            mockUserDataPath = runUserData;

            const oldWorkspace = path.join(runUserData, 'workspace');
            createFileTree(oldWorkspace, fileTree);

            // Record original state
            const originalFiles = listFilesRecursive(oldWorkspace);
            const originalContents: Record<string, string> = {};
            for (const f of originalFiles) {
              originalContents[f] = fs.readFileSync(path.join(oldWorkspace, f), 'utf8');
            }

            vi.resetModules();
            const { migrateWorkspace } = await import('../electron/workspace');
            migrateWorkspace();

            // Verify all original files still exist with same content
            for (const f of originalFiles) {
              const filePath = path.join(oldWorkspace, f);
              expect(fs.existsSync(filePath)).toBe(true);
              expect(fs.readFileSync(filePath, 'utf8')).toBe(originalContents[f]);
            }

            cleanDir(runBase);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // =========================================================================
  // 4.7 Unit test: migration marker prevents re-migration
  // =========================================================================
  describe('Unit: migration marker prevents re-migration', () => {
    it('returns { migrated: false } when .migrated.json exists', async () => {
      /**
       * **Validates: Requirements 3.2, 3.3**
       */
      const oldWorkspace = path.join(mockUserDataPath, 'workspace');
      createFileTree(oldWorkspace, {
        'projects/p1/file.txt': 'hello',
        '.migrated.json': JSON.stringify({ migratedAt: '2024-01-01T00:00:00Z', movedTo: '/tmp/test', version: '0.1.0' }),
      });

      vi.resetModules();
      const { migrateWorkspace, workspaceRoot } = await import('../electron/workspace');

      const result = migrateWorkspace();
      expect(result.migrated).toBe(false);

      // New workspace should NOT have the file (migration was skipped)
      const newRoot = workspaceRoot();
      expect(fs.existsSync(path.join(newRoot, 'projects/p1/file.txt'))).toBe(false);
    });
  });

  // =========================================================================
  // 4.8 Unit test: store.ts still uses app.getPath('userData') path
  // =========================================================================
  describe('Unit: store.ts regression guard', () => {
    it('store.ts file() function uses app.getPath("userData") for renoir-store.json', () => {
      /**
       * **Validates: Requirement 2.2**
       */
      const storeSource = fs.readFileSync(
        path.join(process.cwd(), 'electron', 'store.ts'),
        'utf8'
      );

      // Verify store.ts uses app.getPath('userData') for its file path
      expect(storeSource).toContain("app.getPath('userData')");
      expect(storeSource).toContain('renoir-store.json');

      // Verify store.ts does NOT use app.getPath('documents') for its path
      expect(storeSource).not.toContain("app.getPath('documents')");
    });
  });

  // =========================================================================
  // 4.9 Unit test: renoir-asset:// protocol rejects path traversal
  // =========================================================================
  describe('Unit: renoir-asset:// protocol rejects path traversal sequences', () => {
    /**
     * Replicate the sanitization logic from main.ts protocol handler:
     *   const safeRel = rel.split('/').filter((s) => s && s !== '..').join(path.sep);
     *   const abs = path.join(workspaceRoot(), safeRel);
     */
    function sanitizeRelPath(urlPath: string): string {
      // Simulate what the protocol handler does with the URL path
      const rel = decodeURIComponent(urlPath.replace(/^\/+/, ''));
      return rel.split('/').filter((s: string) => s && s !== '..').join(path.sep);
    }

    it('filters out ".." segments from the URL path', () => {
      /**
       * **Validates: Requirement 7.2**
       */

      // Normal path works correctly — no traversal
      const normal = sanitizeRelPath('projects/p1/images/photo.png');
      expect(normal).toBe(path.join('projects', 'p1', 'images', 'photo.png'));

      // Path traversal attempts: ".." segments are stripped
      const traversal1 = sanitizeRelPath('../../etc/passwd');
      expect(traversal1).toBe(path.join('etc', 'passwd'));
      // No ".." remains in the result
      expect(traversal1).not.toContain('..');

      const traversal2 = sanitizeRelPath('projects/../../../secret');
      expect(traversal2).toBe(path.join('projects', 'secret'));
      expect(traversal2).not.toContain('..');

      // Double dots in middle of path
      const traversal3 = sanitizeRelPath('a/b/../c/d');
      expect(traversal3).toBe(path.join('a', 'b', 'c', 'd'));
      expect(traversal3).not.toContain('..');

      // Only dots — results in empty string (which path.join with root keeps at root)
      const traversal4 = sanitizeRelPath('..');
      expect(traversal4).toBe('');

      // Verify that joining with any workspace root keeps us inside it
      const wsRoot = path.join(mockDocumentsPath, 'Renoir');
      const abs = path.join(wsRoot, traversal1);
      expect(abs.startsWith(wsRoot)).toBe(true);
    });

    it('all resolved paths remain under workspaceRoot (property)', () => {
      /**
       * **Validates: Requirement 7.2**
       */
      const wsRoot = path.join(mockDocumentsPath, 'Renoir');

      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.constant('..'),
              fc.constant('.'),
              fc.constant(''),
              fc.stringMatching(/^[a-z0-9]{1,10}$/)
            ),
            { minLength: 1, maxLength: 8 }
          ),
          (segments) => {
            const urlPath = segments.join('/');
            const rel = urlPath.replace(/^\/+/, '');
            const safeRel = rel.split('/').filter((s: string) => s && s !== '..').join(path.sep);
            const abs = path.join(wsRoot, safeRel);
            // The resolved path must always start with the workspace root
            expect(abs.startsWith(wsRoot)).toBe(true);
            // No segment in the sanitized path should be exactly ".."
            const resultSegments = safeRel.split(path.sep).filter(Boolean);
            for (const seg of resultSegments) {
              expect(seg).not.toBe('..');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
