import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// ─── Mocks (must be declared before imports of the module under test) ────────

// Mock electron's app and BrowserWindow
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test' },
  BrowserWindow: { getAllWindows: () => [] },
}));

// Mock fs module
const mockExistsSync = vi.fn(() => true);
const mockReadFileSync = vi.fn(() => Buffer.from('fake-image-data'));
vi.mock('node:fs', () => ({
  default: {
    existsSync: (...args: any[]) => mockExistsSync(...args),
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
  },
}));

// Track concurrent calls for concurrency testing
let activeCalls = 0;
let maxConcurrentCalls = 0;
let totalApiCalls = 0;

// Mock generateImage — the source imports from './image.js' which resolves to electron/image.js
const mockGenerateImage = vi.fn();
vi.mock('../electron/image.js', () => ({
  generateImage: (...args: any[]) => mockGenerateImage(...args),
}));

// ─── Import module under test (after mocks) ─────────────────────────────────

import {
  batchGenerateImages,
  computePromptHash,
  clearAllCaches,
  getCacheForProject,
  type BatchImageRequest,
  type BatchImageItem,
} from '../electron/image-batch';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetConcurrencyTracking() {
  activeCalls = 0;
  maxConcurrentCalls = 0;
  totalApiCalls = 0;
}

function setupGenerateImageMock(opts?: { delay?: number; failIds?: Set<string> }) {
  const delay = opts?.delay ?? 10;
  const failIds = opts?.failIds ?? new Set<string>();

  mockGenerateImage.mockImplementation(async (req: any) => {
    activeCalls++;
    totalApiCalls++;
    if (activeCalls > maxConcurrentCalls) {
      maxConcurrentCalls = activeCalls;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));

    activeCalls--;

    if (failIds.has(req.prompt)) {
      return { ok: false, error: 'Generation failed' };
    }

    return {
      ok: true,
      images: [
        {
          dataUrl: `data:image/png;base64,${Buffer.from(req.prompt).toString('base64')}`,
          savedPath: `/tmp/images/${req.projectId}/${Date.now()}.png`,
        },
      ],
    };
  });
}

