// User-authored custom skills + design systems. Persisted as flat JSON
// alongside the workspace so they round-trip with the user's data.
import path from 'node:path';
import fs from 'node:fs';
import { workspaceRoot } from './workspace.js';
function dir() {
    return path.join(workspaceRoot(), 'custom');
}
function skillsFile() { return path.join(dir(), 'skills.json'); }
function systemsFile() { return path.join(dir(), 'systems.json'); }
function directionsFile() { return path.join(dir(), 'directions.json'); }
function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch {
        return fallback;
    }
}
function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}
export const customCatalog = {
    listSkills() { return readJson(skillsFile(), []); },
    listSystems() { return readJson(systemsFile(), []); },
    upsertSkill(rec) {
        const all = customCatalog.listSkills();
        const idx = all.findIndex((s) => s.id === rec.id);
        if (idx >= 0)
            all[idx] = rec;
        else
            all.push(rec);
        writeJson(skillsFile(), all);
        return rec;
    },
    deleteSkill(id) {
        writeJson(skillsFile(), customCatalog.listSkills().filter((s) => s.id !== id));
    },
    upsertSystem(rec) {
        const all = customCatalog.listSystems();
        const idx = all.findIndex((s) => s.id === rec.id);
        if (idx >= 0)
            all[idx] = rec;
        else
            all.push(rec);
        writeJson(systemsFile(), all);
        return rec;
    },
    deleteSystem(id) {
        writeJson(systemsFile(), customCatalog.listSystems().filter((s) => s.id !== id));
    },
    listDirections() { return readJson(directionsFile(), []); },
    upsertDirection(rec) {
        const all = customCatalog.listDirections();
        const idx = all.findIndex((d) => d.id === rec.id);
        if (idx >= 0)
            all[idx] = rec;
        else
            all.push(rec);
        writeJson(directionsFile(), all);
        return rec;
    },
    deleteDirection(id) {
        writeJson(directionsFile(), customCatalog.listDirections().filter((d) => d.id !== id));
    },
};
