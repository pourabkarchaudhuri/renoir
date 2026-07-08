export interface PickTargetDetail {
  odId: string;
  tag?: string;
  textPreview?: string;
}

/** Build chat draft for a scoped region edit. */
export function pickEditDraft(detail: PickTargetDetail): string {
  const id = detail.odId?.trim();
  if (!id) return '';
  const hint = detail.textPreview ? ` (currently: "${detail.textPreview.slice(0, 80)}")` : '';
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
