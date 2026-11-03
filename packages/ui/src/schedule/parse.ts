const pad = (n: number) => String(n).padStart(2, "0");

/** Interpreta una hora escrita a mano («9:30», «930», «9 pm», «14.45») y la devuelve como HH:mm, o null si no existe. */
export function parseTime(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\./g, (m, i, all) => (/\d\.\d/.test(all.slice(Math.max(0, i - 1), i + 2)) ? ":" : "")).replace(/\s+/g, "");
  const m = /^(\d{1,2})(?::?(\d{2}))?(a|p)?m?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[3] === "p" ? 12 : 0);
  }
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

const exists = (y: number, mo: number, d: number) => { const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d; };

/** Interpreta una fecha escrita («2026-03-05» o «5/3/2026») y la devuelve como AAAA-MM-DD, o null si no existe. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else return null;
  return exists(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
}

/** Suma minutos a una hora HH:mm; `dayOffset` dice cuántos días se cruzaron. */
export function addMinutes(time: string, minutes: number): { time: string; dayOffset: number } {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const total = h * 60 + m + minutes;
  const dayOffset = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return { time: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`, dayOffset };
}
