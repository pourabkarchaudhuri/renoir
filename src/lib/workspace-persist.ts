import type { Route } from '@/lib/store';

const PROJECT_KEY = 'renoir.lastProjectId';
const ROUTE_KEY = 'renoir.lastRoute';
const SKILL_KEY = 'renoir.lastSkillId';

export interface WorkspaceSnapshot {
  projectId?: string;
  route?: Route;
  skillId?: string;
}

export function saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  try {
    if (snapshot.projectId) localStorage.setItem(PROJECT_KEY, snapshot.projectId);
    if (snapshot.route) localStorage.setItem(ROUTE_KEY, snapshot.route);
    if (snapshot.skillId) localStorage.setItem(SKILL_KEY, snapshot.skillId);
  } catch { /* swallow */ }
}

export function loadWorkspaceSnapshot(): WorkspaceSnapshot {
  try {
    const route = localStorage.getItem(ROUTE_KEY);
    return {
      projectId: localStorage.getItem(PROJECT_KEY) ?? undefined,
      route: (route as Route) || undefined,
      skillId: localStorage.getItem(SKILL_KEY) ?? undefined,
    };
  } catch {
    return {};
  }
}
