import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  composeSystemPrompt, extractArtifact, extractQuestionForm,
  stripArtifact, inferPhase, hasLockedBrief, extractBriefFromConversation,
  conversationForLlm, usesDirectArtifactGeneration, directGenerateKickMessage,
} from '../src/lib/prompt';
import { listSkills, getSkill } from '../electron/library';

describe('prompt composer', () => {
  it('always includes the framing rules', () => {
    const r = composeSystemPrompt({});
    expect(r.system).toContain('You are Renoir');
    expect(r.system).toContain('<artifact>');
  });

  it('injects the active skill block', () => {
    const r = composeSystemPrompt({
      skill: { id: 'web', name: 'Web', category: 'web', emoji: '🌐', blurb: 'Single page.' },
      primer: 'Output one HTML.',
    });
    expect(r.system).toContain('# Active skill: Web');
    expect(r.system).toContain('Output one HTML.');
  });

  it('injects product deck requirements when skill is product-deck', () => {
    const r = composeSystemPrompt({
      skill: { id: 'product-deck', name: 'Product Deck', category: 'deck', emoji: '📽️', blurb: '12-slide walkthrough.' },
      primer: 'Cover through contact.',
    });
    expect(r.system).toContain('# Product Deck requirements');
    expect(r.system).toContain('slide-visual');
    expect(r.system).toContain('12 slides');
  });

  it('injects marketing site layout contract when skill is saas-landing', () => {
    const r = composeSystemPrompt({
      skill: { id: 'saas-landing', name: 'SaaS Landing', category: 'web', emoji: '🚀', blurb: 'Multi-screen site.' },
      primer: 'Three linked screens.',
    });
    expect(r.system).toContain('# SaaS Marketing Site — copy pass on staged shell');
    expect(r.system).toContain('data-screen-id="landing"');
    expect(r.system).toContain('"changelog"');
    expect(r.system).toContain('"blog"');
    expect(r.system).toContain('never <question-form>');
  });

  it('injects blog post layout contract when skill is blog-post', () => {
    const r = composeSystemPrompt({
      skill: { id: 'blog-post', name: 'Blog Post', category: 'doc', emoji: '✍️', blurb: 'Long-form article.' },
      primer: 'Single-screen blog article.',
    });
    expect(r.system).toContain('# Blog Post — single-screen article');
    expect(r.system).toContain('"masthead"');
    expect(r.system).toContain('"article-header"');
    expect(r.system).toContain('"article-body"');
    expect(r.system).toContain('"related-posts"');
    expect(r.system).toContain('never <question-form>');
  });

  it('injects changelog layout contract when skill is changelog', () => {
    const r = composeSystemPrompt({
      skill: { id: 'changelog', name: 'Changelog', category: 'web', emoji: '🗒️', blurb: 'Release notes.' },
      primer: 'Single-screen changelog.',
    });
    expect(r.system).toContain('# Changelog — single-screen release notes');
    expect(r.system).toContain('"changelog-header"');
    expect(r.system).toContain('"changelog-filters"');
    expect(r.system).toContain('"changelog-entries"');
    expect(r.system).toContain('never <question-form>');
  });

  it('injects design system tokens', () => {
    const r = composeSystemPrompt({
      designSystem: { id: 'ember', name: 'Ember', vibe: 'Warm', swatches: [], font: 'Inter' },
      designTokens: [{ name: 'bg', value: 'oklch(0.18 0.02 264)' }],
    });
    expect(r.system).toContain('# Active design system: Ember');
    expect(r.system).toContain('--bg: oklch(0.18 0.02 264);');
  });

  it('adds pitch deck quality bar for pitch-deck skill', () => {
    const r = composeSystemPrompt({
      skill: { id: 'pitch-deck', name: 'Pitch Deck', category: 'deck', emoji: '🎤', blurb: '10-slide investor deck.' },
    });
    expect(r.system).toContain('Pitch deck quality bar');
    expect(r.system).toContain('Never emit <question-form>');
    expect(r.system).toContain('data-slide="1"');
    expect(r.system).toContain('Cover');
    expect(r.system).toContain('Go-To-Market');
    expect(r.system).toContain('Financials / Metrics');
    expect(r.system).toContain('Ask / Closing');
  });

  it('adds all-hands deck quality bar for all-hands-deck skill', () => {
    const r = composeSystemPrompt({
      skill: { id: 'all-hands-deck', name: 'All-hands Deck', category: 'deck', emoji: '🗣️', blurb: 'Internal update deck.' },
    });
    expect(r.system).toContain('All-hands deck quality bar');
    expect(r.system).toContain('Never emit <question-form>');
    expect(r.system).toContain('Executive Summary');
    expect(r.system).toContain('Wins & Achievements');
    expect(r.system).toContain('Risks & Challenges');
    expect(r.system).toContain('Closing / Q&A');
  });

  it('flags direct-generate skills', () => {
    expect(usesDirectArtifactGeneration({ id: 'pricing-page' })).toBe(true);
    expect(usesDirectArtifactGeneration({ id: 'web-prototype' })).toBe(true);
    expect(usesDirectArtifactGeneration({ id: 'pitch-deck' })).toBe(true);
    expect(usesDirectArtifactGeneration({ id: 'all-hands-deck' })).toBe(true);
    expect(usesDirectArtifactGeneration({ id: 'docs-portal' })).toBe(false);
  });

  it('returns skill-specific kick messages for direct generate', () => {
    expect(directGenerateKickMessage('pitch-deck')).toContain('10-slide');
    expect(directGenerateKickMessage('all-hands-deck')).toContain('all-hands');
    expect(directGenerateKickMessage('pricing-page')).toContain('pricing page');
    expect(directGenerateKickMessage('web-prototype')).toContain('full artifact');
  });

  it('includes brand spec when provided', () => {
    const r = composeSystemPrompt({
      brand: {
        name: 'Acme', voice: 'warm', audience: 'CFO',
        colors: ['#fff'], fonts: ['Inter'], values: ['honesty'], doNots: ['shouting'],
      },
    });
    expect(r.system).toContain('Brand: Acme');
    expect(r.system).toContain('Do not: shouting');
  });

  it('omits empty answers', () => {
    const r = composeSystemPrompt({ answers: { audience: '', tone: 'energetic' } });
    expect(r.system).toContain('- tone: energetic');
    expect(r.system).not.toMatch(/^- audience:\s*$/m);
  });
});

