import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Preferencias de la persona usuaria (solo de interfaz: tema, idioma...). En web usa localStorage; en pruebas, memoria. */
export interface PreferenceStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export class MemoryPreferences implements PreferenceStore {
  private data = new Map<string, string>();
  get(key: string) { return this.data.get(key) ?? null; }
  set(key: string, value: string) { this.data.set(key, value); }
}

/** localStorage puede faltar o lanzar (modo privado): en ese caso las preferencias no persisten, pero la app funciona. */
export class LocalStoragePreferences implements PreferenceStore {
  get(key: string) { try { return localStorage.getItem(`vnote:${key}`); } catch { return null; } }
  set(key: string, value: string) { try { localStorage.setItem(`vnote:${key}`, value); } catch { /* sin persistencia */ } }
}

const isMode = (v: string | null): v is ThemeMode => v === "light" || v === "dark" || v === "system";
const systemPrefersDark = () => (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) || false;

type Ctx = { mode: ThemeMode; resolved: ResolvedTheme; setMode: (m: ThemeMode) => void };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ preferences, children }: { preferences: PreferenceStore; children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = preferences.get("theme");
    return isMode(saved) ? saved : "system";
  });
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mql.matches);
    const onChange = (e: { matches: boolean }) => setSystemDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  const resolved: ResolvedTheme = mode === "system" ? (systemDark ? "dark" : "light") : mode;
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    preferences.set("theme", m);
    setModeState(m);
  }, [preferences]);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  return c;
}
