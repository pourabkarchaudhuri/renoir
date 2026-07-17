import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fillChangelogTemplate,
  changelogBriefFromText,
} from '../shared/changelog-template';

const exampleHtml = readFileSync(
  resolve(__dirname, '../skills/changelog/example.html'),
  'utf-8',
);

describe('fillChangelogTemplate', () => {
  it('replaces Filebase with product name', () => {
    const out = fillChangelogTemplate(exampleHtml, { productName: 'Acme' });
    expect(out).not.toContain('Filebase');
    expect(out).toContain('Acme');
  });

  it('updates title with product name', () => {
    const out = fillChangelogTemplate(exampleHtml, { productName: 'Acme' });
    expect(out).toContain('<title>Changelog — Acme</title>');
  });
});

describe('changelogBriefFromText', () => {
  it('parses product name from brief', () => {
    const brief = changelogBriefFromText('Filebase — release notes for v2.4');
    expect(brief.productName).toBe('Filebase');
  });
});