describe('artifact extraction', () => {
  it('returns complete=true for a closed artifact', () => {
    const text = 'intro\n<artifact>\n<html></html>\n</artifact>\noutro';
    const r = extractArtifact(text);
    expect(r).not.toBeNull();
    expect(r!.complete).toBe(true);
    expect(r!.html).toBe('<html></html>');
  });

  it('returns complete=false for an open artifact mid-stream', () => {
    const text = 'preamble\n<artifact>\n<!doctype html><html><head><title>x';
    const r = extractArtifact(text);
    expect(r).not.toBeNull();
    expect(r!.complete).toBe(false);
    expect(r!.html.startsWith('<!doctype')).toBe(true);
  });

  it('parses artifact tags with attributes (web-prototype contract)', () => {
    const text = [
      'Here is your site.',
      '<artifact identifier="bakery-site" type="text/html" title="Bakery">',
      '<!doctype html><html><body><div class="ph-img wide">[ Hero ]</div></body></html>',
      '</artifact>',
    ].join('\n');
    const r = extractArtifact(text);
    expect(r).not.toBeNull();
    expect(r!.complete).toBe(true);
    expect(r!.html).toContain('ph-img');
  });

  it('returns null when no artifact tag present', () => {
    expect(extractArtifact('no artifact here')).toBeNull();
  });
});

describe('stripArtifact', () => {
  it('removes a closed artifact span', () => {
    expect(stripArtifact('hello <artifact>x</artifact> world')).toBe('hello  world'.trim());
  });
  it('removes an open artifact span and everything after', () => {
    expect(stripArtifact('hello <artifact>still streaming…')).toBe('hello');
  });
  it('removes question-form spans too', () => {
    expect(stripArtifact('q<question-form>field:x</question-form>r')).toBe('qr');
  });
  it('preserves regular prose', () => {
    expect(stripArtifact('# Title\nA paragraph.')).toBe('# Title\nA paragraph.');
  });
});

describe('inferPhase', () => {
  it('returns a thinking flavor when buffer is empty', () => {
    const phase = inferPhase('', 0);
    expect(phase.length).toBeGreaterThan(0);
  });

  it('detects question-form phase', () => {
    expect(inferPhase('about to <question-form>x</question-form>', 100)).toBe('Locking the brief…');
  });

  it('detects hero phase from artifact tail', () => {
    expect(inferPhase('<artifact><h1>Hello</h1>', 100)).toBe('Drawing the hero…');
  });

  it('detects nav phase', () => {
    expect(inferPhase('<artifact><header><nav>', 100)).toBe('Wiring navigation…');
  });

  it('detects footer phase', () => {
    expect(inferPhase('<artifact>... lots ...<footer>©', 100)).toBe('Closing the footer…');
  });

  it('detects token tuning phase', () => {
    expect(inferPhase('<artifact><style>:root { --bg: black; }', 100)).toBe('Tuning tokens…');
  });
});

