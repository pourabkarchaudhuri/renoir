import { useEffect, useState } from 'react';
import { useCatalog, useUI } from '@/lib/store';
import { KeyRound, Eye, EyeOff, Save, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { motion, AnimatePresence } from 'framer-motion';

export function ByokInline() {
  const byok = useCatalog((s) => s.byok);
  const azure = useCatalog((s) => s.azure);
  const refresh = useCatalog((s) => s.refresh);
  const toast = useUI((s) => s.toast);

  const [expanded, setExpanded] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Seed form fields from store on mount / when byok changes
  useEffect(() => {
    if (byok) {
      setBaseUrl(byok.baseUrl || '');
      setModel(byok.model || '');
    }
  }, [byok]);

  const llmOk = Boolean(byok?.hasKey && byok?.baseUrl);
  const imgOk = Boolean(azure?.configured);

  const save = async () => {
    try {
      await window.renoir.byokSet({
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        apiKey: apiKey || undefined,
      });
      setApiKey('');
      await refresh();
      toast('LLM credentials saved', 'ok');
    } catch (err: any) {
      toast(err?.message || 'Failed to save credentials', 'err');
    }
  };

  const clear = async () => {
    try {
      await window.renoir.byokClear();
      setBaseUrl('');
      setModel('');
      setApiKey('');
      await refresh();
      toast('LLM credentials cleared', 'info');
    } catch (err: any) {
      toast(err?.message || 'Failed to clear credentials', 'err');
    }
  };

  return (
    <div className="plate-soft rounded-xl">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left"
      >
        <KeyRound className="h-3 w-3 text-primary" strokeWidth={1.6} />
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
          LLM Key
        </span>
        <span className={cn('h-1.5 w-1.5 rounded-full ml-1', llmOk ? 'bg-emerald-400' : 'bg-muted-foreground/40')} />
        <span className={cn('h-1.5 w-1.5 rounded-full', imgOk ? 'bg-emerald-400' : 'bg-muted-foreground/40')} />
        <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform', expanded && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="input-base font-mono text-[11px] w-full"
              />
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o"
                className="input-base font-mono text-[11px] w-full"
              />
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={byok?.hasKey ? '•••• stored ••••' : 'sk-…'}
                  className="input-base font-mono text-[11px] w-full pr-8"
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
              <div className="flex gap-1.5">
                <button onClick={save} className="btn-ember text-[11px] py-1">
                  <Save className="h-3 w-3" /> Save
                </button>
                {byok?.hasKey && (
                  <button onClick={clear} className="btn-quiet text-[11px] py-1 text-red-300 hover:text-red-200">
                    <Trash2 className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
