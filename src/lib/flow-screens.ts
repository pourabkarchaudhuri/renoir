import { countDeckSlides } from '@/lib/preview-modes';

export interface FlowScreen {
  id: string;
  label: string;
  selector: string;
}

const DECK_SKILL_IDS = new Set([
  'pitch-deck', 'product-deck', 'all-hands-deck', 'simple-deck', 'guizang-ppt',
]);

function labelFromEl(attrs: string, inner: string): string {
  const labelM = attrs.match(/\bdata-screen-label=["']([^"']+)["']/i);
  if (labelM) return labelM[1].trim();
  const hM = inner.match(/<h[1-6][^>]*>([^<]{1,80})/i);
  if (hM) return hM[1].trim();
  const idM = attrs.match(/\bdata-screen-id=["']([^"']+)["']/i)
    ?? attrs.match(/\bdata-od-id=["']([^"']+)["']/i);
  return idM ? idM[1] : 'Screen';
}

/** Parse navigable screens from artifact HTML. */
export function parseFlowScreens(html: string, skillId?: string): FlowScreen[] {
  if (!html?.trim()) return [];

  const screens: FlowScreen[] = [];
  const seen = new Set<string>();

  const screenRe = /<([a-z][a-z0-9]*)[^>]*\bdata-screen-id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = screenRe.exec(html)) !== null) {
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    screens.push({
      id,
      label: labelFromEl(m[0].slice(0, m[0].indexOf('>') + 1), m[3]),
      selector: `[data-screen-id="${id}"]`,
    });
  }

  if (screens.length < 2) {
    const odRe = /<([a-z][a-z0-9]*)[^>]*\bdata-od-id=["']([^"']+)["'][^>]*>/gi;
    while ((m = odRe.exec(html)) !== null) {
      const id = m[2];
      if (seen.has(id)) continue;
      seen.add(id);
      const tag = m[0];
      screens.push({
        id,
        label: labelFromEl(tag, ''),
        selector: `[data-od-id="${id}"]`,
      });
    }
  }

  if (screens.length < 2 && skillId && DECK_SKILL_IDS.has(skillId)) {
    const count = countDeckSlides(html);
    for (let i = 0; i < count; i++) {
      const id = `slide-${i}`;
      screens.push({
        id,
        label: `Slide ${i + 1}`,
        selector: `slide:${i}`,
      });
    }
  }

  return screens;
}

export function artifactHasFlowLinks(html: string): boolean {
  return /\bdata-goto=["']/i.test(html) || /\bdata-screen-id=["']/i.test(html);
}
