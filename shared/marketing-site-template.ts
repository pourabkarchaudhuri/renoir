/** Fill the canonical marketing-site HTML shell with brief copy. */

export interface MarketingSiteBrief {
  productName?: string;
  tagline?: string;
}

export function fillMarketingSiteTemplate(template: string, brief: MarketingSiteBrief = {}): string {
  const name = brief.productName?.trim() || 'Acme';
  let out = template.replace(/Filebase/g, name);
  const tagline = brief.tagline?.trim();
  if (tagline) {
    out = out.replace(
      /File sync that doesn't eat your bandwidth\./,
      tagline,
    );
  }
  return out;
}

/** Pull a product name from freeform user text. */
export function inferProductNameFromText(text: string): string {
  const t = text.trim();
  if (!t) return 'Acme';
  const beforeDash = t.split(/\s[—–-]\s/)[0]?.trim();
  if (beforeDash && beforeDash.length <= 48) return beforeDash;
  const firstLine = t.split(/\n/)[0]?.trim() ?? t;
  return firstLine.slice(0, 48).trim() || 'Acme';
}

export function inferTaglineFromText(text: string): string | undefined {
  const t = text.trim();
  const dashMatch = t.match(/\s[—–-]\s+(.+)/);
  if (dashMatch?.[1]) return dashMatch[1].trim().slice(0, 120);
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) return lines[1].slice(0, 120);
  return undefined;
}
