import { useEffect, type ReactNode } from "react";
import { applyAppearance, loadAppearance, useStorageSync } from "./appearance";
import { resolveTheme, type ThemeMode } from "../theme/resolveTheme";
import type { PreferenceStore } from "../theme/theme";

/** Para ventanas secundarias (captura, recordatorio): aplican tema, tipografía y densidad del dispositivo y siguen sus cambios. */
export function SyncedAppearance({ preferences, children }: { preferences: PreferenceStore; children: ReactNode }) {
  useStorageSync(preferences);
  useEffect(() => {
    const dark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", resolveTheme((preferences.get("theme") as ThemeMode | null) ?? "system", dark));
    applyAppearance(document.documentElement, loadAppearance(preferences));
  }, [preferences]);
  return <>{children}</>;
}
