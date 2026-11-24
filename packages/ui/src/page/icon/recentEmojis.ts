// Emojis usados hace poco (solo en este equipo; no forman parte de los datos del espacio).
const KEY = "vnote.recentEmojis";
const MAX = 16;

export function loadRecentEmojis(): string[] {
  try {
    const v: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch { return []; }
}

export function rememberEmoji(char: string): void {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify([char, ...loadRecentEmojis().filter((e) => e !== char)].slice(0, MAX))); } catch { /* sin almacenamiento: no pasa nada */ }
}
