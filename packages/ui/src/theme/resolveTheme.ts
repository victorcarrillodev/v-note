export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Tema a mostrar según la preferencia y el tema del sistema. Una preferencia desconocida se trata como «sistema». */
export function resolveTheme(mode: ThemeMode | null | undefined, systemDark: boolean): ResolvedTheme {
  if (mode === "light" || mode === "dark") return mode;
  return systemDark ? "dark" : "light";
}
