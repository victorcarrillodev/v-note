import { isColor } from "@vnote/core";

/** Últimos colores personalizados: preferencia de este dispositivo (no es contenido, así que no entra al respaldo). */
export const RECENT_KEY = "vnote.diagram.recentColors";
export const MAX_RECENT = 8;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const defaultStorage = (): Storage | undefined => { try { return typeof localStorage === "undefined" ? undefined : localStorage; } catch { return undefined; } };

export function loadRecentColors(storage: Storage | undefined = defaultStorage()): string[] {
  try {
    const raw = storage?.getItem(RECENT_KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: string[] = [];
    for (const c of list) if (typeof c === "string" && HEX.test(c) && !out.includes(c.toLowerCase())) out.push(c.toLowerCase());
    return out.slice(0, MAX_RECENT);
  } catch { return []; }
}

/** Añade un color personalizado al principio (sin repetir) y devuelve la lista nueva. Los ids de paleta y «none» no se guardan. */
export function pushRecentColor(color: string, storage: Storage | undefined = defaultStorage()): string[] {
  const current = loadRecentColors(storage);
  if (!isColor(color) || !HEX.test(color)) return current;
  const next = [color.toLowerCase(), ...current.filter((c) => c !== color.toLowerCase())].slice(0, MAX_RECENT);
  try { storage?.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* sin almacenamiento: la lista vive solo mientras dura la sesión */ }
  return next;
}
