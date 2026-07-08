import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCompare, Smartphone, Tablet, Monitor, Maximize2, ScrollText, Presentation } from 'lucide-react';
import { useStudio, useUI } from '@/lib/store';
import { ensureViewportMeta, PREVIEW_SURFACES, type PreviewSurface } from '@/lib/preview-surfaces';
import { defaultModeForSkill, wrapWithBridge, type PreviewMode } from '@/lib/preview-modes';
import { normalizeArtifactDocument } from '@/lib/artifact-html';
import { DevicePreviewFrame } from './DevicePreviewFrame';
import { isFeatureEnabled } from '@/lib/features';
import { cn } from '@/lib/cn';

interface Props {
  open: boolean;
  aId: string | null;
  bId: string | null;
  onClose: () => void;
}

export function DiffDialog({ open, aId, bId, onClose }: Props) {
  const project = useStudio((s) => s.project);
  const skillId = useStudio((s) => s.selectedSkillId);
  const surface = useUI((s) => s.previewSurface);
  const [mode, setMode] = useState<PreviewMode>('scroll');
  const iframeA = useRef<HTMLIFrameElement | null>(null);
  const iframeB = useRef<HTMLIFrameElement | null>(null);
  const syncLock = useRef(false);

  const versions = project?.versions || [];
  const a = versions.find((v) => v.id === aId);
  const b = versions.find((v) => v.id === bId);

  const effectiveMode = skillId === 'product-deck' ? 'present' as PreviewMode : mode;

  const wrap = useCallback((html: string) => {
    const title = project?.name?.trim() || 'Artifact';
    const normalized = normalizeArtifactDocument(html, {
      title,
      viewportWidth: PREVIEW_SURFACES[surface].w,
      dashboard: skillId === 'dashboard',
      productDeck: skillId === 'product-deck',
      productName: title,
      productDeckFinalize: true,
    });
    return wrapWithBridge(ensureViewportMeta(normalized, PREVIEW_SURFACES[surface].w));
  }, [project?.name, surface, skillId]);

  const aDoc = a ? wrap(a.html) : null;
  const bDoc = b ? wrap(b.html) : null;

  useEffect(() => {
    if (!open || !isFeatureEnabled('scrollSyncDiff') || effectiveMode !== 'scroll') return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== 'renoir:scroll' || syncLock.current) return;
      const y = e.data.y as number;
      const fromA = iframeA.current?.contentWindow && e.source === iframeA.current.contentWindow;
      const fromB = iframeB.current?.contentWindow && e.source === iframeB.current.contentWindow;
      if (!fromA && !fromB) return;
      syncLock.current = true;
      const target = fromA ? iframeB.current : iframeA.current;
      target?.contentWindow?.postMessage({ type: 'renoir:scroll-sync', y }, '*');
      setTimeout(() => { syncLock.current = false; }, 60);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [open, effectiveMode]);

  return (
    <AnimatePresence>
      {open && a && b && aDoc && bDoc && (
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
            transition={{ duration: 0.18 }}
            className="plate rounded-2xl w-full max-w-[1400px] h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
              <GitCompare className="h-4 w-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Diff</div>
                <h3 className="font-display italic text-xl">Side by side.</h3>
              </div>
              <DiffSurfaceTabs />
              {skillId !== 'product-deck' && (
                <DiffModeTabs mode={effectiveMode} onChange={setMode} />
              )}
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {PREVIEW_SURFACES[surface].w}×{PREVIEW_SURFACES[surface].h}
              </span>
              <button onClick={onClose} className="btn-ghost"><X className="h-4 w-4" /></button>
            </header>
            <div className="grid grid-cols-2 gap-3 p-3 flex-1 min-h-0">
              <DiffPane
                label={`${a.source} · ${new Date(a.createdAt).toLocaleString()}`}
                srcDoc={aDoc}
                surface={surface}
                mode={effectiveMode}
                constrainToViewport={skillId === 'dashboard'}
                setIframeRef={(el) => { iframeA.current = el; }}
              />
              <DiffPane
                label={`${b.source} · ${new Date(b.createdAt).toLocaleString()}`}
                srcDoc={bDoc}
                surface={surface}
                mode={effectiveMode}
                constrainToViewport={skillId === 'dashboard'}
                setIframeRef={(el) => { iframeB.current = el; }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DiffPane({
  label,
  srcDoc,
  surface,
  mode,
  constrainToViewport,
  setIframeRef,
}: {
  label: string;
  srcDoc: string;
  surface: PreviewSurface;
  mode: PreviewMode;
  constrainToViewport?: boolean;
  setIframeRef: (el: HTMLIFrameElement | null) => void;
}) {
  return (
    <div className="flex flex-col plate rounded-xl overflow-hidden min-h-0">
      <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70 border-b border-border shrink-0">
        {label}
      </div>
      <div className="relative flex-1 min-h-[320px] bg-canvas/30">
        <DevicePreviewFrame
          surface={surface}
          mode={mode}
          srcDoc={srcDoc}
          setIframeRef={setIframeRef}
          visible
          constrainToViewport={constrainToViewport}
          lockScroll={mode === 'present'}
        />
      </div>
    </div>
  );
}

function DiffSurfaceTabs() {
  const surface = useUI((s) => s.previewSurface);
  const setSurface = useUI((s) => s.setPreviewSurface);
  const tabs: { id: PreviewSurface; icon: React.ReactNode }[] = [
    { id: 'phone', icon: <Smartphone className="h-3.5 w-3.5" /> },
    { id: 'tablet', icon: <Tablet className="h-3.5 w-3.5" /> },
    { id: 'desktop', icon: <Monitor className="h-3.5 w-3.5" /> },
    { id: 'ultrawide', icon: <Maximize2 className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="flex items-center gap-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setSurface(t.id)}
          className={cn(
            'h-7 w-7 grid place-items-center rounded-md',
            surface === t.id ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-muted-foreground hover:bg-accent',
          )}
          title={PREVIEW_SURFACES[t.id].label}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function DiffModeTabs({ mode, onChange }: { mode: PreviewMode; onChange: (m: PreviewMode) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onChange('scroll')}
        className={cn('h-7 w-7 grid place-items-center rounded-md', mode === 'scroll' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}
        title="Scroll"
      >
        <ScrollText className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange('present')}
        className={cn('h-7 w-7 grid place-items-center rounded-md', mode === 'present' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}
        title="Slide"
      >
        <Presentation className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
