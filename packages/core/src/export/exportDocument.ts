import { parseGallery } from "../blocks/gallery";
import type { AssetStore } from "../assets/assetStore";
import { parseAssetUrl } from "../assets/attach";
import type { Block } from "../blocks/types";
import { blocksToHtml, collectAssetUrls, newReport, type DatabaseSnapshot, type ExportReport, type RenderContext, type ResolvedAsset } from "./html";
import { escapeXml } from "./svg";
import { buildExportCss, type ExportPalette } from "./exportCss";

/** Una página lista para exportar: `depth` 0 es la página elegida y las hijas siguen en orden de lectura. */
export type ExportPage = { id: string; title: string; depth: number; blocks: Block[] };
export type ExportInput = { pages: ExportPage[] };
export type ExportDeps = {
  assets: AssetStore;
  /** Entrega la vista elegida de un bloque de base de datos (RF-24); `null` = no disponible. */
  databaseView?: (block: Block) => Promise<DatabaseSnapshot | null>;
};
export type ExportOptions = {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  /** Aspecto del documento (datos, no tema). Sin paleta sale la hoja de siempre, byte por byte. */
  palette?: ExportPalette;
};
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
  const collectNames = (list: Block[]) => { for (const b of list) { if ((b.type === "image" || b.type === "file") && typeof b.props.url === "string") names.set(b.props.url, String(b.props.name ?? "")); if (b.type === "gallery") for (const g of parseGallery(b.props.images)) names.set(g.url, g.name); collectNames(b.children); } };
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
    + `<title>${escapeXml(docTitle)}</title><style>${buildExportCss(opts.palette, sections.some((x) => x.includes('class="ul"')))}</style></head><body>${input.pages.length > 1 ? toc(input.pages) : ""}${sections.join("")}</body></html>`;
  return { status: "done", html, report };
}
