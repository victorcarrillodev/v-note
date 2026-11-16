// Portada de página (plan 005, §4.3 y DP-3): gramática del campo `pages.cover` y crédito de la foto. TypeScript puro.
//   cover := "gradient:" nombre | "color:#" hex6 | "lgrad:" ángulo ":" hex6 "," hex6 ["," hex6] | "asset:" sha256
import { isValidHash } from "../assets/hash";

/** Degradados del tema. Una prueba de la interfaz comprueba que coinciden con `coverGradients` de los tokens. */
export const COVER_GRADIENTS = ["sand", "sage", "sky", "lavender", "rose", "graphite"] as const;
export type CoverGradient = (typeof COVER_GRADIENTS)[number];

export type Cover =
  | { kind: "gradient"; name: CoverGradient }
  | { kind: "color"; hex: string }
  | { kind: "lgrad"; angle: number; colors: string[] }
  | { kind: "asset"; hash: string };

const HEX6 = /^#[0-9a-f]{6}$/i;

/** Lee el campo `cover`. Un valor desconocido o mal formado da `null` (la interfaz lo trata como «sin portada»). */
export function parseCover(text: string | null | undefined): Cover | null {
  if (!text) return null;
  const i = text.indexOf(":");
  if (i < 0) return null;
  const kind = text.slice(0, i), value = text.slice(i + 1);
  if (kind === "gradient") return (COVER_GRADIENTS as readonly string[]).includes(value) ? { kind, name: value as CoverGradient } : null;
  if (kind === "color") return HEX6.test(value) ? { kind, hex: value.toLowerCase() } : null;
  if (kind === "lgrad") return parseLinearGradient(value);
  if (kind === "asset") return isValidHash(value) ? { kind, hash: value } : null;
  return null;
}

/** «ángulo:#hex,#hex[,#hex]» con ángulo entero de 0 a 359 y 2 o 3 colores. */
function parseLinearGradient(value: string): Cover | null {
  const i = value.indexOf(":");
  if (i < 0) return null;
  const angleText = value.slice(0, i);
  const colors = value.slice(i + 1).split(",");
  if (!/^\d{1,3}$/.test(angleText)) return null;
  const angle = Number(angleText);
  if (angle > 359 || colors.length < 2 || colors.length > 3 || !colors.every((c) => HEX6.test(c))) return null;
  return { kind: "lgrad", angle, colors: colors.map((c) => c.toLowerCase()) };
}

/** Texto para guardar en `pages.cover` (inverso de `parseCover`). */
export function formatCover(c: Cover): string {
  switch (c.kind) {
    case "gradient": return `gradient:${c.name}`;
    case "color": return `color:${c.hex}`;
    case "lgrad": return `lgrad:${c.angle}:${c.colors.join(",")}`;
    case "asset": return `asset:${c.hash}`;
  }
}

/** Crédito de una portada de Unsplash (RF-2.5). Se guarda en `pages.cover_credit` como JSON. */
export type CoverCredit = { source: "unsplash"; photoId: string; author: string; authorUrl: string; photoUrl: string };

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const httpsUrl = (v: unknown): string | null => {
  const t = text(v);
  if (!t) return null;
  try { return new URL(t).protocol === "https:" ? t : null; } catch { return null; }
};

/** Valida el crédito (objeto o texto JSON) con lista de claves permitidas y solo URLs `https`; cualquier fallo da `null`. */
export function parseCoverCredit(raw: unknown): CoverCredit | null {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return null; } }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.source !== "unsplash") return null;
  const photoId = text(o.photoId), author = text(o.author), authorUrl = httpsUrl(o.authorUrl), photoUrl = httpsUrl(o.photoUrl);
  if (!photoId || !author || !authorUrl || !photoUrl) return null;
  return { source: "unsplash", photoId, author, authorUrl, photoUrl };
}
