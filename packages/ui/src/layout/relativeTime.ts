/** Descompone una antigüedad en milisegundos en una unidad y una cantidad (el texto lo pone la interfaz, con i18n). */
export function relativeParts(ms: number): { key: "now" | "minutes" | "hours" | "days"; count: number } {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return { key: "now", count: 0 };
  if (min < 60) return { key: "minutes", count: min };
  const h = Math.floor(min / 60);
  if (h < 24) return { key: "hours", count: h };
  return { key: "days", count: Math.floor(h / 24) };
}
