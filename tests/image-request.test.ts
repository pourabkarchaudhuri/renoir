import { describe, it, expect } from 'vitest';
import {
  userRequestedImages,
  conversationRequestsImages,
  skillPromptsForImagePermission,
  shouldRunImagePipeline,
  shouldPromptForImagePermission,
  userDeclinedImages,
} from '../src/lib/image-request';

describe('userRequestedImages', () => {
  it('returns false for ordinary design briefs', () => {
    expect(userRequestedImages('Build a SaaS dashboard for ops teams')).toBe(false);
    expect(userRequestedImages('Pitch deck for a fintech startup')).toBe(false);
  });

  it('returns true when user explicitly asks to generate images', () => {
    expect(userRequestedImages('Build a landing page and generate images for the hero')).toBe(true);
    expect(userRequestedImages('Create the deck — please generate photos for each slide')).toBe(true);
    expect(userRequestedImages('Fill in the image placeholders with AI-generated artwork')).toBe(true);
  });

  it('respects explicit opt-out', () => {
    expect(userRequestedImages('Build a dashboard, do not generate images')).toBe(false);
    expect(userRequestedImages('Landing page without AI images')).toBe(false);
  });

  it('uses the last user message in conversationRequestsImages', () => {
    expect(conversationRequestsImages([
      { role: 'user', content: 'generate images for the hero' },
      { role: 'assistant', content: 'On it.' },
      { role: 'user', content: 'Just use CSS blocks, no images' },
    ])).toBe(false);
    expect(conversationRequestsImages([
      { role: 'user', content: 'Make a dashboard' },
      { role: 'assistant', content: 'Sure.' },
      { role: 'user', content: 'Now generate images for the chart areas' },
    ])).toBe(true);
  });

  it('prompts for image permission on product-deck instead of auto-running', () => {
    expect(skillPromptsForImagePermission('product-deck')).toBe(true);
    expect(skillPromptsForImagePermission('pitch-deck')).toBe(false);
    expect(shouldRunImagePipeline(
      [{ role: 'user', content: 'Brief: audience: PMs' }],
    )).toBe(false);
    expect(shouldPromptForImagePermission(
      [{ role: 'user', content: 'Brief: audience: PMs' }],
      'product-deck',
    )).toBe(true);
    expect(shouldPromptForImagePermission(
      [{ role: 'user', content: 'Build the deck and generate images' }],
      'product-deck',
    )).toBe(false);
    expect(shouldRunImagePipeline(
      [{ role: 'user', content: 'Build the deck and generate images' }],
    )).toBe(true);
    expect(shouldPromptForImagePermission(
      [{ role: 'user', content: 'Product deck, no images please' }],
      'product-deck',
    )).toBe(false);
    expect(userDeclinedImages('no images please')).toBe(true);
  });
});
