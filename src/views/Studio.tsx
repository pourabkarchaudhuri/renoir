import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import { ChatPane } from '@/components/studio/ChatPane';
import { PreviewPane } from '@/components/studio/PreviewPane';
import { LeftRail } from '@/components/studio/LeftRail';
import { Splitter } from '@/components/studio/Splitter';
import { extractArtifact, extractQuestionForm, composeSystemPrompt } from '@/lib/prompt';
import { processArtifactImages } from '@/lib/image-pipeline';
import {
  shouldAutoContinue,
  trimOverlap,
  createInitialAutoState,
  DEFAULT_AUTO_CONTINUE_CONFIG,
  type AutoContinueState,
} from '@/lib/auto-continue';
import type { ChatStreamEvent } from '@/types/global';

export function Studio() {
  const project = useStudio((s) => s.project);
  const refresh = useCatalog((s) => s.refresh);
  const startStreaming = useStudio((s) => s.startStreaming);
  const appendDelta    = useStudio((s) => s.appendAssistantDelta);
  const finishStream   = useStudio((s) => s.finishStreaming);
  const setProject     = useStudio((s) => s.setProject);
  const toast = useUI((s) => s.toast);
  const skills = useCatalog((s) => s.skills);
  const designSystems = useCatalog((s) => s.designSystems);
  const directions    = useCatalog((s) => s.directions);
  const selectedSkillId        = useStudio((s) => s.selectedSkillId);
  const selectedDesignSystemId = useStudio((s) => s.selectedDesignSystemId);
  const selectedDirectionId    = useStudio((s) => s.selectedDirectionId);
  const selectedAgentId        = useStudio((s) => s.selectedAgentId);
  const answers      = useStudio((s) => s.questionAnswers);
  const isStreaming  = useStudio((s) => s.isStreaming);
  const pendingAssistant = useStudio((s) => s.pendingAssistant);

  const conversationIdRef = useRef<string | null>(null);
  const [autoContinue, setAutoContinue] = useState<AutoContinueState>(createInitialAutoState);
  // Track the buffer snapshot before a continuation so we can detect overlap
  const bufferBeforeContinueRef = useRef<string>('');
  // Image generation progress state
  const [imageGenProgress, setImageGenProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const off = window.renoir.onChatEvent((e: ChatStreamEvent) => {
      if (!conversationIdRef.current || e.conversationId !== conversationIdRef.current) return;
      if (e.type === 'delta') {
        const currentBuffer = useStudio.getState().pendingAssistant;
        const bufferBefore = bufferBeforeContinueRef.current;
        // If we're auto-continuing and this is the first delta of a new continuation,
        // apply overlap trimming
        if (bufferBefore && currentBuffer === bufferBefore) {
          const trimmed = trimOverlap(bufferBefore, e.text);
          appendDelta(trimmed);
          bufferBeforeContinueRef.current = '';
        } else {
          appendDelta(e.text);
        }
      } else if (e.type === 'done') {
        const currentPending = useStudio.getState().pendingAssistant;
        const currentState = autoContinue;

        if (shouldAutoContinue(e.finishReason, currentPending, currentState)) {
          // Auto-continue: increment attempts, keep buffer accumulating
          const nextState: AutoContinueState = {
            ...currentState,
            attempts: currentState.attempts + 1,
            isAutoContinuing: true,
          };
          setAutoContinue(nextState);
          // Snapshot the buffer before continuation for overlap detection
          bufferBeforeContinueRef.current = currentPending;
          // Send continuation message without calling finishStreaming
          void sendUserMessage(
            DEFAULT_AUTO_CONTINUE_CONFIG.continuePrompt,
            { skipAppend: false },
          );
        } else {
          // Normal completion or max retries reached
          setAutoContinue((s) => ({ ...s, isAutoContinuing: false }));
          void finishStream().then(() => {
            // After finishStreaming commits the message, trigger image pipeline
            // if the artifact is complete (tasks 8.1, 8.5)
            const st = useStudio.getState();
            if (!st.project) return;
            const lastMsg = st.project.conversation.findLast((m) => m.role === 'assistant');
            if (!lastMsg) return;
            const art = extractArtifact(lastMsg.content);
            if (!art?.complete) return;
            // Run image pipeline asynchronously without blocking UI
            void runImagePipeline(art.html, st.project.id);
          });
        }
      } else if (e.type === 'stalled') useStudio.getState().markStalled(e.sinceMs);
      else if (e.type === 'retry')   useStudio.getState().markRetry(e.attempt, e.waitMs, e.reason);
      else if (e.type === 'error') {
        toast(e.message, 'err');
        setAutoContinue((s) => ({ ...s, isAutoContinuing: false }));
        void finishStream();
      }
    });
    return off;
  }, [appendDelta, finishStream, toast, autoContinue]);

  useEffect(() => { void refresh(); }, [refresh]);

  const skill = useMemo(() => skills.find((s) => s.id === selectedSkillId), [skills, selectedSkillId]);
  const designSystem = useMemo(
    () => designSystems.find((d) => d.id === selectedDesignSystemId),
    [designSystems, selectedDesignSystemId],
  );
  const direction = useMemo(
    () => directions.find((d) => d.id === selectedDirectionId),
    [directions, selectedDirectionId],
  );

  // Run the image pipeline on a completed artifact (tasks 8.1–8.5)
  const runImagePipeline = async (html: string, projectId: string) => {
    try {
      const st = useStudio.getState();
      const ds = designSystems.find((d) => d.id === st.selectedDesignSystemId);
      const dir = directions.find((d) => d.id === st.selectedDirectionId);
      const projName = st.project?.name;

      setImageGenProgress({ done: 0, total: 0 });

      const { html: enrichedHtml, imagesGenerated } = await processArtifactImages(
        html,
        projectId,
        {
          designSystem: ds,
          direction: dir,
          projectName: projName,
          onProgress: (done, total) => {
            setImageGenProgress({ done, total });
          },
        },
      );

      setImageGenProgress(null);

      if (imagesGenerated > 0) {
        // Save enriched HTML as a new version (task 8.2)
        const verRes = await window.renoir.addVersion({
          id: projectId,
          html: enrichedHtml,
          source: 'assistant',
          note: `Auto-generated ${imagesGenerated} images`,
        });
        if (verRes.ok && verRes.project) {
          useStudio.getState().setProject(verRes.project);
        }
        // Show toast notification (task 8.3)
        toast(`Generated ${imagesGenerated} images`, 'ok');
      }
    } catch {
      // Pipeline failed — original artifact remains visible
      setImageGenProgress(null);
    }
  };

  const sendUserMessage = async (content: string, opts?: { skipAppend?: boolean; attachments?: any[] }) => {
    if (!project || (!content.trim() && !opts?.attachments?.length)) return;
    const id = project.id + ':' + Date.now();
    conversationIdRef.current = id;

    // Reset auto-continue state for a fresh user-initiated message
    // (but not when auto-continue itself is sending the continuation prompt)
    if (!autoContinue.isAutoContinuing) {
      setAutoContinue(createInitialAutoState());
      bufferBeforeContinueRef.current = '';
    }

    const composed = composeSystemPrompt({
      skill,
      primer: skill ? (await window.renoir.getSkillPrimer(skill.id)) ?? undefined : undefined,
      designSystem,
      direction,
      answers,
    });

    if (!opts?.skipAppend) await useStudio.getState().appendUser(content, opts?.attachments);
    const next = useStudio.getState().project;
    if (!next) return;

    startStreaming();

    if (selectedAgentId && selectedAgentId !== 'byok') {
      // Route through CLI agent — single-shot prompt with the system context inline.
      const flat = [composed.system, ...next.conversation.map((m) => `${m.role.toUpperCase()}: ${m.content}`)].join('\n\n');
      const res = await window.renoir.invokeAgent({ agentId: selectedAgentId, conversationId: id, prompt: flat });
      if (!res.ok) {
        toast(res.error || 'Could not invoke agent', 'err');
        void finishStream();
      }
      return;
    }

    const messages: { role: 'system' | 'user' | 'assistant'; content: string; attachments?: any[] }[] = [
      { role: 'system', content: composed.system },
      ...next.conversation.map((m) => ({
        role: m.role as any,
        content: m.content,
        attachments: m.attachments,
      })),
    ];
    const res = await window.renoir.chatStart({ conversationId: id, messages });
    if (!res.ok) {
      toast(res.error || 'Could not start chat', 'err');
      void finishStream();
    }
  };

  const cancel = async () => {
    if (!conversationIdRef.current) return;
    if (selectedAgentId && selectedAgentId !== 'byok') {
      await window.renoir.cancelAgent(conversationIdRef.current);
    } else {
      await window.renoir.chatCancel(conversationIdRef.current);
    }
  };

  const regenerateFrom = async (fromIndex: number) => {
    if (!project) return;
    const trimmed = project.conversation.slice(0, fromIndex + 1);
    const lastUser = [...trimmed].reverse().find((m) => m.role === 'user');
    if (!lastUser) { toast('No user turn to regenerate from', 'warn'); return; }
    const next = { ...project, conversation: trimmed };
    await window.renoir.saveProject(next);
    useStudio.getState().setProject(next);
    // Re-send via the same dispatch pipeline
    void sendUserMessage(lastUser.content);
  };

  const lastAssistant = project?.conversation.findLast((m) => m.role === 'assistant');
  const liveExtracted = isStreaming ? extractArtifact(pendingAssistant) : null;
  // If the user restored a historical version, render it instead of the latest.
  const activeVersion = project?.activeVersionId
    ? project.versions?.find((v) => v.id === project.activeVersionId)
    : null;
  // Persist the preview between turns: while streaming a new turn that
  // has not produced an <artifact> yet, fall back to the last completed one.
  const fallbackExtracted = activeVersion
    ? { html: activeVersion.html, complete: true }
    : (lastAssistant ? extractArtifact(lastAssistant.content) : null);
  const extracted = liveExtracted || fallbackExtracted;
  const artifactHtml = extracted?.html || null;
  const liveText = isStreaming ? pendingAssistant : (lastAssistant?.content || '');
  const questionForm = !liveExtracted && !fallbackExtracted ? extractQuestionForm(liveText) : null;

  // If the last finished assistant message has an *unclosed* artifact, we
  // suspect a truncation. Surface a Continue affordance so the user can
  // resume without retyping context.
  const truncated = !isStreaming && lastAssistant && extracted && !extracted.complete;
  const continueLast = async () => {
    if (!project) return;
    void sendUserMessage('Continue from where you stopped. Finish the artifact in full.', { skipAppend: false });
  };

  // Cancel auto-continuation: stop the stream and revert to manual mode
  const cancelAutoContinue = async () => {
    setAutoContinue((s) => ({ ...s, isAutoContinuing: false, enabled: false }));
    await cancel();
  };

  // Whether auto-continue exhausted its attempts without completing
  const autoContinueExhausted = !autoContinue.isAutoContinuing
    && autoContinue.attempts >= autoContinue.maxAttempts
    && truncated;

  if (!project) return <EmptyState />;

  return (
    <div className="flex h-full flex-col">
      {truncated && (
        <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/40 text-[12px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {autoContinue.isAutoContinuing ? (
            <>
              Auto-continuing… (attempt {autoContinue.attempts}/{autoContinue.maxAttempts})
              <button onClick={cancelAutoContinue} className="ml-auto btn-quiet">
                Stop
              </button>
            </>
          ) : autoContinueExhausted ? (
            <>
              Auto-continue exhausted — artifact may need manual completion.
              <button onClick={continueLast} className="ml-auto btn-quiet">
                Continue manually
              </button>
            </>
          ) : (
            <>
              Generation paused — click to resume.
              <button onClick={continueLast} className="ml-auto btn-quiet">
                Continue
              </button>
            </>
          )}
        </div>
      )}
      <StudioLayout
        chat={<ChatPane onSend={(content, attachments) => sendUserMessage(content, { attachments })} onCancel={cancel} onRegenerate={regenerateFrom} questionForm={questionForm} autoContinue={autoContinue} onCancelAutoContinue={cancelAutoContinue} />}
        preview={<PreviewPane artifact={artifactHtml} streaming={isStreaming && !!liveExtracted && !liveExtracted.complete} imageGenProgress={imageGenProgress} />}
      />
    </div>
  );
}

