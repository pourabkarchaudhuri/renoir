import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { copyText } from '@/lib/copy';
import { cn } from '@/lib/cn';

const DEFAULT_THRESHOLD = 72;

export interface ExpandableMessageProps {
  text: string;
  tone?: 'err' | 'warn' | 'info' | 'neutral';
  expandThreshold?: number;
  /** Show copy control. Defaults to true for err/warn. */
  showCopy?: boolean;
  copyLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
  className?: string;
  textClassName?: string;
  actionsClassName?: string;
  /** Force monospace when expanded (default: true for err/warn). */
  mono?: boolean;
  onExpand?: () => void;
}

export function ExpandableMessage({
  text,
  tone = 'neutral',
  expandThreshold = DEFAULT_THRESHOLD,
  showCopy,
  copyLabel = 'Copy',
  expandLabel = 'Show full message',
  collapseLabel = 'Show less',
  className,
  textClassName,
  actionsClassName,
  mono,
  onExpand,
}: ExpandableMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const canExpand = text.length > expandThreshold || /\n/.test(text);
  const useMono = mono ?? (tone === 'err' || tone === 'warn');
  const copyEnabled = showCopy ?? (tone === 'err' || tone === 'warn');

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) onExpand?.();
  };

  const onCopy = async () => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={className}>
      <p
        className={cn(
          !expanded && canExpand && 'line-clamp-2',
          expanded && 'whitespace-pre-wrap break-words max-h-56 overflow-y-auto scroll-thin',
          expanded && useMono && 'font-mono text-[12.5px] leading-relaxed',
          textClassName,
        )}
      >
        {text}
      </p>
      {(canExpand || copyEnabled) && (
        <div className={cn('mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1', actionsClassName)}>
          {canExpand && (
            <button
              type="button"
              onClick={toggleExpanded}
              className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  {collapseLabel}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  {expandLabel}
                </>
              )}
            </button>
          )}
          {copyEnabled && (
            <button
              type="button"
              onClick={() => void onCopy()}
              className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  {copyLabel}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
