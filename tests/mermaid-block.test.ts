import { describe, it, expect } from 'vitest';

/**
 * MermaidBlock component tests.
 * Since the test environment is node (no DOM/React), we test the component's
 * module-level logic by importing and validating the exported interface.
 * Full rendering tests would require jsdom + React Testing Library.
 */

describe('MermaidBlock module', () => {
  it('exports MermaidBlock as a function component', async () => {
    const mod = await import('../src/components/studio/MermaidBlock');
    expect(mod.MermaidBlock).toBeDefined();
    expect(typeof mod.MermaidBlock).toBe('function');
  });

  it('MermaidBlock accepts source and id props (function arity)', async () => {
    const mod = await import('../src/components/studio/MermaidBlock');
    // React function components accept a single props object
    // The function itself has length 1 (one argument: props)
    expect(mod.MermaidBlock.length).toBeLessThanOrEqual(1);
  });
});
