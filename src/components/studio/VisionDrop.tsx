import { useRef, useState } from 'react';
import { Eye, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { useStudio, useUI } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';

export function VisionDrop() {
  const setDraft = useStudio((s) => s.setDraft);
  const draft    = useStudio((s) => s.draft);
  const toast    = useUI((s) => s.toast);
  const fileRef  = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const onPick = (file: File | null) => {
    if (!file) return;
    setOpen(true);
    void run(file);
  };

  const run = async (file: File) => {
    setBusy(true);
    try {
      const arrayBuf = await file.arrayBuffer();
      const buf = new Uint8Array(arrayBuf);
      // Convert to base64 in chunks to avoid call-stack blow up on big images
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      setPreview(`data:${file.type};base64,${base64}`);

      const res = await window.renoir.visionDescribe({
        imageBase64: base64,
        imageMime: file.type || 'image/png',
      });
      if (res.ok && res.description) {
        const sep = draft.trim() ? '\n\n' : '';
        setDraft(`${draft}${sep}Reference image notes:\n${res.description}`);
        toast('Image described — appended to draft', 'ok');
      } else {
        toast(res.error || 'vision failed', 'err');
      }
    } catch (err: any) {
      toast(err?.message || 'vision error', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => fileRef.current?.click()}
        className="btn-ghost text-[12px]"
        title="Drop a reference image — vision describes it into the draft"
      >
        <Eye className="h-3.5 w-3.5" />
        Vision
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6"
            onClick={() => !busy && setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="plate rounded-2xl w-full max-w-[460px] p-5 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => !busy && setOpen(false)}
                className="absolute top-3 right-3 btn-ghost"
                disabled={busy}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Vision</div>
              <h3 className="font-display italic text-2xl mt-0.5">Reading reference…</h3>
              <p className="text-[12px] text-muted-foreground mt-1">
                The model will describe the image as a brand brief and append it to your composer.
              </p>

              <div className="mt-4 grid place-items-center plate-soft rounded-xl p-4 min-h-[180px]">
                {preview ? (
                  <img src={preview} alt="ref" className="max-h-[220px] rounded-md ring-1 ring-border" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              {busy && (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Describing…
                </div>
              )}
              {!busy && preview && (
                <div className="mt-3 text-[12px] text-emerald-300">
                  Done — composer updated. Close this dialog.
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
