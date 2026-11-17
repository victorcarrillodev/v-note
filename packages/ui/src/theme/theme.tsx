import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { resolveTheme, resolvePalette, parseThemeMode, type ThemeMode, type ResolvedTheme } from "./resolveTheme";
import { applyTheme } from "./applyTheme";
import type { PaletteId } from "../design/themes";
export type { ThemeMode, ResolvedTheme };

/** Preferencias de la persona usuaria (solo de interfaz: tema, idioma...). En web usa localStorage; en pruebas, memoria. */
export interface PreferenceStore {
  get(key: string): string | null;
  /** Devuelve `false` si no se pudo conservar (por ejemplo, almacenamiento bloqueado); `void`/`true` si se guardó. */
  set(key: string, value: string): boolean | void;
}

export class MemoryPreferences implements PreferenceStore {
  private data = new Map<string, string>();
  get(key: string) { return this.data.get(key) ?? null; }
  set(key: string, value: string) { this.data.set(key, value); return true; }
}

/** localStorage puede faltar o lanzar (modo privado): en ese caso las preferencias no persisten, pero la app funciona. */
export class LocalStoragePreferences implements PreferenceStore {
  get(key: string) { try { return localStorage.getItem(`vnote:${key}`); } catch { return null; } }
  set(key: string, value: string) { try { localStorage.setItem(`vnote:${key}`, value); return true; } catch { return false; /* sin persistencia */ } }
}

const systemPrefersDark = () => (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) || false;

/** `resolved` = variante (`data-theme`); `palette` = tema de color (`data-palette`) o `null`; `themeKey` cambia con CUALQUIER cambio de tema (también entre temas de la misma variante), para quien guarda colores leídos. `setMode` devuelve `false` si no se pudo conservar. */
type Ctx = { mode: ThemeMode; resolved: ResolvedTheme; palette: PaletteId | null; themeKey: string; setMode: (m: ThemeMode) => boolean };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ preferences, children }: { preferences: PreferenceStore; children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => parseThemeMode(preferences.get("theme")));
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Solo en modo «sistema» se escucha el cambio del sistema (CL-5).
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mql.matches);
    const onChange = (e: { matches: boolean }) => setSystemDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  const resolved: ResolvedTheme = resolveTheme(mode, systemDark);
  const palette = resolvePalette(mode);
  useEffect(() => {
    applyTheme(document.documentElement, mode, systemDark);
  }, [mode, systemDark]);

  const setMode = useCallback((m: ThemeMode): boolean => {
    const saved = preferences.set("theme", m) !== false;
    setModeState(m);
    return saved;
  }, [preferences]);

  const themeKey = `${mode}:${resolved}`;
  const value = useMemo(() => ({ mode, resolved, palette, themeKey, setMode }), [mode, resolved, palette, themeKey, setMode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  return c;
}

/** Como `useTheme`, pero devuelve `null` fuera de un `ThemeProvider` (para piezas que solo ofrecen algo extra cuando hay tema). */
export function useOptionalTheme(): Ctx | null {
  return useContext(ThemeCtx);
}
