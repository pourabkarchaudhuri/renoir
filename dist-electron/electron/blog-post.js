import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { fillBlogPostTemplate, } from '../shared/blog-post-template.js';
function skillsDir() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'skills');
    }
    return path.join(process.cwd(), 'skills');
}
let templateCache = null;
function loadBlogPostTemplate() {
    if (templateCache)
        return templateCache;
    const file = path.join(skillsDir(), 'blog-post', 'example.html');
    templateCache = fs.readFileSync(file, 'utf8');
    return templateCache;
}
export function buildBlogPostFromBrief(brief = {}) {
    return fillBlogPostTemplate(loadBlogPostTemplate(), brief);
}
