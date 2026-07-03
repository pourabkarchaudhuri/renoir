export interface ThemeToken {
  name: string;
  value: string;
}

export interface ThemeStyleOptions {
  tokens: ThemeToken[];
  font?: string;
  directionSwatches?: string[];
}

const STYLE_ID = 'renoir-theme';

function quoteFont(name: string): string {
  return name.includes(' ') ? `'${name}'` : name;
}

function parseFontPair(font?: string): { display?: string; body?: string } {
  if (!font?.trim()) return {};
  const [display, body] = font.split('/').map((s) => s.trim());
  return { display: display || undefined, body: body || display };
}

/** Build :root CSS custom properties from design-system tokens. */
export function buildThemeCss(opts: ThemeStyleOptions): string {
  const lines = opts.tokens.map((t) => `  --${t.name}: ${t.value};`);

  const { display, body } = parseFontPair(opts.font);
  if (display) lines.push(`  --font-display: ${quoteFont(display)};`);
  if (body) lines.push(`  --font-body: ${quoteFont(body)};`);

  opts.directionSwatches?.forEach((swatch, i) => {
    lines.push(`  --swatch-${i + 1}: ${swatch};`);
  });

  let css = `:root {\n${lines.join('\n')}\n}\n`;

  const bodyFont = body || display;
  if (bodyFont) {
    css += `body { font-family: var(--font-body, ${quoteFont(bodyFont)}), system-ui, sans-serif; }\n`;
  }

  return css;
}

/** Inject or replace the Renoir theme style block in artifact HTML. */
export function injectThemeStyle(html: string, css: string): string {
  const trimmed = css.trim();
  if (!trimmed) return html;

  const tag = `<style id="${STYLE_ID}">\n${trimmed}\n</style>`;
  const existing = new RegExp(
    `<style[^>]*\\bid=["']${STYLE_ID}["'][^>]*>[\\s\\S]*?<\\/style>`,
    'i',
  );

  if (existing.test(html)) return html.replace(existing, tag);
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${tag}`);
  }
  return `${tag}\n${html}`;
}
