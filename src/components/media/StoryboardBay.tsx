import { useState } from 'react';
import { Loader2, Film } from 'lucide-react';
import { useStudio, useUI } from '@/lib/store';
import { runStoryboardJob } from '@/lib/jobs';
import { RenderGallery } from './RenderGallery';

interface Frame {
  shot: number;
  prompt: string;
  dataUrl: string;
  savedPath: string;
}

export function StoryboardBay() {
  const project = useStudio((s) => s.project);
  const toast = useUI((s) => s.toast);
  const jobs = useUI((s) => s.jobs);
  const [script, setScript] = useState('');
  const [styleSuffix, setStyleSuffix] = useState('cinematic, anamorphic 2.39:1, soft volumetric light, restrained palette');
  const [size, setSize] = useState<'1024x1024'>('1024x1024');

  const shots = script.split('\n').map((l) => l.trim()).filter(Boolean);

  const sbJobs   = jobs.filter((j) => j.kind === 'storyboard');
  const running  = sbJobs.filter((j) => j.status === 'running');
  const lastDone = [...sbJobs].reverse().find((j) => j.status === 'ok');
  const busy = running.length > 0;
  const frames: Frame[] = (lastDone?.dataUrls || []).map((dataUrl, i) => ({
    shot: i + 1,
    prompt: '',
    dataUrl,
    savedPath: (lastDone?.savedPaths || [])[i] || '',
  }));
  const zipPath = lastDone?.savedPath || null;

  const run = async () => {
    if (!project) { toast('Open a project first', 'warn'); return; }
    if (!shots.length) { toast('Add at least one shot line', 'warn'); return; }
    void runStoryboardJob({ projectId: project.id, shots, styleSuffix: styleSuffix || undefined, size });
    toast(`${shots.length} shots queued — runs in background`, 'info');
  };

  if (!project) {
    return (
      <div className="plate rounded-2xl p-10 text-center">
        <h3 className="font-display italic text-3xl">Open a project first.</h3>
        <p className="text-[12.5px] text-muted-foreground mt-2 max-w-[420px] mx-auto">
          Storyboards are saved into the project workspace alongside their shotlist.
        </p>
      </div>
    );
  }

  return (
    <div className="plate rounded-2xl p-6">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 col-span-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Script — one shot per line
          </span>
          <textarea
            rows={8}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={`Wide: a lone runner crests a dawn ridge, fog burning off\nMedium: hand laces a worn shoe, close on the bow\nClose: panting breath misting the cold air\nTracking: feet hitting frosted gravel\nWide: silhouette against rising sun, holding still`}
            className="input-base font-mono text-[12.5px] resize-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 col-span-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Style suffix — appended to every shot for visual consistency
          </span>
          <input
            value={styleSuffix}
            onChange={(e) => setStyleSuffix(e.target.value)}
            className="input-base font-mono text-[12.5px]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Frame size (max 1024×1024)</span>
          <select className="input-base" value={size} onChange={(e) => setSize(e.target.value as '1024x1024')}>
            <option value="1024x1024">1024×1024 (square)</option>
          </select>
        </label>
        <div className="flex items-end">
          <span className="pill">{shots.length} shots queued</span>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button className="btn-ember" disabled={busy || shots.length === 0} onClick={run}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          Render storyboard
        </button>
      </div>

      {frames.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2 flex items-center justify-between">
            <span>Strip · {frames.length} frames</span>
            {zipPath && <span className="text-emerald-700 dark:text-emerald-300 normal-case tracking-normal text-[11px]">Zip → <span className="font-mono">{zipPath}</span></span>}
          </div>
          <div className="overflow-x-auto scroll-thin pb-2">
            <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
              {frames.map((f) => (
                <div key={f.shot} className="plate rounded-lg p-2 shrink-0">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 px-1 py-0.5 flex items-center justify-between">
                    <span>Shot {String(f.shot).padStart(2, '0')}</span>
                  </div>
                  <img
                    src={f.dataUrl}
                    alt={`shot ${f.shot}`}
                    className="rounded-md ring-1 ring-border"
                    style={{ width: 280, height: 180, objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <RenderGallery kind="storyboard" empty="No saved storyboards yet." />
    </div>
  );
}