/** Arbitrary for valid batch image items */
const batchItemArb = (idPrefix: string = 'item') =>
  fc.record({
    id: fc.nat({ max: 9999 }).map((n) => `${idPrefix}-${n}`),
    prompt: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    size: fc.constantFrom('1024x1024', '1024x1536', '1536x1024', 'auto') as fc.Arbitrary<
      '1024x1024' | '1024x1536' | '1536x1024' | 'auto'
    >,
    quality: fc.constantFrom('low', 'medium', 'high', 'auto') as fc.Arbitrary<
      'low' | 'medium' | 'high' | 'auto'
    >,
  });

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  clearAllCaches();
  resetConcurrencyTracking();
  mockGenerateImage.mockReset();
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(Buffer.from('fake-image-data'));
});

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe('batchGenerateImages', () => {
  describe('basic behavior', () => {
    it('returns empty results for empty items array', async () => {
      setupGenerateImageMock();
      const result = await batchGenerateImages({
        items: [],
        projectId: 'test-project',
      });
      expect(result.ok).toBe(false);
      expect(result.results).toEqual([]);
    });

    it('generates images for all items and returns matching IDs', async () => {
      setupGenerateImageMock();
      const items: BatchImageItem[] = [
        { id: 'img-1', prompt: 'A sunset', size: '1024x1024', quality: 'medium' },
        { id: 'img-2', prompt: 'A mountain', size: '1536x1024', quality: 'high' },
      ];

      const result = await batchGenerateImages({ items, projectId: 'proj-1' });
      expect(result.ok).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe('img-1');
      expect(result.results[1].id).toBe('img-2');
      expect(result.results[0].ok).toBe(true);
      expect(result.results[1].ok).toBe(true);
    });

    it('handles partial failures gracefully', async () => {
      setupGenerateImageMock({ failIds: new Set(['fail-prompt']) });
      const items: BatchImageItem[] = [
        { id: 'ok-1', prompt: 'A sunset' },
        { id: 'fail-1', prompt: 'fail-prompt' },
        { id: 'ok-2', prompt: 'A mountain' },
      ];

      const result = await batchGenerateImages({ items, projectId: 'proj-1' });
      expect(result.ok).toBe(true); // at least one succeeded
      expect(result.results).toHaveLength(3);
      expect(result.results[0].ok).toBe(true);
      expect(result.results[1].ok).toBe(false);
      expect(result.results[2].ok).toBe(true);
    });

    it('uses cache for repeated prompt+size+quality combinations', async () => {
      setupGenerateImageMock();
      const items: BatchImageItem[] = [
        { id: 'first', prompt: 'Same prompt', size: '1024x1024', quality: 'medium' },
      ];

      // First call — generates via API
      await batchGenerateImages({ items, projectId: 'proj-cache' });
      expect(totalApiCalls).toBe(1);

      // Second call with same prompt+size+quality — should use cache
      resetConcurrencyTracking();
      const items2: BatchImageItem[] = [
        { id: 'second', prompt: 'Same prompt', size: '1024x1024', quality: 'medium' },
      ];
      const result2 = await batchGenerateImages({ items: items2, projectId: 'proj-cache' });
      expect(totalApiCalls).toBe(0);
      expect(result2.results[0].ok).toBe(true);
      expect(result2.results[0].id).toBe('second');
    });

    it('respects concurrency limit of 3 by default', async () => {
      setupGenerateImageMock({ delay: 50 });
      const items: BatchImageItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        prompt: `Unique prompt ${i}`,
        size: '1024x1024' as const,
        quality: 'medium' as const,
      }));

      await batchGenerateImages({ items, projectId: 'proj-conc' });
      expect(maxConcurrentCalls).toBeLessThanOrEqual(3);
    });

    it('respects custom concurrency parameter', async () => {
      setupGenerateImageMock({ delay: 50 });
      const items: BatchImageItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        prompt: `Unique prompt ${i}`,
        size: '1024x1024' as const,
        quality: 'medium' as const,
      }));

      await batchGenerateImages({ items, projectId: 'proj-conc2', concurrency: 5 });
      expect(maxConcurrentCalls).toBeLessThanOrEqual(5);
    });

    it('clamps concurrency to max 6', async () => {
      setupGenerateImageMock({ delay: 50 });
      const items: BatchImageItem[] = Array.from({ length: 12 }, (_, i) => ({
        id: `item-${i}`,
        prompt: `Unique prompt ${i}`,
        size: '1024x1024' as const,
        quality: 'medium' as const,
      }));

      await batchGenerateImages({ items, projectId: 'proj-conc3', concurrency: 100 });
      expect(maxConcurrentCalls).toBeLessThanOrEqual(6);
    });
  });

  describe('computePromptHash', () => {
    it('produces consistent hashes for same inputs', () => {
      const h1 = computePromptHash('test', '1024x1024', 'medium');
      const h2 = computePromptHash('test', '1024x1024', 'medium');
      expect(h1).toBe(h2);
    });

    it('produces different hashes for different inputs', () => {
      const h1 = computePromptHash('test', '1024x1024', 'medium');
      const h2 = computePromptHash('test', '1024x1024', 'high');
      const h3 = computePromptHash('test', '1536x1024', 'medium');
      const h4 = computePromptHash('different', '1024x1024', 'medium');
      expect(h1).not.toBe(h2);
      expect(h1).not.toBe(h3);
      expect(h1).not.toBe(h4);
    });
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('batchGenerateImages — property-based tests', () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   * Property 11: Concurrency bound — During batchGenerateImages execution,
   * the number of in-flight Azure API calls SHALL never exceed the concurrency
   * parameter at any point in time.
   */
  it('Property 11: concurrency bound is never exceeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(batchItemArb('conc'), { minLength: 1, maxLength: 15 }),
        fc.integer({ min: 1, max: 6 }),
        async (items, concurrency) => {
          clearAllCaches();
          resetConcurrencyTracking();
          setupGenerateImageMock({ delay: 5 });

          // Ensure unique prompts so nothing is cached
          const uniqueItems = items.map((item, i) => ({
            ...item,
            id: `${item.id}-${i}`,
            prompt: `${item.prompt}-unique-${i}-${Math.random()}`,
          }));

          await batchGenerateImages({
            items: uniqueItems,
            projectId: `proj-prop11-${Math.random()}`,
            concurrency,
          });

          // The max concurrent calls should never exceed the concurrency parameter
          expect(maxConcurrentCalls).toBeLessThanOrEqual(concurrency);
          // And we should have made API calls for all items
          expect(totalApiCalls).toBe(uniqueItems.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 4.4, 7.3**
   * Property 12: Result completeness — For any batch request with N items,
   * batchGenerateImages SHALL return exactly N results where each result's id
   * matches the corresponding input item's id in order.
   */
  it('Property 12: result completeness — N items produce N ordered results with matching IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(batchItemArb('comp'), { minLength: 1, maxLength: 20 }),
        async (items) => {
          clearAllCaches();
          resetConcurrencyTracking();
          setupGenerateImageMock({ delay: 2 });

          // Ensure unique IDs and prompts
          const uniqueItems = items.map((item, i) => ({
            ...item,
            id: `${item.id}-${i}`,
            prompt: `${item.prompt}-completeness-${i}-${Math.random()}`,
          }));

          const result = await batchGenerateImages({
            items: uniqueItems,
            projectId: `proj-prop12-${Math.random()}`,
            concurrency: 3,
          });

          // Exactly N results
          expect(result.results.length).toBe(uniqueItems.length);

          // Each result's id matches the corresponding input item's id in order
          for (let i = 0; i < uniqueItems.length; i++) {
            expect(result.results[i].id).toBe(uniqueItems[i].id);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 4.3, 4.9**
   * Property 13: Cache consistency — For any prompt+size+quality combination
   * that has been previously generated and whose cached file exists on disk,
   * batchGenerateImages SHALL return the cached result without calling Azure_Foundry_API.
   */
  it('Property 13: cache consistency — cached items do not trigger API calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(batchItemArb('cache'), { minLength: 1, maxLength: 10 }),
        async (items) => {
          clearAllCaches();
          resetConcurrencyTracking();
          setupGenerateImageMock({ delay: 2 });

          const projectId = `proj-prop13-${Math.random()}`;

          // Ensure unique prompts per item but consistent across runs
          const uniqueItems = items.map((item, i) => ({
            ...item,
            id: `first-${item.id}-${i}`,
            prompt: `cache-test-${i}-${item.prompt}`,
          }));

          // First call — all items should hit the API
          await batchGenerateImages({
            items: uniqueItems,
            projectId,
            concurrency: 6,
          });

          const firstRunApiCalls = totalApiCalls;
          expect(firstRunApiCalls).toBe(uniqueItems.length);

          // Second call with same prompts but different IDs — should all be cached
          resetConcurrencyTracking();
          const cachedItems = uniqueItems.map((item, i) => ({
            ...item,
            id: `second-${item.id}-${i}`,
          }));

          const result = await batchGenerateImages({
            items: cachedItems,
            projectId,
            concurrency: 6,
          });

          // No API calls should have been made (all cached)
          expect(totalApiCalls).toBe(0);

          // All results should be successful (from cache)
          expect(result.results.length).toBe(cachedItems.length);
          for (let i = 0; i < cachedItems.length; i++) {
            expect(result.results[i].id).toBe(cachedItems[i].id);
            expect(result.results[i].ok).toBe(true);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
