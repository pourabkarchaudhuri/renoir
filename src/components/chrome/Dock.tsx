import { Home as HomeIcon, Sparkles, Images, Settings as SettingsIcon, Wand2 } from 'lucide-react';
import { useUI, useCatalog, type Route } from '@/lib/store';
import { cn } from '@/lib/cn';
import { motion } from 'framer-motion';

const ITEMS: { id: Route; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home',     label: 'Home',     icon: HomeIcon },
  { id: 'studio',   label: 'Studio',   icon: Sparkles },
  { id: 'media',    label: 'Media',    icon: Wand2 },
  { id: 'gallery',  label: 'Gallery',  icon: Images },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function Dock() {
  const route = useUI((s) => s.route);
  const setRoute = useUI((s) => s.setRoute);
  const azure = useCatalog((s) => s.azure);
  const byok = useCatalog((s) => s.byok);

  return (
    <aside className="w-[68px] flex flex-col items-center justify-between py-4 border-r border-border bg-background/40 backdrop-blur-md relative z-20">
      <div className="flex flex-col items-center gap-1.5">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = route === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setRoute(item.id)}
              className={cn(
                'relative h-11 w-11 rounded-xl grid place-items-center text-muted-foreground transition-colors',
                'hover:text-foreground hover:bg-accent',
                active && 'text-primary bg-accent',
              )}
              title={item.label}
            >
              {active && (
                <motion.span
                  layoutId="dock-active"
                  className="absolute inset-0 rounded-xl ring-1 ring-primary/40 bg-primary/5"
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                />
              )}
              <Icon className="h-[18px] w-[18px] relative z-10" />
              <span className="absolute -right-1 top-1.5 h-1.5 w-1.5 rounded-full opacity-0" />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <StatusDot
          on={Boolean(byok?.hasKey && byok?.baseUrl)}
          label="LLM"
        />
        <StatusDot
          on={Boolean(azure?.configured)}
          label="IMG"
        />
      </div>
    </aside>
  );
}

function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          on ? 'bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.45)]' : 'bg-muted-foreground/40',
        )}
        title={`${label} ${on ? 'configured' : 'not configured'}`}
      />
      <span className="text-[8px] uppercase tracking-[0.25em] text-muted-foreground/60">
        {label}
      </span>
    </div>
  );
}
