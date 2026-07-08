import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';

/**
 * LeftRail structure tests.
 *
 * Since vitest is configured with environment: 'node' (no DOM/jsdom),
 * we verify the source code structure of LeftRail.tsx to confirm that
 * removed elements are absent and ByokInline is integrated.
 */

const leftRailSource = readFileSync(
  resolve(__dirname, '../src/components/studio/LeftRail.tsx'),
  'utf-8',
);

describe('LeftRail — VisionDrop removal', () => {
  it('does NOT import VisionDrop', () => {
    expect(leftRailSource).not.toMatch(/import\s+.*VisionDrop.*from/);
  });

  it('does NOT render <VisionDrop', () => {
    expect(leftRailSource).not.toMatch(/<VisionDrop/);
  });
});

describe('LeftRail — Import/Export removal', () => {
  it('does NOT contain an Import button', () => {
    // Check for common patterns: "Import" button text, importProject handler
    expect(leftRailSource).not.toMatch(/importProject/);
    expect(leftRailSource).not.toMatch(/>Import</);
  });

  it('does NOT contain an Export button', () => {
    expect(leftRailSource).not.toMatch(/exportProject/);
    expect(leftRailSource).not.toMatch(/>Export</);
  });

  it('does NOT import Upload or Download icons (used by old Import/Export)', () => {
    // These icons were used for the Import/Export buttons
    expect(leftRailSource).not.toMatch(/\bUpload\b/);
    expect(leftRailSource).not.toMatch(/\bDownload\b/);
  });
});

describe('LeftRail — prompt tab delete', () => {
  it('creates a new prompt tab when the last active prompt is deleted', () => {
    expect(leftRailSource).toMatch(/openNewPromptTab/);
    expect(leftRailSource).not.toMatch(/setProject\(null\)/);
  });
});

describe('LeftRail — ByokInline integration', () => {
  it('imports ByokInline', () => {
    expect(leftRailSource).toMatch(/import\s+.*ByokInline.*from/);
  });

  it('renders <ByokInline /> in the expanded state', () => {
    expect(leftRailSource).toMatch(/<ByokInline\s*\/>/);
  });

  it('ByokInline is NOT rendered in the collapsed state (44px aside)', () => {
    // The collapsed state is the first return in the component (the `if (collapsed)` block).
    // Extract the collapsed block and verify it doesn't contain ByokInline.
    const collapsedMatch = leftRailSource.match(
      /if\s*\(collapsed\)\s*\{[\s\S]*?return\s*\(([\s\S]*?)\);\s*\}/,
    );
    expect(collapsedMatch).not.toBeNull();
    const collapsedBlock = collapsedMatch![1];
    expect(collapsedBlock).not.toContain('ByokInline');
  });
});

describe('LeftRail — RailActions only contains AgentPicker', () => {
  it('RailActions renders AgentPicker', () => {
    // Extract the RailActions function body
    const railActionsMatch = leftRailSource.match(
      /function RailActions\(\)\s*\{([\s\S]*?)\n\}/,
    );
    expect(railActionsMatch).not.toBeNull();
    const railActionsBody = railActionsMatch![1];
    expect(railActionsBody).toContain('AgentPicker');
  });

  it('RailActions does NOT contain VisionDrop, Import, or Export', () => {
    const railActionsMatch = leftRailSource.match(
      /function RailActions\(\)\s*\{([\s\S]*?)\n\}/,
    );
    expect(railActionsMatch).not.toBeNull();
    const railActionsBody = railActionsMatch![1];
    expect(railActionsBody).not.toContain('VisionDrop');
    expect(railActionsBody).not.toContain('Import');
    expect(railActionsBody).not.toContain('Export');
    expect(railActionsBody).not.toContain('Upload');
    expect(railActionsBody).not.toContain('Download');
  });
});

// ---------- Property-based tests ----------

describe('Property-based tests', () => {
  /**
   * **Validates: Requirements 2.1, 3.1**
   * Property 3: For any LeftRail state, removed elements are absent.
   *
   * Since we can't render the component in node env, we verify the source
   * code invariant: no matter what state values are used, the source code
   * structurally cannot render VisionDrop or Import/Export because they
   * are not imported or referenced.
   */
  describe('Removed elements exclusion (Property 3)', () => {
    it('for any hypothetical state, VisionDrop cannot be rendered (not imported)', () => {
      // The source code does not import VisionDrop, so it cannot be rendered
      // regardless of any runtime state. We verify this invariant holds
      // by checking the import section and all JSX-like patterns.
      fc.assert(
        fc.property(
          fc.record({
            railCollapsed: fc.boolean(),
            hasSkills: fc.boolean(),
            hasDirections: fc.boolean(),
            hasByok: fc.boolean(),
          }),
          (_state) => {
            // Structural invariant: VisionDrop is never importable from LeftRail
            const hasVisionDropImport = /import\s+.*VisionDrop.*from/.test(leftRailSource);
            const hasVisionDropJsx = /<VisionDrop/.test(leftRailSource);
            return !hasVisionDropImport && !hasVisionDropJsx;
          },
        ),
        { numRuns: 50 },
      );
    });

    it('for any hypothetical state, Import/Export buttons cannot be rendered (not in source)', () => {
      fc.assert(
        fc.property(
          fc.record({
            railCollapsed: fc.boolean(),
            hasProject: fc.boolean(),
            isStreaming: fc.boolean(),
          }),
          (_state) => {
            // Structural invariant: no Import/Export buttons exist in the source
            const hasImportProject = /importProject/.test(leftRailSource);
            const hasExportProject = /exportProject/.test(leftRailSource);
            const hasImportButton = />Import</.test(leftRailSource);
            const hasExportButton = />Export</.test(leftRailSource);
            return !hasImportProject && !hasExportProject && !hasImportButton && !hasExportButton;
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
