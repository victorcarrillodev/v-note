// Spec 006, Fase 4 (T-062 a T-073): hoja de estilos del documento exportado, con y sin paleta.
import { describe, it, expect } from "vitest";
import { UNDERLINE_COLORS } from "../blocks/underline";
import type { Block, Inline } from "../blocks/types";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { assetUrl } from "../assets/attach";
import { exportHtml, type ExportPage } from "./exportDocument";
import { buildExportCss, EXPORT_BLOCK_COLORS, EXPORT_CHIPS, type ExportPalette } from "./exportCss";

/** La hoja de siempre, tal como estaba antes de la spec 006. */
const OLD_CSS = ":root{color-scheme:light}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,\"Segoe UI\",sans-serif;line-height:1.6;color:#0f172a;max-width:48rem;margin:0 auto;padding:2rem 1rem}h1,h2,h3{line-height:1.25}.page-title{margin-top:0}img,svg{max-width:100%;height:auto}figure{margin:1rem 0}figcaption{font-size:.875rem;color:#475569;text-align:center}pre{background:#f1f5f9;padding:.75rem;border-radius:.375rem;overflow:auto}code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em}blockquote{margin:1rem 0;padding-left:1rem;border-left:4px solid #cbd5e1;color:#334155}table{border-collapse:collapse;margin:1rem 0;width:100%}th,td{border:1px solid #94a3b8;padding:.35rem .6rem;text-align:left;vertical-align:top}th{background:#e2e8f0}caption{caption-side:top;text-align:left;font-weight:600;padding-bottom:.25rem}ul.todo{list-style:none;padding-left:.5rem}.callout{border-radius:.375rem;padding:.75rem 1rem;margin:1rem 0;border:1px solid #93c5fd;background:#eff6ff}.callout-warning{border-color:#fcd34d;background:#fffbeb}.callout-success{border-color:#86efac;background:#f0fdf4}.callout-error{border-color:#fca5a5;background:#fef2f2}.callout-note{border-color:#d1d5db;background:#f9fafb}.link-card{display:block;border:1px solid #cbd5e1;border-radius:.375rem;padding:.6rem .8rem;margin:1rem 0;text-decoration:none}.missing{color:#b91c1c;font-style:italic}.mention{color:#1d4ed8}.when{color:#475569;font-size:.875em}.align-center{text-align:center}.align-right{text-align:right}.align-justify{text-align:justify}.c-gray{color:#6b7280}.c-brown{color:#92400e}.c-red{color:#dc2626}.c-orange{color:#ea580c}.c-yellow{color:#ca8a04}.c-green{color:#16a34a}.c-blue{color:#2563eb}.c-purple{color:#9333ea}.c-pink{color:#db2777}.bg-gray{background:#e5e7eb}.bg-brown{background:#e7d3c4}.bg-red{background:#fecaca}.bg-orange{background:#fed7aa}.bg-yellow{background:#fef08a}.bg-green{background:#bbf7d0}.bg-blue{background:#bfdbfe}.bg-purple{background:#e9d5ff}.bg-pink{background:#fbcfe8}.toc{border:1px solid #cbd5e1;border-radius:.375rem;padding:.75rem 1rem;margin-bottom:2rem}.toc ul{list-style:none;margin:0;padding-left:1rem}.toc>ul{padding-left:0}section.page{margin-top:2rem}@page{margin:18mm}@media print{body{max-width:none;padding:0;color:#000}section.page{page-break-before:always;break-before:page;margin-top:0}section.page:first-of-type{page-break-before:auto;break-before:auto}pre,table,figure,blockquote,.callout{page-break-inside:avoid;break-inside:avoid}h1,h2,h3{page-break-after:avoid;break-after:avoid}a{color:inherit;text-decoration:underline}.toc{border:0;padding:0}details>*{display:block}}";

