import type { AssetStore } from "../assets/assetStore";
import { parseAssetUrl } from "../assets/attach";
import type { Block } from "../blocks/types";
import { blocksToHtml, collectAssetUrls, newReport, type DatabaseSnapshot, type ExportReport, type RenderContext, type ResolvedAsset } from "./html";
import { escapeXml } from "./svg";

/** Una página lista para exportar: `depth` 0 es la página elegida y las hijas siguen en orden de lectura. */
export type ExportPage = { id: string; title: string; depth: number; blocks: Block[] };
export type ExportInput = { pages: ExportPage[] };
export type ExportDeps = {
  assets: AssetStore;
  /** Entrega la vista elegida de un bloque de base de datos (RF-24); `null` = no disponible. */
  databaseView?: (block: Block) => Promise<DatabaseSnapshot | null>;
};
export type ExportOptions = { signal?: AbortSignal; onProgress?: (done: number, total: number) => void };
export type ExportOutcome = { status: "done"; html: string; report: ExportReport } | { status: "cancelled" };

const EXT_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", avif: "image/avif",
  pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json", zip: "application/zip",
};
const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

/** Tipo de contenido por los primeros bytes; si no se reconoce, por la extensión del nombre. */
export function sniffMime(bytes: Uint8Array, name: string): string {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "GIF8") return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "svg" && ascii(bytes, 0, 200).includes("<svg")) return "image/svg+xml";
  return EXT_MIME[ext] && ext !== "svg" ? EXT_MIME[ext]! : "application/octet-stream";
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

const CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6;color:#0f172a;max-width:48rem;margin:0 auto;padding:2rem 1rem}
h1,h2,h3{line-height:1.25}
.page-title{margin-top:0}
img,svg{max-width:100%;height:auto}
figure{margin:1rem 0}
figcaption{font-size:.875rem;color:#475569;text-align:center}
pre{background:#f1f5f9;padding:.75rem;border-radius:.375rem;overflow:auto}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em}
blockquote{margin:1rem 0;padding-left:1rem;border-left:4px solid #cbd5e1;color:#334155}
table{border-collapse:collapse;margin:1rem 0;width:100%}
th,td{border:1px solid #94a3b8;padding:.35rem .6rem;text-align:left;vertical-align:top}
th{background:#e2e8f0}
caption{caption-side:top;text-align:left;font-weight:600;padding-bottom:.25rem}
ul.todo{list-style:none;padding-left:.5rem}
.callout{border-radius:.375rem;padding:.75rem 1rem;margin:1rem 0;border:1px solid #93c5fd;background:#eff6ff}
.callout-warning{border-color:#fcd34d;background:#fffbeb}.callout-success{border-color:#86efac;background:#f0fdf4}.callout-error{border-color:#fca5a5;background:#fef2f2}.callout-note{border-color:#d1d5db;background:#f9fafb}
.link-card{display:block;border:1px solid #cbd5e1;border-radius:.375rem;padding:.6rem .8rem;margin:1rem 0;text-decoration:none}
.missing{color:#b91c1c;font-style:italic}
.mention{color:#1d4ed8}
.when{color:#475569;font-size:.875em}
.align-center{text-align:center}.align-right{text-align:right}.align-justify{text-align:justify}
.c-gray{color:#6b7280}.c-brown{color:#92400e}.c-red{color:#dc2626}.c-orange{color:#ea580c}.c-yellow{color:#ca8a04}.c-green{color:#16a34a}.c-blue{color:#2563eb}.c-purple{color:#9333ea}.c-pink{color:#db2777}
.bg-gray{background:#e5e7eb}.bg-brown{background:#e7d3c4}.bg-red{background:#fecaca}.bg-orange{background:#fed7aa}.bg-yellow{background:#fef08a}.bg-green{background:#bbf7d0}.bg-blue{background:#bfdbfe}.bg-purple{background:#e9d5ff}.bg-pink{background:#fbcfe8}
.toc{border:1px solid #cbd5e1;border-radius:.375rem;padding:.75rem 1rem;margin-bottom:2rem}
.toc ul{list-style:none;margin:0;padding-left:1rem}.toc>ul{padding-left:0}
section.page{margin-top:2rem}
@page{margin:18mm}
@media print{
body{max-width:none;padding:0;color:#000}
section.page{page-break-before:always;break-before:page;margin-top:0}
section.page:first-of-type{page-break-before:auto;break-before:auto}
pre,table,figure,blockquote,.callout{page-break-inside:avoid;break-inside:avoid}
h1,h2,h3{page-break-after:avoid;break-after:avoid}
a{color:inherit;text-decoration:underline}
.toc{border:0;padding:0}
details>*{display:block}
}`.replace(/\n/g, "");

function toc(pages: ExportPage[]): string {
  const items = pages.map((p, i) => `<li style="margin-left:${Math.min(p.depth, 6) * 1}rem"><a href="#page-${i}">${escapeXml(p.title.trim() || "Sin título")}</a></li>`);
  return `<nav class="toc" aria-label="Índice"><ul>${items.join("")}</ul></nav>`;
}

function findBlocks(blocks: Block[], type: string, into: Block[] = []): Block[] {
  for (const b of blocks) { if (b.type === type) into.push(b); findBlocks(b.children, type, into); }
  return into;
}

/**
 * Exporta páginas a un único HTML autocontenido (RF-24): estilos incrustados, adjuntos en línea y sin scripts ni recursos externos.
 * Un adjunto que falta no detiene la exportación: se lista en el informe. Se puede cancelar en cualquier momento (CL-31).
 */
export async function exportHtml(input: ExportInput, deps: ExportDeps, opts: ExportOptions = {}): Promise<ExportOutcome> {
  const { signal } = opts;
  const report = newReport();
  const allBlocks = input.pages.flatMap((p) => p.blocks);
  const urls = collectAssetUrls(allBlocks);
  const dbBlocks = deps.databaseView ? findBlocks(allBlocks, "databaseView") : [];
  const total = urls.length + dbBlocks.length + input.pages.length;
  let done = 0;
  const tick = async () => { opts.onProgress?.(++done, total); await yieldNow(); };
  if (signal?.aborted) return { status: "cancelled" };

  const assets = new Map<string, ResolvedAsset>();
  const names = new Map<string, string>();
  const collectNames = (list: Block[]) => { for (const b of list) { if ((b.type === "image" || b.type === "file") && typeof b.props.url === "string") names.set(b.props.url, String(b.props.name ?? "")); collectNames(b.children); } };
  collectNames(allBlocks);
  for (const url of urls) {
    if (signal?.aborted) return { status: "cancelled" };
    const hash = parseAssetUrl(url)!;
    let bytes: Uint8Array | null = null;
    try { bytes = await deps.assets.get(hash); } catch { bytes = null; }
    assets.set(url, bytes ? { dataUri: `data:${sniffMime(bytes, names.get(url) ?? "")};base64,${toBase64(bytes)}` } : null);
    await tick();
  }

  const databases = new Map<string, DatabaseSnapshot>();
  for (const b of dbBlocks) {
    if (signal?.aborted) return { status: "cancelled" };
    let snap: DatabaseSnapshot | null = null;
    try { snap = await deps.databaseView!(b); } catch { snap = null; }
    if (snap) databases.set(b.id, snap);
    await tick();
  }

  const pageAnchors = new Map(input.pages.map((p, i) => [p.id, `page-${i}`]));
  const ctx: RenderContext = { assets, databases, pageAnchors, report };
  const sections: string[] = [];
  for (const [i, p] of input.pages.entries()) {
    if (signal?.aborted) return { status: "cancelled" };
    const title = p.title.trim() || "Sin título";
    sections.push(`<section class="page depth-${Math.min(p.depth, 2)}" id="page-${i}"><h1 class="page-title">${escapeXml(title)}</h1>${blocksToHtml(p.blocks, ctx)}</section>`);
    await tick();
  }
  if (signal?.aborted) return { status: "cancelled" };

  const docTitle = input.pages[0]?.title.trim() || "Sin título";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'">`
    + `<title>${escapeXml(docTitle)}</title><style>${CSS}</style></head><body>${input.pages.length > 1 ? toc(input.pages) : ""}${sections.join("")}</body></html>`;
  return { status: "done", html, report };
}
