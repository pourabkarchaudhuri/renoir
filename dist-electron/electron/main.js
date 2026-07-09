import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { loadEnv, azureConfig, azureConfigured, azureImageConfigured } from './env.js';
import { store } from './store.js';
import { secrets } from './secrets.js';
import { startChat, cancelChat, describeRoute } from './llm.js';
import { generateImage } from './image.js';
import { batchGenerateImages } from './image-batch.js';
import { listSkills, getSkill, listDesignSystems, listPromptTemplates, listVisualDirections, getDesignSystem, } from './library.js';
import { openWorkspaceFolder, writeArtifact, migrateWorkspace, workspaceRoot } from './workspace.js';
import { detectAgents, invokeAgent, cancelAgent } from './agents.js';
import { loadSkillsFromDisk } from './skill-loader.js';
/**
 * Adapts an Open Design SKILL.md primer to work with Renoir's runtime.
 * Strips references to DESIGN.md, file-system operations, data-od-id attributes,
 * and reformats artifact output instructions to use Renoir's simple <artifact> format.
 */
function adaptDiskPrimer(raw) {
    let primer = raw;
    // Remove sections that reference files Renoir doesn't have
    primer = primer.replace(/## 1\. Read context[\s\S]*?(?=## \d|$)/i, '');
    primer = primer.replace(/### Step 0 — Pre-flight[\s\S]*?(?=### Step \d|## |$)/i, '');
    primer = primer.replace(/Read `DESIGN\.md`[^\n]*/gi, '');
    primer = primer.replace(/Read `assets\/[^`]*`[^\n]*/gi, '');
    primer = primer.replace(/Read `references\/[^`]*`[^\n]*/gi, '');
    // Remove data-od-id instructions
    primer = primer.replace(/[^\n]*data-od-id[^\n]*/gi, '');
    // Replace Open Design artifact format with Renoir's simple format
    primer = primer.replace(/<artifact\s+identifier="[^"]*"\s+type="[^"]*"\s+title="[^"]*">/gi, '<artifact>');
    primer = primer.replace(/```\s*\n<artifact[^>]*>[\s\S]*?<\/artifact>\s*\n```/gi, '');
    // Remove "Output contract" sections that specify the wrong format
    primer = primer.replace(/## Output contract[\s\S]*?(?=## |$)/i, '');
    // Remove references to DESIGN.md tokens (Renoir uses its own design system injection)
    primer = primer.replace(/All colors must come from DESIGN\.md[^\n]*/gi, 'Use the active design system colors and tokens.');
    primer = primer.replace(/DESIGN\.md/g, 'the active design system');
    // Remove "For skill authors" meta-sections
    primer = primer.replace(/## For skill authors[\s\S]*$/i, '');
    // Remove resource map sections
    primer = primer.replace(/## Resource map[\s\S]*?(?=## |$)/i, '');
    // Trim excessive whitespace
    primer = primer.replace(/\n{3,}/g, '\n\n').trim();
    // Cap at reasonable length to avoid overwhelming the context
    if (primer.length > 2000) {
        primer = primer.slice(0, 2000) + '\n\n[Skill instructions truncated for context efficiency]';
    }
    return primer;
}
import { lintArtifact, extractBrandSpec } from './lint.js';
import { generateAudio, generateVideo } from './media.js';
import { renderHyperFrames } from './hyperframes.js';
import { recordPreview } from './preview-record.js';
import { listTemplates, saveTemplate, deleteTemplate } from './templates.js';
import { exportProject, importProject } from './projectIO.js';
import { startCritique } from './critique.js';
import { editImage } from './image.js';
import { customCatalog } from './customCatalog.js';
import { exportArtifactToPdf } from './pdf.js';
import { describeImage } from './vision.js';
import { renderStoryboard } from './storyboard.js';
import { extractPalette } from './colors.js';
import { ensurePreviewWindow, pushPreviewHtml, isPreviewOpen } from './preview-window.js';
import { exportArtifactToPptx } from './pptx.js';
import { buildMarketingSiteFromBrief } from './marketing-site.js';
import { buildBlogPostFromBrief } from './blog-post.js';
import { buildChangelogFromBrief } from './changelog.js';
import { listProjectAssets } from './assets.js';
let mainWindow = null;
let closeConfirmed = false;
function createWindow() {
    closeConfirmed = false;
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1180,
        minHeight: 720,
        icon: path.join(__dirname, '..', 'public', 'icon.svg'),
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
        titleBarOverlay: process.platform === 'win32'
            ? { color: '#0c0e14', symbolColor: '#9aa1b1', height: 36 }
            : undefined,
        backgroundColor: '#0c0e14',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    // Safety net: if renderer crashes or takes too long, show window anyway
    // so the user doesn't stare at a black/invisible screen forever.
    setTimeout(() => { if (mainWindow && !mainWindow.isVisible())
        mainWindow.show(); }, 5000);
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
        console.error('[Renoir] Renderer crashed:', details.reason, details.exitCode);
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url).catch(() => { });
        return { action: 'deny' };
    });
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl) {
        mainWindow.loadURL(devUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }
    mainWindow.on('close', (e) => {
        if (closeConfirmed)
            return;
        e.preventDefault();
        mainWindow?.webContents.send('renoir:app:flush');
    });
}
function registerIpc() {
    ipcMain.handle('renoir:app:flush-done', () => {
        closeConfirmed = true;
        mainWindow?.close();
        return { ok: true };
    });
    // BYOK
    ipcMain.handle('renoir:byok:get', async () => {
        const cfg = store.getByok();
        const key = await secrets.getByokKey();
        return { baseUrl: cfg.baseUrl ?? '', model: cfg.model ?? '', hasKey: Boolean(key) };
    });
    ipcMain.handle('renoir:byok:set', async (_e, payload) => {
        if (typeof payload?.baseUrl === 'string' || typeof payload?.model === 'string') {
            store.setByok({
                ...(payload.baseUrl ? { baseUrl: payload.baseUrl.trim() } : {}),
                ...(payload.model ? { model: payload.model.trim() } : {}),
            });
        }
        if (typeof payload?.apiKey === 'string' && payload.apiKey) {
            await secrets.setByokKey(payload.apiKey);
        }
        return { ok: true };
    });
    ipcMain.handle('renoir:byok:clear', async () => {
        store.clearByok();
        await secrets.clearByokKey();
        return { ok: true };
    });
    // Azure status
    ipcMain.handle('renoir:azure:status', () => {
        const c = azureConfig();
        return {
            configured: azureConfigured(),
            imageConfigured: azureImageConfigured(),
            imageDeployment: c.imageModel,
            textDeployment: c.textModel,
            endpoint: c.endpoint,
            imageEndpoint: c.imageEndpoint,
            audioDeployment: process.env.AZURE_AUDIO_DEPLOYMENT || '',
            videoDeployment: process.env.AZURE_VIDEO_DEPLOYMENT || '',
        };
    });
    // Catalog (built-in + user-authored + disk-loaded merged)
    ipcMain.handle('renoir:skills:list', () => {
        const builtIn = listSkills();
        const custom = customCatalog.listSkills().map((s) => ({
            id: s.id, name: s.name, category: s.category, blurb: s.blurb, emoji: s.emoji,
        }));
        const diskSkills = loadSkillsFromDisk().map((s) => ({
            id: s.id, name: s.name, category: s.category, blurb: s.blurb, emoji: s.emoji,
        }));
        // Deduplicate: built-in and custom take priority over disk-loaded
        const existingIds = new Set([...builtIn.map((s) => s.id), ...custom.map((s) => s.id)]);
        const uniqueDisk = diskSkills.filter((s) => !existingIds.has(s.id));
        return [...builtIn, ...custom, ...uniqueDisk];
    });
    ipcMain.handle('renoir:skills:primer', (_e, id) => {
        // Return the full primer for a skill by ID.
        // Built-in primers are preferred — they're optimized for Renoir's FRAME prompt.
        const builtIn = getSkill(id);
        if (builtIn)
            return builtIn.primer;
        const custom = customCatalog.listSkills().find((s) => s.id === id);
        if (custom)
            return custom.primer;
        // Disk-loaded skills: adapt the primer to work with Renoir's context.
        // Strip references to DESIGN.md, file operations, and reformat artifact instructions.
        const disk = loadSkillsFromDisk().find((s) => s.id === id);
        if (disk)
            return adaptDiskPrimer(disk.primer);
        return null;
    });
    ipcMain.handle('renoir:design:list', () => {
        const builtIn = listDesignSystems();
        const custom = customCatalog.listSystems().map((d) => ({
            id: d.id, name: d.name, vibe: d.vibe, swatches: d.swatches, font: d.font, tokens: d.tokens,
        }));
        return [...builtIn, ...custom];
    });
    ipcMain.handle('renoir:design:get', (_e, id) => {
        const builtIn = getDesignSystem(id);
        if (builtIn)
            return { id: builtIn.id, name: builtIn.name, tokens: builtIn.tokens };
        const custom = customCatalog.listSystems().find((s) => s.id === id);
        if (custom)
            return { id: custom.id, name: custom.name, tokens: custom.tokens };
        return null;
    });
    ipcMain.handle('renoir:prompts:list', () => listPromptTemplates());
    ipcMain.handle('renoir:directions:list', () => {
        const builtIn = listVisualDirections();
        const custom = customCatalog.listDirections();
        return [...builtIn, ...custom];
    });
    // Custom catalog CRUD
    ipcMain.handle('renoir:custom:listSkills', () => customCatalog.listSkills());
    ipcMain.handle('renoir:custom:saveSkill', (_e, rec) => customCatalog.upsertSkill(rec));
    ipcMain.handle('renoir:custom:deleteSkill', (_e, id) => { customCatalog.deleteSkill(id); return { ok: true }; });
    ipcMain.handle('renoir:custom:listSystems', () => customCatalog.listSystems());
    ipcMain.handle('renoir:custom:saveSystem', (_e, rec) => customCatalog.upsertSystem(rec));
    ipcMain.handle('renoir:custom:deleteSystem', (_e, id) => { customCatalog.deleteSystem(id); return { ok: true }; });
    ipcMain.handle('renoir:custom:listDirections', () => customCatalog.listDirections());
    ipcMain.handle('renoir:custom:saveDirection', (_e, rec) => customCatalog.upsertDirection(rec));
    ipcMain.handle('renoir:custom:deleteDirection', (_e, id) => { customCatalog.deleteDirection(id); return { ok: true }; });
    // Chat (LLM via BYOK or Azure fallback)
    ipcMain.handle('renoir:chat:start', (_e, req) => startChat(req));
    ipcMain.handle('renoir:chat:cancel', (_e, id) => cancelChat(id));
    ipcMain.handle('renoir:chat:route', () => describeRoute());
    ipcMain.handle('renoir:marketing:instant', (_e, brief) => {
        try {
            return { ok: true, html: buildMarketingSiteFromBrief(brief) };
        }
        catch (err) {
            return { ok: false, error: String(err?.message || err) };
        }
    });
    ipcMain.handle('renoir:blog-post:instant', (_e, brief) => {
        try {
            return { ok: true, html: buildBlogPostFromBrief(brief) };
        }
        catch (err) {
            return { ok: false, error: String(err?.message || err) };
        }
    });
    ipcMain.handle('renoir:changelog:instant', (_e, brief) => {
        try {
            return { ok: true, html: buildChangelogFromBrief(brief) };
        }
        catch (err) {
            return { ok: false, error: String(err?.message || err) };
        }
    });
    // Theme — sync titlebar overlay color in real time on Windows.
    ipcMain.handle('renoir:theme:set', (_e, theme) => {
        if (process.platform !== 'win32')
            return { ok: true };
        const overlay = theme === 'light'
            ? { color: '#f5f6f8', symbolColor: '#262b36' }
            : { color: '#0c0e14', symbolColor: '#9aa1b1' };
        for (const w of BrowserWindow.getAllWindows()) {
            try {
                w.setTitleBarOverlay(overlay);
            }
            catch { /* swallow */ }
            try {
                w.setBackgroundColor(theme === 'light' ? '#f5f6f8' : '#0c0e14');
            }
            catch { /* swallow */ }
        }
        return { ok: true };
    });
    // CLI agents
    ipcMain.handle('renoir:agents:list', () => detectAgents(true));
    ipcMain.handle('renoir:agents:invoke', (_e, req) => invokeAgent(req));
    ipcMain.handle('renoir:agents:cancel', (_e, id) => cancelAgent(id));
    // Image
    ipcMain.handle('renoir:image:generate', (_e, req) => generateImage(req));
    ipcMain.handle('renoir:image:edit', (_e, req) => editImage(req));
    ipcMain.handle('renoir:image:generateBatch', async (_e, req) => {
        const azureOk = azureImageConfigured();
        // Validate non-empty items array
        if (!req?.items || !Array.isArray(req.items) || req.items.length === 0) {
            return { ok: false, results: [] };
        }
        // Validate each item has a non-empty prompt
        for (const item of req.items) {
            if (!item.prompt || typeof item.prompt !== 'string' || item.prompt.trim() === '') {
                return { ok: false, results: req.items.map((i) => ({ id: i.id || '', ok: false, error: 'Each item must have a non-empty prompt' })) };
            }
        }
        // Validate Azure is configured
        if (!azureOk) {
            return { ok: false, results: req.items.map((i) => ({ id: i.id || '', ok: false, error: 'Azure image is not configured' })) };
        }
        const result = await batchGenerateImages(req);
        return result;
    });
    // Critique (5-dim)
    ipcMain.handle('renoir:critique:start', (_e, req) => startCritique(req));
    // PDF + PPTX export
    ipcMain.handle('renoir:export:pdf', (_e, req) => exportArtifactToPdf(req));
    ipcMain.handle('renoir:export:pptx', (_e, req) => exportArtifactToPptx(req));
    // Persistent render assets per project
    ipcMain.handle('renoir:assets:list', (_e, req) => listProjectAssets(req.projectId));
    // Vision (image → description)
    ipcMain.handle('renoir:vision:describe', (_e, req) => describeImage(req));
    // Storyboard (script → image strip)
    ipcMain.handle('renoir:storyboard:render', (_e, req) => renderStoryboard(req));
    // Color extractor
    ipcMain.handle('renoir:colors:extract', (_e, req) => extractPalette(req));
    // Detached preview window
    ipcMain.handle('renoir:preview:open', (_e, html) => ensurePreviewWindow(html));
    ipcMain.handle('renoir:preview:push', (_e, html) => { pushPreviewHtml(html); return { ok: true }; });
    ipcMain.handle('renoir:preview:isOpen', () => isPreviewOpen());
    // Remix from gallery
    ipcMain.handle('renoir:projects:remix', (_e, req) => {
        const skillSrc = req.skillFromId ? store.getProject(req.skillFromId) : null;
        const systemSrc = req.systemFromId ? store.getProject(req.systemFromId) : null;
        const artifactSrc = req.artifactFromId ? store.getProject(req.artifactFromId) : null;
        const seedHtml = (() => {
            if (!artifactSrc)
                return '';
            const last = [...artifactSrc.conversation].reverse().find((m) => m.role === 'assistant');
            const m = last?.content.match(/<artifact>([\s\S]*?)<\/artifact>/i);
            return m ? m[1].trim() : (last?.content || '');
        })();
        const now = new Date().toISOString();
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const rec = {
            id,
            name: req.name || `Remix · ${new Date().toLocaleDateString()}`,
            createdAt: now,
            updatedAt: now,
            skillId: skillSrc?.skillId,
            designSystemId: systemSrc?.designSystemId,
            visualDirectionId: artifactSrc?.visualDirectionId,
            conversation: seedHtml ? [{
                    role: 'system',
                    content: `You are remixing prior work. Inherit the chosen skill and system. Use the previous artifact below as a starting reference.\n\nPREVIOUS ARTIFACT:\n${seedHtml.slice(0, 12_000)}`,
                    ts: now,
                }] : [],
            artifacts: [],
            versions: [],
        };
        store.upsertProject(rec);
        return { ok: true, project: rec };
    });
    // Project rename
    ipcMain.handle('renoir:projects:rename', (_e, req) => {
        const rec = store.getProject(req.id);
        if (!rec)
            return { ok: false, error: 'project not found' };
        rec.name = (req.name || '').trim() || rec.name;
        rec.updatedAt = new Date().toISOString();
        store.upsertProject(rec);
        return { ok: true, project: rec };
    });
    // Version snapshots
    ipcMain.handle('renoir:projects:addVersion', (_e, req) => {
        const rec = store.getProject(req.id);
        if (!rec)
            return { ok: false, error: 'project not found' };
        if (!rec.versions)
            rec.versions = [];
        const last = rec.versions[rec.versions.length - 1];
        if (last && last.html === req.html)
            return { ok: true, project: rec, deduped: true };
        rec.versions.push({
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            html: req.html,
            source: req.source || 'assistant',
            note: req.note,
            createdAt: new Date().toISOString(),
        });
        // A new assistant version overrides any restore selection.
        if (req.source !== 'restore')
            rec.activeVersionId = undefined;
        const skillKey = req.skillId ?? rec.skillId;
        if (skillKey) {
            if (!rec.skillSessions)
                rec.skillSessions = {};
            rec.skillSessions[skillKey] = {
                ...rec.skillSessions[skillKey],
                conversation: rec.conversation,
                versions: rec.versions,
                activeVersionId: rec.activeVersionId,
                previewHtml: req.html,
            };
        }
        rec.updatedAt = new Date().toISOString();
        store.upsertProject(rec);
        return { ok: true, project: rec };
    });
    ipcMain.handle('renoir:projects:restoreVersion', (_e, req) => {
        const rec = store.getProject(req.id);
        if (!rec || !rec.versions)
            return { ok: false, error: 'no versions' };
        const v = rec.versions.find((x) => x.id === req.versionId);
        if (!v)
            return { ok: false, error: 'version not found' };
        // Don't push a new entry — just point activeVersionId at the chosen
        // historical version. Cleared automatically when a new assistant turn
        // emits another artifact.
        rec.activeVersionId = req.versionId;
        rec.updatedAt = new Date().toISOString();
        store.upsertProject(rec);
        return { ok: true, project: rec };
    });
    // Fork — clone artifact into a new project seeded with system context
    ipcMain.handle('renoir:projects:fork', (_e, req) => {
        const src = store.getProject(req.fromId);
        if (!src)
            return { ok: false, error: 'source not found' };
        const lastAssistant = [...src.conversation].reverse().find((m) => m.role === 'assistant');
        const artifactMatch = lastAssistant?.content.match(/<artifact>([\s\S]*?)<\/artifact>/i);
        const seedHtml = artifactMatch ? artifactMatch[1].trim() : (lastAssistant?.content || '');
        const now = new Date().toISOString();
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const rec = {
            id,
            name: `${src.name}${req.nameSuffix ? ' · ' + req.nameSuffix : ' (fork)'}`,
            createdAt: now,
            updatedAt: now,
            skillId: src.skillId,
            designSystemId: src.designSystemId,
            visualDirectionId: src.visualDirectionId,
            conversation: [
                {
                    role: 'system',
                    content: `You are continuing an existing study. The previous artifact is shown below — fork it: keep its layout language but improve hierarchy, contrast, and copy.\n\nPREVIOUS ARTIFACT:\n${seedHtml.slice(0, 12_000)}`,
                    ts: now,
                },
            ],
            artifacts: [],
        };
        store.upsertProject(rec);
        return { ok: true, project: rec };
    });
    // Audio + video
    ipcMain.handle('renoir:audio:generate', (_e, req) => generateAudio(req));
    ipcMain.handle('renoir:video:generate', (_e, req) => generateVideo(req));
    // HyperFrames
    ipcMain.handle('renoir:hyperframes:render', (_e, req) => renderHyperFrames(req));
    ipcMain.handle('renoir:preview:record', (_e, req) => recordPreview(req));
    // Lint + brand spec
    ipcMain.handle('renoir:lint:artifact', (_e, html) => lintArtifact(html || ''));
    ipcMain.handle('renoir:brand:extract', (_e, text) => extractBrandSpec(text || ''));
    // Templates
    ipcMain.handle('renoir:templates:list', () => listTemplates());
    ipcMain.handle('renoir:templates:save', (_e, rec) => saveTemplate(rec));
    ipcMain.handle('renoir:templates:delete', (_e, id) => { deleteTemplate(id); return { ok: true }; });
    // Projects
    ipcMain.handle('renoir:projects:list', () => store.listProjects());
    ipcMain.handle('renoir:projects:read', (_e, id) => store.getProject(id) ?? null);
    ipcMain.handle('renoir:projects:create', (_e, meta) => {
        const now = new Date().toISOString();
        const rec = {
            id: meta.id || (Math.random().toString(36).slice(2) + Date.now().toString(36)),
            name: meta.name || 'Untitled',
            createdAt: now,
            updatedAt: now,
            skillId: meta.skillId,
            designSystemId: meta.designSystemId,
            preview: meta.preview,
            conversation: meta.conversation || [],
            artifacts: meta.artifacts || [],
        };
        store.upsertProject(rec);
        return rec;
    });
    ipcMain.handle('renoir:projects:save', (_e, rec) => {
        rec.updatedAt = new Date().toISOString();
        store.upsertProject(rec);
        return { ok: true };
    });
    ipcMain.handle('renoir:projects:delete', (_e, id) => {
        store.deleteProject(id);
        return { ok: true };
    });
    ipcMain.handle('renoir:projects:export', (_e, id) => exportProject(id));
    ipcMain.handle('renoir:projects:import', () => importProject());
    // Workspace
    ipcMain.handle('renoir:workspace:open', () => openWorkspaceFolder());
    ipcMain.handle('renoir:workspace:write', (_e, req) => writeArtifact(req));
}
// `renoir-asset://` resolves to userData/workspace/<rest> so the renderer can
// render persisted images/videos/audio via standard <img>/<video>/<audio>
// elements without a heavy data-URL round-trip.
protocol.registerSchemesAsPrivileged([
    { scheme: 'renoir-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } },
]);
app.whenReady().then(() => {
    loadEnv();
    // Migrate workspace from userData to Documents before anything else
    migrateWorkspace();
    // Map renoir-asset://path → file under workspaceRoot()
    protocol.handle('renoir-asset', async (req) => {
        try {
            const url = new URL(req.url);
            // The host part is the first path segment; combine with pathname.
            const rel = decodeURIComponent((url.host + url.pathname).replace(/^\/+/, ''));
            const safeRel = rel.split('/').filter((s) => s && s !== '..').join(path.sep);
            const abs = path.join(workspaceRoot(), safeRel);
            return await net.fetch(pathToFileURL(abs).toString());
        }
        catch (err) {
            return new Response(`bad request: ${err?.message || ''}`, { status: 400 });
        }
    });
    registerIpc();
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});
