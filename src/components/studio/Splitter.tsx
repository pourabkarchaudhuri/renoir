import { useEffect, useRef } from 'react';
import { useUI } from '@/lib/store';

/**
 * Vertical draggable divider between ChatPane and PreviewPane. Updates the
 * `chatWidth` percentage in the UI store; the parent layout reads that
 * value to size both panes.
 *
 * Receives a `containerRef` so we can compute the percentage relative to
 * the row width regardless of zoom or window-resize.
 */
export function Splitter({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  const setChatWidth = useUI((s) => s.setChatWidth);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setChatWidth(pct);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [containerRef, setChatWidth]);

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
      onDoubleClick={() => setChatWidth(56)}
      className="group relative w-[6px] shrink-0 cursor-col-resize z-20"
      title="Drag to resize · double-click to reset"
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border group-hover:bg-primary/50 transition-colors" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-1 rounded-full bg-border opacity-60 group-hover:opacity-100 group-hover:bg-primary/60 transition-all" />
    </div>
  );
}
