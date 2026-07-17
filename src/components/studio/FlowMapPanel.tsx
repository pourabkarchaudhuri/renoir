import { useMemo } from 'react';
import { Map } from 'lucide-react';
import { useStudio, useUI } from '@/lib/store';
import { parseFlowScreens } from '@/lib/flow-screens';
import { isFeatureEnabled } from '@/lib/features';
import { cn } from '@/lib/cn';

const PROTOTYPE_SKILLS = new Set([
  'web-prototype', 'mobile-onboarding', 'gamified-app', 'mobile-app',
  'mobile-onboarding', 'wireframe-sketch', 'saas-landing', 'kami-landing',
]);

export function FlowMapPanel({
  artifactHtml,
  onNavigate,
}: {
  artifactHtml: string | null;
  onNavigate: (screenId: string) => void;
}) {
  const skillId = useStudio((s) => s.selectedSkillId);
  const activeFlowScreenId = useUI((s) => s.activeFlowScreenId);

  const screens = useMemo(
    () => (artifactHtml ? parseFlowScreens(artifactHtml, skillId) : []),
    [artifactHtml, skillId],
  );

  if (!isFeatureEnabled('flowMap')) return null;
  if (!skillId || !PROTOTYPE_SKILLS.has(skillId)) return null;
  if (screens.length < 2) return null;

  return (
    <div className="border-t border-border px-3 py-3 shrink-0 max-h-[200px] overflow-y-auto scroll-thin">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
        <Map className="h-3 w-3" />
        Flow map
      </div>
      <ul className="space-y-0.5">
        {screens.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onNavigate(s.id)}
              className={cn(
                'w-full text-left rounded-md px-2 py-1.5 text-[11px] transition-colors truncate',
                activeFlowScreenId === s.id
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'hover:bg-accent text-foreground',
              )}
              title={s.label}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
