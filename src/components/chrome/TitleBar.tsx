import { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

export function TitleBar() {
  const [platform, setPlatform] = useState<NodeJS.Platform | 'unknown'>('unknown');
  useEffect(() => {
    setPlatform((window.renoir?.platform ?? 'unknown') as NodeJS.Platform);
  }, []);

  const isMac = platform === 'darwin';

  return (
    <div className="titlebar-drag h-9 flex items-center justify-between px-3 border-b border-border bg-background/80 backdrop-blur-md relative z-30 text-foreground">
      <div className="flex items-center gap-2.5">
        {isMac ? (
          <div className="flex items-center gap-1.5 ml-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
        ) : (
          <BrandMark />
        )}
        <span className="text-[12px] tracking-[0.3em] uppercase text-muted-foreground/80 ml-1">
          Renoir
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
          local · BYOK
        </span>
      </div>

      {!isMac && (
        <div className="titlebar-no-drag flex items-center -mr-3">
          {/* Win11 native controls render via titleBarOverlay; we leave the slot empty. */}
        </div>
      )}
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 256 256" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="titlebar-ember" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316"/>
            <stop offset="50%" stopColor="#ef4444"/>
            <stop offset="100%" stopColor="#c026d3"/>
          </linearGradient>
        </defs>
        <rect width="256" height="256" rx="48" fill="#0c0e14"/>
        <path d="M88 184 C88 184 90 100 110 80 C130 60 158 65 163 88 C168 111 140 120 125 125 C110 130 148 135 158 155 C168 175 173 195 173 195"
              stroke="url(#titlebar-ember)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M192 58 L195 66 L203 69 L195 72 L192 80 L189 72 L181 69 L189 66 Z" fill="#f97316" opacity="0.9"/>
      </svg>
    </div>
  );
}
