import { describe, it, expect } from 'vitest';
import { llmOk, imageOk, audioOk, videoOk } from '../src/lib/settings-status';

describe('settings status helpers', () => {
  it('llmOk requires a key and baseUrl', () => {
    expect(llmOk({ hasKey: true, baseUrl: 'https://api.openai.com/v1' })).toBe(true);
    expect(llmOk({ hasKey: true, baseUrl: '' })).toBe(false);
    expect(llmOk(null)).toBe(false);
  });

  it('imageOk prefers imageConfigured when present', () => {
    expect(imageOk({ configured: true, imageConfigured: false })).toBe(false);
    expect(imageOk({ configured: false, imageConfigured: true })).toBe(true);
    expect(imageOk({ configured: true })).toBe(true);
  });

  it('audioOk uses audio deployment or text fallback', () => {
    expect(audioOk({ audioDeployment: 'gpt-audio' })).toBe(true);
    expect(audioOk({ textDeployment: 'gpt-5.4' })).toBe(true);
    expect(audioOk({})).toBe(false);
  });

  it('videoOk requires a video deployment', () => {
    expect(videoOk({ videoDeployment: 'gpt-video' })).toBe(true);
    expect(videoOk({})).toBe(false);
  });
});
