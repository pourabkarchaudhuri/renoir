import type { DesignSystemSummary, VisualDirection } from '@/types/global';
import { buildThemeCss, injectThemeStyle, type ThemeStyleOptions } from '@/lib/theme-tokens';

export function themeOptionsFromStudio(
  designSystem?: DesignSystemSummary,
  direction?: VisualDirection,
): ThemeStyleOptions | undefined {
  if (!designSystem?.tokens?.length) return undefined;
  return {
    tokens: designSystem.tokens,
    font: designSystem.font,
    directionSwatches: direction?.swatches,
  };
}

/** Inject active design-system + direction tokens into artifact HTML. */
export function applyArtifactTheme(
  html: string,
  designSystem?: DesignSystemSummary,
  direction?: VisualDirection,
): string {
  const theme = themeOptionsFromStudio(designSystem, direction);
  if (!theme) return html;
  return injectThemeStyle(html, buildThemeCss(theme));
}
