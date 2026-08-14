import { describe, it, expect } from 'vitest';
import { exportFormatsForSkill, isDeckSkill } from '../src/lib/skill-export';
import { buildCaptureProfile } from '../src/lib/skill-export-capture';

describe('exportFormatsForSkill', () => {
  it('returns PPTX only for product deck', () => {
    expect(exportFormatsForSkill('product-deck')).toEqual(['pptx']);
  });

  it('returns PDF and PPTX for other deck skills', () => {
    expect(exportFormatsForSkill('pitch-deck')).toEqual(['pdf', 'pptx']);
    expect(exportFormatsForSkill('all-hands-deck')).toEqual(['pdf', 'pptx']);
  });

  it('returns PDF for default web skills', () => {
    expect(exportFormatsForSkill('web-prototype')).toEqual(['pdf']);
    expect(exportFormatsForSkill('saas-landing')).toEqual(['pdf']);
    expect(exportFormatsForSkill('dashboard')).toEqual(['pdf']);
  });

  it('returns PDF and PNG for mobile skills', () => {
    expect(exportFormatsForSkill('mobile-app')).toEqual(['pdf', 'png']);
  });

  it('returns PDF, DOCX, and Markdown for doc skills', () => {
    expect(exportFormatsForSkill('blog-post')).toEqual(['pdf', 'docx', 'markdown']);
    expect(exportFormatsForSkill('one-pager')).toEqual(['pdf', 'docx', 'markdown']);
  });

  it('returns PNG for social card and email template', () => {
    expect(exportFormatsForSkill('social-card')).toEqual(['png']);
    expect(exportFormatsForSkill('email-template')).toEqual(['png']);
  });

  it('returns PDF and PNG for menu card and system diagram', () => {
    expect(exportFormatsForSkill('menu-card')).toEqual(['pdf', 'png']);
    expect(exportFormatsForSkill('system-diagram')).toEqual(['pdf', 'png']);
  });

  it('defaults to PDF when skill is unknown', () => {
    expect(exportFormatsForSkill(undefined)).toEqual(['pdf']);
  });
});

describe('isDeckSkill', () => {
  it('identifies deck category skills', () => {
    expect(isDeckSkill('product-deck')).toBe(true);
    expect(isDeckSkill('blog-post')).toBe(false);
  });
});

describe('buildCaptureProfile', () => {
  const deckHtml = '<div class="deck"><section class="slide"></section><section class="slide"></section></div>';

  it('uses present mode for decks', () => {
    const profile = buildCaptureProfile('pitch-deck', deckHtml);
    expect(profile.mode).toBe('present');
    expect(profile.width).toBe(1280);
    expect(profile.height).toBe(720);
  });

  it('uses viewport mode for dashboard', () => {
    const profile = buildCaptureProfile('dashboard', '<div></div>');
    expect(profile.mode).toBe('viewport');
    expect(profile.width).toBe(1280);
    expect(profile.height).toBe(800);
  });

  it('uses fullpage mode for blog posts', () => {
    const profile = buildCaptureProfile('blog-post', '<article></article>');
    expect(profile.mode).toBe('fullpage');
    expect(profile.width).toBe(1280);
  });

  it('uses phone viewport for mobile skills', () => {
    const profile = buildCaptureProfile('mobile-app', '<div></div>');
    expect(profile.mode).toBe('viewport');
    expect(profile.width).toBe(390);
    expect(profile.height).toBe(844);
  });

  it('uses fixed viewport for social card', () => {
    const profile = buildCaptureProfile('social-card', '<div></div>');
    expect(profile.mode).toBe('viewport');
    expect(profile.width).toBe(1200);
    expect(profile.height).toBe(630);
  });
});
