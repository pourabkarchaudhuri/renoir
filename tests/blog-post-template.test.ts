import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fillBlogPostTemplate,
  inferBlogHeadlineFromText,
  blogBriefFromText,
} from '../shared/blog-post-template';

const exampleHtml = readFileSync(
  resolve(__dirname, '../skills/blog-post/example.html'),
  'utf-8',
);

describe('fillBlogPostTemplate', () => {
  it('replaces Filebase with company name', () => {
    const out = fillBlogPostTemplate(exampleHtml, { companyName: 'Acme' });
    expect(out).not.toContain('Filebase');
    expect(out).toContain('Acme');
  });

  it('replaces headline when provided', () => {
    const out = fillBlogPostTemplate(exampleHtml, {
      companyName: 'Acme',
      headline: 'How we scaled our API gateway',
    });
    expect(out).toContain('How we scaled our API gateway');
    expect(out).not.toContain('Why we rewrote our sync engine in Rust');
    expect(out).toContain('<title>How we scaled our API gateway — Acme</title>');
  });
});

describe('inferBlogHeadlineFromText', () => {
  it('extracts text after em-dash', () => {
    expect(
      inferBlogHeadlineFromText('Filebase engineering blog — why we rewrote our sync engine in Rust'),
    ).toBe('why we rewrote our sync engine in Rust');
  });
});

describe('blogBriefFromText', () => {
  it('parses company and headline from brief', () => {
    const brief = blogBriefFromText('Filebase — why we rewrote our sync engine in Rust');
    expect(brief.companyName).toBe('Filebase');
    expect(brief.headline).toBe('why we rewrote our sync engine in Rust');
  });
});
