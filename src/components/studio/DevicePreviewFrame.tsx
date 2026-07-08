import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  computePreviewScale,
  frameDimensions,
  measurePreviewContainer,
  type PreviewSurface,
} from '@/lib/preview-surfaces';
import type { PreviewMode } from '@/lib/preview-modes';
import { cn } from '@/lib/cn';

interface DevicePreviewFrameProps {
  surface: PreviewSurface;
  mode: PreviewMode;
  srcDoc: string;
  setIframeRef: (el: HTMLIFrameElement | null) => void;
  visible: boolean;
  /** Keep the frame at the device viewport size (dashboard-style apps). */
  constrainToViewport?: boolean;
  /** Disable iframe scrolling (deck present mode). */
  lockScroll?: boolean;
  className?: string;
}

/** Configure viewport; reload charts only when this device is active/visible. */
function syncIframePreview(
  win: Window | null | undefined,
  deviceW: number,
  mode: PreviewMode,
  renderCharts: boolean,
) {
  if (!win) return;
  const post = (msg: unknown) => win.postMessage(msg, '*');
  post({ type: 'renoir:set-viewport', width: deviceW });
  post({ type: 'renoir:set-mode', mode });
  if (renderCharts) {
    post({ type: 'renoir:probe' });
    post({ type: 'renoir:reload' });
  }
}

/**
 * Renders an artifact iframe at the exact device pixel size, uniformly scaled
 * to fit the preview pane while preserving the device aspect ratio.
 */
export function DevicePreviewFrame({
  surface,
  mode,
  srcDoc,
  setIframeRef,
  visible,
  constrainToViewport = false,
  lockScroll = false,
  className,
}: DevicePreviewFrameProps) {
  const { w: deviceW, h: deviceH } = frameDimensions(surface, mode);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [scale, setScale] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { w, h } = measurePreviewContainer(el);
    if (w < 48 || h < 48) return;
    setScale(computePreviewScale(w, h, deviceW, deviceH, 0));
  }, [deviceW, deviceH]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    const parent = el?.parentElement;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    setScale(null);
  }, [surface, mode, deviceW, deviceH]);

  useLayoutEffect(() => {
    if (!visible) return;
    measure();
    const raf = window.requestAnimationFrame(measure);
    const timers = [50, 150, 400].map((ms) => window.setTimeout(measure, ms));
    return () => {
      window.cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [visible, measure, srcDoc, surface, mode]);

  const scheduleSync = useCallback((win: Window | null | undefined, renderCharts: boolean) => {
    if (!win) return () => {};
    const run = () => syncIframePreview(win, deviceW, mode, renderCharts && visibleRef.current);
    const delays = renderCharts ? [0, 80, 200, 500, 1000] : [0];
    const timers = delays.map((ms) => window.setTimeout(run, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [deviceW, mode]);

  // Full chart reload when this device becomes visible.
  useEffect(() => {
    if (!visible) return;
    return scheduleSync(iframeRef.current?.contentWindow ?? null, true);
  }, [visible, srcDoc, deviceW, mode, scheduleSync]);

  const displayW = scale != null ? deviceW * scale : 0;
  const displayH = scale != null ? deviceH * scale : 0;

  return (
    <div
      ref={containerRef}
      aria-hidden={!visible}
      className={cn(
        'absolute inset-0 w-full h-full min-h-0 flex justify-center overflow-hidden grain',
        mode === 'scroll' ? 'items-start' : 'items-center',
        constrainToViewport ? 'p-8' : 'p-4',
        visible ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none',
        className,
      )}
    >
      {scale != null && (
        <div
          className="rounded-2xl overflow-hidden shadow-plate ring-1 ring-border/60 shrink-0 bg-white relative"
          style={{
            width: displayW,
            height: displayH,
          }}
        >
          <iframe
            ref={(el) => {
              iframeRef.current = el;
              setIframeRef(el);
            }}
            title={`preview-${surface}`}
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            onLoad={() => {
              scheduleSync(iframeRef.current?.contentWindow ?? null, visibleRef.current);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: deviceW,
              height: deviceH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              background: 'white',
              border: 0,
              display: 'block',
              overflow: lockScroll || mode === 'present' ? 'hidden' : 'auto',
            }}
          />
        </div>
      )}
    </div>
  );
}
