import { FileDown, FileText, FileType } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';
import type { ExportFormat } from '@shared/export/types';
import { useSkillExport } from '@/lib/use-skill-export';

const FORMATS: { format: ExportFormat; label: string; icon: typeof FileText }[] = [
  { format: 'pdf', label: 'PDF', icon: FileText },
  { format: 'docx', label: 'Word (.docx)', icon: FileType },
  { format: 'markdown', label: 'Markdown (.md)', icon: FileDown },
];

export function SkillExportMenu({
  skillId,
  streaming = false,
}: {
  skillId: string | undefined;
  streaming?: boolean;
}) {
  const { canExport, exportSkill } = useSkillExport(skillId, streaming);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={!canExport}>
        <button
          type="button"
          disabled={!canExport}
          className={cn(
            'btn-ghost text-[12px] h-7 px-2.5 gap-1.5 font-medium',
            canExport ? 'text-foreground' : 'text-muted-foreground opacity-50 cursor-not-allowed',
          )}
          title={canExport ? 'Export document' : 'Generate content to enable export'}
        >
          <FileDown className="h-3.5 w-3.5" strokeWidth={1.6} />
          Export
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="plate rounded-lg p-1 shadow-plate min-w-[180px] z-50"
          sideOffset={6}
          align="end"
        >
          {FORMATS.map(({ format, label, icon: Icon }) => (
            <DropdownMenu.Item
              key={format}
              className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] rounded-md cursor-pointer outline-none hover:bg-accent focus:bg-accent"
              onSelect={() => { void exportSkill(format); }}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
              {label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
