// Storyboard — turn a multi-line script into a horizontal strip of frames,
// one Azure image per shot. Saves PNGs into the project workspace and zips
// them up alongside a shotlist.json.
import path from 'node:path';
import fs from 'node:fs';
import { generateImage } from './image.js';
import { writeZipToFile } from './zipio.js';
import { projectDir as getProjectDir } from './workspace.js';
export async function renderStoryboard(req) {
    const projectDir = getProjectDir(req.projectId);
    const stem = `storyboard-${Date.now()}`;
    const dir = path.join(projectDir, stem);
    fs.mkdirSync(dir, { recursive: true });
    const styleSuffix = req.styleSuffix?.trim() ? ` ${req.styleSuffix.trim()}` : '';
    const frames = [];
    for (let i = 0; i < req.shots.length; i++) {
        const raw = req.shots[i].trim();
        if (!raw)
            continue;
        const prompt = raw + styleSuffix;
        const result = await generateImage({ prompt, n: 1, size: req.size, projectId: req.projectId });
        if (!result.ok || !result.images?.length) {
            return { ok: false, error: `shot ${i + 1}: ${result.error || 'no image'}` };
        }
        const img = result.images[0];
        const target = path.join(dir, `shot-${String(i + 1).padStart(2, '0')}.png`);
        if (img.savedPath && img.savedPath !== target) {
            try {
                fs.copyFileSync(img.savedPath, target);
            }
            catch { /* swallow */ }
        }
        else if (img.dataUrl) {
            const b64 = img.dataUrl.replace(/^data:[^;]+;base64,/, '');
            fs.writeFileSync(target, Buffer.from(b64, 'base64'));
        }
        frames.push({ shot: i + 1, prompt, dataUrl: img.dataUrl, savedPath: target });
    }
    // Save shotlist + zip
    const shotlist = frames.map(({ shot, prompt }) => ({ shot, prompt }));
    fs.writeFileSync(path.join(dir, 'shotlist.json'), JSON.stringify(shotlist, null, 2));
    const zipEntries = [
        { name: 'shotlist.json', data: Buffer.from(JSON.stringify(shotlist, null, 2)) },
        ...frames.map((f) => ({
            name: `shot-${String(f.shot).padStart(2, '0')}.png`,
            data: fs.readFileSync(f.savedPath),
        })),
    ];
    const zipPath = path.join(dir, `${stem}.zip`);
    writeZipToFile(zipPath, zipEntries);
    return { ok: true, frames, zipPath };
}
