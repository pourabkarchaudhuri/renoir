import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildDefaultExportDocument, briefAnswersToInputs } from '../../shared/export/skill-content';
import { htmlToExportBlocks } from '../../shared/export/html-parser';
import { hasExportableContent } from '../../src/lib/skill-export';
import type { ProjectRecord } from '../../src/types/global';

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
