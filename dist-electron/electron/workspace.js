import { app, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
// --- Path Resolution ---
export function workspaceRoot() {
    try {
        return path.join(app.getPath('documents'), 'Renoir');
    }
    catch {
        return path.join(app.getPath('userData'), 'workspace');
    }
}
export function projectDir(projectId) {
    return path.join(workspaceRoot(), 'projects', projectId);
}
export function ensureProjectDir(projectId) {
    const d = projectDir(projectId);
    fs.mkdirSync(d, { recursive: true });
    return d;
}
// --- Workspace Operations ---
export async function openWorkspaceFolder() {
    const root = workspaceRoot();
    fs.mkdirSync(root, { recursive: true });
    await shell.openPath(root);
    return { ok: true, path: root };
}
export function writeArtifact(req) {
    try {
        const dir = ensureProjectDir(req.projectId);
        const safe = req.filename.replace(/[^a-z0-9._-]/gi, '_');
        const target = path.join(dir, safe);
        if (req.encoding === 'base64') {
            fs.writeFileSync(target, Buffer.from(req.content, 'base64'));
        }
        else {
            fs.writeFileSync(target, req.content, 'utf8');
        }
        return { ok: true, path: target };
    }
    catch (err) {
        return { ok: false, error: err?.message || String(err) };
    }
}
// --- Migration ---
/**
 * Recursively copies all files/directories from src to dest.
 * Skips `.migrated.json` and does not overwrite existing files (no-clobber).
 */
function copyRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === '.migrated.json')
            continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        }
        else if (entry.isFile()) {
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
/**
 * One-time migration from old userData/workspace to documents/Renoir.
 * Safe, idempotent, and non-destructive (old data is never deleted).
 */
export function migrateWorkspace() {
    const oldRoot = path.join(app.getPath('userData'), 'workspace');
    const newRoot = workspaceRoot();
    const markerPath = path.join(oldRoot, '.migrated.json');
    // Guard: already migrated
    if (fs.existsSync(markerPath)) {
        return { migrated: false };
    }
    // Guard: nothing to migrate
    if (!fs.existsSync(oldRoot)) {
        fs.mkdirSync(newRoot, { recursive: true });
        return { migrated: false };
    }
    // Guard: new location already has content (manual move or partial migration)
    if (fs.existsSync(newRoot)) {
        const contents = fs.readdirSync(newRoot);
        if (contents.length > 0) {
            writeMarker(markerPath, newRoot);
            return { migrated: false };
        }
    }
    // Perform copy (not move — safer, old data preserved as backup)
    try {
        copyRecursive(oldRoot, newRoot);
        writeMarker(markerPath, newRoot);
        return { migrated: true, from: oldRoot, to: newRoot };
    }
    catch (err) {
        return { migrated: false, error: err?.message || String(err) };
    }
}
function writeMarker(markerPath, newRoot) {
    const marker = {
        migratedAt: new Date().toISOString(),
        movedTo: newRoot,
        version: app.getVersion(),
    };
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2));
}
