export type Platform = "mac" | "other";

const MAC: Record<string, string> = { Mod: "⌘", Alt: "⌥", Shift: "⇧", Space: "Espacio" };
const OTHER: Record<string, string> = { Mod: "Ctrl", Alt: "Alt", Shift: "Mayús", Space: "Espacio" };

/** Muestra un atajo según la plataforma: ⌘⌥⇧ en macOS, Ctrl+Alt+Mayús en el resto. */
export function formatCombo(combo: string | null, platform: Platform): string {
  if (!combo) return "";
  const parts = combo.split("+");
  return platform === "mac" ? parts.map((p) => MAC[p] ?? p).join("") : parts.map((p) => OTHER[p] ?? p).join("+");
}

const ARIA: Record<string, (p: Platform) => string> = { Mod: (p) => (p === "mac" ? "Meta" : "Control"), Alt: () => "Alt", Shift: () => "Shift" };

/** Valor válido de `aria-keyshortcuts` (nombres de modificadores de ARIA) para un atajo. */
export function toAriaShortcut(combo: string | null, platform: Platform): string {
  if (!combo) return "";
  return combo.split("+").map((p) => ARIA[p]?.(platform) ?? p).join("+");
}
