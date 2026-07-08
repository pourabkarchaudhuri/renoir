import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, X } from 'lucide-react';
import type { PreviewSurface } from '@/lib/preview-surfaces';

export function RecordPreviewDialog({
  open,
  surface,
  effectiveMode,
  onClose,
  onRecord,
}: {
  open: boolean;
  surface: PreviewSurface;
  effectiveMode: 'scroll' | 'present';
  onClose: () => void;
  onRecord: (opts: { mode: 'static' | 'scroll' | 'present'; durationSec: number; fps: number }) => void;
}) {
  const [mode, setMode] = useState<'static' | 'scroll' | 'present'>(
    effectiveMode === 'present' ? 'present' : 'scroll',
  );
  const [durationSec, setDurationSec] = useState(6);
  const [fps, setFps] = useState(12);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="plate rounded-2xl w-full max-w-[420px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <Video className="h-4 w-4 text-primary" />
              <h3 className="font-display italic text-xl flex-1">Record preview</h3>
              <button type="button" onClick={onClose} className="btn-ghost"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-[12px] text-muted-foreground mb-4">
              Captures at {surface} resolution offscreen. Requires ffmpeg on PATH for MP4.
            </p>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'static' | 'scroll' | 'present')}
              className="w-full mb-3 text-[13px] rounded-lg border border-border bg-background px-2 py-1.5"
            >
              <option value="static">Static screenshot</option>
              <option value="scroll">Scroll walkthrough</option>
              <option value="present">Slide walkthrough</option>
            </select>
            {mode !== 'static' && (
              <>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Duration (sec)</label>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-full mb-3 text-[13px] rounded-lg border border-border bg-background px-2 py-1.5"
                />
                <label className="block text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">FPS</label>
                <input
                  type="number"
                  min={4}
                  max={30}
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-full mb-4 text-[13px] rounded-lg border border-border bg-background px-2 py-1.5"
                />
              </>
            )}
            <button
              type="button"
              className="btn-ember w-full"
              onClick={() => {
                onRecord({ mode, durationSec, fps });
                onClose();
              }}
            >
              Start recording
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