const mk = (variant: "light" | "dark", k: string): ExportPalette => ({
  variant, canvas: `#c${k}0001`, text: `#a${k}0002`, textMuted: `#b${k}0003`, border: `#d${k}0004`, borderControl: `#e${k}0005`, raised: `#f${k}0006`, accent: `#1${k}0007`, danger: `#2${k}0008`,
  chips: Object.fromEntries(EXPORT_CHIPS.map((c, i) => [c, { fg: `#3${k}00${i}1`, bg: `#4${k}00${i}2` }])) as ExportPalette["chips"],
  blocks: Object.fromEntries(EXPORT_BLOCK_COLORS.map((c, i) => [c, { text: `#5${k}0${i}01`, bg: `#6${k}0${i}02` }])) as ExportPalette["blocks"],
  underlines: Object.fromEntries(UNDERLINE_COLORS.map((c, i) => [c, `#7${k}0${i}03`])) as ExportPalette["underlines"],
});
const DARK = mk("dark", "1"), LIGHT = mk("light", "2");
const rule = (css: string, selector: string) => new RegExp(`(?:^|[}{])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`).exec(css)?.[1] ?? "";

const t = (text: string): Inline => ({ type: "text", text, styles: {} });
const para = (text: string): Block => ({ id: "b" + text, type: "paragraph", props: {}, content: [t(text)], children: [] });
const page = (blocks: Block[] = [para("hola")]): ExportPage => ({ id: "1", title: "Doc", depth: 0, blocks });
const run = async (opts: Parameters<typeof exportHtml>[2] = {}, pages = [page()], assets = new MemoryAssetStore()) => {
  const r = await exportHtml({ pages }, { assets }, opts);
  if (r.status !== "done") throw new Error("x");
  return r.html;
};

describe("sin paleta (T-063)", () => {
  it("devuelve exactamente la hoja de siempre", () => {
    expect(buildExportCss()).toBe(OLD_CSS);
    expect(buildExportCss(undefined)).toBe(OLD_CSS);
  });
});

describe("con paleta (T-064 a T-068)", () => {
  it("cuerpo: color, fondo y color-scheme de la variante", () => {
    const d = buildExportCss(DARK), l = buildExportCss(LIGHT);
    expect(d).toContain(":root{color-scheme:dark}");
    expect(l).toContain(":root{color-scheme:light}");
    expect(rule(d, "body")).toContain(`color:${DARK.text};background:${DARK.canvas};`);
    expect(rule(l, "body")).toContain(`color:${LIGHT.text};background:${LIGHT.canvas};`);
  });
  it("texto suave, elevados, bordes y bordes de tabla según la tabla del plan", () => {
    const c = buildExportCss(DARK);
    expect(rule(c, "figcaption")).toContain(`color:${DARK.textMuted}`);
    expect(rule(c, ".when")).toContain(`color:${DARK.textMuted}`);
    expect(rule(c, "blockquote")).toContain(`color:${DARK.textMuted}`);
    expect(rule(c, "blockquote")).toContain(`border-left:4px solid ${DARK.border}`);
    expect(rule(c, "pre")).toContain(`background:${DARK.raised}`);
    expect(rule(c, "th")).toContain(`background:${DARK.raised}`);
    expect(rule(c, ".link-card")).toContain(`border:1px solid ${DARK.border}`);
    expect(rule(c, ".toc")).toContain(`border:1px solid ${DARK.border}`);
    expect(rule(c, "th,td")).toContain(`border:1px solid ${DARK.borderControl}`);
    expect(c).toContain(`.callout-note{border-color:${DARK.border};background:${DARK.raised}}`);
  });
  it("las cuatro llamadas usan los chips de la variante", () => {
    const c = buildExportCss(LIGHT);
    expect(rule(c, ".callout")).toContain(`border:1px solid ${LIGHT.chips.info.fg};background:${LIGHT.chips.info.bg}`);
    for (const [cls, k] of [["warning", "warning"], ["success", "success"], ["error", "error"]] as const) expect(c).toContain(`.callout-${cls}{border-color:${LIGHT.chips[k].fg};background:${LIGHT.chips[k].bg}}`);
  });
  it("colores y fondos de bloque, enlaces y menciones con el acento, «faltante» con danger", () => {
    const c = buildExportCss(DARK);
    EXPORT_BLOCK_COLORS.forEach((k) => { expect(c).toContain(`.c-${k}{color:${DARK.blocks[k].text}}`); expect(c).toContain(`.bg-${k}{background:${DARK.blocks[k].bg}}`); });
    expect(rule(c, "a")).toContain(`color:${DARK.accent}`);
    expect(rule(c, ".mention")).toContain(`color:${DARK.accent}`);
    expect(rule(c, ".missing")).toContain(`color:${DARK.danger}`);
  });
  it("impresión: no fuerza #000 y añade print-color-adjust; sin paleta queda igual", () => {
    const c = buildExportCss(DARK);
    expect(c).toContain("print-color-adjust:exact");
    expect(c).toContain("-webkit-print-color-adjust:exact");
    expect(c).not.toContain("#000");
    expect(buildExportCss()).toContain("color:#000");
    expect(buildExportCss()).not.toContain("print-color-adjust");
  });
  it("diagramas sobre tarjeta clara solo con variante oscura", () => {
    expect(buildExportCss(DARK)).toContain("figure.diagram{background:#fff");
    expect(buildExportCss(LIGHT)).not.toContain("figure.diagram");
    expect(buildExportCss()).not.toContain("figure.diagram");
  });
});

