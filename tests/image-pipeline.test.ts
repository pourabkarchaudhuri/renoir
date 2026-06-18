/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processArtifactImages } from '../src/lib/image-pipeline';

// ─── Mock Setup ──────────────────────────────────────────────────────────────

const mockImageBatchGenerate = vi.fn();

beforeEach(() => {
  // Set up window.renoir mock with imageBatchGenerate
  (globalThis as any).window = globalThis.window ?? {};
  (window as any).renoir = {
    imageBatchGenerate: mockImageBatchGenerate,
  };
});

afterEach(() => {
  vi.resetAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SMALL_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** HTML with two image placeholders */
const HTML_WITH_PLACEHOLDERS = `
<div>
  <h1>Hero Section</h1>
  <img src="" alt="Hero banner" style="width:800px;height:400px">
  <section>
    <h2>About Us</h2>
    <div style="background-color:#cccccc;width:400px;height:300px;"></div>
  </section>
</div>
`;

/** HTML with no placeholders */
const HTML_NO_PLACEHOLDERS = `
<div>
  <h1>Hello World</h1>
  <p>This is a paragraph with no image placeholders.</p>
  <img src="https://example.com/real-image.png" alt="Real image" style="width:200px;height:200px">
</div>
`;

// ─── Integration Tests ───────────────────────────────────────────────────────

describe('processArtifactImages', () => {
  describe('pipeline chaining', () => {
    it('chains PlaceholderDetector → PromptGenerator → BatchImageGenerator → ImageReplacer', async () => {
      mockImageBatchGenerate.mockResolvedValue({
        ok: true,
        results: [
          { id: expect.any(String), ok: true, dataUrl: SMALL_DATA_URL, savedPath: 'images/hero.png' },
          { id: expect.any(String), ok: true, dataUrl: SMALL_DATA_URL, savedPath: 'images/about.png' },
        ],
      });

      // We need to capture the actual call to verify the pipeline chains correctly
      mockImageBatchGenerate.mockImplementation(async (req) => {
        // Verify the batch request has items derived from placeholders
        expect(req.items.length).toBe(2);
        expect(req.projectId).toBe('test-project');
        expect(req.concurrency).toBe(3);

        // Each item should have a prompt, size, and quality derived by PromptGenerator
        for (const item of req.items) {
          expect(item.id).toBeTruthy();
          expect(item.prompt).toBeTruthy();
          expect(item.prompt.length).toBeGreaterThan(0);
          expect(item.prompt.length).toBeLessThanOrEqual(4000);
          expect(['1024x1024', '1024x1536', '1536x1024']).toContain(item.size);
          expect(['low', 'medium', 'high']).toContain(item.quality);
        }

        return {
          ok: true,
          results: req.items.map((item: any) => ({
            id: item.id,
            ok: true,
            dataUrl: SMALL_DATA_URL,
            savedPath: `images/${item.id.replace(/[^a-z0-9]/gi, '_')}.png`,
          })),
        };
      });

      const result = await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project', {
        projectName: 'Test Project',
      });

      expect(result.imagesGenerated).toBe(2);
      expect(result.html).toContain('data:image/png;base64,');
      expect(result.html).not.toBe(HTML_WITH_PLACEHOLDERS);
      expect(mockImageBatchGenerate).toHaveBeenCalledTimes(1);
    });

    it('passes design system and direction to prompt generator', async () => {
      mockImageBatchGenerate.mockImplementation(async (req) => {
        // Verify style suffix is incorporated into prompts
        const hasStyleInPrompt = req.items.some((item: any) =>
          item.prompt.includes('Modern') || item.prompt.includes('minimal')
        );
        expect(hasStyleInPrompt).toBe(true);

        return {
          ok: true,
          results: req.items.map((item: any) => ({
            id: item.id,
            ok: true,
            dataUrl: SMALL_DATA_URL,
          })),
        };
      });

      await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project', {
        direction: {
          id: 'dir-1',
          name: 'Modern',
          vibe: 'Modern minimal',
          swatches: ['#000', '#fff'],
          font: 'Inter',
          tagline: 'Clean and simple',
        },
      });

      expect(mockImageBatchGenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe('early return on no placeholders', () => {
    it('returns original HTML unchanged when no placeholders detected', async () => {
      const result = await processArtifactImages(HTML_NO_PLACEHOLDERS, 'test-project');

      expect(result.html).toBe(HTML_NO_PLACEHOLDERS);
      expect(result.imagesGenerated).toBe(0);
      expect(mockImageBatchGenerate).not.toHaveBeenCalled();
    });

    it('makes zero API calls for empty HTML', async () => {
      const result = await processArtifactImages('', 'test-project');

      expect(result.html).toBe('');
      expect(result.imagesGenerated).toBe(0);
      expect(mockImageBatchGenerate).not.toHaveBeenCalled();
    });

    it('makes zero API calls for HTML with only real images', async () => {
      const html = '<div><img src="https://example.com/photo.jpg" alt="Real" style="width:300px;height:200px"></div>';
      const result = await processArtifactImages(html, 'test-project');

      expect(result.html).toBe(html);
      expect(result.imagesGenerated).toBe(0);
      expect(mockImageBatchGenerate).not.toHaveBeenCalled();
    });
  });

  describe('progress callback', () => {
    it('calls onProgress for each batch result item', async () => {
      mockImageBatchGenerate.mockResolvedValue({
        ok: true,
        results: [
          { id: 'sel-1', ok: true, dataUrl: SMALL_DATA_URL },
          { id: 'sel-2', ok: true, dataUrl: SMALL_DATA_URL },
        ],
      });

      const onProgress = vi.fn();

      await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project', {
        onProgress,
      });

      // onProgress should be called once per result item
      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
    });

    it('calls onProgress even for failed items', async () => {
      mockImageBatchGenerate.mockResolvedValue({
        ok: true,
        results: [
          { id: 'sel-1', ok: true, dataUrl: SMALL_DATA_URL },
          { id: 'sel-2', ok: false, error: 'Rate limited' },
        ],
      });

      const onProgress = vi.fn();

      await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project', {
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
    });

    it('does not throw when onProgress is not provided', async () => {
      mockImageBatchGenerate.mockResolvedValue({
        ok: true,
        results: [
          { id: 'sel-1', ok: true, dataUrl: SMALL_DATA_URL },
        ],
      });

      // Should not throw
      const result = await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project');
      expect(result.imagesGenerated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('returns original HTML on total failure (all items fail)', async () => {
      mockImageBatchGenerate.mockResolvedValue({
        ok: false,
        results: [
          { id: 'sel-1', ok: false, error: 'Azure unavailable' },
          { id: 'sel-2', ok: false, error: 'Azure unavailable' },
        ],
      });

      const result = await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project');

      expect(result.html).toBe(HTML_WITH_PLACEHOLDERS);
      expect(result.imagesGenerated).toBe(0);
    });

    it('returns original HTML when batchResult.ok is false and no results succeed', async () => {
      mockImageBatchGenerate.mockResolvedValue({
        ok: false,
        results: [
          { id: 'sel-1', ok: false, error: 'Content policy violation' },
          { id: 'sel-2', ok: false, error: 'Timeout' },
        ],
      });

      const result = await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project');

      expect(result.html).toBe(HTML_WITH_PLACEHOLDERS);
      expect(result.imagesGenerated).toBe(0);
    });

    it('performs partial replacement when some items succeed and some fail', async () => {
      // Mock returns one success and one failure
      mockImageBatchGenerate.mockImplementation(async (req) => ({
        ok: true,
        results: [
          { id: req.items[0].id, ok: true, dataUrl: SMALL_DATA_URL, savedPath: 'images/hero.png' },
          { id: req.items[1].id, ok: false, error: 'Rate limited' },
        ],
      }));

      const result = await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project');

      // Only one image should be replaced
      expect(result.imagesGenerated).toBe(1);
      expect(result.html).not.toBe(HTML_WITH_PLACEHOLDERS);
      // The HTML should contain the replaced image
      expect(result.html).toContain('data:image/png;base64,');
    });

    it('returns original HTML on unexpected IPC error (promise rejection)', async () => {
      mockImageBatchGenerate.mockRejectedValue(new Error('IPC channel closed'));

      const result = await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project');

      expect(result.html).toBe(HTML_WITH_PLACEHOLDERS);
      expect(result.imagesGenerated).toBe(0);
    });

    it('returns original HTML on unexpected thrown error', async () => {
      mockImageBatchGenerate.mockImplementation(() => {
        throw new Error('Unexpected crash');
      });

      const result = await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project');

      expect(result.html).toBe(HTML_WITH_PLACEHOLDERS);
      expect(result.imagesGenerated).toBe(0);
    });

    it('handles partial success where batchResult.ok is true but some items have no dataUrl', async () => {
      mockImageBatchGenerate.mockImplementation(async (req) => ({
        ok: true,
        results: [
          { id: req.items[0].id, ok: true, dataUrl: SMALL_DATA_URL },
          { id: req.items[1].id, ok: true, dataUrl: undefined }, // ok but no dataUrl
        ],
      }));

      const result = await processArtifactImages(HTML_WITH_PLACEHOLDERS, 'test-project');

      // Only the item with a dataUrl should be replaced
      expect(result.imagesGenerated).toBe(1);
    });
  });
});
