import { effectiveBindings, defaultBindings, type Bindings } from "@vnote/core";
import type { PreferenceStore } from "../theme/theme";

const KEY = "shortcuts";
/** Evento de ventana que avisa de que cambiaron los atajos (para volver a registrar el atajo global). */
export const BINDINGS_CHANGED = "vnote:bindings-changed";

/** Atajos efectivos: los de fábrica sobrescritos por los guardados. Un JSON dañado se ignora. */
export function loadBindings(prefs: PreferenceStore): Bindings {
  try {
    const raw = prefs.get(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return effectiveBindings(parsed && typeof parsed === "object" ? (parsed as Record<string, string | null>) : {});
  } catch {
    return defaultBindings();
  }
}

export function saveBindings(prefs: PreferenceStore, b: Bindings): void {
  prefs.set(KEY, JSON.stringify(b));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BINDINGS_CHANGED));
}

/** Texto para mostrar: `Mod` se muestra como Ctrl (en macOS la interfaz podrá mostrar ⌘). */
export const displayCombo = (combo: string | null, none: string) => (combo === null ? none : combo.replace("Mod", "Ctrl"));