function StudioLayout({ chat, preview }: { chat: React.ReactNode; preview: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatWidth = useUI((s) => s.chatWidth);
  const previewFull = useUI((s) => s.previewFull);
  const chatCollapsed = useUI((s) => s.chatCollapsed);
  const toggleChat = useUI((s) => s.toggleChat);

  return (
    <div className="flex flex-1 min-h-0">
      {!previewFull && <LeftRail />}
      <div ref={containerRef} className="flex-1 flex min-w-0">
        {!previewFull && !chatCollapsed && (
          <>
            <div style={{ width: `${chatWidth}%` }} className="flex min-w-0">
              {chat}
            </div>
            <Splitter containerRef={containerRef} />
          </>
        )}
        {!previewFull && chatCollapsed && (
          <button
            onClick={toggleChat}
            className="w-8 shrink-0 flex items-center justify-center border-r border-border hover:bg-accent transition-colors"
            title="Expand chat"
          >
            <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
        <div className={previewFull ? 'flex-1 min-w-0' : 'flex-1 min-w-0'}>
          {preview}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const setRoute = useUI((s) => s.setRoute);
  return (
    <div className="h-full grid place-items-center">
      <div className="text-center max-w-[420px]">
        <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Studio</div>
        <h2 className="font-display text-4xl italic mt-2">A canvas waits for a brief.</h2>
        <p className="text-sm text-muted-foreground mt-3">
          Open a study from Home, or start a new one.
        </p>
        <button className="btn-ember mt-5" onClick={() => setRoute('home')}>
          Go to Home
        </button>
      </div>
    </div>
  );
}
