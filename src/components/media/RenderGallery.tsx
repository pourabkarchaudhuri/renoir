import { useEffect, useState, useCallback } from 'react';
import { useStudio, useUI } from '@/lib/store';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Film, Music2, Layers3, Clapperboard, FolderOpen } from 'lucide-react';

interface AssetCommon { url: string; savedPath: string; createdAt: string; sizeBytes: number }
interface AssetStoryboard { dir: string; zipPath?: string; thumbnails: { url: string; savedPath: string; shot: number }[]; createdAt: string }
interface AssetHyperframe { dir: string; videoPath?: string; videoUrl?: string; firstFramePath?: string; firstFrameUrl?: string; createdAt: string }
interface ProjectAssets {
  images:      AssetCommon[];
  videos:      AssetCommon[];
  audio:       AssetCommon[];
  storyboards: AssetStoryboard[];
  hyperframes: AssetHyperframe[];
}

interface Props {
  kind: 'image' | 'video' | 'audio' | 'storyboard' | 'hyperframe';
  empty?: string;
  limit?: number;
}

export function RenderGallery({ kind, empty, limit }: Props) {
  const project = useStudio((s) => s.project);
  const jobs    = useUI((s) => s.jobs);
  const toast   = useUI((s) => s.toast);
  const [assets, setAssets] = useState<ProjectAssets | null>(null);

  const reload = useCallback(async () => {
    if (!project?.id) { setAssets(null); return; }
    // The preload exposes this as listProjectAssets. We cast through to avoid
    // a hard dep on the global type (which lives in src/types/global.d.ts).
    const api = (window.renoir as unknown as { listProjectAssets: (req: { projectId: string }) => Promise<ProjectAssets> }).listProjectAssets;
    const a = await api({ projectId: project.id });
    setAssets(a);
  }, [project?.id]);

  useEffect(() => { void reload(); }, [reload]);

  // Refresh whenever a relevant job finishes.
  const completedKinds = jobs.filter((j) => j.status === 'ok').map((j) => j.kind).join(',');
  useEffect(() => { void reload(); }, [completedKinds, reload]);

  if (!project) return null;
  if (!assets) {
    return (
      <div className="text-[11px] text-muted-foreground/70 italic px-1 py-3">Loading past renders…</div>
    );
  }

  const emptyText = empty || 'Past renders will land here.';

  if (kind === 'image') {
    const items = (assets.images || []).slice(0, limit ?? 30);
    if (!items.length) return <EmptyHint icon={<ImageIcon className="h-4 w-4" strokeWidth={1.5} />} text={emptyText} />;
    return (
      <Section title="Past images" count={items.length}>
        <div className="grid grid-cols-6 gap-2">
          {items.map((img: AssetCommon, i: number) => (
            <Tile key={img.savedPath} delay={i}>
              <a href={img.url} target="_blank" rel="noreferrer" className="block aspect-square">
                <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </a>
            </Tile>
          ))}
        </div>
      </Section>
    );
  }

  if (kind === 'video') {
    const items = (assets.videos || []).slice(0, limit ?? 12);
    if (!items.length) return <EmptyHint icon={<Film className="h-4 w-4" strokeWidth={1.5} />} text={emptyText} />;
    return (
      <Section title="Past videos" count={items.length}>
        <div className="grid grid-cols-2 gap-3">
          {items.map((v: AssetCommon) => (
            <div key={v.savedPath} className="plate rounded-lg overflow-hidden">
              <video controls preload="metadata" className="w-full bg-black" src={v.url} />
              <Footer savedPath={v.savedPath} createdAt={v.createdAt} sizeBytes={v.sizeBytes} onReveal={() => { window.renoir.openWorkspace(); toast('Workspace folder opened', 'info'); }} />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (kind === 'audio') {
    const items = (assets.audio || []).slice(0, limit ?? 12);
    if (!items.length) return <EmptyHint icon={<Music2 className="h-4 w-4" strokeWidth={1.5} />} text={emptyText} />;
    return (
      <Section title="Past audio" count={items.length}>
        <div className="grid grid-cols-1 gap-2">
          {items.map((a: AssetCommon) => (
            <div key={a.savedPath} className="plate rounded-lg p-3 flex flex-col gap-2">
              <audio controls className="w-full" src={a.url} />
              <Footer savedPath={a.savedPath} createdAt={a.createdAt} sizeBytes={a.sizeBytes} onReveal={() => { window.renoir.openWorkspace(); toast('Workspace folder opened', 'info'); }} />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (kind === 'storyboard') {
    const items = (assets.storyboards || []).slice(0, limit ?? 8);
    if (!items.length) return <EmptyHint icon={<Clapperboard className="h-4 w-4" strokeWidth={1.5} />} text={emptyText} />;
    return (
      <Section title="Past storyboards" count={items.length}>
        <div className="flex flex-col gap-3">
          {items.map((sb: AssetStoryboard, i: number) => (
            <Tile key={sb.dir} delay={i}>
              <div className="p-3">
                <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
                  {sb.thumbnails.map((t: { url: string; savedPath: string; shot: number }) => (
                    <img
                      key={t.savedPath}
                      src={t.url}
                      alt={`shot ${t.shot}`}
                      className="h-20 rounded-md ring-1 ring-border shrink-0"
                      loading="lazy"
                    />
                  ))}
                </div>
                <Footer savedPath={sb.zipPath || sb.dir} createdAt={sb.createdAt} onReveal={() => { window.renoir.openWorkspace(); }} />
              </div>
            </Tile>
          ))}
        </div>
      </Section>
    );
  }

  if (kind === 'hyperframe') {
    const items = (assets.hyperframes || []).slice(0, limit ?? 8);
    if (!items.length) return <EmptyHint icon={<Layers3 className="h-4 w-4" strokeWidth={1.5} />} text={emptyText} />;
    return (
      <Section title="Past HyperFrames" count={items.length}>
        <div className="grid grid-cols-2 gap-3">
          {items.map((hf: AssetHyperframe) => (
            <Tile key={hf.dir}>
              <div className="p-2">
                {hf.videoUrl ? (
                  <video controls preload="metadata" className="w-full bg-black rounded" src={hf.videoUrl} />
                ) : hf.firstFrameUrl ? (
                  <img src={hf.firstFrameUrl} alt="hyperframe" className="w-full rounded" />
                ) : (
                  <div className="aspect-video grid place-items-center text-muted-foreground text-[11px]">no preview</div>
                )}
                <Footer savedPath={hf.videoPath || hf.dir} createdAt={hf.createdAt} onReveal={() => { window.renoir.openWorkspace(); }} />
              </div>
            </Tile>
          ))}
        </div>
      </Section>
    );
  }

  return null;
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
        <span>{title}</span>
        <span className="font-mono">({count})</span>
      </div>
      {children}
    </div>
  );
}

function Tile({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(0.04 * delay, 0.3) }}
      className="plate rounded-lg overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="mt-5 plate-soft rounded-lg p-4 flex items-center gap-3 text-[12px] text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {text}
    </div>
  );
}

function Footer({
  savedPath, createdAt, sizeBytes, onReveal,
}: { savedPath: string; createdAt: string; sizeBytes?: number; onReveal: () => void }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground/80">
      <span className="font-mono truncate" title={savedPath}>{savedPath.split(/[\\/]/).pop()}</span>
      <span className="flex items-center gap-2">
        <span>{new Date(createdAt).toLocaleString()}</span>
        {typeof sizeBytes === 'number' && <span>{formatBytes(sizeBytes)}</span>}
        <button onClick={onReveal} className="btn-ghost text-[10.5px] py-0 h-6">
          <FolderOpen className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
