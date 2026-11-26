/** Fecha local de hoy como `AAAA-MM-DD`. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `AAAA-MM-DD` en el idioma de la interfaz («26 nov»). */
export const shortDay = (day: string, language: string): string =>
  new Intl.DateTimeFormat(language, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
