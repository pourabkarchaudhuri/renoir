// Media studio — split layout. Prompt / parameters on the left, gallery
// dominates the right. Each kind ships with example prompt chips so users
// don't stare at a blank field. New renders land in the same gallery
// they're browsing (background-job system feeds it).

import { useState, useEffect, useMemo, useRef } from 'react';
import { useCatalog, useStudio, useUI } from '@/lib/store';
import {
  ImageIcon, Film, Music2, Layers3, Sparkles, Loader2, Wand2, Send,
  Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { motion, AnimatePresence } from 'framer-motion';
import { runImageJob, runImageEditJob, runVideoJob, runAudioJob, runHyperframeJob, runStoryboardJob } from '@/lib/jobs';
import { getExamples, type RenderKind } from '@/lib/example-prompts';
import { AssetModal, type AssetItem } from '@/components/media/AssetModal';
import type {
  ProjectAssets, ProjectAssetImage, ProjectAssetMedia,
  ProjectAssetStoryboard, ProjectAssetHyperframe,
} from '@/types/global';

const TABS: { id: RenderKind; label: string; icon: typeof ImageIcon; hint: string }[] = [
  { id: 'image',      label: 'Image',      icon: ImageIcon,    hint: 'Single-frame stills' },
  { id: 'video',      label: 'Video',      icon: Film,         hint: 'Short loops & clips' },
  { id: 'audio',      label: 'Audio',      icon: Music2,       hint: 'Voiceover, music, SFX' },
  { id: 'storyboard', label: 'Storyboard', icon: Clapperboard, hint: 'Multi-shot strips' },
  { id: 'hyperframe', label: 'HyperFrame', icon: Layers3,      hint: 'HTML → MP4 frames' },
];

export function Media() {
  const azure   = useCatalog((s) => s.azure);
  const project = useStudio((s) => s.project);
  const [tab, setTab] = useState<RenderKind>('image');

  return (
    <div className="absolute inset-0 overflow-hidden flex flex-col">
      <header className="px-8 pt-10 pb-4 border-b border-border flex items-end gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Media</div>
          <h1 className="font-display italic text-4xl mt-1">Render the rest of the brand.</h1>
        </div>
        <p className="ml-auto text-[12px] text-muted-foreground max-w-[420px] leading-relaxed">
          Renders run as background jobs. Switch tabs freely — your gallery on the right is the source of truth.
        </p>
      </header>

      <nav className="px-8 py-2 border-b border-border bg-background/40 flex items-center gap-1 overflow-x-auto scroll-thin">
        {TABS.map(({ id, label, icon: Icon, hint }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'h-9 px-3.5 rounded-lg flex items-center gap-2 text-[12.5px] transition-colors shrink-0',
                active
                  ? 'bg-primary/10 ring-1 ring-primary/30 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
              title={hint}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 grid grid-cols-[420px_1fr] min-h-0">
        <aside className="border-r border-border overflow-y-auto scroll-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.16 }}
              className="px-6 py-5"
            >
              {tab === 'image'      && <ImagePanel  azureReady={Boolean(azure?.configured)} projectId={project?.id} />}
              {tab === 'video'      && <VideoPanel  azureReady={Boolean(azure?.videoDeployment)} projectId={project?.id} />}
              {tab === 'audio'      && <AudioPanel  azureReady={Boolean(azure?.audioDeployment || azure?.textDeployment)} projectId={project?.id} />}
              {tab === 'storyboard' && <StoryboardPanel projectId={project?.id} />}
              {tab === 'hyperframe' && <HyperframePanel projectId={project?.id} />}
            </motion.div>
          </AnimatePresence>
        </aside>

        <section className="overflow-y-auto scroll-thin">
          <Gallery kind={tab} projectId={project?.id} />
        </section>
      </div>
    </div>
  );
}

/* ─── Panels (left) ───────────────────────────────────────────────────── */

function ExampleChips({ kind, onPick }: { kind: RenderKind; onPick: (body: string) => void }) {
  const examples = getExamples(kind);
  if (!examples.length) return null;
  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-2">Try one</div>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((ex) => (
          <button
            key={ex.title}
            onClick={() => onPick(ex.body)}
            className="plate-soft hover:bg-accent rounded-full px-2.5 py-1 text-[11.5px] flex items-center gap-1.5 transition-colors"
            title={ex.body.slice(0, 200)}
          >
            <Wand2 className="h-3 w-3 text-primary" strokeWidth={1.6} />
            {ex.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function PanelHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="font-display italic text-2xl">{title}</h2>
      </div>
      <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 mt-3">
      <span className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ImagePanel({ azureReady, projectId }: { azureReady: boolean; projectId?: string }) {
  const toast = useUI((s) => s.toast);
  const [mode, setMode] = useState<'gen' | 'edit'>('gen');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1024x1024'>('1024x1024');
  const [n, setN] = useState(1);
  const [editFile, setEditFile] = useState<{ base64: string; mime: string; preview: string } | null>(null);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    const base64 = btoa(binary);
    setEditFile({ base64, mime: file.type || 'image/png', preview: `data:${file.type};base64,${base64}` });
  };

  const run = () => {
    if (!prompt.trim()) return;
    if (!azureReady) { toast('Add AZURE_FOUNDRY_ENDPOINT in .env first', 'warn'); return; }
    if (mode === 'edit' && editFile) {
      void runImageEditJob({ prompt, imageBase64: editFile.base64, imageMime: editFile.mime, size, n, projectId });
    } else {
      void runImageJob({ prompt, size, n, projectId });
    }
    toast(`${mode === 'edit' ? 'Edit' : 'Render'} queued · runs in background`, 'info');
  };

  return (
    <div>
      <PanelHeader
        icon={<ImageIcon className="h-5 w-5" strokeWidth={1.5} />}
        title="Image"
        subtitle="Generate stills via gpt-image-2. Output saved to the project workspace."
      />

      <div className="flex items-center gap-1 mb-2">
        <SegBtn label="Generate" active={mode === 'gen'}  onClick={() => setMode('gen')} />
        <SegBtn label="Edit"     active={mode === 'edit'} onClick={() => setMode('edit')} />
      </div>

      {mode === 'edit' && (
        <Field label="Source image">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            className="text-[12px] file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-foreground"
          />
          {editFile && (
            <img src={editFile.preview} alt="source" className="mt-2 max-h-[160px] rounded-md ring-1 ring-border" />
          )}
        </Field>
      )}

      <Field label="Prompt">
        <textarea
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={mode === 'edit' ? 'Make the sky a dawn pink, keep the subject untouched…' : 'Studio shot of a brushed-aluminum espresso press…'}
          className="input-base resize-none"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Size (max 1024×1024)">
          <select value={size} onChange={(e) => setSize(e.target.value as '1024x1024')} className="input-base">
            <option value="1024x1024">Square 1024×1024</option>
          </select>
        </Field>
        <Field label="Count">
          <select value={n} onChange={(e) => setN(parseInt(e.target.value, 10))} className="input-base">
            {[1, 2, 3, 4].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <ExampleChips kind="image" onPick={setPrompt} />

      <div className="mt-5 flex justify-end">
        <button onClick={run} className="btn-ember" disabled={!prompt.trim() || (mode === 'edit' && !editFile)}>
          <Send className="h-4 w-4" />
          Render
        </button>
      </div>
    </div>
  );
}

function VideoPanel({ azureReady, projectId }: { azureReady: boolean; projectId?: string }) {
  const toast = useUI((s) => s.toast);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(4);
  const [size, setSize] = useState<'1280x720' | '720x1280' | '1024x1024'>('1280x720');

  const run = () => {
    if (!prompt.trim() || !projectId) return;
    if (!azureReady) { toast('Add AZURE_VIDEO_DEPLOYMENT in .env to enable video', 'warn'); return; }
    void runVideoJob({ prompt, durationSec: duration, size, projectId });
    toast('Video queued · runs in background', 'info');
  };

  return (
    <div>
      <PanelHeader
        icon={<Film className="h-5 w-5" strokeWidth={1.5} />}
        title="Video"
        subtitle={azureReady
          ? 'Short clips via your Azure video deployment.'
          : 'Add AZURE_VIDEO_DEPLOYMENT to .env to enable this lane.'}
      />
      <Field label="Prompt">
        <textarea
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A slow dolly through a paper origami forest at golden hour, 24fps, 4 seconds…"
          className="input-base resize-none"
          disabled={!azureReady}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration">
          <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10))} className="input-base" disabled={!azureReady}>
            {[2, 4, 6, 8, 10].map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
        </Field>
        <Field label="Aspect">
          <select value={size} onChange={(e) => setSize(e.target.value as any)} className="input-base" disabled={!azureReady}>
            <option value="1280x720">Landscape 16:9</option>
            <option value="720x1280">Portrait 9:16</option>
            <option value="1024x1024">Square</option>
          </select>
        </Field>
      </div>
      <ExampleChips kind="video" onPick={setPrompt} />
      <div className="mt-5 flex justify-end">
        <button onClick={run} className="btn-ember" disabled={!azureReady || !prompt.trim() || !projectId}>
          <Send className="h-4 w-4" />
          Render
        </button>
      </div>
      {!projectId && <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-300">Open a project first — outputs land in its workspace.</p>}
    </div>
  );
}

function AudioPanel({ azureReady, projectId }: { azureReady: boolean; projectId?: string }) {
  const toast = useUI((s) => s.toast);
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [format, setFormat] = useState<'mp3' | 'wav' | 'opus'>('mp3');

  const run = () => {
    if (!text.trim()) return;
    if (!azureReady) { toast('No audio deployment configured', 'warn'); return; }
    void runAudioJob({ prompt: text, text, voice, format, projectId });
    toast('Audio queued', 'info');
  };

  return (
    <div>
      <PanelHeader
        icon={<Music2 className="h-5 w-5" strokeWidth={1.5} />}
        title="Audio"
        subtitle="Synth voice / music / SFX via your Azure deployment."
      />
      <Field label="Text or prompt">
        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Read this in a calm editorial voice: …"
          className="input-base resize-none"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Voice">
          <select value={voice} onChange={(e) => setVoice(e.target.value)} className="input-base">
            {['alloy', 'verse', 'aria', 'sage', 'echo'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Format">
          <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="input-base">
            {['mp3', 'wav', 'opus'].map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
          </select>
        </Field>
      </div>
      <ExampleChips kind="audio" onPick={setText} />
      <div className="mt-5 flex justify-end">
        <button onClick={run} className="btn-ember" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
          Render
        </button>
      </div>
    </div>
  );
}

function StoryboardPanel({ projectId }: { projectId?: string }) {
  const toast = useUI((s) => s.toast);
  const [script, setScript] = useState('');
  const [styleSuffix, setStyleSuffix] = useState('cinematic, anamorphic 2.39:1, soft volumetric light, restrained palette');
  const [size, setSize] = useState<'1024x1024'>('1024x1024');
  const shots = script.split('\n').map((l) => l.trim()).filter(Boolean);

  const run = () => {
    if (!projectId) { toast('Open a project first', 'warn'); return; }
    if (!shots.length) { toast('Add at least one shot line', 'warn'); return; }
    void runStoryboardJob({ projectId, shots, styleSuffix: styleSuffix || undefined, size });
    toast(`${shots.length} shots queued`, 'info');
  };

  return (
    <div>
      <PanelHeader
        icon={<Clapperboard className="h-5 w-5" strokeWidth={1.5} />}
        title="Storyboard"
        subtitle="One shot per line. Style suffix applies to every shot for visual consistency."
      />
      <Field label="Script">
        <textarea
          rows={8}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Wide: a runner crests a dawn ridge…"
          className="input-base font-mono text-[12.5px] resize-none"
        />
      </Field>
      <Field label="Style suffix (consistency)">
        <input
          value={styleSuffix}
          onChange={(e) => setStyleSuffix(e.target.value)}
          className="input-base font-mono text-[12px]"
        />
      </Field>
      <Field label="Frame size (max 1024×1024)">
        <select value={size} onChange={(e) => setSize(e.target.value as '1024x1024')} className="input-base">
          <option value="1024x1024">Square 1024×1024</option>
        </select>
      </Field>
      <div className="text-[11px] text-muted-foreground mt-3">{shots.length} shot{shots.length === 1 ? '' : 's'} queued</div>
      <ExampleChips kind="storyboard" onPick={setScript} />
      <div className="mt-5 flex justify-end">
        <button onClick={run} className="btn-ember" disabled={!shots.length}>
          <Send className="h-4 w-4" />
          Render strip
        </button>
      </div>
    </div>
  );
}

function HyperframePanel({ projectId }: { projectId?: string }) {
  const toast = useUI((s) => s.toast);
  const project = useStudio((s) => s.project);
  const [duration, setDuration] = useState(3);
  const [fps, setFps] = useState(24);

  const lastAssistant = project?.conversation.findLast((m) => m.role === 'assistant')?.content || '';
  const artifactMatch = lastAssistant.match(/<artifact>([\s\S]*?)<\/artifact>/i);
  const artifact = artifactMatch ? artifactMatch[1].trim() : null;

  const run = () => {
    if (!projectId || !artifact) {
      toast('Open a project that has a rendered artifact first', 'warn');
      return;
    }
    const html = /^<!doctype/i.test(artifact)
      ? artifact
      : `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head><body>${artifact}</body></html>`;
    void runHyperframeJob({ projectId, html, durationSec: duration, fps });
    toast('HyperFrame queued · capture in background', 'info');
  };

  return (
    <div>
      <PanelHeader
        icon={<Layers3 className="h-5 w-5" strokeWidth={1.5} />}
        title="HyperFrame"
        subtitle="Capture the latest artifact as a sequence of PNG frames; encode to MP4 if ffmpeg is on PATH."
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration">
          <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10))} className="input-base">
            {[1, 2, 3, 4, 6, 8].map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
        </Field>
        <Field label="FPS">
          <select value={fps} onChange={(e) => setFps(parseInt(e.target.value, 10))} className="input-base">
            {[12, 24, 30, 60].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
      </div>
      {!artifact && <p className="mt-3 text-[12px] text-amber-600 dark:text-amber-300">Open a project with a rendered artifact first.</p>}
      <ExampleChips kind="hyperframe" onPick={() => { /* hyperframes don't take a prompt — chips are inspirational only */ }} />
      <div className="mt-5 flex justify-end">
        <button onClick={run} className="btn-ember" disabled={!artifact || !projectId}>
          <Send className="h-4 w-4" />
          Capture
        </button>
      </div>
    </div>
  );
}

function SegBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-7 px-2.5 rounded-md text-[12px] transition-colors',
        active ? 'bg-primary/10 ring-1 ring-primary/30 text-primary' : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {label}
    </button>
  );
}

/* ─── Gallery (right) ─────────────────────────────────────────────────── */

function Gallery({ kind, projectId }: { kind: RenderKind; projectId?: string }) {
  const jobs = useUI((s) => s.jobs);
  const [assets, setAssets] = useState<ProjectAssets | null>(null);
  const [open, setOpen]     = useState<AssetItem | null>(null);
  const reloadKey = useMemo(() =>
    jobs.filter((j) => j.status === 'ok').map((j) => j.id).join(','), [jobs]);

  useEffect(() => {
    if (!projectId) { setAssets(null); return; }
    let cancelled = false;
    const api = (window.renoir as unknown as { listProjectAssets: (req: { projectId: string }) => Promise<ProjectAssets> }).listProjectAssets;
    void api({ projectId }).then((a) => { if (!cancelled) setAssets(a); });
    return () => { cancelled = true; };
  }, [projectId, reloadKey]);

  const runningOfKind = jobs.filter((j) => j.status === 'running' && (
    (kind === 'image'      && (j.kind === 'image' || j.kind === 'image-edit')) ||
    (kind === 'video'      &&  j.kind === 'video') ||
    (kind === 'audio'      &&  j.kind === 'audio') ||
    (kind === 'storyboard' &&  j.kind === 'storyboard') ||
    (kind === 'hyperframe' &&  j.kind === 'hyperframe')
  ));

  return (
    <div className="px-8 py-6">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Gallery</div>
          <h2 className="font-display italic text-2xl mt-0.5">Past renders</h2>
        </div>
        {runningOfKind.length > 0 && (
          <div className="plate-soft rounded-md px-2.5 py-1 text-[11px] flex items-center gap-2 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            {runningOfKind.length} running
          </div>
        )}
      </div>

      {!projectId && <Empty hint="Open a project first — galleries are per-study." />}
      {projectId && !assets && <Empty hint="Loading…" />}
      {projectId && assets && <Body kind={kind} assets={assets} onOpen={setOpen} />}

      <AssetModal open={!!open} asset={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Body({
  kind, assets, onOpen,
}: { kind: RenderKind; assets: ProjectAssets; onOpen: (a: AssetItem) => void }) {
  if (kind === 'image') {
    const imgs = assets.images || [];
    if (!imgs.length) return <Empty hint="No images yet — render one on the left." icon={<ImageIcon className="h-5 w-5" strokeWidth={1.5} />} />;
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {imgs.map((img: ProjectAssetImage) => (
          <Tile key={img.savedPath}>
            <button
              onClick={() => onOpen({ ...img, kind: 'image' })}
              className="block w-full aspect-square overflow-hidden bg-canvas/50"
            >
              <img src={img.url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]" />
            </button>
            <Caption name={img.savedPath} createdAt={img.createdAt} sizeBytes={img.sizeBytes} />
          </Tile>
        ))}
      </div>
    );
  }
  if (kind === 'video') {
    const vids = assets.videos || [];
    if (!vids.length) return <Empty hint="No videos yet." icon={<Film className="h-5 w-5" strokeWidth={1.5} />} />;
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {vids.map((v: ProjectAssetMedia) => (
          <Tile key={v.savedPath}>
            <button onClick={() => onOpen({ ...v, kind: 'video' })} className="block w-full">
              <video preload="metadata" muted className="w-full bg-black aspect-video" src={v.url} />
            </button>
            <Caption name={v.savedPath} createdAt={v.createdAt} sizeBytes={v.sizeBytes} />
          </Tile>
        ))}
      </div>
    );
  }
  if (kind === 'audio') {
    const audio = assets.audio || [];
    if (!audio.length) return <Empty hint="No audio yet." icon={<Music2 className="h-5 w-5" strokeWidth={1.5} />} />;
    return (
      <div className="grid grid-cols-1 gap-2">
        {audio.map((a: ProjectAssetMedia) => (
          <Tile key={a.savedPath}>
            <div className="p-3 flex flex-col gap-2">
              <button onClick={() => onOpen({ ...a, kind: 'audio' })} className="text-left text-[12.5px] font-medium tracking-tight hover:text-primary transition-colors">
                {a.savedPath.split(/[\\/]/).pop()}
              </button>
              <audio controls className="w-full" src={a.url} />
              <Caption name={a.savedPath} createdAt={a.createdAt} sizeBytes={a.sizeBytes} hideName />
            </div>
          </Tile>
        ))}
      </div>
    );
  }
  if (kind === 'storyboard') {
    const sbs = assets.storyboards || [];
    if (!sbs.length) return <Empty hint="No storyboards yet." icon={<Clapperboard className="h-5 w-5" strokeWidth={1.5} />} />;
    return (
      <div className="flex flex-col gap-3">
        {sbs.map((sb: ProjectAssetStoryboard) => (
          <Tile key={sb.dir}>
            <div className="p-3">
              <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
                {sb.thumbnails.map((t: { url: string; savedPath: string; shot: number }) => (
                  <button
                    key={t.savedPath}
                    onClick={() => onOpen({ url: t.url, savedPath: t.savedPath, createdAt: sb.createdAt, sizeBytes: 0, kind: 'image' })}
                    className="shrink-0"
                  >
                    <img src={t.url} alt={`shot ${t.shot}`} className="h-24 rounded-md ring-1 ring-border" loading="lazy" />
                  </button>
                ))}
              </div>
              <Caption name={sb.zipPath || sb.dir} createdAt={sb.createdAt} />
            </div>
          </Tile>
        ))}
      </div>
    );
  }
  if (kind === 'hyperframe') {
    const hfs = assets.hyperframes || [];
    if (!hfs.length) return <Empty hint="No HyperFrames yet." icon={<Layers3 className="h-5 w-5" strokeWidth={1.5} />} />;
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
        {hfs.map((hf: ProjectAssetHyperframe) => (
          <Tile key={hf.dir}>
            <div className="p-2">
              {hf.videoUrl ? (
                <video controls preload="metadata" className="w-full bg-black rounded aspect-video" src={hf.videoUrl} />
              ) : hf.firstFrameUrl ? (
                <img src={hf.firstFrameUrl} alt="hyperframe" className="w-full rounded aspect-video object-cover" loading="lazy" />
              ) : (
                <div className="aspect-video grid place-items-center text-muted-foreground text-[11px]">no preview</div>
              )}
              <Caption name={hf.videoPath || hf.dir} createdAt={hf.createdAt} />
            </div>
          </Tile>
        ))}
      </div>
    );
  }
  return null;
}

function Tile({ children }: { children: React.ReactNode }) {
  return <div className="plate rounded-xl overflow-hidden group hover:ring-1 hover:ring-primary/40 transition-all">{children}</div>;
}

function Caption({
  name, createdAt, sizeBytes, hideName,
}: { name: string; createdAt: string; sizeBytes?: number; hideName?: boolean }) {
  return (
    <div className="px-3 py-2 text-[10.5px] text-muted-foreground/80 flex items-center gap-2">
      {!hideName && <span className="font-mono truncate" title={name}>{name.split(/[\\/]/).pop()}</span>}
      <span className="ml-auto whitespace-nowrap">
        {new Date(createdAt).toLocaleDateString()} · {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {typeof sizeBytes === 'number' && sizeBytes > 0 && ` · ${formatBytes(sizeBytes)}`}
      </span>
    </div>
  );
}

function Empty({ hint, icon }: { hint: string; icon?: React.ReactNode }) {
  return (
    <div className="plate rounded-2xl p-12 text-center text-muted-foreground grain relative overflow-hidden">
      <div className="ambient" />
      <div className="relative z-10">
        <div className="mx-auto h-10 w-10 grid place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/30 mb-3">
          {icon ?? <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.5} />}
        </div>
        <h3 className="font-display italic text-2xl text-foreground">Your gallery starts empty.</h3>
        <p className="text-[12.5px] mt-1 max-w-[340px] mx-auto leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
