import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
}));

import { modelSupportsTemperature } from '../electron/llm.js';

describe('modelSupportsTemperature', () => {
  it('rejects gpt-5 family deployments', () => {
    expect(modelSupportsTemperature('gpt-5')).toBe(false);
    expect(modelSupportsTemperature('gpt-5.4')).toBe(false);
    expect(modelSupportsTemperature('gpt-5-mini')).toBe(false);
  });

  it('rejects o-series reasoning models', () => {
    expect(modelSupportsTemperature('o1')).toBe(false);
    expect(modelSupportsTemperature('o1-mini')).toBe(false);
    expect(modelSupportsTemperature('o3-mini')).toBe(false);
    expect(modelSupportsTemperature('o4-mini')).toBe(false);
  });

  it('allows standard chat models', () => {
    expect(modelSupportsTemperature('gpt-4o')).toBe(true);
    expect(modelSupportsTemperature('gpt-4.1')).toBe(true);
    expect(modelSupportsTemperature('claude-sonnet-4-20250514')).toBe(true);
  });
});
