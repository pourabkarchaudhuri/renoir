import { describe, it, expect } from 'vitest';
import { countDeckSlides } from '../src/lib/preview-deck-contrast';

describe('countDeckSlides deck container', () => {
  it('counts all slides inside .deck even with nested divs', () => {
    const html = `
      <div class="deck">
        ${Array.from({ length: 12 }, (_, i) => `<section class="slide" data-title="S${i + 1}"><div class="card">${i}</div></section>`).join('')}
        <nav class="deck-nav">ignore</nav>
      </div>`;
    expect(countDeckSlides(html)).toBe(12);
  });
});
