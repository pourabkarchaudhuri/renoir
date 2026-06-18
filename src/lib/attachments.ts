// Safe-attachment filtering. Allowlist of MIME types + extension. Blocks
// risky extensions even when the MIME claims to be text. Also rejects
// double-extension tricks like "image.png.exe" or "report.pdf.scr".

export type AttachKind = 'image' | 'text' | 'diagram';

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: AttachKind;
  dataUrl?: string;   // image only
  text?: string;      // text and diagram
}

const IMAGE_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/heic', 'image/avif',
]);

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.csv', '.tsv', '.json', '.yaml', '.yml', '.toml', '.ini',
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.cs', '.php',
  '.css', '.scss', '.less',
  '.html', '.htm', '.xml', '.svg',
  '.sql', '.graphql', '.gql',
  '.sh', '.zsh', '.bash',
  '.lock',
]);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.avif',
]);

const DIAGRAM_EXTENSIONS = new Set([
  '.mmd',
]);

/**
 * Anything in this set is rejected outright — even as the *first* part of
 * a chained extension (`report.pdf.exe`). Includes Windows native, classic
 * macros, and shell scripts that an LLM should not be running.
 */
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.com', '.cmd', '.bat', '.scr', '.msi', '.dll', '.ps1', '.psm1',
  '.vbs', '.vbe', '.wsf', '.wsh',
  '.app', '.dmg', '.pkg',
  '.jar', '.class',
  '.lnk', '.pif', '.cpl',
  '.iso', '.img',
  '.reg',
  '.ade', '.adp', '.docm', '.dotm', '.xlsm', '.xltm', '.pptm', '.potm',
  '.sys', '.drv',
]);

const MAX_BYTES = 10 * 1024 * 1024;     // 10 MB per attachment
export const MAX_ATTACHMENTS = 8;

export interface Validation {
  ok: boolean;
  reason?: string;
}

function lowerExt(name: string, idx = -1): string {
  const dot = idx >= 0
    ? name.lastIndexOf('.', idx - 1)
    : name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

/**
 * Walks every dot-separated suffix and rejects if any of them look
 * dangerous. So `image.png.exe` is rejected because `.exe` appears, and
 * `report.cmd.txt` is rejected because `.cmd` appears.
 */
export function checkExtensionSafe(name: string): Validation {
  const cleaned = name.toLowerCase();
  const parts = cleaned.split('.');
  if (parts.length < 2) return { ok: false, reason: 'no extension' };
  for (let i = parts.length - 1; i >= 1; i--) {
    const ext = '.' + parts[i];
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return { ok: false, reason: `rejected extension "${ext}" in "${name}"` };
    }
  }
  // Reject confusing double-extensions where the secondary segment is
  // a known executable shape *and* the first looks like a doc.
  if (parts.length >= 3) {
    const intermediate = '.' + parts[parts.length - 2];
    if (DANGEROUS_EXTENSIONS.has(intermediate)) {
      return { ok: false, reason: `double-extension trap detected: ${name}` };
    }
  }
  return { ok: true };
}

export function classify(name: string, mime: string): { kind: AttachKind | null; reason?: string } {
  const safety = checkExtensionSafe(name);
  if (!safety.ok) return { kind: null, reason: safety.reason };
  const ext = lowerExt(name);
  if (DIAGRAM_EXTENSIONS.has(ext)) return { kind: 'diagram' };
  if (IMAGE_MIMES.has((mime || '').toLowerCase()) || IMAGE_EXTENSIONS.has(ext)) return { kind: 'image' };
  if (TEXT_EXTENSIONS.has(ext)) return { kind: 'text' };
  // Fall back to MIME — accept anything text/*.
  if ((mime || '').toLowerCase().startsWith('text/')) return { kind: 'text' };
  return { kind: null, reason: `unsupported file type: ${ext || mime || '?'}` };
}

export async function readFileAsAttachment(file: File): Promise<Attachment | { error: string }> {
  if (file.size > MAX_BYTES) return { error: `${file.name} is larger than 10 MB` };
  const cls = classify(file.name, file.type);
  if (!cls.kind) return { error: cls.reason || 'rejected' };

  if (cls.kind === 'image') {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type || 'image/png'};base64,${base64}`;
    return {
      id: cryptoRandomId(),
      name: file.name,
      mime: file.type || 'image/png',
      size: file.size,
      kind: 'image',
      dataUrl,
    };
  }

  if (cls.kind === 'diagram') {
    const text = await file.text();
    return {
      id: cryptoRandomId(),
      name: file.name,
      mime: 'text/vnd.mermaid',
      size: file.size,
      kind: 'diagram',
      text,
    };
  }

  const text = await file.text();
  return {
    id: cryptoRandomId(),
    name: file.name,
    mime: file.type || 'text/plain',
    size: file.size,
    kind: 'text',
    text,
  };
}

export async function readClipboardImage(items: DataTransferItemList | null): Promise<Attachment | null> {
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (!file) continue;
    if (!file.type.startsWith('image/')) continue;
    const r = await readFileAsAttachment(file);
    if ('error' in r) continue;
    return r;
  }
  return null;
}

function cryptoRandomId(): string {
  const a = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Build the user-message content the LLM should see.  Keeps a plain-text
 * summary of any attachments inline (so a non-vision model still gets the
 * names and sizes), and the actual image/text payload is appended for
 * provider-specific routing in the main process.
 */
export function summarizeAttachments(attachments: Attachment[]): string {
  if (!attachments.length) return '';
  const lines = attachments.map((a) => {
    if (a.kind === 'image') return `[image · ${a.name} · ${a.mime} · ${formatBytes(a.size)}]`;
    if (a.kind === 'diagram') return `[diagram · ${a.name} · ${formatBytes(a.size)}]`;
    return `[text · ${a.name} · ${formatBytes(a.size)}]`;
  });
  return lines.join('\n');
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
