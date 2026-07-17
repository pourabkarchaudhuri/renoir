import { describe, it, expect } from 'vitest';
import { applyArtifactTheme, themeOptionsFromStudio } from '../src/lib/artifact-theme';

describe('applyArtifactTheme', () => {
  it('injects design-system tokens into artifact HTML', () => {
    const html = '<!doctype html><html><head><style>:root { --bg: #fff; }</style></head><body></body></html>';
    const out = applyArtifactTheme(html, {
      id: 'ember',
      name: 'Ember',
      vibe: 'Warm',
      swatches: ['#c96442'],
      font: 'Georgia / Inter',
      tokens: [
        { name: 'bg', value: 'oklch(0.15 0.02 260)' },
        { name: 'accent', value: 'oklch(0.65 0.18 30)' },
      ],
    }, {
      id: 'bold',
      name: 'Bold',
      vibe: 'Strong',
      swatches: ['#ff00aa', '#00ffaa'],
      font: 'Inter',
      tagline: 'Go bold',
    });
    expect(out).toContain('id="renoir-theme"');
    expect(out).toContain('--bg: oklch(0.15 0.02 260)');
    expect(out).toContain('--swatch-1: #ff00aa');
  });

  it('returns html unchanged when no tokens', () => {
    const html = '<html><body>x</body></html>';
    expect(applyArtifactTheme(html, { id: 'x', name: 'X', vibe: '', swatches: [], font: 'Inter' })).toBe(html);
  });
});

describe('themeOptionsFromStudio', () => {
  it('merges direction swatches', () => {
    const opts = themeOptionsFromStudio(
      { id: 'e', name: 'E', vibe: '', swatches: [], font: 'Inter', tokens: [{ name: 'fg', value: '#111' }] },
      { id: 'd', name: 'D', vibe: '', swatches: ['#abc'], font: 'Inter', tagline: '' },
    );
    expect(opts?.directionSwatches).toEqual(['#abc']);
  });
});
