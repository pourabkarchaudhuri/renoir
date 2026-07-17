import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import { Send, Square, ImageIcon, Sparkles, Pencil, Trash2, RotateCcw, Loader2, Paperclip, X, KeyRound, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { QuestionForm } from './QuestionForm';
import { extractArtifact, stripArtifact, inferPhase } from '@/lib/prompt';
import { renderMarkdown } from '@/lib/markdown';
import { ChatMarkdown } from './ChatMarkdown';
import type { AutoContinueState } from '@/lib/auto-continue';
import { readFileAsAttachment, readClipboardImage, classify, MAX_ATTACHMENTS, type Attachment, summarizeAttachments } from '@/lib/attachments';
import { ExpandableMessage } from '@/components/chrome/ExpandableMessage';
import { syncActiveSession } from '@/lib/skill-sessions';
import { pickEditDraftFromHtml } from '@/lib/pick-target';
import type { ProjectMessage } from '@/types/global';
import { previewHtmlForSkill } from '@/lib/skill-sessions';

interface Props {
  onSend: (content: string, attachments?: Attachment[]) => void;
  onCancel: () => void;
  onRegenerate: (fromIndex: number) => void;
  onReloadPreview?: () => void;
  hasPreview?: boolean;
  questionForm: { id: string; label: string; type: string; options?: string[] }[] | null;
  autoContinue?: AutoContinueState;
  onCancelAutoContinue?: () => void;
}

export function ChatPane({ onSend, onCancel, onRegenerate, onReloadPreview, hasPreview, questionForm, autoContinue, onCancelAutoContinue }: Props) {
  const project = useStudio((s) => s.project);
  const draft = useStudio((s) => s.draft);
  const setDraft = useStudio((s) => s.setDraft);
  const isStreaming = useStudio((s) => s.isStreaming);
  const pending = useStudio((s) => s.pendingAssistant);

  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' });
  }, [project?.conversation.length, pending, questionForm]);

  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        odId?: string;
        tag?: string;
        textPreview?: string;
      };
      if (!detail?.odId) return;
      const st = useStudio.getState();
      const html = st.project
        ? previewHtmlForSkill(st.project, st.selectedSkillId)
        : undefined;
      setDraft(pickEditDraftFromHtml({
        odId: detail.odId,
        tag: detail.tag,
        textPreview: detail.textPreview,
      }, html));
    };
    window.addEventListener('renoir:pick-target', onPick);
    return () => window.removeEventListener('renoir:pick-target', onPick);
  }, [setDraft]);

  return (
    <section className="flex-1 flex flex-col min-w-0">
      <div ref={scroll} className="flex-1 overflow-y-auto scroll-thin px-8 py-6 space-y-6">
        {(!project?.conversation || project.conversation.length === 0) && (
          <Greeting />
        )}

        {project?.conversation.map((m, i) => (
          <EditableMessage
            key={i}
            index={i}
            role={m.role}
            content={m.content}
            attachments={m.attachments}
            hasPreview={hasPreview}
            onRegenerate={() => onRegenerate(i)}
            onReloadPreview={onReloadPreview}
          />
        ))}

        {isStreaming && <StreamingBubble buffer={pending} />}

        {questionForm && !isStreaming && <QuestionForm fields={questionForm} onSubmit={(text) => onSend(text)} />}
      </div>

      {autoContinue?.isAutoContinuing && (
        <div className="px-8 py-2 flex items-center gap-2 text-[12px] text-primary/90 border-t border-border/50 bg-primary/5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>
            Auto-continuing… (attempt {autoContinue.attempts}/{autoContinue.maxAttempts})
          </span>
          {onCancelAutoContinue && (
            <button
              onClick={onCancelAutoContinue}
              className="ml-auto btn-quiet text-[11px]"
            >
              Stop
            </button>
          )}
        </div>
      )}

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={(attachments) => { if (draft.trim() || attachments?.length) onSend(draft, attachments); }}
        onCancel={onCancel}
        isStreaming={isStreaming}
        hasPreview={hasPreview}
      />
    </section>
  );
}

