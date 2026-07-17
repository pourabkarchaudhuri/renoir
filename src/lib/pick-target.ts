export interface PickTargetDetail {
  odId: string;
  tag?: string;
  textPreview?: string;
  /** Optional outer HTML for the picked region — strengthens revision prompts. */
  snippet?: string;
}

/** Build chat draft for a scoped region edit. */
export function pickEditDraft(detail: PickTargetDetail): string {
  const id = detail.odId?.trim();
  if (!id) return '';
  const hint = detail.textPreview ? ` (currently: "${detail.textPreview.slice(0, 80)}")` : '';
  const snippet = detail.snippet?.trim();
  if (snippet) {
    const clipped = snippet.length > 400 ? `${snippet.slice(0, 400)}…` : snippet;
    return `Edit the section [data-od-id="${id}"]${hint}. Current markup:\n\`\`\`html\n${clipped}\n\`\`\`\n\nChange: `;
  }
  return `Edit the section [data-od-id="${id}"]${hint}: `;
}

/** Extract outer HTML for a data-od-id region from raw artifact HTML. */
export function extractOdIdSnippet(html: string, odId: string): string | null {
  if (!html || !odId) return null;
  const escaped = odId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<([a-z][a-z0-9]*)[^>]*\\bdata-od-id=["']${escaped}["'][^>]*>[\\s\\S]*?<\\/\\1>`,
    'i',
  );
  const m = html.match(re);
  if (m) return m[0].slice(0, 2000);
  const selfClose = new RegExp(`<[^>]+\\bdata-od-id=["']${escaped}["'][^>]*\\/?>`, 'i');
  const m2 = html.match(selfClose);
  return m2 ? m2[0] : null;
}

/** Build a pick draft, optionally enriching with a snippet from the current artifact HTML. */
export function pickEditDraftFromHtml(
  detail: PickTargetDetail,
  artifactHtml?: string | null,
): string {
  const snippet = detail.snippet
    ?? (artifactHtml && detail.odId ? extractOdIdSnippet(artifactHtml, detail.odId) ?? undefined : undefined);
  return pickEditDraft({ ...detail, snippet });
}
