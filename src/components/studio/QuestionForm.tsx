import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useStudio } from '@/lib/store';

interface Field {
  id: string;
  label: string;
  type: string;
  options?: string[];
}

/**
 * Attempt to infer a value for a brief field from the user's original prompt.
 * Uses keyword matching against the field id and label to extract relevant
 * fragments from the user's messages.
 */
function inferFieldValues(
  fields: Field[],
  conversation: { role: string; content: string }[],
): Record<string, string> {
  const userText = conversation
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n\n');
  if (!userText.trim()) return {};

  const inferred: Record<string, string> = {};

  for (const f of fields) {
    const fid = f.id.toLowerCase();
    const flabel = f.label.toLowerCase();

    // For select fields, check if any option appears in the user text
    if (f.type === 'select' && f.options?.length) {
      const lower = userText.toLowerCase();
      const match = f.options.find((o) => lower.includes(o.toLowerCase()));
      if (match) { inferred[f.id] = match; continue; }
    }

    // Try to extract a value from structured lines like "audience: designers"
    const patterns = [fid];
    // Add common aliases for well-known field ids
    if (fid === 'audience') patterns.push('for', 'users', 'customers', 'target', 'who');
    if (fid === 'tone') patterns.push('style', 'mood', 'feel', 'vibe');
    if (fid === 'scope') patterns.push('include', 'must have', 'needs', 'features', 'sections', 'contain');
    if (fid === 'brand') patterns.push('brand', 'company', 'name');
    if (fid === 'product') patterns.push('product', 'app', 'service', 'tool');
    if (fid === 'topic') patterns.push('topic', 'about', 'subject');
    if (fid === 'title') patterns.push('title', 'headline', 'heading');
    if (fid === 'company') patterns.push('company', 'startup', 'org');
    if (fid === 'role') patterns.push('role', 'position', 'job');
    if (fid === 'customer') patterns.push('customer', 'client');
    if (fid === 'event') patterns.push('event', 'conference', 'meetup');

    for (const line of userText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      for (const pat of patterns) {
        // Match "audience: designers" or "- audience: designers" or "audience — designers"
        const re = new RegExp(`(?:^[\\s\\-•]*)${pat}\\s*[:—\\-]\\s*(.+)`, 'i');
        const m = trimmed.match(re);
        if (m) {
          inferred[f.id] = m[1].trim();
          break;
        }
      }
      if (inferred[f.id]) break;
    }

    // For audience/tone/scope, try to infer from unstructured prose
    if (!inferred[f.id] && fid === 'audience') {
      const m = userText.match(/\b(?:for|targeting|aimed at|designed for)\s+([^.,;!?\n]{3,60})/i);
      if (m) inferred[f.id] = m[1].trim();
    }
    if (!inferred[f.id] && fid === 'product') {
      const m = userText.match(/\b(?:called|named|for my|our)\s+["']?([^"',;!?\n]{2,40})["']?/i);
      if (m) inferred[f.id] = m[1].trim();
    }
  }

  return inferred;
}

export function QuestionForm({
  fields,
  onSubmit,
}: {
  fields: Field[];
  onSubmit: (text: string) => void;
}) {
  const project = useStudio((s) => s.project);

  // Pre-fill fields from the user's original prompt
  const prefilled = useMemo(
    () => inferFieldValues(fields, project?.conversation ?? []),
    [fields, project?.conversation],
  );

  const [values, setValues] = useState<Record<string, string>>(prefilled);

  const submit = () => {
    const lines: string[] = ['Brief:'];
    for (const f of fields) {
      const v = values[f.id]?.trim();
      if (v) lines.push(`- ${f.label}: ${v}`);
    }
    if (lines.length === 1) lines.push('(skipped — proceed with sensible defaults)');
    onSubmit(lines.join('\n'));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="plate rounded-2xl p-5"
    >
      <div className="flex items-center gap-2">
        <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Brief · turn 1</div>
        <div className="h-px flex-1 bg-border" />
      </div>
      <h4 className="font-display italic text-xl mt-1">A few questions before I render.</h4>
      <p className="text-[12px] text-muted-foreground mt-1">
        Skip what you do not know — I will fill the gaps with safe defaults.
      </p>
      <div className="grid grid-cols-2 gap-3 mt-5">
        {fields.map((f) => (
          <FieldInput
            key={f.id}
            field={f}
            value={values[f.id] || ''}
            onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))}
            wide={f.type === 'textarea'}
          />
        ))}
      </div>
      <div className="flex justify-end mt-4">
        <button className="btn-ember" onClick={submit}>
          <Send className="h-4 w-4" />
          Lock the brief
        </button>
      </div>
    </motion.div>
  );
}

function FieldInput({
  field, value, onChange, wide,
}: { field: Field; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <label className={cn('flex flex-col gap-1.5', wide && 'col-span-2')}>
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{field.label}</span>
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="input-base"
          placeholder="…"
        />
      ) : field.type === 'select' && field.options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="input-base">
          <option value="">choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-base"
          placeholder="…"
        />
      )}
    </label>
  );
}
