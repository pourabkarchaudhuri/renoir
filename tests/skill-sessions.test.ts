import { describe, it, expect } from 'vitest';
import { ensureSkillSessions, loadSession, projectHasSkillWork, skillDisplayName, setSkillSessionName, syncActiveSession } from '../shared/skill-sessions';

describe('skill-sessions', () => {
  it('migrates legacy conversation into skillSessions', () => {
    const project = {
      skillId: 'web-prototype',
      conversation: [{ role: 'user' as const, content: 'hi', ts: '1' }],
      versions: [],
    };
    const sessions = ensureSkillSessions(project);
    expect(sessions['web-prototype']?.conversation).toHaveLength(1);
  });

  it('switches between isolated skill sessions', () => {
    const base = {
      skillId: 'web-prototype',
      conversation: [{ role: 'user' as const, content: 'salon site', ts: '1' }],
      versions: [{ id: 'v1', html: '<html></html>', source: 'assistant' as const, createdAt: '1' }],
    };
    let project = syncActiveSession(base, 'web-prototype');
    project = loadSession(project, 'pricing-page');
    expect(project.conversation).toHaveLength(0);
    expect(project.versions).toHaveLength(0);

    project = loadSession(project, 'web-prototype');
    expect(project.conversation[0]?.content).toBe('salon site');
    expect(project.versions).toHaveLength(1);
  });

  it('detects skill-specific work', () => {
    const project = syncActiveSession({
      skillId: 'web-prototype',
      conversation: [{ role: 'user' as const, content: 'x', ts: '1' }],
    }, 'web-prototype');
    expect(projectHasSkillWork(project, 'web-prototype')).toBe(true);
    expect(projectHasSkillWork(project, 'pricing-page')).toBe(false);
  });

  it('keeps per-skill display names', () => {
    const project = syncActiveSession({
      name: 'Test Run',
      skillId: 'web-prototype',
      conversation: [{ role: 'user' as const, content: 'salon', ts: '1' }],
    }, 'web-prototype');
    expect(skillDisplayName(project, 'web-prototype')).toBe('Untitled');
    const named = setSkillSessionName(project, 'web-prototype', 'Test Run');
    expect(skillDisplayName(named, 'web-prototype')).toBe('Test Run');
    expect(skillDisplayName(loadSession(named, 'pricing-page'), 'pricing-page')).toBe('Untitled');
    const renamed = setSkillSessionName(named, 'pricing-page', 'Sunny pricing');
    expect(skillDisplayName(renamed, 'pricing-page')).toBe('Sunny pricing');
  });

  it('does not reuse the study name on a different skill', () => {
    const project = syncActiveSession({
      name: 'Test Run',
      skillId: 'pricing-page',
      conversation: [{ role: 'user' as const, content: 'pricing page please', ts: '1' }],
    }, 'pricing-page');
    expect(skillDisplayName(project, 'pricing-page')).toBe('Untitled');
  });

  it('does not wipe stored conversation when root is empty on sync', () => {
    const project = {
      skillId: 'web-prototype',
      conversation: [],
      skillSessions: {
        'web-prototype': {
          conversation: [{ role: 'user' as const, content: 'salon site', ts: '1' }],
          versions: [{ id: 'v1', html: '<html></html>', source: 'assistant' as const, createdAt: '1' }],
          name: 'Test Run',
        },
      },
    };
    const synced = syncActiveSession(project, 'web-prototype');
    expect(synced.skillSessions!['web-prototype'].conversation).toHaveLength(1);
    expect(synced.skillSessions!['web-prototype'].versions).toHaveLength(1);
    expect(synced.skillSessions!['web-prototype'].name).toBe('Test Run');
  });
});
