// Hoja de estilos del documento exportado (spec 006, RF-6). Sin paleta devuelve EXACTAMENTE la hoja de siempre; con paleta (datos, no tema)
// sustituye los colores fijos por los suyos. Sin dependencias de la interfaz: la paleta la construye `packages/ui`.

import { UNDERLINE_COLORS, UNDERLINE_DARK_STRENGTH, type UnderlineColor } from "../blocks/underline";
import { UNDERLINE_EFFECTS_CSS } from "../blocks/underlineCss";

export type ExportVariant = "light" | "dark";
export type ExportChip = { fg: string; bg: string };
export type ExportBlockColor = { text: string; bg: string };
export const EXPORT_CHIPS = ["info", "success", "warning", "error"] as const;
export const EXPORT_BLOCK_COLORS = ["gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"] as const;
export type ExportPalette = {
  variant: ExportVariant;
  canvas: string; text: string; textMuted: string; border: string; borderControl: string; raised: string; accent: string; danger: string;
  chips: Record<(typeof EXPORT_CHIPS)[number], ExportChip>;
  blocks: Record<(typeof EXPORT_BLOCK_COLORS)[number], ExportBlockColor>;
  /** Color de cada subrayado con estilo (claro u oscuro según la variante). */
  underlines: Record<UnderlineColor, string>;
};

/** Colores de la hoja estándar (los de siempre). */
const STD = {
  text: "#0f172a", muted: "#475569", quote: "#334155", raised: "#f1f5f9", th: "#e2e8f0", border: "#cbd5e1", control: "#94a3b8",
  info: { fg: "#93c5fd", bg: "#eff6ff" }, warning: { fg: "#fcd34d", bg: "#fffbeb" }, success: { fg: "#86efac", bg: "#f0fdf4" }, error: { fg: "#fca5a5", bg: "#fef2f2" }, note: { fg: "#d1d5db", bg: "#f9fafb" },
  underline: { yellow: "#F5C400", orange: "#F58A1F", red: "#EE4B4B", pink: "#EB5FA3", purple: "#9B6BF0", blue: "#3D91F0", green: "#2FBF7A", gray: "#8B8F98", brown: "#B07A52" } as Record<UnderlineColor, string>,
  missing: "#b91c1c", mention: "#1d4ed8", when: "#475569",
  c: { gray: "#6b7280", brown: "#92400e", red: "#dc2626", orange: "#ea580c", yellow: "#ca8a04", green: "#16a34a", blue: "#2563eb", purple: "#9333ea", pink: "#db2777" },
  bg: { gray: "#e5e7eb", brown: "#e7d3c4", red: "#fecaca", orange: "#fed7aa", yellow: "#fef08a", green: "#bbf7d0", blue: "#bfdbfe", purple: "#e9d5ff", pink: "#fbcfe8" },
};

/** Fondo y relleno de la tarjeta clara que lleva cada diagrama cuando el documento es oscuro (los SVG traen colores pensados para fondo claro). */
const DIAGRAM_CARD = "figure.diagram{background:#fff;padding:.75rem;border-radius:.375rem}";

