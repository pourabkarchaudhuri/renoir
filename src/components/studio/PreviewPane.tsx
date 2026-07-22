import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, Smartphone, Tablet, Monitor, Maximize2, Loader2, Code, RotateCcw,
  BookmarkPlus, ScanSearch, FileText, GitFork, ExternalLink, MoreHorizontal,
  Minimize2, ChevronLeft, ChevronRight, Presentation, ScrollText, Presentation as PresentIcon,
  Upload, FileDown, Save as SaveIcon, Crosshair, Video, Footprints, GitCompare,
} from 'lucide-react';
import { useStudio, useUI, useCatalog } from '@/lib/store';
import { VersionStrip } from './VersionStrip';
import { DiffDialog } from './DiffDialog';
import { cn } from '@/lib/cn';
import { motion, AnimatePresence } from 'framer-motion';
import { LintBadge } from './LintBadge';
import { defaultModeForSkill, wrapWithBridge, type PreviewMode } from '@/lib/preview-modes';
import { enrichProductDeckHtml } from '@/lib/product-deck-content';
import {
  PREVIEW_SURFACES,
  PREVIEW_SURFACE_ORDER,
  ensureViewportMeta,
  frameDimensions,
  isDesktopOnlyPreview,
  previewSurfacesForSkill,
  type PreviewSurface,
} from '@/lib/preview-surfaces';
import { normalizeArtifactDocument, stripNonInteractiveButtonsForPreview } from '@/lib/artifact-html';
import { repairArtifactIfNeeded } from '@/lib/artifact-repair';
import { applySession, getSkillSession, patchSkillSession } from '@/lib/skill-sessions';
import { DevicePreviewFrame } from './DevicePreviewFrame';
import { PreviewLoading } from './PreviewLoading';
import { RecordPreviewDialog } from './RecordPreviewDialog';
import { VariantCompareDialog } from './VariantCompareDialog';
import { SkillExportMenu } from './SkillExportMenu';
import { isFeatureEnabled } from '@/lib/features';
import { artifactHasFlowLinks } from '@/lib/flow-screens';
import type { PreviewGenerationProgress } from '@/lib/preview-generation-progress';

type Surface = PreviewSurface;

