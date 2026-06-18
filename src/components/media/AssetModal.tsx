import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FolderOpen, ImageIcon, Loader2 } from 'lucide-react';
import { useUI } from '@/lib/store';

export type AssetKind = 'image' | 'video' | 'audio';

export interface AssetItem {
  url: string;
  savedPath: string;
  createdAt: string;
  sizeBytes?: number;
  kind: AssetKind;
}

interface Props {
  open: boolean;
  asset: AssetItem | null;
  onClose: () => void;
}

const IMAGE_FORMATS = [
  { id: 'png',  label: 'PNG',  mime: 'image/png'  },
  { id: 'jpg',  label: 'JPEG', mime: 'image/jpeg' },
  { id: 'webp', label: 'WebP', mime: 'image/webp' },
];

export function AssetModal({ open, asset, onClose }: Props) {
  const toast = useUI((s) => s.toast);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const downloadAs = async (mime: string, ext: string) => {
    if (!asset || asset.kind !== 'image') return;
    setBusy(ext);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = asset.url;
      await new Promise((res, rej) => { img.onload = () => res(null); img.onerror = rej; });
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      // For JPEG, paint an opaque white background under transparency.
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), mime, 0.92));
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const baseName = (asset.savedPath.split(/[\\/]/).pop() || 'asset').replace(/\.[^.]+$/, '');
      link.download = `${baseName}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      toast(`Downloaded ${ext.toUpperCase()}`, 'ok');
    } catch (err: any) {
      toast(err?.message || 'download failed', 'err');
    } finally {
      setBusy(null);
    }
  };

  const downloadOriginal = async () => {
    if (!asset) return;
    setBusy('orig');
    try {
      const r = await fetch(asset.url);
      const b = await r.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(b);
      link.download = asset.savedPath.split(/[\\/]/).pop() || 'asset';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      toast('Downloaded', 'ok');
    } catch (err: any) {
      toast(err?.message || 'download failed', 'err');
    } finally {
      setBusy(null);
    }
  };

  const reveal = async () => {
    await window.renoir.openWorkspace();
    toast('Workspace folder opened', 'info');
  };

  return (
    <AnimatePresence>
      {open && asset && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="plate rounded-2xl w-full max-w-[1080px] max-h-[88vh] flex flex-col overflow-hidden"
          >
            <header className="px-5 py-3 border-b border-border flex items-center gap-3">
              <ImageIcon className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Asset</div>
                <div className="font-mono text-[12px] truncate" title={asset.savedPath}>
                  {asset.savedPath.split(/[\\/]/).pop()}
                </div>
              </div>
              <button onClick={onClose} className="btn-ghost"><X className="h-4 w-4" /></button>
            </header>

            <div className="flex-1 grid place-items-center p-5 overflow-auto scroll-thin bg-canvas/50">
              {asset.kind === 'image' && (
                <img src={asset.url} alt="" className="max-w-full max-h-full rounded-lg ring-1 ring-border" />
              )}
              {asset.kind === 'video' && (
                <video controls autoPlay className="max-w-full max-h-full rounded-lg ring-1 ring-border bg-black" src={asset.url} />
              )}
              {asset.kind === 'audio' && (
                <div className="w-full max-w-[520px] flex flex-col items-center gap-3 plate rounded-xl p-6">
                  <div className="font-display italic text-2xl">Audio</div>
                  <audio controls autoPlay className="w-full" src={asset.url} />
                </div>
              )}
            </div>

            <footer className="px-5 py-3 border-t border-border flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted-foreground">
                {new Date(asset.createdAt).toLocaleString()}
                {typeof asset.sizeBytes === 'number' && ` · ${formatBytes(asset.sizeBytes)}`}
              </span>
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                <button onClick={reveal} className="btn-ghost text-[12px]" title="Reveal in workspace">
                  <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Reveal
                </button>
                <button onClick={downloadOriginal} className="btn-quiet text-[12px]" disabled={busy === 'orig'}>
                  {busy === 'orig' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download
                </button>
                {asset.kind === 'image' && IMAGE_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => downloadAs(f.mime, f.id)}
                    className="btn-ghost text-[11.5px]"
                    disabled={busy === f.id}
                    title={`Convert and download as ${f.label}`}
                  >
                    {busy === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {f.label}
                  </button>
                ))}
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
