import { describe, it, expect } from 'vitest';
import { normalizeArtifactDocument } from '../src/lib/artifact-html';

describe('normalizeArtifactDocument', () => {
  it('wraps HTML fragments with doctype, title, and tailwind', () => {
    const out = normalizeArtifactDocument('<div>Hello</div>', { title: 'My doc' });
    expect(out).toMatch(/<!doctype html>/i);
    expect(out).toContain('<title>My doc</title>');
    expect(out).toContain('tailwindcss.com');
    expect(out).toContain('<div>Hello</div>');
  });

  it('prepends doctype when html root exists without one', () => {
    const out = normalizeArtifactDocument('<html><body>x</body></html>', { title: 'T' });
    expect(out).toMatch(/^<!doctype html>/i);
    expect(out).toContain('<title>T</title>');
  });

  it('injects viewport when width is provided', () => {
    const out = normalizeArtifactDocument('<div>x</div>', { title: 'T', viewportWidth: 390 });
    expect(out).toContain('width=390');
  });

  it('strips skip-to-main accessibility links', () => {
    const html = '<!doctype html><html><body><a href="#main" class="skip-link">Skip to main content</a><main id="main">Hi</main></body></html>';
    const out = normalizeArtifactDocument(html, { title: 'T' });
    expect(out).not.toContain('Skip to main content');
    expect(out).toContain('<main id="main">Hi</main>');
  });

  it('injects active design system theme for dashboard preview', () => {
    const out = normalizeArtifactDocument('<html><head></head><body></body></html>', {
      title: 'Dash',
      dashboard: true,
      theme: {
        tokens: [{ name: 'bg', value: 'oklch(0.2 0.02 240)' }],
        font: 'Inter / Inter',
      },
    });
    expect(out).toContain('id="renoir-theme"');
    expect(out).toContain('--bg: oklch(0.2 0.02 240)');
    expect(out).toContain('name="renoir:dashboard"');
    expect(out).toContain('id="renoir-dashboard-base"');
  });
});
