import { describe, it, expect } from 'vitest';
import {
  sessionKey,
  ensureSkillSessions,
  syncActiveSession,
  switchSkillSession,
  hydrateProject,
  applySession,
  streamStateForSkill,
  getSkillSession,
  resolvePreviewHtml,
  previewHtmlForSkill,
} from '../src/lib/skill-sessions';
import type { ProjectRecord } from '../src/types/global';

function baseProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 'p1',
    name: 'Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    skillId: 'dashboard',
    conversation: [],
    artifacts: [],
    ...overrides,
  };
}

describe('skill-sessions', () => {
  it('sessionKey falls back to _default', () => {
    expect(sessionKey()).toBe('_default');
    expect(sessionKey('prototype')).toBe('prototype');
  });

  it('migrates legacy conversation into skillSessions', () => {
    const project = baseProject({
      conversation: [{ role: 'user', content: 'hi', ts: '2026-01-01' }],
      versions: [{ id: 'v1', html: '<html></html>', source: 'assistant', createdAt: '2026-01-01' }],
    });
    const migrated = ensureSkillSessions(project);
    expect(migrated.skillSessions?.dashboard?.conversation).toHaveLength(1);
    expect(migrated.skillSessions?.dashboard?.versions).toHaveLength(1);
    expect(migrated.skillSessions?.dashboard?.previewHtml).toBe('<html></html>');
  });

  it('switchSkillSession isolates preview + chat per skill', () => {
    const project = baseProject({
      skillId: 'dashboard',
      conversation: [{ role: 'user', content: 'build dashboard', ts: '2026-01-01' }],
      versions: [{ id: 'v-dash', html: '<html>dash</html>', source: 'assistant', createdAt: '2026-01-01' }],
    });
    const migrated = ensureSkillSessions(project);

    const onPrototype = switchSkillSession(migrated, 'dashboard', 'prototype');
    expect(onPrototype.conversation).toHaveLength(0);
    expect(onPrototype.versions ?? []).toHaveLength(0);
    expect(onPrototype.skillSessions?.dashboard?.conversation).toHaveLength(1);
    expect(onPrototype.skillSessions?.dashboard?.versions?.[0]?.html).toContain('dash');

    const protoProject = {
      ...onPrototype,
      conversation: [{ role: 'user', content: 'build prototype', ts: '2026-01-02' }],
      versions: [{ id: 'v-proto', html: '<html>proto</html>', source: 'assistant', createdAt: '2026-01-02' }],
    };
    const savedProto = syncActiveSession(protoProject, 'prototype');
    const backToDash = switchSkillSession(savedProto, 'prototype', 'dashboard');

    expect(backToDash.conversation[0]?.content).toBe('build dashboard');
    expect(backToDash.versions?.[0]?.html).toContain('dash');
    expect(backToDash.skillSessions?.prototype?.versions?.[0]?.html).toContain('proto');
  });

  it('hydrateProject heals stale session map from top-level data', () => {
    const project = baseProject({
      skillId: 'dashboard',
      conversation: [{ role: 'assistant', content: '<artifact>html</artifact>', ts: '2026-01-01' }],
      skillSessions: { dashboard: { conversation: [] } },
    });
    const hydrated = hydrateProject(project);
    expect(hydrated.conversation).toHaveLength(1);
  });

  it('applySession loads the requested skill without dropping others', () => {
    const project = baseProject({
      skillSessions: {
        dashboard: { conversation: [{ role: 'user', content: 'a', ts: '1' }] },
        prototype: { conversation: [{ role: 'user', content: 'b', ts: '2' }] },
      },
    });
    const proto = applySession(project, 'prototype');
    expect(proto.conversation[0]?.content).toBe('b');
    expect(proto.skillSessions?.dashboard?.conversation[0]?.content).toBe('a');
  });

  it('resolvePreviewHtml prefers cached previewHtml', () => {
    expect(resolvePreviewHtml({
      conversation: [],
      versions: [{ id: 'v1', html: '<html>v</html>', source: 'assistant', createdAt: '1' }],
      previewHtml: '<html>cached</html>',
    })).toBe('<html>cached</html>');
  });

  it('previewHtmlForSkill returns stored preview after hydrate', () => {
    const project = baseProject({
      skillId: 'dashboard',
      skillSessions: {
        dashboard: {
          conversation: [],
          previewHtml: '<html>saved</html>',
        },
      },
    });
    const hydrated = hydrateProject(project);
    expect(previewHtmlForSkill(hydrated, 'dashboard')).toBe('<html>saved</html>');
  });

  it('switchSkillSession preserves background stream state', () => {
    const project = baseProject({
      skillId: 'dashboard',
      conversation: [{ role: 'user', content: 'dash brief', ts: '1' }],
      skillSessions: {
        dashboard: {
          conversation: [{ role: 'user', content: 'dash brief', ts: '1' }],
          pendingAssistant: '<artifact><html',
          isStreaming: true,
          streamStatus: 'streaming',
          conversationId: 'conv-dash',
        },
      },
    });
    const onProto = switchSkillSession(project, 'dashboard', 'prototype', {
      pendingAssistant: '<artifact><html',
      isStreaming: true,
      streamStatus: 'streaming',
      conversationId: 'conv-dash',
    });
    expect(onProto.conversation).toHaveLength(0);
    expect(onProto.skillSessions?.dashboard?.isStreaming).toBe(true);
    expect(onProto.skillSessions?.dashboard?.pendingAssistant).toContain('artifact');
    const dashView = streamStateForSkill(getSkillSession(onProto, 'dashboard'), true);
    expect(dashView.isStreaming).toBe(true);
    const protoView = streamStateForSkill(getSkillSession(onProto, 'prototype'), false);
    expect(protoView.isStreaming).toBe(false);
  });
});