function Greeting() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="plate rounded-2xl p-6 grain relative overflow-hidden"
    >
      <div className="ambient" />
      <div className="relative z-10 flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl grid place-items-center bg-primary/10 ring-1 ring-primary/30">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Renoir</div>
          <h3 className="font-display italic text-2xl mt-0.5">Tell me what to render.</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose leading-relaxed">
            Drop a brief and I will return a runnable artifact. If the brief is thin, expect a short
            question form first — locking the scope keeps the output sharp.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function StreamingBubble({ buffer }: { buffer: string }) {
  const [tick, setTick] = useState(0);
  const startedAtRef = useRef(Date.now());
  const status = useStudio((s) => s.streamStatus);
  const note   = useStudio((s) => s.retryNote);
  const [thoughtOpen, setThoughtOpen] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 700);
    return () => clearInterval(id);
  }, []);
  const elapsed = Date.now() - startedAtRef.current;
  const phase = inferPhase(buffer, elapsed);
  const extracted = extractArtifact(buffer);
  const visible = stripArtifact(buffer);
  const html = useMemo(() => (visible ? renderMarkdown(visible) : ''), [visible]);
  void tick; // re-render driver
  const lines = extracted?.html ? extracted.html.split('\n').length : 0;
  const bytes = extracted?.html?.length ?? 0;
  const hasThought = Boolean(visible && extracted);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex gap-3 justify-start"
    >
      <div className="h-7 w-7 shrink-0 rounded-md grid place-items-center bg-primary/10 ring-1 ring-primary/30">
        <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
      </div>
      <div className="rounded-2xl px-4 py-3 max-w-[680px] text-[13.5px] leading-relaxed plate flex-1 chat-selectable">
        {/* Chain-of-thought: collapsible when artifact is also generating */}
        {html && hasThought ? (
          <details open={thoughtOpen} onToggle={(e) => setThoughtOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-muted-foreground mb-1 select-none">
              {thoughtOpen ? '▾' : '▸'} Thinking
            </summary>
            <div className="pl-2 border-l-2 border-primary/20 mb-2">
              <ChatMarkdown html={html} />
            </div>
          </details>
        ) : html ? (
          <ChatMarkdown html={html} />
        ) : null}
        {/* Phase-aware status */}
        <div className="mt-1 flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <span className={cn(
            'inline-flex h-1.5 w-1.5 rounded-full animate-pulse',
            status === 'stalled' ? 'bg-amber-500'
              : status === 'retrying' ? 'bg-sky-500'
              : 'bg-primary',
          )} />
          <span className={cn(
            'italic',
            status === 'stalled'  && 'text-amber-700 dark:text-amber-200',
            status === 'retrying' && 'text-sky-700 dark:text-sky-200',
          )}>
            {status === 'stalled'  ? 'Server quiet — still waiting…'
             : status === 'retrying' ? 'Reconnecting…'
             : phase}
          </span>
          {extracted && (
            <span className="ml-auto font-mono text-[10.5px] text-muted-foreground/70">
              {lines} lines · {(bytes / 1024).toFixed(1)} KB
            </span>
          )}
        </div>
        {note && (
          <ExpandableMessage
            text={note}
            tone={status === 'stalled' ? 'warn' : status === 'retrying' ? 'info' : 'neutral'}
            textClassName="mt-1 text-[10.5px] text-muted-foreground/80"
            copyLabel="Copy"
            expandLabel="Show details"
          />
        )}
        {extracted && (
          <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-ember-400 to-ember-600"
              initial={{ width: '12%' }}
              animate={{ width: extracted.complete ? '100%' : `${Math.min(92, 12 + lines * 1.5)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EditableMessage({
  index, role, content, attachments, hasPreview, onRegenerate, onReloadPreview,
}: {
  index: number;
  role: string;
  content: string;
  attachments?: any[];
  hasPreview?: boolean;
  onRegenerate: () => void;
  onReloadPreview?: () => void;
}) {
  const project = useStudio((s) => s.project);
  const selectedSkillId = useStudio((s) => s.selectedSkillId);
  const setProject = useStudio((s) => s.setProject);
  const toast = useUI((s) => s.toast);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  const saveEdit = async () => {
    setEditing(false);
    if (!project) return;
    if (draft === content) return;
    const conv = project.conversation.slice();
    conv[index] = { ...conv[index], content: draft };
    const next = syncActiveSession(
      { ...project, conversation: conv },
      selectedSkillId ?? project.skillId,
    );
    await window.renoir.saveProject(next);
    setProject(next);
    toast('Message updated', 'ok');
  };

  const remove = async () => {
    if (!project) return;
    const removed: ProjectMessage = { ...project.conversation[index] };
    const conv = project.conversation.slice();
    conv.splice(index, 1);
    const next = syncActiveSession(
      { ...project, conversation: conv },
      selectedSkillId ?? project.skillId,
    );
    await window.renoir.saveProject(next);
    setProject(next);

    const undo = async () => {
      const current = useStudio.getState().project;
      if (!current) return;
      const restored = current.conversation.slice();
      let insertAt = restored.findIndex((m) => m.ts > removed.ts);
      if (insertAt === -1) insertAt = restored.length;
      restored.splice(insertAt, 0, removed);
      const undone = syncActiveSession(
        { ...current, conversation: restored },
        useStudio.getState().selectedSkillId ?? current.skillId,
      );
      await window.renoir.saveProject(undone);
      useStudio.getState().setProject(undone);
    };

    toast('Message removed', 'info', { label: 'Undo', onClick: () => { void undo(); } });
  };

  if (editing) {
    return (
      <div className="flex justify-end">
        <div className="plate rounded-2xl p-3 max-w-[680px] w-full">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(12, Math.max(2, draft.split('\n').length))}
            className="input-base font-mono text-[12.5px] resize-none w-full"
            autoFocus
          />
          <div className="flex items-center gap-1.5 justify-end mt-2">
            <button onClick={() => { setEditing(false); setDraft(content); }} className="btn-quiet">Cancel</button>
            <button onClick={saveEdit} className="btn-ember">Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <Message role={role} content={content} attachments={attachments} />
      <div className="flex items-center gap-1 -mt-1 ml-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => { setDraft(content); setEditing(true); }} className="btn-ghost text-[10.5px] py-0.5">
          <Pencil className="h-3 w-3" />
          Edit
        </button>
        <button onClick={remove} className="btn-ghost text-[10.5px] py-0.5 text-muted-foreground hover:text-red-400">
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
        {role === 'user' && hasPreview && onReloadPreview && (
          <button onClick={onReloadPreview} className="btn-ghost text-[10.5px] py-0.5">
            <RotateCcw className="h-3 w-3" />
            Reload preview
          </button>
        )}
        {role === 'user' && (
          <button
            onClick={() => {
              if (!window.confirm('Regenerate from this message? This will re-run the AI.')) return;
              onRegenerate();
            }}
            className="btn-ghost text-[10.5px] py-0.5 text-muted-foreground"
          >
            <Wand2 className="h-3 w-3" />
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}

function Message({ role, content, attachments, streaming }: { role: string; content: string; attachments?: any[]; streaming?: boolean }) {
  const isUser = role === 'user';
  const cleaned = stripArtifact(content);
  const extracted = extractArtifact(content);
  const hasArtifact = Boolean(extracted);
  const html = useMemo(() => (cleaned ? renderMarkdown(cleaned) : ''), [cleaned]);
  const imageAtts = (attachments || []).filter((a: any) => a.kind === 'image' && a.dataUrl);
  const textAtts = (attachments || []).filter((a: any) => a.kind === 'text' || a.kind === 'diagram');

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="h-7 w-7 shrink-0 rounded-md grid place-items-center bg-primary/10 ring-1 ring-primary/30">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'rounded-2xl px-4 py-3 max-w-[680px] text-[13.5px] leading-relaxed chat-selectable',
          isUser
            ? 'bg-primary/10 ring-1 ring-primary/30 text-foreground'
            : 'plate',
        )}
      >
        {imageAtts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {imageAtts.map((a: any, i: number) => (
              <img key={i} src={a.dataUrl} alt={a.name} className="h-16 rounded-md ring-1 ring-border object-cover" />
            ))}
          </div>
        )}
        {textAtts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {textAtts.map((a: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 plate-soft rounded px-2 py-0.5 text-[10.5px] font-mono">
                <Paperclip className="h-2.5 w-2.5" />
                {a.name}
              </span>
            ))}
          </div>
        )}
        {!cleaned && hasArtifact && !streaming && (
          <span className="text-muted-foreground italic">Artifact rendered →</span>
        )}
        {cleaned && (
          isUser
            ? <pre className="whitespace-pre-wrap break-words font-sans">{cleaned}</pre>
            : <ChatMarkdown html={html} />
        )}
        {streaming && (
          <span className="inline-block w-1.5 h-3.5 align-middle bg-primary ml-1 caret" />
        )}
        {hasArtifact && !streaming && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <ImageIcon className="h-3 w-3" />
            <span>Rendered to preview</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Composer({
  value, onChange, onSend, onCancel, isStreaming, hasPreview,
}: {
  value: string;
  onChange: (s: string) => void;
  onSend: (attachments?: Attachment[]) => void;
  onCancel: () => void;
  isStreaming: boolean;
  hasPreview?: boolean;
}) {
  const skills = useCatalog((s) => s.skills);
  const designSystems = useCatalog((s) => s.designSystems);
  const directions = useCatalog((s) => s.directions);
  const agents = useCatalog((s) => s.agents);
  const byok = useCatalog((s) => s.byok);
  const selectedAgentId = useStudio((s) => s.selectedAgentId);
  const setSkill = useStudio((s) => s.setSkill);
  const setSystem = useStudio((s) => s.setSystem);
  const setDirection = useStudio((s) => s.setDirection);
  const setAgent = useStudio((s) => s.setAgent);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  const toast = useUI((s) => s.toast);

  // BYOK guard: if BYOK is selected but not configured, block sending
  const isByokSelected = !selectedAgentId || selectedAgentId === 'byok';
  const byokConfigured = Boolean(byok?.hasKey && byok?.baseUrl && byok?.model);
  const byokMissing = isByokSelected && !byokConfigured;

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (attachments.length >= MAX_ATTACHMENTS) {
        toast(`Max ${MAX_ATTACHMENTS} attachments`, 'warn');
        break;
      }
      const result = await readFileAsAttachment(file);
      if ('error' in result) {
        toast(result.error, 'warn');
        continue;
      }
      setAttachments((prev) => {
        if (prev.length >= MAX_ATTACHMENTS) return prev;
        return [...prev, result];
      });
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const doSend = () => {
    if (!value.trim() && !attachments.length) return;
    if (isStreaming) return;
    if (byokMissing) {
      toast('Configure a model first — open the model selector (top-right) to set your LLM key and endpoint.', 'warn');
      return;
    }
    const atts = attachments.length > 0 ? [...attachments] : undefined;
    setAttachments([]);
    onSend(atts);
  };

  // Slash command popover state
  const [hint, setHint] = useState<{ items: { id: string; label: string; sub?: string }[]; cmd: string; arg: string } | null>(null);
  const [hintIdx, setHintIdx] = useState(0);

  useEffect(() => {
    const m = value.match(/^\/(\w*)(?:\s+(.*))?$/);
    if (!m) { setHint(null); return; }
    const cmd = m[1].toLowerCase();
    const arg = (m[2] || '').toLowerCase();
    let items: { id: string; label: string; sub?: string }[] = [];
    if ('skill'.startsWith(cmd) || cmd === 'skill') {
      items = skills.filter((s) => s.name.toLowerCase().includes(arg) || s.id.includes(arg))
        .map((s) => ({ id: s.id, label: s.name, sub: s.blurb }));
    } else if ('system'.startsWith(cmd) || cmd === 'system') {
      items = designSystems.filter((s) => s.name.toLowerCase().includes(arg) || s.id.includes(arg))
        .map((s) => ({ id: s.id, label: s.name, sub: s.vibe }));
    } else if ('direction'.startsWith(cmd) || cmd === 'direction') {
      items = directions.filter((d) => d.name.toLowerCase().includes(arg) || d.id.includes(arg))
        .map((d) => ({ id: d.id, label: d.name, sub: d.tagline }));
    } else if ('agent'.startsWith(cmd) || cmd === 'agent') {
      items = [
        { id: 'byok', label: 'BYOK', sub: 'configured LLM' },
        ...agents.filter((a) => a.available && (a.name.toLowerCase().includes(arg) || a.id.includes(arg)))
          .map((a) => ({ id: a.id, label: a.name, sub: a.blurb })),
      ];
    } else if ('critique'.startsWith(cmd) || cmd === 'critique' || cmd === 'lint' || cmd === 'help') {
      items = [
        { id: 'critique', label: 'Run 5-dim critique', sub: 'Hierarchy / typography / contrast / spacing / affordance' },
        { id: 'help',     label: 'Show shortcuts',    sub: 'Cmd-K palette and slash commands' },
      ].filter((c) => !arg || c.label.toLowerCase().includes(arg));
    }
    setHint({ items: items.slice(0, 6), cmd, arg });
    setHintIdx(0);
  }, [value, skills, designSystems, directions, agents]);

  const applySlash = (item: { id: string; label: string }) => {
    const cmd = hint?.cmd || '';
    if (cmd.startsWith('skill'))     { setSkill(item.id);     toast(`Skill → ${item.label}`, 'ok'); }
    else if (cmd.startsWith('system'))    { setSystem(item.id);    toast(`System → ${item.label}`, 'ok'); }
    else if (cmd.startsWith('direction')) { setDirection(item.id); toast(`Direction → ${item.label}`, 'ok'); }
    else if (cmd.startsWith('agent'))     { setAgent(item.id);     toast(`Agent → ${item.label}`, 'ok'); }
    else if (cmd.startsWith('critique'))  { window.dispatchEvent(new CustomEvent('renoir:run-critique')); }
    else if (cmd.startsWith('help'))      { setPaletteOpen(true); }
    onChange('');
    setHint(null);
  };

  return (
    <div className="border-t border-border p-4 bg-background/60 backdrop-blur-md relative">
      {byokMissing && (
        <div className="mb-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 flex items-center gap-2 text-[12px] text-amber-800 dark:text-amber-200">
          <KeyRound className="h-3.5 w-3.5 shrink-0" />
          <span>
            No model configured. Use the <strong>model selector</strong> (top-right) to set your API key, endpoint, and model before chatting.
          </span>
        </div>
      )}
      {hint && hint.items.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-1 plate rounded-lg p-1 max-h-[40vh] overflow-y-auto scroll-thin shadow-plate">
          <div className="px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
            /{hint.cmd}
          </div>
          {hint.items.map((it, i) => (
            <button
              key={it.id}
              onMouseEnter={() => setHintIdx(i)}
              onClick={() => applySlash(it)}
              className={cn(
                'w-full text-left rounded-md px-2.5 py-1.5 flex items-center gap-2 transition-colors',
                i === hintIdx ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-accent',
              )}
            >
              <span className="text-[12.5px] font-medium tracking-tight">{it.label}</span>
              {it.sub && <span className="text-[11px] text-muted-foreground/70 truncate flex-1">{it.sub}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="plate rounded-xl p-2 flex flex-col gap-2 focus-within:shadow-glow transition-shadow">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 plate-soft rounded-md px-2 py-1 text-[11px]"
              >
                {a.kind === 'image' && a.dataUrl ? (
                  <img src={a.dataUrl} alt={a.name} className="h-5 w-5 rounded object-cover" />
                ) : (
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="truncate max-w-[120px]">{a.name}</span>
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="h-4 w-4 grid place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="shrink-0 h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Attach files (images, text, code)"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (hint && hint.items.length) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHintIdx((c) => Math.min(hint.items.length - 1, c + 1)); return; }
              if (e.key === 'ArrowUp')   { e.preventDefault(); setHintIdx((c) => Math.max(0, c - 1)); return; }
              if (e.key === 'Tab') { e.preventDefault(); applySlash(hint.items[hintIdx]); return; }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applySlash(hint.items[hintIdx]); return; }
              if (e.key === 'Escape')    { e.preventDefault(); setHint(null); return; }
            }
            // Enter alone sends. Shift-Enter (or Cmd/Ctrl-Enter) inserts a newline.
            if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              doSend();
            }
          }}
          onPaste={async (e) => {
            const img = await readClipboardImage(e.clipboardData?.items ?? null);
            if (img) {
              e.preventDefault();
              if (attachments.length < MAX_ATTACHMENTS) {
                setAttachments((prev) => [...prev, img]);
                toast('Image pasted', 'ok');
              }
            }
          }}
          onDrop={async (e) => {
            e.preventDefault();
            if (e.dataTransfer?.files?.length) {
              void addFiles(e.dataTransfer.files);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          rows={2}
          placeholder={hasPreview
            ? 'Ask for a change — rewrite, expand, shorten, add an image…'
            : 'Describe the artifact, or type / for skills, systems, agents…'}
          className="flex-1 bg-transparent outline-none resize-none text-[13.5px] leading-relaxed px-2 py-1.5"
        />
        {isStreaming ? (
          <button onClick={onCancel} className="btn-quiet" title="Stop">
            <Square className="h-4 w-4 fill-current" />
            Stop
          </button>
        ) : (
          <button onClick={doSend} className="btn-ember" disabled={byokMissing || (!value.trim() && !attachments.length)}>
            <Send className="h-4 w-4" />
            Send
          </button>
        )}
        </div>
      </div>
      <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70 mt-2 px-1">
        <span>Enter to send · Shift+Enter for newline · / commands · ⌘K palette</span>
        <div className="flex items-center gap-2">
          <span>{isStreaming ? 'streaming…' : 'idle'}</span>
          <button
            onClick={() => useUI.getState().toggleChat()}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            title="Collapse chat panel"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
