import { describe, it, expect } from 'vitest';
import { parseFlowScreens, artifactHasFlowLinks } from '../src/lib/flow-screens';

describe('flow-screens', () => {
  it('parses data-screen-id regions', () => {
    const html = `
      <section data-screen-id="home" data-screen-label="Home"><h1>Hi</h1></section>
      <section data-screen-id="detail"><h2>Detail</h2></section>
    `;
    const screens = parseFlowScreens(html);
    expect(screens).toHaveLength(2);
    expect(screens[0].id).toBe('home');
    expect(screens[0].label).toBe('Home');
  });

  it('falls back to data-od-id sections', () => {
    const html = `
      <div data-od-id="hero"><h1>Hero</h1></div>
      <div data-od-id="footer">End</div>
    `;
    const screens = parseFlowScreens(html);
    expect(screens.length).toBeGreaterThanOrEqual(2);
  });

  it('detects flow links', () => {
    expect(artifactHasFlowLinks('<button data-goto="next">Go</button>')).toBe(true);
    expect(artifactHasFlowLinks('<div>plain</div>')).toBe(false);
  });
});
