import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { fillChangelogTemplate, } from '../shared/changelog-template.js';
function skillsDir() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'skills');
    }
    return path.join(process.cwd(), 'skills');
}
let templateCache = null;
function loadChangelogTemplate() {
    if (templateCache)
        return templateCache;
    const file = path.join(skillsDir(), 'changelog', 'example.html');
    templateCache = fs.readFileSync(file, 'utf8');
    return templateCache;
}
export function buildChangelogFromBrief(brief = {}) {
    return fillChangelogTemplate(loadChangelogTemplate(), brief);
}
