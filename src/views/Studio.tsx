import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import { ChatPane } from '@/components/studio/ChatPane';
import { PreviewPane } from '@/components/studio/PreviewPane';
import { LeftRail } from '@/components/studio/LeftRail';
import { Splitter } from '@/components/studio/Splitter';
import { extractArtifact, extractQuestionForm, composeSystemPrompt, hasLockedBrief, extractBriefFromConversation, inferPhase, conversationForLlm, usesDirectArtifactGeneration, directGenerateKickMessage } from '@/lib/prompt';
import { hasBrandContent, resolveBrandSpec } from '@/lib/brand-spec';
import { processArtifactImages } from '@/lib/image-pipeline';
import { enrichProductDeckHtml } from '@/lib/product-deck-content';
import { planImagePostProcess, setArtifactImageListener } from '@/lib/image-post-process';
import { repairArtifactIfNeeded } from '@/lib/artifact-repair';
import { isRevisionTurn, withLatestArtifact } from '@/lib/artifact-revision';
import { generationBudgetForSkill, FAST_PATH_SKILL_IDS } from '@shared/generation-budgets';
import { applySession, findSkillForConversation, getSkillSession, patchSkillSession, previewHtmlForSkill } from '@/lib/skill-sessions';
import { buildPreviewGenerationProgress } from '@/lib/preview-generation-progress';
import { ConfirmDialog } from '@/components/chrome/ConfirmDialog';
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
  const streamStartedAtRef = useRef(Date.now());
  const bindConversation = useStudio((s) => s.bindConversation);
  const [autoContinue, setAutoContinue] = useState<AutoContinueState>(createInitialAutoState);
  const autoContinueRef = useRef(autoContinue);
  autoContinueRef.current = autoContinue;
  /** True while a post-creation revision is in flight — keep showing the prior artifact. */
  const isRevisingRef = useRef(false);
  const [isRevising, setIsRevising] = useState(false);
  // Track the buffer snapshot before a continuation so we can detect overlap
  const bufferBeforeContinueRef = useRef<string>('');
  const questionFormKickRef = useRef(false);
  // Image generation progress state
  const [imageGenProgress, setImageGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [imageGenPrompt, setImageGenPrompt] = useState<{
    html: string;
    projectId: string;
    skillId: string;
    slotCount: number;
  } | null>(null);
  const deferredLintRef = useRef<{ html: string; projectId: string; skillId?: string } | null>(null);

  useEffect(() => {
    const off = window.renoir.onChatEvent((e: ChatStreamEvent) => {
      const st = useStudio.getState();
      const skillId = findSkillForConversation(st.project, e.conversationId)
        ?? (st.activeConversationId === e.conversationId ? (st.streamingSkillId ?? st.selectedSkillId) : undefined)
        ?? (conversationIdRef.current === e.conversationId
          ? (st.streamingSkillId ?? st.selectedSkillId)
          : undefined)
        ?? (st.streamingSkillId
          && st.project
          && getSkillSession(st.project, st.streamingSkillId).conversationId === e.conversationId
          ? st.streamingSkillId
          : undefined);
      if (!skillId) return;

      const viewing = st.selectedSkillId === skillId;

      if (e.type === 'delta') {
        if (!viewing) {
          appendDelta(e.text);
          return;
        }
        const currentBuffer = st.pendingAssistant;
        const bufferBefore = bufferBeforeContinueRef.current;
        if (bufferBefore && currentBuffer === bufferBefore) {
          appendDelta(trimOverlap(bufferBefore, e.text));
          bufferBeforeContinueRef.current = '';
        } else {
          appendDelta(e.text);
        }
      } else if (e.type === 'done') {
        const currentPending = viewing
          ? st.pendingAssistant
          : (st.project ? (st.project.skillSessions?.[skillId]?.pendingAssistant ?? '') : '');
        const currentState = autoContinueRef.current;
        const willAutoContinue = shouldAutoContinue(e.finishReason, currentPending, currentState);

        if (willAutoContinue) {
          const nextState: AutoContinueState = {
            ...currentState,
            attempts: currentState.attempts + 1,
            isAutoContinuing: true,
          };
          setAutoContinue(nextState);
          bufferBeforeContinueRef.current = currentPending;
          if (viewing) {
            void sendUserMessage(
              DEFAULT_AUTO_CONTINUE_CONFIG.continuePrompt,
              { skipAppend: false, isAutoContinue: true },
            );
          }
        } else {
          setAutoContinue((s) => ({ ...s, isAutoContinuing: false }));
          isRevisingRef.current = false;
          setIsRevising(false);
          void finishStream().then(() => {
            const after = useStudio.getState();
            if (!after.project) return;
            const session = getSkillSession(after.project, skillId);
            const conversation = session.conversation?.length
              ? session.conversation
              : after.project.conversation;
            const lastMsg = [...conversation].reverse().find((m) => m.role === 'assistant');
            if (!lastMsg) return;
            const art = extractArtifact(lastMsg.content);
            if (!art?.complete) return;
            const plan = planImagePostProcess({
              html: art.html,
              projectId: after.project.id,
              skillId,
              conversation,
              productName: after.project.name,
            });
            if ((plan.shouldPrompt && plan.slotCount > 0) || plan.autoRun) {
              deferredLintRef.current = { html: art.html, projectId: after.project.id, skillId };
            } else {
              void maybePersistLintFixes(art.html, after.project.id, skillId, { skip: FAST_PATH_SKILL_IDS.has(skillId) });
            }
          });
        }
      } else if (e.type === 'stalled') {
        useStudio.getState().markStalled(e.sinceMs);
      } else if (e.type === 'retry') {
        useStudio.getState().markRetry(e.attempt, e.waitMs, e.reason);
      } else if (e.type === 'error') {
        toast(e.message, 'err');
        setAutoContinue((s) => ({ ...s, isAutoContinuing: false }));
        isRevisingRef.current = false;
        setIsRevising(false);
        void finishStream();
      }
    });
    return off;
  }, [appendDelta, finishStream, toast]);

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
  const runImagePipeline = async (html: string, projectId: string, skillId?: string) => {
    try {
      const st = useStudio.getState();
      const ds = designSystems.find((d) => d.id === st.selectedDesignSystemId);
      const dir = directions.find((d) => d.id === st.selectedDirectionId);
      const projName = st.project?.name;

      setImageGenProgress({ done: 0, total: 0 });

      let htmlForPipeline = html;
      if (skillId === 'product-deck') {
        htmlForPipeline = enrichProductDeckHtml(html, {
          productName: projName,
          finalize: true,
        }).html;
      }

      const { html: enrichedHtml, imagesGenerated } = await processArtifactImages(
        htmlForPipeline,
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
        const verRes = await window.renoir.addVersion({
          id: projectId,
          html: enrichedHtml,
          source: 'assistant',
          skillId,
          note: `Auto-generated ${imagesGenerated} images`,
        });
        if (verRes.ok && verRes.project) {
          let next = patchSkillSession(verRes.project, skillId, {
            previewHtml: enrichedHtml,
            versions: getSkillSession(verRes.project, skillId).versions,
          });
          if (skillId === useStudio.getState().selectedSkillId) {
            next = applySession(next, skillId);
          }
          useStudio.getState().setProject(next);
        }
        toast(`Generated ${imagesGenerated} images`, 'ok');
        deferredLintRef.current = null;
        void maybePersistLintFixes(enrichedHtml, projectId, skillId, { skip: FAST_PATH_SKILL_IDS.has(skillId ?? '') });
      } else {
        toast('Image generation failed — placeholders kept', 'warn');
        const deferred = deferredLintRef.current;
        if (deferred) {
          deferredLintRef.current = null;
          void maybePersistLintFixes(deferred.html, deferred.projectId, deferred.skillId, { skip: FAST_PATH_SKILL_IDS.has(deferred.skillId ?? '') });
        }
      }
    } catch (err) {
      toast('Image generation error — placeholders kept', 'err');
      setImageGenProgress(null);
    }
  };

  const runImagePipelineRef = useRef(runImagePipeline);
  runImagePipelineRef.current = runImagePipeline;

  useEffect(() => {
    setArtifactImageListener((ctx) => {
      const plan = planImagePostProcess(ctx);

      if (plan.autoRun) {
        void runImagePipelineRef.current(plan.prepared, plan.projectId, plan.skillId);
        return;
      }
      if (plan.shouldPrompt && plan.slotCount > 0) {
        setImageGenPrompt({
          html: plan.prepared,
          projectId: plan.projectId,
          skillId: plan.skillId,
          slotCount: plan.slotCount,
        });
      }
    });
    return () => setArtifactImageListener(null);
  }, []);

  const sendUserMessage = async (content: string, opts?: { skipAppend?: boolean; attachments?: any[]; isAutoContinue?: boolean }) => {
    if (!project || (!content.trim() && !opts?.attachments?.length)) return;
    const id = project.id + ':' + Date.now();
    conversationIdRef.current = id;
    bindConversation(id);

    // Reset auto-continue state for a fresh user-initiated message
    // (but not when auto-continue itself is sending the continuation prompt)
    const budget = generationBudgetForSkill(skill?.id);
    const isContinuation = Boolean(opts?.isAutoContinue || autoContinue.isAutoContinuing);
    if (!isContinuation) {
      setAutoContinue(createInitialAutoState(budget.maxAutoContinue));
      bufferBeforeContinueRef.current = '';
    }

    if (!opts?.skipAppend) await useStudio.getState().appendUser(content, opts?.attachments);
    const next = useStudio.getState().project;
    if (!next) return;

    let working = useStudio.getState().project;
    if (!working) return;

    const sess = skill?.id ? getSkillSession(working, skill.id) : null;
    const latestPreview = skill?.id ? previewHtmlForSkill(working, skill.id) : undefined;
    const revisionTurn = isRevisionTurn({
      conversation: working.conversation,
      previewHtml: latestPreview ?? sess?.previewHtml,
      versions: sess?.versions ?? working.versions,
      activeVersionId: sess?.activeVersionId ?? working.activeVersionId,
      isAutoContinue: isContinuation,
    });
    isRevisingRef.current = revisionTurn;
    setIsRevising(revisionTurn);

    // Drop any cached template preview so the pane waits for the LLM artifact.
    // Revision turns keep the living document on screen until the new version lands.
    if (!isContinuation && !revisionTurn && skill?.id) {
      const cleared = patchSkillSession(working, skill.id, { previewHtml: undefined });
      useStudio.getState().setProject(cleared);
      working = useStudio.getState().project ?? cleared;
    }

    streamStartedAtRef.current = Date.now();
    startStreaming();

    const briefAnswers = extractBriefFromConversation(working.conversation);

    let brand = working.brandSpec;
    if (!hasBrandContent(brand) && (!skill?.id || !FAST_PATH_SKILL_IDS.has(skill.id))) {
      brand = await resolveBrandSpec(next);
    }
    if (brand && brand !== working.brandSpec) {
      const withBrand = { ...working, brandSpec: brand };
      useStudio.getState().setProject(withBrand);
      void window.renoir.saveProject(withBrand);
      working = withBrand;
    }
    const composed = composeSystemPrompt({
      skill,
      primer: skill ? (await window.renoir.getSkillPrimer(skill.id)) ?? undefined : undefined,
      designSystem,
      designTokens: designSystem?.tokens,
      direction,
      answers: { ...briefAnswers, ...answers },
      brand,
      revision: revisionTurn,
    });

    const keepLastArtifact = isContinuation || revisionTurn;
    const sourceHtml = revisionTurn
      ? (skill?.id ? previewHtmlForSkill(working, skill.id) : latestPreview)
      : undefined;

    if (selectedAgentId && selectedAgentId !== 'byok') {
      let llmConversation = conversationForLlm(working.conversation, { keepLastArtifact });
      if (revisionTurn) llmConversation = withLatestArtifact(llmConversation, sourceHtml);
      const flat = [composed.system, ...llmConversation.map((m) => `${m.role.toUpperCase()}: ${m.content}`)].join('\n\n');
      const res = await window.renoir.invokeAgent({ agentId: selectedAgentId, conversationId: id, prompt: flat });
      if (!res.ok) {
        toast(res.error || 'Could not invoke agent', 'err');
        isRevisingRef.current = false;
        setIsRevising(false);
        void finishStream();
      }
      return;
    }

    let llmConversation = conversationForLlm(working.conversation, { keepLastArtifact });
    if (revisionTurn) llmConversation = withLatestArtifact(llmConversation, sourceHtml);
    const messages: { role: 'system' | 'user' | 'assistant'; content: string; attachments?: any[] }[] = [
      { role: 'system', content: composed.system },
      ...llmConversation.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
        attachments: m.attachments as any[] | undefined,
      })),
    ];
    const res = await window.renoir.chatStart({
      conversationId: id,
      messages,
      maxTokens: budget.maxTokens,
    });
    if (!res.ok) {
      toast(res.error || 'Could not start chat', 'err');
      isRevisingRef.current = false;
      setIsRevising(false);
      void finishStream();
    }
  };

  const cancel = async () => {
    setAutoContinue((s) => ({ ...s, isAutoContinuing: false, enabled: false }));
    isRevisingRef.current = false;
    setIsRevising(false);
    if (conversationIdRef.current) {
      if (selectedAgentId && selectedAgentId !== 'byok') {
        await window.renoir.cancelAgent(conversationIdRef.current);
      } else {
        await window.renoir.chatCancel(conversationIdRef.current);
      }
    }
    void finishStream();
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
  const activeVersion = project?.activeVersionId
    ? project.versions?.find((v) => v.id === project.activeVersionId)
    : null;

  // Only render complete artifacts — partial HTML in a scaled iframe looks squashed/broken.
  const lastUserIdx = project?.conversation.findLastIndex((m) => m.role === 'user') ?? -1;
  const lastAssistantIdx = project?.conversation.findLastIndex((m) => m.role === 'assistant') ?? -1;
  const awaitingNewArtifact = Boolean(project && lastUserIdx > lastAssistantIdx);
  // During revision, keep the living document until the new complete artifact streams in.
  const holdRevisionPreview = isRevising && awaitingNewArtifact && !liveExtracted?.complete;

  const completeArtifactHtml = useMemo(() => {
    if (liveExtracted?.complete) return liveExtracted.html;

    // Post-processed HTML (generated images, lint fixes) wins over the raw conversation artifact.
    // Also keep it during revision turns so the preview never blanks.
    if (!awaitingNewArtifact || holdRevisionPreview) {
      const processedHtml = previewHtmlForSkill(project!, selectedSkillId);
      if (processedHtml) return processedHtml;
    }

    const assistantComplete = !isStreaming && lastAssistant && !awaitingNewArtifact
      ? extractArtifact(lastAssistant.content)
      : null;
    if (assistantComplete?.complete) return assistantComplete.html;

    if (activeVersion?.html && (!awaitingNewArtifact || holdRevisionPreview)) return activeVersion.html;

    // While waiting for a brand-new LLM artifact, never resurface a cached template.
    if (awaitingNewArtifact && !holdRevisionPreview) return null;

    return null;
  }, [activeVersion, liveExtracted, isStreaming, lastAssistant, project, selectedSkillId, awaitingNewArtifact, holdRevisionPreview]);

  const previewArtifact = completeArtifactHtml;
  const artifactHtml = previewArtifact;
  const artifactResetKey = activeVersion?.id
    ? `version-${activeVersion.id}`
    : (project?.conversation.findLast((m) => m.role === 'user')?.ts
      ?? String(project?.conversation.length ?? 0));
  const liveText = isStreaming ? pendingAssistant : (lastAssistant?.content || '');
  const briefLocked = hasLockedBrief(project?.conversation ?? []);
  const directGenerate = usesDirectArtifactGeneration(skill);
  const hasCompletePreview = Boolean(completeArtifactHtml);
  const questionForm = !briefLocked && !directGenerate && !liveExtracted?.complete && !hasCompletePreview
    ? extractQuestionForm(liveText)
    : null;
  const stalledOnQuestionForm = Boolean(
    directGenerate && !isStreaming && lastAssistant && !hasCompletePreview && extractQuestionForm(lastAssistant.content),
  );

  useEffect(() => {
    if (!project || isStreaming || autoContinueRef.current.isAutoContinuing) return;
    if (!stalledOnQuestionForm) { questionFormKickRef.current = false; return; }
    if (questionFormKickRef.current) return;
    questionFormKickRef.current = true;
    const nextState: AutoContinueState = {
      ...autoContinueRef.current,
      attempts: autoContinueRef.current.attempts + 1,
      isAutoContinuing: true,
    };
    setAutoContinue(nextState);
    bufferBeforeContinueRef.current = lastAssistant?.content || '';
    void sendUserMessage(directGenerateKickMessage(skill?.id), { skipAppend: true, isAutoContinue: true });
  }, [stalledOnQuestionForm, isStreaming, project, lastAssistant?.content, skill?.id]);

  const generationPhase = inferPhase(
    isStreaming ? pendingAssistant : (lastAssistant?.content || ''),
    Date.now() - streamStartedAtRef.current,
  );

  const lastFinishedExtracted = lastAssistant ? extractArtifact(lastAssistant.content) : null;
  const truncated = !isStreaming && lastFinishedExtracted && !lastFinishedExtracted.complete;
  const autoContinueExhausted = !autoContinue.isAutoContinuing
    && autoContinue.attempts >= autoContinue.maxAttempts
    && truncated;
  const isGenerating = isStreaming || autoContinue.isAutoContinuing || (truncated && !autoContinueExhausted);
  const showPreviewLoading = Boolean(isGenerating && !previewArtifact);
  const generationProgress = useMemo(
    () => (isGenerating || imageGenProgress)
      ? buildPreviewGenerationProgress({
        phase: generationPhase,
        isStreaming,
        isAutoContinuing: autoContinue.isAutoContinuing,
        hasOpenArtifact: Boolean(liveExtracted) || Boolean(previewArtifact),
        artifactComplete: Boolean(
          liveExtracted?.complete
          || (!isStreaming && previewArtifact && !truncated),
        ),
        previewReady: Boolean(previewArtifact) && !imageGenProgress,
        imageGen: imageGenProgress,
      })
      : null,
    [
      isGenerating,
      generationPhase,
      isStreaming,
      autoContinue.isAutoContinuing,
      liveExtracted,
      previewArtifact,
      truncated,
      imageGenProgress,
    ],
  );

  const continueLast = async () => {
    if (!project) return;
    void sendUserMessage('Continue from where you stopped. Finish the artifact in full.', { skipAppend: false });
  };

  // Cancel auto-continuation: stop the stream and revert to manual mode
  const cancelAutoContinue = cancel;

  if (!project) return <EmptyState />;

  return (
    <div className="flex h-full flex-col">
      <ConfirmDialog
        open={!!imageGenPrompt}
        title="Generate images?"
        message={
          imageGenPrompt ? (
            <>
              This page has <span className="text-foreground font-medium">{imageGenPrompt.slotCount}</span> image
              {imageGenPrompt.slotCount === 1 ? ' box' : ' boxes'} ready for AI generation.
              Generate images now? You can skip and keep the placeholder preview.
            </>
          ) : null
        }
        confirmLabel="Generate images"
        cancelLabel="Not now"
        onConfirm={() => {
          if (!imageGenPrompt) return;
          const { html, projectId, skillId } = imageGenPrompt;
          setImageGenPrompt(null);
          void runImagePipeline(html, projectId, skillId);
        }}
        onCancel={() => {
          const deferred = deferredLintRef.current;
          setImageGenPrompt(null);
          if (deferred) {
            deferredLintRef.current = null;
            void maybePersistLintFixes(deferred.html, deferred.projectId, deferred.skillId, { skip: FAST_PATH_SKILL_IDS.has(deferred.skillId ?? '') });
          }
        }}
      />
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
        chat={<ChatPane onSend={(content, attachments) => sendUserMessage(content, { attachments })} onCancel={cancel} onRegenerate={regenerateFrom} onReloadPreview={() => window.dispatchEvent(new CustomEvent('renoir:reload-preview'))} hasPreview={Boolean(artifactHtml)} questionForm={questionForm} autoContinue={autoContinue} onCancelAutoContinue={cancelAutoContinue} />}
        preview={<PreviewPane key={selectedSkillId ?? 'default'} artifact={artifactHtml} loading={showPreviewLoading} loadingPhase={generationPhase} loadingProgress={generationProgress} streaming={isStreaming && !!liveExtracted && !liveExtracted.complete} imageGenProgress={imageGenProgress} artifactResetKey={artifactResetKey} revising={isRevising || (isStreaming && Boolean(previewArtifact) && awaitingNewArtifact)} />}
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
      <div ref={containerRef} className="flex-1 flex min-w-0 min-h-0 h-full">
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
        <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col">
          {preview}
        </div>
      </div>
    </div>
  );
}

