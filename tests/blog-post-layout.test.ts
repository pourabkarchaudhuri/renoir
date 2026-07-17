import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BLOG_POST_REGIONS,
  blogPostPromptLines,
  isBlogPostArtifact,
  lintBlogPostRegions,
  missingBlogPostRegions,
  parseBlogPostRegionIds,
} from '../shared/blog-post-layout';

const exampleHtml = readFileSync(
  resolve(__dirname, '../skills/blog-post/example.html'),
  'utf-8',
);

describe('blogPostPromptLines', () => {
  it('includes section contract and required region ids', () => {
    const lines = blogPostPromptLines().join('\n');
    expect(lines).toContain('# Blog Post — single-screen article');
    expect(lines).toContain('~350 words');
    expect(lines).toContain('max-width ~680px');
    for (const region of BLOG_POST_REGIONS) {
      expect(lines).toContain(`"${region}"`);
    }
  });
});

describe('parseBlogPostRegionIds', () => {
  it('extracts unique data-od-id values from example.html', () => {
    const ids = parseBlogPostRegionIds(exampleHtml);
    for (const region of BLOG_POST_REGIONS) {
      expect(ids).toContain(region);
    }
  });
});

describe('missingBlogPostRegions', () => {
  it('returns no missing regions for canonical example', () => {
    expect(missingBlogPostRegions(exampleHtml)).toEqual([]);
  });

  it('flags missing regions when article-header is present', () => {
    const partial = '<div data-od-id="article-header"><h1>Title</h1></div>';
    const missing = missingBlogPostRegions(partial);
    expect(missing).toContain('masthead');
    expect(missing).toContain('article-body');
    expect(missing).toContain('related-posts');
  });
});

describe('isBlogPostArtifact', () => {
  it('detects blog-post artifacts by article-header and article-body', () => {
    expect(isBlogPostArtifact(exampleHtml)).toBe(true);
    expect(isBlogPostArtifact('<div data-od-id="article-header"></div>')).toBe(false);
    expect(isBlogPostArtifact('<p>plain html</p>')).toBe(false);
  });
});

describe('lintBlogPostRegions', () => {
  it('returns null for canonical example', () => {
    expect(lintBlogPostRegions(exampleHtml)).toBeNull();
  });

  it('reports missing regions for partial blog artifacts', () => {
    const partial = `
      <header data-od-id="article-header"><h1>Title</h1></header>
      <div data-od-id="article-body"><p>Body</p></div>
    `;
    const issue = lintBlogPostRegions(partial);
    expect(issue?.rule).toBe('blog-post-regions');
    expect(issue?.message).toContain('masthead');
    expect(issue?.message).toContain('hero-figure');
    expect(issue?.message).toContain('related-posts');
  });

  it('ignores non-blog artifacts', () => {
    expect(lintBlogPostRegions('<p>not a blog</p>')).toBeNull();
  });
});