describe('question-form extraction', () => {
  it('parses fields with options', () => {
    const text = `<question-form>
field:tone | label:Tone | type:select | options:minimal,bold
field:goal | label:Goal | type:textarea
</question-form>`;
    const fields = extractQuestionForm(text);
    expect(fields).not.toBeNull();
    expect(fields).toHaveLength(2);
    expect(fields![0]).toMatchObject({ id: 'tone', type: 'select' });
    expect(fields![0].options).toEqual(['minimal', 'bold']);
  });
  it('returns null when none', () => {
    expect(extractQuestionForm('blah')).toBeNull();
  });
});

describe('conversationForLlm', () => {
  it('strips artifacts from prior assistant turns', () => {
    const msgs = [
      { role: 'user', content: 'Build a blog' },
      { role: 'assistant', content: 'Done.\n<artifact><html>old</html></artifact>' },
      { role: 'user', content: 'Make it shorter' },
    ];
    const out = conversationForLlm(msgs);
    expect(out[1].content).not.toContain('<html>');
    expect(out[1].content).toBe('Done.');
  });

  it('keeps the latest assistant artifact when continuing', () => {
    const partial = 'streaming\n<artifact><html>partial';
    const msgs = [
      { role: 'user', content: 'Build' },
      { role: 'assistant', content: partial },
    ];
    const out = conversationForLlm(msgs, { keepLastArtifact: true });
    expect(out[1].content).toBe(partial);
  });

  it('keeps the latest artifact for revision turns', () => {
    const msgs = [
      { role: 'user', content: 'Build' },
      { role: 'assistant', content: 'Done.\n<artifact><html>v1</html></artifact>' },
      { role: 'user', content: 'Shorten the hero' },
    ];
    const out = conversationForLlm(msgs, { keepLastArtifact: true });
    expect(out[1].content).toContain('<html>v1</html>');
  });
});

describe('brief lock', () => {
  it('detects locked brief from user message', () => {
    const conv = [
      { role: 'user', content: 'Build a dashboard' },
      { role: 'assistant', content: '<question-form>field:audience | label:Who</question-form>' },
      { role: 'user', content: 'Brief:\n- Tone: minimal\n- Who is this for?: ops leads' },
    ];
    expect(hasLockedBrief(conv)).toBe(true);
    expect(extractBriefFromConversation(conv)).toMatchObject({
      locked: 'yes',
      tone: 'minimal',
      audience: 'ops leads',
    });
  });

  it('does not treat ordinary messages as locked brief', () => {
    const conv = [
      { role: 'user', content: 'Build a dashboard for ops leads' },
      { role: 'assistant', content: '<question-form>field:audience</question-form>' },
    ];
    expect(hasLockedBrief(conv)).toBe(false);
  });

  it('includes locked brief answers in system prompt', () => {
    const r = composeSystemPrompt({
      answers: { locked: 'yes', audience: 'ops', tone: 'minimal', scope: 'KPIs + charts' },
    });
    expect(r.system).toContain('do NOT re-ask');
    expect(r.system).toContain('Never emit <question-form>');
    expect(r.system).toContain('- audience: ops');
  });
});

describe('FRAME enrichment sections', () => {
  it('contains all six enrichment section headers', () => {
    const r = composeSystemPrompt({});
    const headers = [
      'Component layout patterns',
      'Visual polish techniques',
      'Motion & animation',
      'Dark/light theming',
      'Realistic content patterns',
      'CSS-only decorative elements',
    ];
    for (const h of headers) {
      expect(r.system).toContain(h);
    }
  });

  it('contains key content phrases from enrichment sections', () => {
    const r = composeSystemPrompt({});
    const phrases = [
      'prefers-color-scheme',
      'Lorem ipsum',
      'elevation-',
      'Gradient orbs',
      'prefers-reduced-motion',
      'oklch',
    ];
    for (const p of phrases) {
      expect(r.system).toContain(p);
    }
  });
});

