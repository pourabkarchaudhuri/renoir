import { useRef, useState } from 'react';
import { Loader2, Pipette, Save } from 'lucide-react';
import { useCatalog, useUI } from '@/lib/store';

export function ColorExtractor({ onSaved }: { onSaved: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useUI((s) => s.toast);
  const refreshCatalog = useCatalog((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [swatches, setSwatches] = useState<string[]>([]);
  const [hexes, setHexes] = useState<string[]>([]);
  const [name, setName] = useState('');

  const onPick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      const base64 = btoa(binary);
      setPreview(`data:${file.type};base64,${base64}`);
      const r = await window.renoir.colorsExtract({
        imageBase64: base64,
        imageMime: file.type || 'image/png',
        k: 6,
      });
      if (r.ok) {
        setSwatches(r.swatches || []);
        setHexes(r.hexes || []);
      } else {
        toast(r.error || 'extraction failed', 'err');
      }
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!swatches.length) return;
    const sysName = name.trim() || `Extracted · ${new Date().toLocaleDateString()}`;
    await window.renoir.saveCustomSystem({
      id: 'extracted_' + Math.random().toString(36).slice(2, 8),
      name: sysName,
      vibe: 'Extracted from image',
      font: 'Inter / Inter',
      swatches,
      tokens: [
        { name: 'bg',      value: swatches[0] },
        { name: 'surface', value: swatches[1] || swatches[0] },
        { name: 'fg',      value: swatches[swatches.length - 1] },
        { name: 'accent',  value: swatches[Math.floor(swatches.length / 2)] },
        { name: 'muted',   value: swatches[Math.floor(swatches.length * 0.7)] },
      ],
    });
    await onSaved();
    await refreshCatalog();
    setSwatches([]); setHexes([]); setPreview(null); setName('');
    toast('Saved as custom system', 'ok');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button onClick={() => fileRef.current?.click()} className="btn-quiet">
          <Pipette className="h-4 w-4" />
          Drop or pick image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />
        {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      </div>
      {preview && (
        <div className="flex items-center gap-3">
          <img src={preview} alt="ref" className="h-16 w-16 object-cover rounded-md ring-1 ring-border" />
          <div className="flex-1 flex gap-1.5">
            {swatches.map((c, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="block h-10 w-full rounded-md ring-1 ring-border" style={{ background: c }} />
                <span className="text-[10px] font-mono text-muted-foreground/80">{hexes[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {swatches.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name for the new design system…"
            className="input-base flex-1 text-[12.5px]"
          />
          <button onClick={save} className="btn-ember">
            <Save className="h-4 w-4" />
            Save as system
          </button>
        </div>
      )}
    </div>
  );
}
