// Comprobación pura de contraste de un tema (spec 006, RF-5). La usan las pruebas de `themes.test.ts`; no depende de React ni del DOM.
import { ACCENT_IDS } from "@vnote/core";
import { contrastRatio } from "./contrast";
import { blockColors, chips } from "./tokens";
import type { ThemeDef } from "./themes";

export type ContrastFailure = { pair: string; ratio: number; min: number };

/** Pares que no llegan al mínimo (4,5:1 texto, 3:1 bordes de control). Lista vacía = el tema cumple. */
export function checkTheme(def: ThemeDef): ContrastFailure[] {
  const c = def.colors;
  const v = def.variant;
  const fails: ContrastFailure[] = [];
  const need = (pair: string, fg: string, bg: string, min: number) => {
    const ratio = contrastRatio(fg, bg);
    if (ratio < min) fails.push({ pair, ratio, min });
  };
  const surfaces = { canvas: c.canvas, sidebar: c.sidebar, card: c.card, raised: c.raised } as const;
  const main = { canvas: c.canvas, sidebar: c.sidebar, card: c.card } as const;
  const base = { canvas: c.canvas, card: c.card } as const;
  for (const [n, bg] of Object.entries(surfaces)) {
    need(`text/${n}`, c.text, bg, 4.5);
    need(`textMuted/${n}`, c.textMuted, bg, 4.5);
    need(`borderControl/${n}`, c.borderControl, bg, 3);
  }
  for (const [n, bg] of Object.entries(main)) for (const k of ["accent", "success", "warning", "danger"] as const) need(`${k}/${n}`, c[k], bg, 4.5);
  for (const [n, bg] of Object.entries(base)) {
    need(`textPlaceholder/${n}`, c.textPlaceholder, bg, 4.5);
    for (const [id, col] of Object.entries(blockColors)) need(`block ${id}/${n}`, col[v].text, bg, 4.5);
    for (const id of ACCENT_IDS) need(`accent de página ${id}/${n}`, blockColors[id]![v].text, bg, 4.5);
  }
  need("onAccent/accent", c.onAccent, c.accent, 4.5);
  for (const id of ACCENT_IDS) need(`onAccent/accent de página ${id}`, c.onAccent, blockColors[id]![v].text, 4.5);
  for (const [id, col] of Object.entries(blockColors)) need(`text/fondo de bloque ${id}`, c.text, col[v].bg, 4.5);
  for (const [id, col] of Object.entries(chips)) need(`text/fondo de llamada ${id}`, c.text, col[v].bg, 4.5);
  return fails;
}