async function maybePersistLintFixes(
  html: string,
  projectId: string,
  skillId?: string,
  opts?: { skip?: boolean },
) {
  if (opts?.skip) return;
  try {
    const st = useStudio.getState();
    const title = st.project?.name?.trim() || 'Artifact';
    const repair = await repairArtifactIfNeeded(
      html,
      {
        title,
        viewportWidth: 1280,
        dashboard: skillId === 'dashboard',
        productDeck: skillId === 'product-deck',
        productName: title,
        productDeckFinalize: true,
      },
      window.renoir.lintArtifact,
    );
    if (!repair.improved) return;

    const fixedCount = repair.before.findings.length - repair.after.findings.length;
    const verRes = await window.renoir.addVersion({
      id: projectId,
      html: repair.html,
      source: 'assistant',
      skillId,
      note: `Auto-fixed ${fixedCount} lint finding(s)`,
    });
    if (!verRes.ok || !verRes.project) return;

    let next = patchSkillSession(verRes.project, skillId, {
      previewHtml: repair.html,
      versions: getSkillSession(verRes.project, skillId).versions,
    });
    if (skillId === st.selectedSkillId) {
      next = applySession(next, skillId);
    }
    useStudio.getState().setProject(next);
  } catch {
    /* keep original artifact on failure */
  }
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
