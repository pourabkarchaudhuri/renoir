// Loads .env from the project root (dev) or alongside the packaged binary (prod).
// Keeps Azure Foundry credentials in the main process only — never sent to renderer.

import { config as dotenv } from 'dotenv';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

let loaded = false;

function candidatePaths(): string[] {
  const out: string[] = [];
  if (app.isPackaged) {
    // electron-builder extraFiles drop .env next to the binary.
    out.push(path.join(path.dirname(app.getPath('exe')), '.env'));
    out.push(path.join(process.resourcesPath, '.env'));
  } else {
    out.push(path.join(process.cwd(), '.env'));
  }
  out.push(path.join(app.getPath('userData'), '.env'));
  return out;
}

export function loadEnv(): { source: string | null } {
  if (loaded) return { source: null };
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
  return {
    endpoint:    (process.env.AZURE_FOUNDRY_ENDPOINT || '').replace(/\/+$/, ''),
    apiKey:       process.env.AZURE_FOUNDRY_API_KEY || '',
    apiVersion:   process.env.AZURE_FOUNDRY_API_VERSION || '2025-04-01-preview',
    imageModel:   process.env.AZURE_IMAGE_DEPLOYMENT || 'gpt-image-2',
    textModel:    process.env.AZURE_TEXT_DEPLOYMENT || 'gpt-5.4',
  };
}

export function azureConfigured(): boolean {
  const c = azureConfig();
  return Boolean(c.endpoint && c.apiKey);
}
