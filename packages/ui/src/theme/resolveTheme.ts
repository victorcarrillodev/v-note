import { isPaletteId, variantOf, type PaletteId, type ThemeId } from "../design/themes";

/** Valor de la preferencia `theme`: «sistema», Claro, Oscuro o uno de los diez temas de color. */
export type ThemeMode = "system" | ThemeId;
export type ResolvedTheme = "light" | "dark";

/** Tema a mostrar según la preferencia y el tema del sistema. Una preferencia desconocida se trata como «sistema». */
export function resolveTheme(mode: string | null | undefined, systemDark: boolean): ResolvedTheme {
  if (mode === "light" || mode === "dark") return mode;
  if (isPaletteId(mode)) return variantOf(mode);
  return systemDark ? "dark" : "light"; // «system» o un valor desconocido
}

/** Tema de color a aplicar (`data-palette`); `null` en Claro, Oscuro, Sistema o un valor desconocido. */
export function resolvePalette(mode: string | null | undefined): PaletteId | null {
  return isPaletteId(mode) ? mode : null;
}

/** Valor guardado → modo válido; cualquier otro valor (también un id que ya no existe) se trata como «sistema». */
export function parseThemeMode(value: string | null | undefined): ThemeMode {
  return value === "light" || value === "dark" || isPaletteId(value) ? value : "system";
}
