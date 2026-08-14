/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildDefaultExportDocument, briefAnswersToInputs } from '../../shared/export/skill-content';
import { htmlToExportBlocks } from '../../shared/export/html-parser';
import {
  buildSkillExportDocument,
  hasExportableContent,
} from '../../src/lib/skill-export';
import { PRODUCT_DECK_SLIDE_COUNT } from '../../src/lib/product-deck-content';
import type { ProjectRecord } from '../../src/types/global';

function deckProject(html: string, skillId = 'product-deck'): ProjectRecord {
  return {
    id: 'p-deck',
    name: 'Acme Deck',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    conversation: [],
    skillId,
    skillSessions: {
      [skillId]: {
        conversation: [{ role: 'assistant', content: `<artifact>${html}</artifact>`, ts: '2026-01-01' }],
        versions: [{ id: 'v1', html, source: 'assistant', createdAt: '2026-01-01' }],
        activeVersionId: 'v1',
      },
    },
  };
}

describe('briefAnswersToInputs', () => {
  it('converts brief answers to labeled inputs', () => {
    const inputs = briefAnswersToInputs({ audience: 'Developers', tone: 'Technical', locked: 'yes' });
    expect(inputs).toHaveLength(2);
    expect(inputs.find((i) => i.label === 'Audience')?.value).toBe('Developers');
  });
});

describe('buildDefaultExportDocument', () => {
  it('assembles metadata and blocks', () => {
    const blocks = [{ type: 'heading' as const, level: 1 as const, text: 'Title' }];
    const doc = buildDefaultExportDocument({
      skillId: 'blog-post',
      skillName: 'Blog Post',
      skillBlurb: 'Write articles',
      projectId: 'proj_1',
      projectName: 'My Study',
      artifactHtml: '<h1>Title</h1>',
      briefAnswers: { audience: 'Readers' },
      createdAt: '2026-01-01T00:00:00.000Z',
      modifiedAt: '2026-01-02T00:00:00.000Z',
    }, blocks);

    expect(doc.title).toBe('My Study');
    expect(doc.subtitle).toBe('Write articles');
    expect(doc.skillId).toBe('blog-post');
    expect(doc.inputs).toHaveLength(1);
    expect(doc.blocks).toHaveLength(1);
  });
});

describe('hasExportableContent', () => {
  const project: ProjectRecord = {
    id: 'p1',
    name: 'Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    conversation: [],
    skillId: 'web-prototype',
    skillSessions: {
      'web-prototype': {
        conversation: [{ role: 'assistant', content: '<artifact><h1>Hi</h1></artifact>', ts: '2026-01-01' }],
        versions: [{ id: 'v1', html: '<h1>Hi</h1>', source: 'assistant', createdAt: '2026-01-01' }],
        activeVersionId: 'v1',
      },
    },
  };

  it('returns true when skill has preview HTML', () => {
    expect(hasExportableContent(project, 'web-prototype')).toBe(true);
  });

  it('returns false for empty skill session', () => {
    expect(hasExportableContent(project, 'dashboard')).toBe(false);
  });

  it('returns false for null project', () => {
    expect(hasExportableContent(null, 'web-prototype')).toBe(false);
  });
});

describe('html integration', () => {
  it('parses simple artifact fragment', () => {
    const blocks = htmlToExportBlocks(
      '<p>Hello <strong>world</strong></p>',
      (s) => new JSDOM(s).window.document,
    );
    expect(blocks[0]?.type).toBe('paragraph');
  });
});

describe('deck raster export document', () => {
  const minimalDeck = `<div class="deck">${Array.from({ length: 3 }, (_, i) =>
    `<section class="slide" data-title="S${i + 1}"><p class="kicker">K</p><h2 class="h2">Slide ${i + 1}</h2>` +
    `<p class="lede">Enough copy for slide ${i + 1} with two sentences here.</p></section>`,
  ).join('')}</div>`;

  it('builds raster export fields for product-deck', () => {
    const project = deckProject(minimalDeck, 'product-deck');
    const doc = buildSkillExportDocument({
      project,
      skillId: 'product-deck',
      skillName: 'Product Deck',
    });
    expect(doc.rasterExport).toBe(true);
    expect(doc.slideCount).toBe(PRODUCT_DECK_SLIDE_COUNT);
    expect(doc.captureHtml).toContain('__renoir_mode_style');
    expect(doc.blocks).toHaveLength(0);
    expect(doc.previewHtml).toContain('class="deck"');
  });

  it('builds raster export for pitch-deck without padding to 12', () => {
    const project = deckProject(minimalDeck, 'pitch-deck');
    const doc = buildSkillExportDocument({
      project,
      skillId: 'pitch-deck',
      skillName: 'Pitch Deck',
    });
    expect(doc.rasterExport).toBe(true);
    expect(doc.captureMode).toBe('present');
    expect(doc.slideCount).toBe(3);
    expect(doc.captureHtml).toMatch(/renoir:nav-state|__renoir_mode_style/);
  });
});

describe('non-deck raster export documents', () => {
  function skillProject(html: string, skillId: string): ProjectRecord {
    return {
      id: 'p-export',
      name: 'Acme',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      conversation: [],
      skillId,
      skillSessions: {
        [skillId]: {
          conversation: [{ role: 'assistant', content: `<artifact>${html}</artifact>`, ts: '2026-01-01' }],
          versions: [{ id: 'v1', html, source: 'assistant', createdAt: '2026-01-01' }],
          activeVersionId: 'v1',
        },
      },
    };
  }

  it('builds viewport capture for dashboard', () => {
    const html = '<div class="dashboard"><section data-od-id="kpi"></section></div>';
    const doc = buildSkillExportDocument({
      project: skillProject(html, 'dashboard'),
      skillId: 'dashboard',
      skillName: 'Dashboard',
    });
    expect(doc.rasterExport).toBe(true);
    expect(doc.captureMode).toBe('viewport');
    expect(doc.captureWidth).toBe(1280);
    expect(doc.captureHeight).toBe(800);
  });

  it('builds fullpage capture and keeps blocks for blog-post', () => {
    const html = '<article><h1>Title</h1><p>Body copy here.</p></article>';
    const doc = buildSkillExportDocument({
      project: skillProject(html, 'blog-post'),
      skillId: 'blog-post',
      skillName: 'Blog Post',
    });
    expect(doc.rasterExport).toBe(true);
    expect(doc.captureMode).toBe('fullpage');
    expect(doc.blocks.length).toBeGreaterThan(0);
  });

  it('builds present capture for saas-landing with screens', () => {
    const html = [
      '<div data-screen-id="landing">Landing</div>',
      '<div data-screen-id="changelog">Changelog</div>',
      '<div data-screen-id="blog">Blog</div>',
    ].join('');
    const doc = buildSkillExportDocument({
      project: skillProject(html, 'saas-landing'),
      skillId: 'saas-landing',
      skillName: 'SaaS Landing',
    });
    expect(doc.rasterExport).toBe(true);
    expect(doc.captureMode).toBe('present');
    expect(doc.slideCount).toBe(3);
  });
});
