// Tiny JSON-backed store for non-secret app state (projects, last-used skill, etc).
// Secrets (BYOK API key) live in keytar instead.
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { syncActiveSession } from '../shared/skill-sessions.js';
const DEFAULT = {
    byok: {},
    projects: [],
};
let cache = null;
function file() {
    return path.join(app.getPath('userData'), 'renoir-store.json');
}
function load() {
    if (cache)
        return cache;
    try {
        const raw = fs.readFileSync(file(), 'utf8');
        cache = { ...DEFAULT, ...JSON.parse(raw) };
    }
    catch {
        cache = JSON.parse(JSON.stringify(DEFAULT));
    }
    return cache;
}
function flush() {
    if (!cache)
        return;
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8');
}
export const store = {
    getByok() {
        const s = load();
        const cfg = { ...s.byok };
        // In dev, allow .env to provide defaults when nothing is configured via UI.
        // This avoids having to open Settings every time you restart.
        if (!cfg.baseUrl && process.env.BYOK_BASE_URL)
            cfg.baseUrl = process.env.BYOK_BASE_URL;
        if (!cfg.model && process.env.BYOK_MODEL)
            cfg.model = process.env.BYOK_MODEL;
        return cfg;
    },
    setByok(cfg) {
        const s = load();
        s.byok = { ...s.byok, ...cfg };
        flush();
    },
    clearByok() {
        load().byok = {};
        flush();
    },
    listProjects() {
        return load().projects.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    getProject(id) {
        return load().projects.find((p) => p.id === id);
    },
    upsertProject(record) {
        const synced = syncActiveSession(record, record.skillId || 'web-prototype');
        const s = load();
        const idx = s.projects.findIndex((p) => p.id === synced.id);
        if (idx >= 0)
            s.projects[idx] = synced;
        else
            s.projects.push(synced);
        flush();
    },
    deleteProject(id) {
        const s = load();
        s.projects = s.projects.filter((p) => p.id !== id);
        flush();
    },
    setLast(skillId, designSystemId) {
        const s = load();
        if (skillId)
            s.lastSkillId = skillId;
        if (designSystemId)
            s.lastDesignSystemId = designSystemId;
        flush();
    },
    getLast() {
        const s = load();
        return { skillId: s.lastSkillId, designSystemId: s.lastDesignSystemId };
    },
};
