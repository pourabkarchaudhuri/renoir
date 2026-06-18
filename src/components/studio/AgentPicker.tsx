import { useState } from 'react';
import { Cpu, ChevronDown, Check, Wrench } from 'lucide-react';
import { useCatalog, useStudio } from '@/lib/store';
import { cn } from '@/lib/cn';
import { motion, AnimatePresence } from 'framer-motion';

export function AgentPicker() {
  const agents = useCatalog((s) => s.agents);
  const byok   = useCatalog((s) => s.byok);
  const selected = useStudio((s) => s.selectedAgentId);
  const setAgent = useStudio((s) => s.setAgent);
  const [open, setOpen] = useState(false);

  const installed  = agents.filter((a) => a.available);
  const missing    = agents.filter((a) => !a.available);
  const currentAgent = agents.find((a) => a.id === selected);
  const isByok = !selected || selected === 'byok';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] transition-colors',
          'plate hover:shadow-glow',
        )}
      >
        <Cpu className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium tracking-tight">
          {isByok ? `BYOK · ${byok?.model || 'no model'}` : currentAgent?.name || 'agent'}
        </span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="absolute z-50 left-0 mt-2 w-[300px] plate rounded-xl p-2 shadow-plate max-h-[70vh] overflow-y-auto scroll-thin"
          >
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
              Routing
            </div>
            <Row
              active={isByok}
              onClick={() => { setAgent('byok'); setOpen(false); }}
              title={`BYOK · ${byok?.model || 'unset'}`}
              sub={byok?.hasKey ? byok?.baseUrl : 'No key configured — set in Settings'}
              icon={<Wrench className="h-3.5 w-3.5 text-primary" />}
            />
            {installed.length > 0 && (
              <>
                <div className="px-2 py-1.5 mt-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                  CLI agents on PATH
                </div>
                {installed.map((a) => (
                  <Row
                    key={a.id}
                    active={selected === a.id}
                    onClick={() => { setAgent(a.id); setOpen(false); }}
                    title={a.name}
                    sub={a.blurb}
                  />
                ))}
              </>
            )}
            {missing.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/50 hover:text-muted-foreground">
                  Not on PATH ({missing.length})
                </summary>
                <ul className="px-2 pb-1 space-y-1">
                  {missing.map((a) => (
                    <li key={a.id} className="text-[11px] text-muted-foreground/60 py-0.5">
                      <span className="font-medium text-muted-foreground/80">{a.name}</span>
                      <span className="font-mono text-[10px] ml-1">({a.bin})</span>
                      <div className="text-[10px] text-muted-foreground/40 mt-0.5">
                        {a.id === 'kiro' && 'Install: kiro.dev/cli → kiro-cli'}
                        {a.id === 'cursor' && 'Install: irm https://cursor.com/install | iex'}
                        {a.id === 'claude-code' && 'Install: npm i -g @anthropic-ai/claude-code'}
                        {a.id === 'gemini' && 'Install: npm i -g @anthropic-ai/gemini'}
                        {a.id === 'codex' && 'Install: npm i -g @openai/codex'}
                        {!['kiro', 'cursor', 'claude-code', 'gemini', 'codex'].includes(a.id) && `Add ${a.bin} to PATH`}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  active, onClick, title, sub, icon,
}: { active: boolean; onClick: () => void; title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-md px-2.5 py-2 flex items-start gap-2 transition-colors',
        active ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-accent',
      )}
    >
      {icon ?? <span className="h-3.5 w-3.5" />}
      <span className="flex-1 min-w-0">
        <span className="block text-[12.5px] font-medium tracking-tight">{title}</span>
        {sub && <span className="block text-[11px] opacity-70 truncate">{sub}</span>}
      </span>
      {active && <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-1" />}
    </button>
  );
}
