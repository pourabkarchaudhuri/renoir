// Secret storage. Tries keytar first; falls back to encrypted file using safeStorage
// when keytar is unavailable (e.g. headless Linux without libsecret).

import { safeStorage, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const SERVICE = 'renoir';
const ACCOUNT_BYOK_KEY = 'byok-llm-key';

interface KeytarLike {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

let keytar: KeytarLike | null = null;
try {
  // Optional: keytar is in optionalDependencies. If native build failed
  // (corp cert chain on node-gyp, missing libsecret on Linux, etc.), we
  // fall back to safeStorage-encrypted disk store below.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  keytar = require('keytar') as KeytarLike;
} catch {
  keytar = null;
}

function fallbackPath(): string {
  return path.join(app.getPath('userData'), 'renoir-secrets.bin');
}

function readFallback(): Record<string, string> {
  try {
    const buf = fs.readFileSync(fallbackPath());
    if (!safeStorage.isEncryptionAvailable()) return {};
    const json = safeStorage.decryptString(buf);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function writeFallback(map: Record<string, string>): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  fs.mkdirSync(path.dirname(fallbackPath()), { recursive: true });
  fs.writeFileSync(fallbackPath(), safeStorage.encryptString(JSON.stringify(map)));
}

export const secrets = {
  async getStoredByokKey(): Promise<string | null> {
    if (keytar) {
      const stored = await keytar.getPassword(SERVICE, ACCOUNT_BYOK_KEY);
      if (stored) return stored;
    } else {
      const stored = readFallback()[ACCOUNT_BYOK_KEY] ?? null;
      if (stored) return stored;
    }
    return null;
  },
  async getByokKey(): Promise<string | null> {
    const stored = await this.getStoredByokKey();
    if (stored) return stored;
    // Dev fallback: allow BYOK_API_KEY from .env so developers don't need
    // to open Settings on every fresh install / userData wipe.
    return process.env.BYOK_API_KEY || null;
  },
  async getByokKeySource(): Promise<'keychain' | 'env' | 'none'> {
    const stored = await this.getStoredByokKey();
    if (stored) return 'keychain';
    if (process.env.BYOK_API_KEY) return 'env';
    return 'none';
  },
  async setByokKey(value: string): Promise<void> {
    if (keytar) {
      await keytar.setPassword(SERVICE, ACCOUNT_BYOK_KEY, value);
      return;
    }
    const m = readFallback();
    m[ACCOUNT_BYOK_KEY] = value;
    writeFallback(m);
  },
  async clearByokKey(): Promise<void> {
    if (keytar) {
      await keytar.deletePassword(SERVICE, ACCOUNT_BYOK_KEY);
      return;
    }
    const m = readFallback();
    delete m[ACCOUNT_BYOK_KEY];
    writeFallback(m);
  },
};
