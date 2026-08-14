import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
}));

import { modelSupportsTemperature, tokenCapParams } from '../electron/llm.js';

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

describe('tokenCapParams', () => {
  it('uses max_completion_tokens for reasoning models on chat completions', () => {
    expect(tokenCapParams('openai', 'gpt-5', 6144)).toEqual({ max_completion_tokens: 12288 });
    expect(tokenCapParams('azure', 'o3-mini', 6144)).toEqual({ max_completion_tokens: 12288 });
  });

  it('raises tight budgets so reasoning tokens cannot starve the artifact', () => {
    expect(tokenCapParams('openai', 'gpt-5', 3072).max_completion_tokens).toBeGreaterThan(3072);
  });

  it('respects budgets already above the reasoning floor', () => {
    expect(tokenCapParams('openai', 'gpt-5', 16384)).toEqual({ max_completion_tokens: 16384 });
  });

  it('keeps max_tokens for standard chat models', () => {
    expect(tokenCapParams('openai', 'gpt-4o', 3072)).toEqual({ max_tokens: 3072 });
    expect(tokenCapParams('anthropic', 'claude-sonnet-4-20250514', 4096)).toEqual({ max_tokens: 4096 });
  });

  it('uses max_output_tokens on the Azure Responses API', () => {
    expect(tokenCapParams('azure-responses', 'gpt-4o', 4096)).toEqual({ max_output_tokens: 4096 });
  });
});
