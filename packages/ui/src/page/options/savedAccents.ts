import { MAX_SAVED_ACCENTS, parseCustomAccent, type CustomAccent } from "@vnote/core";

/** Colores de acento propios: preferencia de este dispositivo (no es contenido, así que no entra al respaldo). */
export const SAVED_ACCENTS_KEY = "vnote.page.savedAccents";

const defaultStorage = (): Storage | undefined => { try { return typeof localStorage === "undefined" ? undefined : localStorage; } catch { return undefined; } };

export function loadSavedAccents(storage: Storage | undefined = defaultStorage()): CustomAccent[] {
  try {
    const list: unknown = JSON.parse(storage?.getItem(SAVED_ACCENTS_KEY) ?? "[]");
    if (!Array.isArray(list)) return [];
    const out: CustomAccent[] = [];
    for (const c of list) { const v = parseCustomAccent(c); if (v && !out.includes(v)) out.push(v); }
    return out.slice(0, MAX_SAVED_ACCENTS);
  } catch { return []; }
}

function write(list: CustomAccent[], storage: Storage | undefined) {
  try { storage?.setItem(SAVED_ACCENTS_KEY, JSON.stringify(list)); } catch { /* sin almacenamiento: la lista vive solo mientras dura la sesión */ }
}

/** Guarda un color propio al final (sin repetir) y devuelve la lista nueva. */
export function addSavedAccent(value: string, storage: Storage | undefined = defaultStorage()): CustomAccent[] {
  const v = parseCustomAccent(value);
  const cur = loadSavedAccents(storage);
  if (!v || cur.includes(v)) return cur;
  const next = [...cur, v].slice(-MAX_SAVED_ACCENTS);
  write(next, storage);
  return next;
}

export function removeSavedAccent(value: string, storage: Storage | undefined = defaultStorage()): CustomAccent[] {
  const next = loadSavedAccents(storage).filter((c) => c !== value);
  write(next, storage);
  return next;
}
