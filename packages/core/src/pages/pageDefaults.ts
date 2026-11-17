// Predeterminado del espacio (plan 005, §4.4 y DP-7): el estilo con el que nacen las páginas nuevas.
// Se COPIA a la página al crearla; nunca se aplica en vivo (cambiarlo no altera las páginas existentes, RF-8.5).
import type { SqlExecutor } from "../ports/sqlStore";
import { parseStyle, styleToText, type PageStyle } from "./style";

export const PAGE_DEFAULT_STYLE_KEY = "page.default.style";

/** Estilo predeterminado del espacio; sin guardar o dañado = `{}` (estilo clásico). */
export async function loadPageDefaultStyle(store: SqlExecutor): Promise<PageStyle> {
  const rows = await store.query<{ value: string }>("SELECT value FROM meta WHERE key = ?", [PAGE_DEFAULT_STYLE_KEY]);
  return parseStyle(rows[0]?.value);
}

/** Guarda el estilo normalizado; un estilo sin tocar borra la clave. */
export async function savePageDefaultStyle(store: SqlExecutor, style: PageStyle): Promise<void> {
  const text = styleToText(style);
  if (text === null) await store.exec("DELETE FROM meta WHERE key = ?", [PAGE_DEFAULT_STYLE_KEY]);
  else await store.exec("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", [PAGE_DEFAULT_STYLE_KEY, text]);
}
