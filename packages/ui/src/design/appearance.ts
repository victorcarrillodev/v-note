import { useEffect } from "react";
import type { PreferenceStore } from "../theme/theme";
import { applyTheme } from "../theme/applyTheme";

export type FontChoice = "sans" | "serif" | "mono";
export type DensityChoice = "comfortable" | "compact";
export type Appearance = { font: FontChoice; density: DensityChoice };

const FONTS: readonly string[] = ["sans", "serif", "mono"];
const DENSITIES: readonly string[] = ["comfortable", "compact"];

/** Ajustes de apariencia del DISPOSITIVO (no viajan en el respaldo). Valores inválidos se ignoran. */
export function loadAppearance(p: PreferenceStore): Appearance {
  const f = p.get("font"), d = p.get("density");
  return { font: FONTS.includes(f ?? "") ? (f as FontChoice) : "sans", density: DENSITIES.includes(d ?? "") ? (d as DensityChoice) : "comfortable" };
}

/** Guarda ambos ajustes; devuelve `false` si alguno no se pudo conservar. */
export function saveAppearance(p: PreferenceStore, a: Appearance): boolean {
  const r1 = p.set("font", a.font), r2 = p.set("density", a.density);
  return r1 !== false && r2 !== false;
}

export function applyAppearance(root: HTMLElement, a: Appearance): void {
  root.setAttribute("data-font", a.font);
  root.setAttribute("data-density", a.density);
}

/**
 * Aplica los cambios hechos desde OTRA ventana (evento `storage`): tema, tipografía y densidad, sin recargar.
 * Sirve también a las ventanas secundarias (captura, recordatorio), que comparten el almacenamiento del dispositivo.
 */
export function useStorageSync(p: PreferenceStore): void {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith("vnote:")) return;
      const root = document.documentElement;
      const systemDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(root, p.get("theme"), systemDark);
      applyAppearance(root, loadAppearance(p));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [p]);
}
