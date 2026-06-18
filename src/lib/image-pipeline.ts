/**
 * Image Pipeline Orchestration — chains PlaceholderDetector → PromptGenerator →
 * BatchImageGenerator → ImageReplacer to produce enriched artifact HTML.
 *
 * Responsibilities:
 *  - Detect placeholders in artifact HTML
 *  - Derive image prompts from placeholder context
 *  - Generate images in parallel via batch IPC
 *  - Replace placeholders with generated images
 *  - Report progress during execution
 *  - Handle errors gracefully (return original HTML on total failure)
 */

import { extractPlaceholders } from './image-placeholders';
import { deriveImagePrompts } from './image-prompts';
import { replacePlaceholders } from './image-replacer';

import type { DesignSystemSummary, VisualDirection } from '../types/global';

// ─── Main Pipeline Function ──────────────────────────────────────────────────

/**
 * Process artifact HTML through the full image generation pipeline.
 *
 * Steps:
 *  1. Detect placeholders in the HTML
 *  2. Derive image prompts from placeholder context
 *  3. Generate images in parallel via batch IPC call
 *  4. Replace placeholders with generated images
 *
 * Returns the enriched HTML and count of successfully generated images.
 * On total failure or unexpected error, returns the original HTML unchanged.
 */
export async function processArtifactImages(
  artifactHtml: string,
  projectId: string,
  opts: {
    designSystem?: DesignSystemSummary;
    direction?: VisualDirection;
    projectName?: string;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<{ html: string; imagesGenerated: number }> {
  try {
    // Step 1: Detect placeholders
    const placeholders = extractPlaceholders(artifactHtml);

    // Early return when no placeholders are detected (zero API calls)
    if (placeholders.length === 0) {
      return { html: artifactHtml, imagesGenerated: 0 };
    }

    // Step 2: Derive prompts from context
    const requests = deriveImagePrompts(placeholders, {
      designSystem: opts.designSystem,
      direction: opts.direction,
      projectName: opts.projectName,
    });

    // Step 3: Generate images in parallel via batch IPC
    const batchResult = await window.renoir.imageBatchGenerate({
      items: requests.map((r) => ({
        id: r.placeholderSelector,
        prompt: r.prompt,
        size: r.size,
        quality: r.quality,
      })),
      projectId,
      concurrency: 3,
    });

    // Handle total failure: batchResult.ok === false or no successful results
    if (!batchResult.ok && batchResult.results.every((r) => !r.ok)) {
      return { html: artifactHtml, imagesGenerated: 0 };
    }

    // Step 4: Build replacement map from successful results, reporting progress
    const replacements = new Map<string, { dataUrl: string; savedPath?: string }>();
    let done = 0;
    const total = batchResult.results.length;

    for (const result of batchResult.results) {
      done++;
      if (result.ok && result.dataUrl) {
        replacements.set(result.id, {
          dataUrl: result.dataUrl,
          savedPath: result.savedPath,
        });
      }
      // Report progress after processing each item
      opts.onProgress?.(done, total);
    }

    // If no images succeeded, return original HTML
    if (replacements.size === 0) {
      return { html: artifactHtml, imagesGenerated: 0 };
    }

    // Step 5: Replace placeholders in HTML
    const { html, replaced } = replacePlaceholders(artifactHtml, replacements);

    return { html, imagesGenerated: replaced };
  } catch {
    // On any unexpected error, return original HTML unchanged
    return { html: artifactHtml, imagesGenerated: 0 };
  }
}