export function PreviewPane({
  artifact,
  loading = false,
  loadingPhase = 'Composing your artifact…',
  loadingProgress = null,
  streaming = false,
  imageGenProgress = null,
  artifactResetKey,
  revising = false,
}: {
  artifact: string | null;
  loading?: boolean;
  loadingPhase?: string;
  loadingProgress?: PreviewGenerationProgress | null;
  streaming?: boolean;
  imageGenProgress?: { done: number; total: number } | null;
  /** Changes when a new generation or version is selected — resets slide index for deck skills. */
  artifactResetKey?: string;
  /** Post-creation revision in flight — preserve slide position and crossfade updates. */
  revising?: boolean;
}) {
  const surface = useUI((s) => s.previewSurface);
  const setPreviewSurface = useUI((s) => s.setPreviewSurface);
  const [showCode, setShowCode] = useState(false);
  const project = useStudio((s) => s.project);
  const skillId = useStudio((s) => s.selectedSkillId);
  const desktopOnly = isDesktopOnlyPreview(skillId);
  const activeSurfaces = useMemo(() => previewSurfacesForSkill(skillId), [skillId]);
  const toast = useUI((s) => s.toast);
  const refreshTemplates = useCatalog((s) => s.refreshTemplates);
  const designSystems = useCatalog((s) => s.designSystems);
  const directions = useCatalog((s) => s.directions);
  const selectedDesignSystemId = useStudio((s) => s.selectedDesignSystemId);
  const selectedDirectionId = useStudio((s) => s.selectedDirectionId);
  const [diff, setDiff] = useState<{ a: string; b: string } | null>(null);
  const iframeRefs = useRef<Record<PreviewSurface, HTMLIFrameElement | null>>({
    phone: null,
    tablet: null,
    desktop: null,
    ultrawide: null,
  });

  // Preview mode — deck skills lock to present; user can override for others.
  const [modeOverride, setModeOverride] = useState<PreviewMode | 'auto'>('auto');
  const effectiveMode: PreviewMode = desktopOnly
    ? 'present'
    : modeOverride === 'auto'
      ? defaultModeForSkill(skillId)
      : modeOverride;
  const [navState, setNavState] = useState<{ idx: number; total: number }>({ idx: 0, total: 1 });
  const [reloadGen, setReloadGen] = useState(0);
  const [pickMode, setPickMode] = useState(false);
  const [walkMode, setWalkMode] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const setActiveFlowScreenId = useUI((s) => s.setActiveFlowScreenId);

  useEffect(() => {
    if (desktopOnly && surface !== 'desktop') setPreviewSurface('desktop');
  }, [desktopOnly, surface, setPreviewSurface]);

  const docTitle = project?.name?.trim() || 'Artifact';

  const artifactTheme = useMemo(() => {
    const ds = designSystems.find((d) => d.id === selectedDesignSystemId);
    if (!ds?.tokens?.length) return undefined;
    const dir = directions.find((d) => d.id === selectedDirectionId);
    return {
      tokens: ds.tokens,
      font: ds.font,
      directionSwatches: dir?.swatches,
    };
  }, [designSystems, directions, selectedDesignSystemId, selectedDirectionId]);

  const srcDocsBySurface = useMemo(() => {
    if (!artifact) return null;
    const normalized = stripNonInteractiveButtonsForPreview(
      normalizeArtifactDocument(artifact, {
        title: docTitle,
        theme: artifactTheme,
        dashboard: skillId === 'dashboard',
        productDeck: skillId === 'product-deck',
        productName: docTitle,
        productDeckFinalize: !streaming,
      }),
      skillId,
    );
    const out = {} as Record<PreviewSurface, string>;
    for (const id of activeSurfaces) {
      const viewportW = PREVIEW_SURFACES[id].w;
      const html = ensureViewportMeta(normalized, viewportW);
      out[id] = wrapWithBridge(html);
    }
    return out;
  }, [artifact, docTitle, artifactTheme, skillId, activeSurfaces, streaming]);

  useEffect(() => {
    if (!artifact || !desktopOnly) return;
    const enriched = enrichProductDeckHtml(artifact, {
      productName: docTitle,
      finalize: !streaming,
    });
    setNavState((n) => ({
      idx: Math.min(n.idx, Math.max(0, enriched.slideCount - 1)),
      total: enriched.slideCount,
    }));
  }, [artifact, desktopOnly, docTitle, streaming]);

  const activeSrcDoc = srcDocsBySurface?.[surface] ?? null;
  const baseHtml = useMemo(() => {
    if (!artifact) return null;
    return stripNonInteractiveButtonsForPreview(
      normalizeArtifactDocument(artifact, {
        title: docTitle,
        viewportWidth: PREVIEW_SURFACES[surface].w,
        theme: artifactTheme,
        dashboard: skillId === 'dashboard',
        productDeck: skillId === 'product-deck',
        productName: docTitle,
        productDeckFinalize: !streaming,
      }),
      skillId,
    );
  }, [artifact, surface, docTitle, artifactTheme, skillId, streaming]);

  // Listen for nav-state messages from the iframe bridge.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d?.type !== 'renoir:nav-state') return;
      if (desktopOnly) {
        const win = iframeRefs.current.desktop?.contentWindow;
        if (win && e.source !== win) return;
      }
      setNavState({ idx: d.idx ?? 0, total: d.total ?? 1 });
      setActiveFlowScreenId(`slide-${d.idx ?? 0}`);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [desktopOnly, setActiveFlowScreenId]);

  const postToSurface = useCallback((surf: PreviewSurface, msg: unknown) => {
    iframeRefs.current[surf]?.contentWindow?.postMessage(msg, '*');
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d?.type === 'renoir:picked') {
        const odId = d.odId as string | undefined;
        if (!odId) {
          toast('No tagged region — artifacts need data-od-id sections', 'warn');
          return;
        }
        window.dispatchEvent(new CustomEvent('renoir:pick-target', {
          detail: {
            odId,
            tag: d.tag,
            textPreview: d.textPreview,
            artifactHtml: artifact,
          },
        }));
        setPickMode(false);
        return;
      }
      if (d?.type === 'renoir:a11y-report') {
        window.dispatchEvent(new CustomEvent('renoir:a11y-probe-result', { detail: d }));
        return;
      }
      if (d?.type === 'renoir:flow-screen') {
        const screenId = d.screenId as string | undefined;
        if (screenId) setActiveFlowScreenId(screenId);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [artifact, toast, setActiveFlowScreenId]);

  useEffect(() => {
    const msg = pickMode ? { type: 'renoir:pick-enable' } : { type: 'renoir:pick-disable' };
    for (const id of activeSurfaces) postToSurface(id, msg);
    if (!pickMode) return;
    if (effectiveMode === 'present') {
      setPickMode(false);
      toast('Pick mode works in scroll view only', 'info');
    }
  }, [pickMode, effectiveMode, activeSurfaces, postToSurface, toast]);

  useEffect(() => {
    if (!isFeatureEnabled('clickThrough')) return;
    const msg = walkMode ? { type: 'renoir:flow-enable' } : { type: 'renoir:flow-disable' };
    for (const id of activeSurfaces) postToSurface(id, msg);
    if (!walkMode) return;
    if (effectiveMode === 'present') {
      setWalkMode(false);
      toast('Walk mode works in scroll view only', 'info');
    }
  }, [walkMode, effectiveMode, activeSurfaces, postToSurface, toast]);

  useEffect(() => {
    const onProbe = () => {
      for (const id of activeSurfaces) postToSurface(id, { type: 'renoir:a11y-probe' });
    };
    const onFlowNav = (e: Event) => {
      const screenId = (e as CustomEvent).detail?.screenId as string | undefined;
      if (!screenId) return;
      postToSurface(surface, { type: 'renoir:flow-nav', screenId });
      window.requestAnimationFrame(() => {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      });
    };
    window.addEventListener('renoir:run-a11y-probe', onProbe);
    window.addEventListener('renoir:flow-nav-request', onFlowNav);
    return () => {
      window.removeEventListener('renoir:run-a11y-probe', onProbe);
      window.removeEventListener('renoir:flow-nav-request', onFlowNav);
    };
  }, [activeSurfaces, postToSurface, surface]);

  const postNavToDesktop = useCallback((idx: number) => {
    postToSurface('desktop', { type: 'renoir:set-mode', mode: 'present' });
    const msg = { type: 'renoir:nav', idx };
    postToSurface('desktop', msg);
    window.setTimeout(() => postToSurface('desktop', msg), 80);
    window.setTimeout(() => postToSurface('desktop', msg), 280);
  }, [postToSurface]);

  const navigateSlide = useCallback((action: { dir?: 'prev' | 'next'; idx?: number }) => {
    setNavState((prev) => {
      let nextIdx = prev.idx;
      if (action.dir === 'next') nextIdx = Math.min(prev.total - 1, prev.idx + 1);
      else if (action.dir === 'prev') nextIdx = Math.max(0, prev.idx - 1);
      else if (typeof action.idx === 'number') nextIdx = Math.max(0, Math.min(prev.total - 1, action.idx));
      if (nextIdx === prev.idx) return prev;
      if (desktopOnly) postNavToDesktop(nextIdx);
      else {
        const msg = typeof action.idx === 'number'
          ? { type: 'renoir:nav', idx: nextIdx }
          : { type: 'renoir:nav', dir: action.dir };
        for (const id of activeSurfaces) postToSurface(id, msg);
      }
      return { ...prev, idx: nextIdx };
    });
  }, [activeSurfaces, desktopOnly, postNavToDesktop, postToSurface]);

  const resetKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!desktopOnly || !artifact || !artifactResetKey) return;
    // Keep deck slide position during living-document revisions.
    if (revising) return;
    if (resetKeyRef.current === artifactResetKey) return;
    resetKeyRef.current = artifactResetKey;
    setNavState((n) => ({ idx: 0, total: n.total }));
    const t = window.setTimeout(() => postNavToDesktop(0), 150);
    return () => window.clearTimeout(t);
  }, [artifactResetKey, artifact, desktopOnly, postNavToDesktop, revising]);

  // Apply mode + viewport to every preview; charts only on the active device.
  useEffect(() => {
    if (!srcDocsBySurface) return;
    const id = window.setTimeout(() => {
      for (const surf of activeSurfaces) {
        const { w } = frameDimensions(surf, effectiveMode);
        postToSurface(surf, { type: 'renoir:set-viewport', width: w });
        postToSurface(surf, { type: 'renoir:set-mode', mode: effectiveMode });
        if (surf === surface) postToSurface(surf, { type: 'renoir:reload' });
      }
    }, 120);
    return () => window.clearTimeout(id);
  }, [effectiveMode, srcDocsBySurface, reloadGen, surface, activeSurfaces]);

  // When the active device tab changes, reload that preview (charts + layout).
  useEffect(() => {
    if (!srcDocsBySurface) return;
    const { w } = frameDimensions(surface, effectiveMode);
    const t1 = window.setTimeout(() => {
      postToSurface(surface, { type: 'renoir:set-viewport', width: w });
      postToSurface(surface, { type: 'renoir:set-mode', mode: effectiveMode });
      postToSurface(surface, { type: 'renoir:reload' });
    }, 30);
    const t2 = window.setTimeout(() => {
      postToSurface(surface, { type: 'renoir:reload' });
    }, 350);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [surface, effectiveMode, srcDocsBySurface, reloadGen]);

  // Keyboard nav for present / deck mode (skip when iframe has focus — it handles keys locally).
  useEffect(() => {
    if (effectiveMode !== 'present') return;
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'IFRAME') return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (t && (t as any).isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        navigateSlide({ dir: 'next' });
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        navigateSlide({ dir: 'prev' });
      } else if (e.key === 'Home') {
        e.preventDefault();
        navigateSlide({ idx: 0 });
      } else if (e.key === 'End') {
        e.preventDefault();
        navigateSlide({ idx: 999 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [effectiveMode, navigateSlide]);

  const downloadHtml = async () => {
    if (!artifact || !project) return;
    const filename = `artifact-${Date.now()}.html`;
    const res = await window.renoir.writeArtifact({
      projectId: project.id, filename, content: baseHtml!,
    });
    if (res.ok) toast(`Saved ${filename}`, 'ok');
    else toast(res.error || 'Save failed', 'err');
  };

  const exportPptx = async () => {
    if (!artifact || !project) return;
    const id = useUI.getState().pushExport({ kind: 'pptx', label: 'Exporting PPTX' });
    try {
      useUI.getState().updateExport(id, { phase: 'capturing slides…' });
      const res = await window.renoir.exportPptx({
        projectId: project.id,
        html: wrapWithBridge(baseHtml!),
      });
      if (res.ok) useUI.getState().completeExport(id, { savedPath: res.savedPath, ok: true });
      else useUI.getState().completeExport(id, { ok: false, error: res.error });
    } catch (err: any) {
      useUI.getState().completeExport(id, { ok: false, error: err?.message || String(err) });
    }
  };

  const runCritique = useCallback(async () => {
    if (!artifact || !project) return;
    const html = baseHtml ?? artifact;
    const id = `${project.id}:critique:${Date.now()}`;
    const userMsg = '/critique — review the latest artifact across hierarchy, typography, contrast, spacing, affordance.';

    useStudio.getState().bindConversation(id);
    useStudio.getState().startStreaming();

    const brief = project.conversation.find(
      (m) => m.role === 'user' && !m.content.startsWith('/critique'),
    )?.content || '';
    const res = await window.renoir.critiqueStart({ conversationId: id, artifactHtml: html, brief });
    void useStudio.getState().appendUser(userMsg);

    if (!res.ok) {
      toast(res.error || 'critique failed', 'err');
      void useStudio.getState().finishStreaming();
    }
  }, [artifact, project, baseHtml, toast]);

  useEffect(() => {
    const h = () => { void runCritique(); };
    window.addEventListener('renoir:run-critique', h);
    return () => window.removeEventListener('renoir:run-critique', h);
  }, [runCritique]);

  // Push to detached preview window whenever the artifact changes.
  useEffect(() => {
    if (!activeSrcDoc) return;
    void window.renoir.previewIsOpen().then((open) => {
      if (open) void window.renoir.pushPreview(activeSrcDoc);
    });
  }, [activeSrcDoc]);

  const fork = async () => {
    if (!project || !artifact) return;
    const res = await window.renoir.forkProject({ fromId: project.id });
    if (res.ok && res.project) {
      useStudio.getState().setProject(res.project);
      toast(`Forked → ${res.project.name}`, 'ok');
    } else {
      toast(res.error || 'fork failed', 'err');
    }
  };

  const detach = async () => {
    if (!activeSrcDoc) return;
    await window.renoir.openPreview(activeSrcDoc);
    toast('Detached preview opened', 'ok');
  };

  const runPreviewRecord = async (opts: { mode: 'static' | 'scroll' | 'present'; durationSec: number; fps: number }) => {
    if (!activeSrcDoc || !project) return;
    const id = useUI.getState().pushExport({ kind: 'pdf', label: 'Recording preview' });
    try {
      useUI.getState().updateExport(id, { phase: 'capturing frames…' });
      const res = await window.renoir.previewRecord({
        projectId: project.id,
        html: activeSrcDoc,
        mode: opts.mode,
        surface,
        durationSec: opts.durationSec,
        fps: opts.fps,
        slideCount: navState.total,
      });
      if (res.ok) {
        const path = res.videoPath ?? res.pngPath ?? res.framesDir;
        useUI.getState().completeExport(id, { ok: true, savedPath: path });
        toast(res.error ? `Saved frames (${res.error})` : 'Recording saved', res.error ? 'warn' : 'ok');
      } else {
        useUI.getState().completeExport(id, { ok: false, error: res.error });
      }
    } catch (err: unknown) {
      useUI.getState().completeExport(id, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  };

  const saveAsTemplate = async () => {
    if (!artifact || !project) return;
    const name = window.prompt('Template name?', `${project.name} template`) || '';
    if (!name) return;
    await window.renoir.saveTemplate({ name, category: 'artifact', body: baseHtml! });
    await refreshTemplates();
    toast('Saved as template', 'ok');
  };

  const setProject = useStudio((s) => s.setProject);
  const exportProjectZip = async () => {
    if (!project) return;
    const r = await window.renoir.exportProject(project.id);
    if (r.ok) toast(`Exported to ${r.savedPath}`, 'ok');
    else if (r.error !== 'cancelled') toast(r.error || 'Export failed', 'err');
  };
  const importProjectZip = async () => {
    const r = await window.renoir.importProject();
    if (r.ok && r.project) {
      setProject(r.project);
      toast('Project imported', 'ok');
    } else if (r.error && r.error !== 'cancelled') {
      toast(r.error, 'err');
    }
  };

  const reloadPreviews = useCallback(async () => {
    const bumpReload = () => {
      setReloadGen((n) => n + 1);
      window.setTimeout(() => {
        for (const id of activeSurfaces) {
          postToSurface(id, { type: 'renoir:reload' });
        }
      }, 150);
    };

    if (!artifact) {
      bumpReload();
      return;
    }

    const normalizeOpts = {
      title: docTitle,
      viewportWidth: PREVIEW_SURFACES[surface].w,
      theme: artifactTheme,
      dashboard: skillId === 'dashboard',
      productDeck: skillId === 'product-deck',
      productName: docTitle,
      productDeckFinalize: !streaming,
    };

    const previewHtml = baseHtml ?? normalizeArtifactDocument(artifact, normalizeOpts);
    const lintBefore = await window.renoir.lintArtifact(previewHtml);

    if (lintBefore.errors === 0 && lintBefore.warnings === 0) {
      bumpReload();
      toast('Preview reloaded', 'ok');
      return;
    }

    const repair = await repairArtifactIfNeeded(
      artifact,
      normalizeOpts,
      window.renoir.lintArtifact,
      previewHtml,
    );
    if (repair.improved && project) {
      const fixedCount = repair.before.findings.length - repair.after.findings.length;
      const verRes = await window.renoir.addVersion({
        id: project.id,
        html: repair.html,
        source: 'assistant',
        skillId,
        note: `Fixed ${fixedCount} lint finding(s) on reload`,
      });
      if (verRes.ok && verRes.project) {
        let next = patchSkillSession(verRes.project, skillId, {
          previewHtml: repair.html,
          versions: getSkillSession(verRes.project, skillId).versions,
        });
        if (skillId === useStudio.getState().selectedSkillId) {
          next = applySession(next, skillId);
        }
        setProject(next);
        toast(`Fixed ${fixedCount} preview issue${fixedCount === 1 ? '' : 's'}`, 'ok');
      } else {
        toast('Preview reloaded', 'ok');
      }
    } else {
      toast('Preview reloaded', 'ok');
    }

    bumpReload();
  }, [
    artifact,
    baseHtml,
    docTitle,
    surface,
    artifactTheme,
    skillId,
    streaming,
    project,
    activeSurfaces,
    postToSurface,
    setProject,
    toast,
  ]);

  useEffect(() => {
    const onReload = () => reloadPreviews();
    window.addEventListener('renoir:reload-preview', onReload);
    return () => window.removeEventListener('renoir:reload-preview', onReload);
  }, [reloadPreviews]);

  const sz = frameDimensions(surface, effectiveMode);

  return (
    <section className="h-full min-h-0 flex-1 min-w-0 flex flex-col bg-canvas/50">
      <VersionStrip onCompare={(a, b) => setDiff({ a, b })} />
      <div className="px-3 py-2 border-b border-border flex items-center gap-1.5">
        {streaming && (
          <span className="flex items-center gap-1.5 px-1.5 h-6 rounded text-[10px] uppercase tracking-[0.18em] text-primary bg-primary/10 ring-1 ring-primary/30">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            live
          </span>
        )}
        {loadingProgress && !loading && (
          <span
            className="flex items-center gap-2 px-2 h-6 rounded text-[10px] uppercase tracking-[0.14em] text-muted-foreground bg-secondary/80 ring-1 ring-border"
            title={loadingProgress.phase}
          >
            <span className="font-mono tracking-normal normal-case">
              {loadingProgress.completedCount}/{loadingProgress.totalCount}
            </span>
            <span className="w-16 h-1 rounded-full bg-background/80 overflow-hidden">
              <span
                className="block h-full bg-gradient-to-r from-ember-400 to-ember-600 transition-[width] duration-300"
                style={{ width: `${Math.max(8, Math.round(loadingProgress.fraction * 100))}%` }}
              />
            </span>
          </span>
        )}
        {imageGenProgress && (
          <span className="flex items-center gap-1.5 px-1.5 h-6 rounded text-[10px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating images: {imageGenProgress.done}/{imageGenProgress.total}
          </span>
        )}
        <ModeTabs mode={effectiveMode} onChange={setModeOverride} hidden={desktopOnly} />
        {!desktopOnly && (
          <>
            <SurfaceTab id="phone"     surface={surface} setSurface={setPreviewSurface} icon={<Smartphone className="h-3.5 w-3.5" strokeWidth={1.6} />} />
            <SurfaceTab id="tablet"    surface={surface} setSurface={setPreviewSurface} icon={<Tablet className="h-3.5 w-3.5" strokeWidth={1.6} />} />
            <SurfaceTab id="desktop"   surface={surface} setSurface={setPreviewSurface} icon={<Monitor className="h-3.5 w-3.5" strokeWidth={1.6} />} />
            <SurfaceTab id="ultrawide" surface={surface} setSurface={setPreviewSurface} icon={<Maximize2 className="h-3.5 w-3.5" strokeWidth={1.6} />} />
          </>
        )}
        <span className="ml-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
          {desktopOnly ? 'Desktop' : ''} {sz.w}×{sz.h}
        </span>
        {effectiveMode === 'present' && !desktopOnly && (
          <SlideNav nav={navState} onPrev={() => navigateSlide({ dir: 'prev' })} onNext={() => navigateSlide({ dir: 'next' })} />
        )}
        {artifact && effectiveMode !== 'present' && (
          <button
            type="button"
            onClick={() => {
              setPickMode((v) => {
                const next = !v;
                if (next) setWalkMode(false);
                return next;
              });
            }}
            className={cn(
              'h-7 w-7 grid place-items-center rounded-md transition-colors',
              pickMode ? 'bg-primary/10 ring-1 ring-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
            title="Pick region to edit"
          >
            <Crosshair className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        )}
        {artifact && effectiveMode !== 'present' && isFeatureEnabled('clickThrough') && (
          <button
            type="button"
            onClick={() => {
              if (!walkMode && artifact && !artifactHasFlowLinks(artifact)) {
                toast('No flow links — ask for data-goto screens', 'warn');
              }
              setWalkMode((v) => {
                const next = !v;
                if (next) setPickMode(false);
                return next;
              });
            }}
            className={cn(
              'h-7 w-7 grid place-items-center rounded-md transition-colors',
              walkMode ? 'bg-primary/10 ring-1 ring-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
            title="Walk prototype (click data-goto links)"
          >
            <Footprints className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        )}
        {artifact && (
          <button
            type="button"
            onClick={reloadPreviews}
            className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Reload preview (all devices)"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {artifact && <LintBadge html={baseHtml} />}
          <SkillExportMenu skillId={skillId} streaming={streaming} />
          <FullViewToggle />
          <OverflowMenu
            items={[
              { label: 'Save as HTML',      icon: <SaveIcon className="h-3.5 w-3.5" strokeWidth={1.6} />,     onClick: downloadHtml,       disabled: !artifact, group: 'save' },
              { label: 'Export PPTX',       icon: <PresentIcon className="h-3.5 w-3.5" strokeWidth={1.6} />,  onClick: exportPptx,         disabled: !artifact, group: 'save' },
              { label: 'Save as template',  icon: <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={1.6} />, onClick: saveAsTemplate,     disabled: !artifact, group: 'save' },
              { label: 'Reload preview',    icon: <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />, onClick: reloadPreviews,     disabled: !artifact, group: 'view' },
              { label: 'Toggle source',     icon: <Code className="h-3.5 w-3.5" strokeWidth={1.6} />,         active: showCode, onClick: () => setShowCode((v) => !v), disabled: !artifact, group: 'view' },
              { label: 'Detach preview',    icon: <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />, onClick: detach,             disabled: !artifact, group: 'view' },
              { label: 'Record preview…',   icon: <Video className="h-3.5 w-3.5" strokeWidth={1.6} />, onClick: () => setRecordOpen(true), disabled: !artifact, group: 'view' },
              ...(isFeatureEnabled('variantCompareWizard') ? [{
                label: 'Compare versions…',
                icon: <GitCompare className="h-3.5 w-3.5" strokeWidth={1.6} />,
                onClick: () => setCompareOpen(true),
                disabled: !artifact || (project?.versions?.length ?? 0) < 1,
                group: 'view' as const,
              }] : []),
              { label: 'Critique (5-dim)',  icon: <ScanSearch className="h-3.5 w-3.5" strokeWidth={1.6} />,   onClick: runCritique,        disabled: !artifact, group: 'view' },
              { label: 'Fork as new study', icon: <GitFork className="h-3.5 w-3.5" strokeWidth={1.6} />,      onClick: fork,               disabled: !artifact, group: 'project' },
              { label: 'Import project',    icon: <Upload className="h-3.5 w-3.5" strokeWidth={1.6} />,       onClick: importProjectZip,   group: 'project' },
              { label: 'Export project',    icon: <FileDown className="h-3.5 w-3.5" strokeWidth={1.6} />,     onClick: exportProjectZip,   group: 'project' },
            ]}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {loading && !srcDocsBySurface ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 grid place-items-center"
            >
              <PreviewLoading phase={loadingPhase} progress={loadingProgress} />
            </motion.div>
          ) : !srcDocsBySurface ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 grid place-items-center"
            >
              <PreviewEmpty />
            </motion.div>
          ) : showCode ? (
            <motion.pre
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 m-4 plate rounded-xl p-4 text-[11px] font-mono leading-relaxed overflow-auto whitespace-pre-wrap min-h-0"
            >
              {activeSrcDoc}
            </motion.pre>
          ) : (
            <motion.div
              key="frame"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 flex flex-col"
            >
              <div className="relative flex-1 min-h-0 w-full overflow-hidden">
                {activeSurfaces.map((id) => (
                  <DevicePreviewFrame
                    key={`${id}-${reloadGen}`}
                    surface={id}
                    mode={effectiveMode}
                    srcDoc={srcDocsBySurface[id]}
                    setIframeRef={(el) => { iframeRefs.current[id] = el; }}
                    visible={desktopOnly || surface === id}
                    constrainToViewport={skillId === 'dashboard'}
                    lockScroll={desktopOnly}
                    crossfade={revising}
                  />
                ))}
              </div>
              {desktopOnly && artifact && (
                <DeckSlideFooter
                  nav={navState}
                  onPrev={() => navigateSlide({ dir: 'prev' })}
                  onNext={() => navigateSlide({ dir: 'next' })}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DiffDialog
        open={Boolean(diff)}
        aId={diff?.a ?? null}
        bId={diff?.b ?? null}
        onClose={() => setDiff(null)}
      />
      <RecordPreviewDialog
        open={recordOpen}
        surface={surface}
        effectiveMode={effectiveMode}
        onClose={() => setRecordOpen(false)}
        onRecord={(opts) => void runPreviewRecord(opts)}
      />
      {isFeatureEnabled('variantCompareWizard') && (
        <VariantCompareDialog open={compareOpen} onClose={() => setCompareOpen(false)} />
      )}
    </section>
  );
}

interface OverflowItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  group?: 'save' | 'view' | 'project';
}

function OverflowMenu({ items }: { items: OverflowItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // Group items into separators inside the popover.
  const groups: { id: string; label: string; items: OverflowItem[] }[] = [
    { id: 'save',    label: 'Save & export', items: items.filter((i) => i.group === 'save') },
    { id: 'view',    label: 'View',          items: items.filter((i) => i.group === 'view') },
    { id: 'project', label: 'Project',       items: items.filter((i) => i.group === 'project') },
  ];
  const ungrouped = items.filter((i) => !i.group);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-quiet text-[12px] h-7 py-0 w-8 px-0 grid place-items-center"
        title="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 mt-1.5 w-[260px] plate rounded-xl p-1 shadow-plate z-30"
          >
            {groups.map((g, gi) => (
              g.items.length === 0 ? null : (
                <div key={g.id} className={gi > 0 ? 'mt-1 pt-1 border-t border-border' : ''}>
                  <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                    {g.label}
                  </div>
                  {g.items.map((it) => (
                    <button
                      key={it.label}
                      onClick={() => { setOpen(false); it.onClick(); }}
                      disabled={it.disabled}
                      className={cn(
                        'w-full text-left rounded-md px-2.5 py-1.5 flex items-center gap-2 text-[12.5px] transition-colors',
                        it.active ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground',
                        it.disabled && 'opacity-40 pointer-events-none',
                      )}
                    >
                      <span className="text-muted-foreground">{it.icon}</span>
                      <span>{it.label}</span>
                    </button>
                  ))}
                </div>
              )
            ))}
            {ungrouped.length > 0 && (
              <div className="mt-1 pt-1 border-t border-border">
                {ungrouped.map((it) => (
                  <button
                    key={it.label}
                    onClick={() => { setOpen(false); it.onClick(); }}
                    disabled={it.disabled}
                    className={cn(
                      'w-full text-left rounded-md px-2.5 py-1.5 flex items-center gap-2 text-[12.5px] transition-colors',
                      it.active ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground',
                      it.disabled && 'opacity-40 pointer-events-none',
                    )}
                  >
                    <span className="text-muted-foreground">{it.icon}</span>
                    <span>{it.label}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeTabs({ mode, onChange, hidden = false }: { mode: PreviewMode; onChange: (m: PreviewMode | 'auto') => void; hidden?: boolean }) {
  if (hidden) return null;
  const tabs: { id: PreviewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'scroll',  icon: <ScrollText className="h-3.5 w-3.5" strokeWidth={1.6} />,    label: 'Scroll' },
    { id: 'present', icon: <Presentation className="h-3.5 w-3.5" strokeWidth={1.6} />,  label: 'Slide' },
  ];
  return (
    <div className="flex items-center gap-0.5 mr-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'h-7 w-7 grid place-items-center rounded-md transition-colors',
            mode === t.id
              ? 'bg-primary/10 ring-1 ring-primary/30 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function DeckSlideFooter({
  nav,
  onPrev,
  onNext,
}: {
  nav: { idx: number; total: number };
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-border px-4 py-2.5 flex flex-col items-center gap-2 bg-canvas/50">
      <span className="text-[12px] tabular-nums text-muted-foreground">
        Slide {nav.idx + 1} / {nav.total}
      </span>
      <div className="flex items-center gap-3 text-[12.5px]">
        <button
          type="button"
          onClick={onPrev}
          disabled={nav.idx === 0}
          className="btn-quiet h-7 px-2.5 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-muted-foreground/50 select-none" aria-hidden>|</span>
        <button
          type="button"
          onClick={onNext}
          disabled={nav.idx >= nav.total - 1}
          className="btn-quiet h-7 px-2.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SlideNav({ nav, onPrev, onNext }: { nav: { idx: number; total: number }; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-1 ml-1">
      <button
        onClick={onPrev}
        disabled={nav.idx === 0}
        className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
        title="Previous (←)"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-[11px] tabular-nums font-mono px-1.5 text-muted-foreground min-w-[72px] text-center">
        Slide {nav.idx + 1} / {nav.total}
      </span>
      <button
        onClick={onNext}
        disabled={nav.idx >= nav.total - 1}
        className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
        title="Next (→ / Space)"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function FullViewToggle() {
  const full           = useUI((s) => s.previewFull);
  const setFull        = useUI((s) => s.setPreviewFull);
  const railCollapsed  = useUI((s) => s.railCollapsed);
  const toggleRail     = useUI((s) => s.toggleRail);
  const Icon           = full ? Minimize2 : Maximize2;

  const handle = () => {
    const next = !full;
    setFull(next);
    // Going full-view: also collapse the rail so preview owns the screen.
    // Restoring: bring the rail back if we collapsed it ourselves.
    if (next && !railCollapsed)      toggleRail();
    else if (!next && railCollapsed) toggleRail();
  };

  return (
    <button
      onClick={handle}
      className="btn-ghost text-[12px] h-7 py-0 w-7 px-0 grid place-items-center"
      title={full ? 'Restore split (Esc)' : 'Full-view preview'}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
    </button>
  );
}

function SurfaceTab({
  id, surface, setSurface, icon,
}: { id: Surface; surface: Surface; setSurface: (s: Surface) => void; icon: React.ReactNode }) {
  const active = surface === id;
  return (
    <button
      onClick={() => setSurface(id)}
      className={cn(
        'h-7 w-7 rounded-md grid place-items-center transition-colors',
        active ? 'bg-primary/10 ring-1 ring-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
      title={PREVIEW_SURFACES[id].label}
    >
      {icon}
    </button>
  );
}

function PreviewEmpty() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center max-w-[360px] py-20"
    >
      <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 ring-1 ring-primary/30 grid place-items-center">
        <Monitor className="h-5 w-5 text-primary" strokeWidth={1.5} />
      </div>
      <h3 className="font-display italic text-2xl mt-3">Preview waits.</h3>
      <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
        When the model returns an &lt;artifact&gt; block, it lands here in a sandboxed frame.
      </p>
    </motion.div>
  );
}