/** `usesUnderline`: el documento trae subrayados con estilo; sin ellos la hoja queda idéntica a la de siempre. */
export function buildExportCss(palette?: ExportPalette, usesUnderline = false): string {
  const p = palette;
  const text = p?.text ?? STD.text, muted = p?.textMuted ?? STD.muted, quote = p?.textMuted ?? STD.quote, raised = p?.raised ?? STD.raised, th = p?.raised ?? STD.th;
  const border = p?.border ?? STD.border, control = p?.borderControl ?? STD.control;
  const chip = (k: "info" | "warning" | "success" | "error") => (p ? p.chips[k] : STD[k]);
  const note = p ? { fg: p.border, bg: p.raised } : STD.note;
  const c = (k: keyof typeof STD.c) => p?.blocks[k].text ?? STD.c[k];
  const bg = (k: keyof typeof STD.bg) => p?.blocks[k].bg ?? STD.bg[k];
  const rules = [
    `:root{color-scheme:${p?.variant ?? "light"}}`,
    `*{box-sizing:border-box}`,
    `body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6;color:${text};${p ? `background:${p.canvas};` : ""}max-width:48rem;margin:0 auto;padding:2rem 1rem}`,
    ...(p ? [`html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}`, `a{color:${p.accent}}`] : []),
    `h1,h2,h3{line-height:1.25}`,
    `.page-title{margin-top:0}`,
    `img,svg{max-width:100%;height:auto}`,
    `figure{margin:1rem 0}`,
    ...(p?.variant === "dark" ? [DIAGRAM_CARD] : []),
    `figcaption{font-size:.875rem;color:${muted};text-align:center}`,
    `pre{background:${raised};padding:.75rem;border-radius:.375rem;overflow:auto}`,
    `code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em}`,
    `blockquote{margin:1rem 0;padding-left:1rem;border-left:4px solid ${border};color:${quote}}`,
    `table{border-collapse:collapse;margin:1rem 0;width:100%}`,
    `th,td{border:1px solid ${control};padding:.35rem .6rem;text-align:left;vertical-align:top}`,
    `th{background:${th}}`,
    `caption{caption-side:top;text-align:left;font-weight:600;padding-bottom:.25rem}`,
    `ul.todo{list-style:none;padding-left:.5rem}`,
    `.callout{border-radius:.375rem;padding:.75rem 1rem;margin:1rem 0;border:1px solid ${chip("info").fg};background:${chip("info").bg}}`,
    `.callout-warning{border-color:${chip("warning").fg};background:${chip("warning").bg}}.callout-success{border-color:${chip("success").fg};background:${chip("success").bg}}.callout-error{border-color:${chip("error").fg};background:${chip("error").bg}}.callout-note{border-color:${note.fg};background:${note.bg}}`,
    `.link-card{display:block;border:1px solid ${border};border-radius:.375rem;padding:.6rem .8rem;margin:1rem 0;text-decoration:none}`,
    `.missing{color:${p?.danger ?? STD.missing};font-style:italic}`,
    `.mention{color:${p?.accent ?? STD.mention}}`,
    `.when{color:${p?.textMuted ?? STD.when};font-size:.875em}`,
    `.align-center{text-align:center}.align-right{text-align:right}.align-justify{text-align:justify}`,
    `.c-gray{color:${c("gray")}}.c-brown{color:${c("brown")}}.c-red{color:${c("red")}}.c-orange{color:${c("orange")}}.c-yellow{color:${c("yellow")}}.c-green{color:${c("green")}}.c-blue{color:${c("blue")}}.c-purple{color:${c("purple")}}.c-pink{color:${c("pink")}}`,
    `.bg-gray{background:${bg("gray")}}.bg-brown{background:${bg("brown")}}.bg-red{background:${bg("red")}}.bg-orange{background:${bg("orange")}}.bg-yellow{background:${bg("yellow")}}.bg-green{background:${bg("green")}}.bg-blue{background:${bg("blue")}}.bg-purple{background:${bg("purple")}}.bg-pink{background:${bg("pink")}}`,
    ...(usesUnderline ? [...(p?.variant === "dark" ? [`:root{--underline-strength:${UNDERLINE_DARK_STRENGTH}}`] : []), ...UNDERLINE_EFFECTS_CSS, ...UNDERLINE_COLORS.map((k) => `.ul[data-ul-color=${k}]{--ul:${p?.underlines[k] ?? STD.underline[k]}}`)] : []),
    `.toc{border:1px solid ${border};border-radius:.375rem;padding:.75rem 1rem;margin-bottom:2rem}`,
    `.toc ul{list-style:none;margin:0;padding-left:1rem}.toc>ul{padding-left:0}`,
    `section.page{margin-top:2rem}`,
    `@page{margin:18mm}`,
    `@media print{`,
    `body{max-width:none;padding:0${p ? "" : ";color:#000"}}`,
    `section.page{page-break-before:always;break-before:page;margin-top:0}`,
    `section.page:first-of-type{page-break-before:auto;break-before:auto}`,
    `pre,table,figure,blockquote,.callout{page-break-inside:avoid;break-inside:avoid}`,
    `h1,h2,h3{page-break-after:avoid;break-after:avoid}`,
    `a{color:inherit;text-decoration:underline}`,
    `.toc{border:0;padding:0}`,
    `details>*{display:block}`,
    `}`,
  ];
  return rules.join("");
}