describe("exportHtml con paleta (T-070 a T-073)", () => {
  it("aplica la paleta y sin ella el HTML es el de siempre", async () => {
    const withP = await run({ palette: DARK });
    expect(withP).toContain(DARK.canvas);
    expect(withP).toContain(":root{color-scheme:dark}");
    const plain = await run();
    expect(plain).toContain(`<style>${OLD_CSS}</style>`);
    expect(await run({})).toBe(plain);
  });
  it("sigue autocontenido: sin direcciones externas, sin scripts y sin prefers-color-scheme", async () => {
    const html = await run({ palette: DARK }, [page([para("texto")])]);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toContain("prefers-color-scheme");
  });
  it("las imágenes adjuntas llevan los mismos bytes con y sin paleta", async () => {
    const assets = new MemoryAssetStore();
    const info = await assets.put(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 8, 7, 6]));
    const img: Block = { id: "i", type: "image", props: { url: assetUrl(info.hash), name: "a.png", caption: "" }, content: undefined, children: [] };
    const uri = (h: string) => /src="(data:[^"]+)"/.exec(h)?.[1];
    const a = await run({}, [page([img])], assets), b = await run({ palette: DARK }, [page([img])], assets);
    expect(uri(a)).toBeTruthy();
    expect(uri(b)).toBe(uri(a));
  });
});

describe("subrayado con estilo en el documento exportado", () => {
  const u = (text: string, styles: Record<string, true | string> = {}): Inline => ({ type: "text", text, styles });
  const doc = (inline: Inline[], palette?: ExportPalette) =>
    run(palette ? { palette } : {}, [page([{ id: "u", type: "paragraph", props: {}, content: inline, children: [] }])]);

  it("el texto lleva un <span class=\"ul\"> con el tipo y el color, y la hoja trae los tres trazos y los nueve colores", async () => {
    const html = await doc([u("hola", { underlineStyle: "marker:yellow" })]);
    expect(html).toContain('<span class="ul" data-ul-kind="marker" data-ul-color="yellow">hola</span>');
    for (const kind of ["line", "soft", "marker"]) expect(html).toContain(`.ul[data-ul-kind=${kind}]{`);
    for (const c of UNDERLINE_COLORS) expect(html).toContain(`.ul[data-ul-color=${c}]{--ul:#`);
  });
  it("con paleta usa los colores de la paleta", async () => {
    expect(await doc([u("x", { underlineStyle: "soft:red" })], mk("dark", "a"))).toContain(".ul[data-ul-color=red]{--ul:#7a0203}");
  });
  it("sin subrayados con estilo la hoja no cambia (ni con un valor mal formado ni con otros estilos)", async () => {
    const html = await doc([u("a", { underline: true, bold: true }), u("b", { underlineStyle: "mal:valor" })]);
    expect(html).not.toContain(".ul[");
    expect(html).not.toContain('class="ul"');
  });
  it("un subrayado simple (Ctrl+U) sigue siendo <u>", async () => {
    expect(await doc([u("c", { underline: true })])).toContain("<u>c</u>");
  });

  it("en un documento oscuro el relleno del subrayado es más transparente; en claro no se declara", async () => {
    const dark = await doc([u("x", { underlineStyle: "marker:yellow" })], DARK);
    const light = await doc([u("x", { underlineStyle: "marker:yellow" })], LIGHT);
    expect(dark).toContain(":root{--underline-strength:0.55}");
    expect(light).not.toContain("--underline-strength:");
    expect(dark).toContain("var(--underline-strength,1)");
  });
});
