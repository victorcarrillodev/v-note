// Preferencias de cuadrícula del dispositivo (spec 004, RF-18; plan DP-9): mostrar y acomodar, compartidas por diagrama y mapa.
import { useCallback, useSyncExternalStore } from "react";

export type GridPrefs = { show: boolean; snap: boolean };
export const GRID_PREFS_KEY = "vnote.canvas.grid";
const DEFAULTS: GridPrefs = { show: true, snap: true };

/** Lee las preferencias; lo ausente, dañado o inaccesible cae a los valores iniciales campo por campo (nunca lanza). */
export function loadGridPrefs(): GridPrefs {
  try {
    const raw = localStorage.getItem(GRID_PREFS_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<Record<keyof GridPrefs, unknown>>) : {};
    return { show: typeof v.show === "boolean" ? v.show : DEFAULTS.show, snap: typeof v.snap === "boolean" ? v.snap : DEFAULTS.snap };
  } catch { return { ...DEFAULTS }; }
}

const listeners = new Set<() => void>();
let cache: GridPrefs | null = null;
const read = (): GridPrefs => {
  const fresh = loadGridPrefs();
  if (!cache || cache.show !== fresh.show || cache.snap !== fresh.snap) cache = fresh;
  return cache;
};

export function saveGridPrefs(p: GridPrefs): void {
  cache = { ...p };
  try { localStorage.setItem(GRID_PREFS_KEY, JSON.stringify(p)); } catch { /* sin almacenamiento: la preferencia vale solo en esta sesión */ }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

/** Preferencias de cuadrícula y su modificador; todos los componentes que lo usan se actualizan a la vez. */
export function useGridPrefs(): readonly [GridPrefs, (patch: Partial<GridPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, read, read);
  const set = useCallback((patch: Partial<GridPrefs>) => saveGridPrefs({ ...read(), ...patch }), []);
  return [prefs, set] as const;
}