describe('FRAME enrichment property tests', () => {
  const ENRICHMENT_HEADERS = [
    'Component layout patterns',
    'Visual polish techniques',
    'Motion & animation',
    'Dark/light theming',
    'Realistic content patterns',
    'CSS-only decorative elements',
  ];

  it('Property 1: enrichment section headers present for all input combinations', () => {
    /** Validates: Requirement 8.3 */
    fc.assert(
      fc.property(
        fc.record({
          skill: fc.option(fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            category: fc.constantFrom('web', 'mobile', 'deck', 'doc', 'media', 'system') as fc.Arbitrary<'web' | 'mobile' | 'deck' | 'doc' | 'media' | 'system'>,
            emoji: fc.string({ minLength: 1, maxLength: 4 }),
            blurb: fc.string({ minLength: 0, maxLength: 50 }),
          }), { nil: undefined }),
          primer: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
          designSystem: fc.option(fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            vibe: fc.string({ minLength: 0, maxLength: 30 }),
            swatches: fc.array(fc.string(), { maxLength: 3 }),
            font: fc.string({ minLength: 1, maxLength: 30 }),
          }), { nil: undefined }),
          designTokens: fc.option(fc.array(fc.record({
            name: fc.string({ minLength: 1, maxLength: 10 }),
            value: fc.string({ minLength: 1, maxLength: 30 }),
          }), { maxLength: 3 }), { nil: undefined }),
          direction: fc.option(fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            vibe: fc.string({ minLength: 0, maxLength: 30 }),
            swatches: fc.array(fc.string(), { maxLength: 3 }),
            font: fc.string({ minLength: 1, maxLength: 30 }),
            tagline: fc.string({ minLength: 0, maxLength: 50 }),
          }), { nil: undefined }),
          brand: fc.option(fc.record({
            name: fc.string({ minLength: 0, maxLength: 20 }),
            voice: fc.string({ minLength: 0, maxLength: 20 }),
            audience: fc.string({ minLength: 0, maxLength: 30 }),
            colors: fc.array(fc.string(), { maxLength: 3 }),
            fonts: fc.array(fc.string(), { maxLength: 2 }),
            values: fc.array(fc.string(), { maxLength: 3 }),
            doNots: fc.array(fc.string(), { maxLength: 3 }),
          }), { nil: undefined }),
          answers: fc.option(fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.string({ minLength: 0, maxLength: 30 }),
            { maxKeys: 4 },
          ), { nil: undefined }),
        }),
        (opts) => {
          const r = composeSystemPrompt(opts);
          for (const h of ENRICHMENT_HEADERS) {
            expect(r.system).toContain(h);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('Property 2: every skill primer is at most 600 characters', () => {
    /** Validates: Requirement 7.2 */
    const allSkills = listSkills();
    for (const summary of allSkills) {
      const skill = getSkill(summary.id);
      expect(skill).toBeDefined();
      expect(skill!.primer.length).toBeLessThanOrEqual(600);
    }
  });

  it('Property 3: every skill primer references at least one enrichment pattern keyword', () => {
    /** Validates: Requirement 7.1 */
    const keywords = [
      'hero', 'elevation', 'gradient', 'entrance', 'dark/light',
      'realistic', 'animation', 'theme token', 'typography', 'radius',
    ];
    const allSkills = listSkills();
    for (const summary of allSkills) {
      const skill = getSkill(summary.id);
      expect(skill).toBeDefined();
      const primerLower = skill!.primer.toLowerCase();
      const hasKeyword = keywords.some((kw) => primerLower.includes(kw.toLowerCase()));
      expect(hasKeyword, `Skill "${skill!.id}" primer should reference at least one enrichment keyword`).toBe(true);
    }
  });
});

describe('composeSystemPrompt signature stability', () => {
  it('accepts empty options and returns PromptComposition with system string', () => {
    const r = composeSystemPrompt({});
    expect(r).toHaveProperty('system');
    expect(typeof r.system).toBe('string');
    expect(r.system.length).toBeGreaterThan(0);
  });

  it('accepts all optional fields and returns PromptComposition', () => {
    const r = composeSystemPrompt({
      skill: { id: 'web', name: 'Web', category: 'web', emoji: '🌐', blurb: 'Test.' },
      primer: 'Test primer.',
      designSystem: { id: 'ember', name: 'Ember', vibe: 'Warm', swatches: ['#fff'], font: 'Inter' },
      designTokens: [{ name: 'bg', value: '#000' }],
      direction: { id: 'd1', name: 'Bold', vibe: 'Strong', swatches: ['#f00'], font: 'Inter', tagline: 'Go bold.' },
      brand: { name: 'Acme', voice: 'warm', audience: 'devs', colors: ['#fff'], fonts: ['Inter'], values: ['speed'], doNots: ['yelling'] },
      answers: { tone: 'minimal', audience: 'designers' },
      revision: true,
    });
    expect(r).toHaveProperty('system');
    expect(typeof r.system).toBe('string');
    expect(r.system).toContain('Revision turn');
  });

  it('does not export new symbols from src/lib/prompt.ts', async () => {
    const mod = await import('../src/lib/prompt');
    const exportedKeys = Object.keys(mod).sort();
    const expectedExports = [
      'REVISION_PROMPT_ADDENDUM',
      'composeSystemPrompt',
      'conversationForLlm',
      'directGenerateKickMessage',
      'extractArtifact',
      'extractBriefFromConversation',
      'extractQuestionForm',
      'hasLockedBrief',
      'inferPhase',
      'stripArtifact',
      'usesDirectArtifactGeneration',
    ].sort();
    expect(exportedKeys).toEqual(expectedExports);
  });
});
