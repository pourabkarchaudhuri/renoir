/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  shouldKeepArtifactButtons,
  stripNonInteractiveButtonsForPreview,
} from '../src/lib/artifact-html';

describe('shouldKeepArtifactButtons', () => {
  it('keeps buttons for interactive skills', () => {
    expect(shouldKeepArtifactButtons('saas-landing')).toBe(true);
    expect(shouldKeepArtifactButtons('web-prototype')).toBe(true);
    expect(shouldKeepArtifactButtons('dashboard')).toBe(true);
  });

  it('suppresses buttons for document and deck skills', () => {
    expect(shouldKeepArtifactButtons('blog-post')).toBe(false);
    expect(shouldKeepArtifactButtons('changelog')).toBe(false);
    expect(shouldKeepArtifactButtons('product-deck')).toBe(false);
    expect(shouldKeepArtifactButtons('pitch-deck')).toBe(false);
    expect(shouldKeepArtifactButtons('all-hands-deck')).toBe(false);
  });

  it('defaults to keeping buttons for unknown skills', () => {
    expect(shouldKeepArtifactButtons('custom-skill')).toBe(true);
    expect(shouldKeepArtifactButtons(undefined)).toBe(true);
  });
});

describe('stripNonInteractiveButtonsForPreview', () => {
  const html = `<!doctype html><html><body>
    <p>Read more in <a href="/docs">our docs</a>.</p>
    <button type="button">Subscribe</button>
    <a href="#" class="btn btn-primary">Get started</a>
    <a href="#" role="button">Join waitlist</a>
  </body></html>`;

  it('removes buttons and button-like CTAs for blog-post', () => {
    const out = stripNonInteractiveButtonsForPreview(html, 'blog-post');
    expect(out).toContain('our docs');
    expect(out).not.toContain('<button');
    expect(out).not.toContain('Get started');
    expect(out).not.toContain('Join waitlist');
  });

  it('preserves prose links for changelog', () => {
    const out = stripNonInteractiveButtonsForPreview(html, 'changelog');
    expect(out).toContain('href="/docs"');
    expect(out).toContain('our docs');
  });

  it('leaves interactive skill artifacts unchanged', () => {
    const out = stripNonInteractiveButtonsForPreview(html, 'saas-landing');
    expect(out).toContain('<button');
    expect(out).toContain('btn btn-primary');
    expect(out).toContain('role="button"');
  });

  it('removes deck slide CTAs for product-deck', () => {
    const deck = `<!doctype html><html><body><section class="slide">
      <h2>Launch</h2>
      <a class="cta-btn" href="#">Book a demo</a>
    </section></body></html>`;
    const out = stripNonInteractiveButtonsForPreview(deck, 'product-deck');
    expect(out).toContain('Launch');
    expect(out).not.toContain('Book a demo');
    expect(out).not.toContain('cta-btn');
  });
});
