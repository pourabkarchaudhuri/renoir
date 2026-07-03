import { useEffect, useMemo, useState } from 'react';
import { useUI } from '@/lib/store';
import { ExpandableMessage } from '@/components/chrome/ExpandableMessage';

interface MermaidBlockProps {
  /** Raw Mermaid diagram source text */
  source: string;
  /** Unique ID for this diagram instance (for mermaid.render) */
  id: string;
}

interface MermaidRenderState {
  status: 'loading' | 'rendered' | 'error';
  svg: string | null;
  error: string | null;
}

// Singleton module cache — mermaid is loaded at most once across all instances
let mermaidModule: typeof import('mermaid') | null = null;
let mermaidLoadPromise: Promise<typeof import('mermaid')> | null = null;
let initializedTheme: 'dark' | 'default' | null = null;

async function loadMermaid(theme: 'dark' | 'light'): Promise<typeof import('mermaid')> {
  if (mermaidModule) {
    // Re-initialize if theme changed
    const desiredTheme = theme === 'dark' ? 'dark' : 'default';
    if (initializedTheme !== desiredTheme) {
      mermaidModule.default.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: desiredTheme,
        fontFamily: 'inherit',
      });
      initializedTheme = desiredTheme;
    }
    return mermaidModule;
  }

  if (!mermaidLoadPromise) {
    mermaidLoadPromise = import('mermaid').then((mod) => {
      mermaidModule = mod;
      const desiredTheme = theme === 'dark' ? 'dark' : 'default';
      mod.default.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: desiredTheme,
        fontFamily: 'inherit',
      });
      initializedTheme = desiredTheme;
      return mod;
    });
  }

  return mermaidLoadPromise;
}

export function MermaidBlock({ source, id }: MermaidBlockProps) {
  const theme = useUI((s) => s.theme);
  const [state, setState] = useState<MermaidRenderState>({
    status: 'loading',
    svg: null,
    error: null,
  });

  // Memoize source to avoid re-rendering unchanged diagrams
  const stableSource = useMemo(() => source, [source]);

  useEffect(() => {
    let cancelled = false;

    setState({ status: 'loading', svg: null, error: null });

    loadMermaid(theme)
      .then(async (mod) => {
        if (cancelled) return;
        const { svg } = await mod.default.render(id, stableSource);
        if (!cancelled) {
          setState({ status: 'rendered', svg, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            svg: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [stableSource, id, theme]);

  if (state.status === 'loading') {
    return <LoadingSkeleton />;
  }

  if (state.status === 'error') {
    return (
      <div className="my-2 rounded-lg border border-red-500/40 bg-red-500/5 overflow-hidden">
        <div className="px-3 py-2 border-b border-red-500/20">
          <div className="flex items-center gap-1.5 text-[11px] text-red-700 dark:text-red-300">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
            </svg>
            <span>Diagram render failed</span>
          </div>
          {state.error && (
            <ExpandableMessage
              text={state.error}
              tone="err"
              textClassName="mt-1.5 text-[10.5px] text-red-700/90 dark:text-red-200/90"
              copyLabel="Copy error"
              expandLabel="Show full error"
            />
          )}
        </div>
        <pre className="px-3 py-2 text-[12px] leading-relaxed overflow-x-auto text-foreground/80 font-mono whitespace-pre-wrap">
          {source}
        </pre>
      </div>
    );
  }

  return (
    <div
      className="my-2 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: state.svg! }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="my-2 rounded-lg plate p-4 animate-pulse">
      <div className="flex flex-col items-center gap-2">
        <div className="h-3 w-24 rounded bg-muted-foreground/20" />
        <div className="h-20 w-full max-w-[300px] rounded bg-muted-foreground/10" />
        <div className="h-3 w-16 rounded bg-muted-foreground/15" />
      </div>
    </div>
  );
}
