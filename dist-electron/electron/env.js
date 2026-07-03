// Loads .env from the project root (dev) or alongside the packaged binary (prod).
// Keeps Azure Foundry credentials in the main process only — never sent to renderer.
import { config as dotenv } from 'dotenv';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
let loaded = false;
function candidatePaths() {
    const out = [];
    if (app.isPackaged) {
        // electron-builder extraFiles drop .env next to the binary.
        out.push(path.join(path.dirname(app.getPath('exe')), '.env'));
        out.push(path.join(process.resourcesPath, '.env'));
    }
    else {
        out.push(path.join(process.cwd(), '.env'));
    }
    out.push(path.join(app.getPath('userData'), '.env'));
    return out;
}
export function loadEnv() {
    if (loaded)
        return { source: null };
    for (const p of candidatePaths()) {
        if (fs.existsSync(p)) {
            dotenv({ path: p });
            loaded = true;
            return { source: p };
        }
    }
    loaded = true;
    return { source: null };
}
export function azureConfig() {
    const endpoint = (process.env.AZURE_FOUNDRY_ENDPOINT || '').replace(/\/+$/, '');
    const imageEndpoint = (process.env.AZURE_IMAGE_ENDPOINT || endpoint).replace(/\/+$/, '');
    const apiKey = process.env.AZURE_FOUNDRY_API_KEY || '';
    const imageApiKey = process.env.AZURE_IMAGE_API_KEY || apiKey;
    return {
        endpoint,
        /** Resource for images/edits — may differ from text (Foundry project vs resource-level). */
        imageEndpoint,
        apiKey,
        /** Key for image resource — defaults to AZURE_FOUNDRY_API_KEY when unset. */
        imageApiKey,
        apiVersion: process.env.AZURE_FOUNDRY_API_VERSION || '2025-04-01-preview',
        imageModel: process.env.AZURE_IMAGE_DEPLOYMENT || 'gpt-image-2',
        textModel: process.env.AZURE_TEXT_DEPLOYMENT || 'gpt-5.4',
    };
}
export function azureConfigured() {
    const c = azureConfig();
    return Boolean(c.endpoint && c.apiKey);
}
export function azureImageConfigured() {
    const c = azureConfig();
    return Boolean(c.imageEndpoint && c.imageApiKey);
}
