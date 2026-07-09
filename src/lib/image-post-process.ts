import { extractPlaceholders } from '@/lib/image-placeholders';
import {
  shouldRunImagePipeline,
  shouldPromptForImagePermission,
} from '@/lib/image-request';
import { enrichProductDeckHtml } from '@/lib/product-deck-content';

export interface ArtifactImageContext {
  html: string;
  projectId: string;
  skillId: string;
  conversation: { role: string; content: string }[];
  productName?: string;
}

export interface ImagePostProcessPlan {
  autoRun: boolean;
  shouldPrompt: boolean;
  prepared: string;
  slotCount: number;
  projectId: string;
  skillId: string;
}

type ArtifactImageListener = (ctx: ArtifactImageContext) => void;

let listener: ArtifactImageListener | null = null;

export function setArtifactImageListener(fn: ArtifactImageListener | null): void {
  listener = fn;
}

export function notifyArtifactImageReady(ctx: ArtifactImageContext): void {
  listener?.(ctx);
}

export function planImagePostProcess(ctx: ArtifactImageContext): ImagePostProcessPlan {
  let prepared = ctx.html;
  if (ctx.skillId === 'product-deck') {
    prepared = enrichProductDeckHtml(ctx.html, {
      productName: ctx.productName,
      finalize: true,
    }).html;
  }
  const slotCount = extractPlaceholders(prepared).length;
  return {
    autoRun: shouldRunImagePipeline(ctx.conversation),
    shouldPrompt: shouldPromptForImagePermission(ctx.conversation, ctx.skillId),
    prepared,
    slotCount,
    projectId: ctx.projectId,
    skillId: ctx.skillId,
  };
}
