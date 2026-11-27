import { parseUnderline, UNDERLINE_STYLE_KEY } from "../blocks/underline";
import { galleryCarouselRem, galleryFitOf, galleryLayoutOf, galleryMosaicStyleOf, galleryRowRem, parseGallery } from "../blocks/gallery";
import { inlineToText, type Block, type Inline } from "../blocks/types";
import { parseAssetUrl } from "../assets/attach";
import { parseDiagram } from "../diagrams/diagram";
import { parseMatrix } from "../diagrams/matrix";
import { parseTimeline } from "../diagrams/timeline";
import { parseTree } from "../diagrams/tree";
import type { Property } from "../databases/databaseService";
import type { QueryRow } from "../databases/query";
import katex from "katex";
import { diagramToSvg, escapeXml, matrixToSvg, timelineToSvg, treeToSvg } from "./svg";
import { hasTocBlock, tocEntries, type TocEntry } from "../pages/toc";

// Bloques → HTML autocontenido (RF-24). Solo produce texto: todo valor se escapa, los enlaces pasan por una lista de esquemas permitidos
// y los colores/variantes por listas cerradas de nombres, de modo que un contenido malicioso no puede inyectar etiquetas ni atributos.

export type ResolvedAsset = { dataUri: string } | null;
/** Una base de datos tal como se verá en la exportación: la vista elegida, ya filtrada y ordenada. */
export type DatabaseSnapshot = { name: string; viewName: string; properties: readonly Property[]; rows: readonly QueryRow[] };
export type ExportReport = { missing: { name: string; url: string }[]; warnings: string[] };
export type RenderContext = {
  /** Adjuntos ya resueltos por su dirección `asset:`; `null` = no está disponible. */
  assets: Map<string, ResolvedAsset>;
  /** Vistas de base de datos por id del bloque. */
  databases: Map<string, DatabaseSnapshot>;
  /** Páginas que también se exportan: id → ancla, para que sus menciones sean enlaces internos. */
  pageAnchors: Map<string, string>;
  report: ExportReport;
  /** Diagramas Mermaid ya dibujados (SVG) por id de bloque; sin entrada, se conserva el código. */
  mermaid?: Map<string, string>;
  /** Entradas del índice del documento (solo si tiene un bloque `toc`): cada encabezado lleva el `id` de su ancla. */
  toc?: { entries: readonly TocEntry[]; byBlock: Map<string, string> };
};
/**
 * Un SVG ajeno solo entra al documento si no puede ejecutar ni pedir nada. Ante la duda se rechaza (se conserva el código, que es seguro):
 * - sin elementos activos o que cargan recursos: script, iframe, object, embed, foreignObject, image, a, link, meta, base, set, animate;
 * - sin controladores `on…=` (con espacio, barra u otro separador delante) ni esquemas `javascript:`/`data:`/`vbscript:`;
 * - sin entidades numéricas o con nombre de separadores (`&#…;`, `&colon;`, `&Tab;`, `&NewLine;`) que disfracen un esquema;
 * - `href` solo hacia un fragmento interno (`#…`), y en estilos solo `url(#…)`; nada de `@import`.
 */
export function svgProblems(svg: string): string[] {
  const found: string[] = [];
  if (!/^\s*<svg[\s>]/i.test(svg)) found.push("no empieza por <svg>");
  const active = /<\s*\/?\s*(script|iframe|object|embed|foreignObject|image|a|link|meta|base|set|animate|animateTransform|animateMotion)[\s/>]/i.exec(svg);
  if (active) found.push(`elemento activo <${active[1]}>`);
  const handler = /[\s/"'`]on[a-z]+\s*=/i.exec(svg);
  if (handler) found.push(`controlador de evento «${handler[0].trim()}»`);
  const scheme = /(javascript|data|vbscript)\s*:/i.exec(svg);
  if (scheme) found.push(`esquema «${scheme[0]}»`);
  const entity = /&(#|colon;|tab;|newline;)/i.exec(svg);
  if (entity) found.push(`entidad «${entity[0]}»`);
  if (/@import/i.test(svg)) found.push("@import");
  // Un escape CSS (`u\72l(` es `url(`) disfraza una carga externa: se rechaza cualquier barra invertida dentro de estilos.
  if (/<style[^>]*>[^<]*\\/i.test(svg) || /\sstyle\s*=\s*(["'])[^"']*\\/i.test(svg)) found.push("escape CSS dentro de un estilo");
  const url = /url\(\s*(?!["']?#)[^)]{0,40}/i.exec(svg);
  if (url) found.push(`url() externa «${url[0]}»`);
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*(["']?)([^"'\s>]*)/gi)) if (!m[2]!.startsWith("#")) found.push(`href externo «${m[2]}»`);
  return found;
}
export const isSafeSvg = (svg: string): boolean => svgProblems(svg).length === 0;
export const newReport = (): ExportReport => ({ missing: [], warnings: [] });

const esc = escapeXml;
const COLORS = new Set(["gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"]);
const ALIGN = new Set(["left", "center", "right", "justify"]);
const VARIANTS = new Set(["info", "warning", "success", "error", "note"]);
const LANG = /^[A-Za-z0-9_+#.-]{1,32}$/;
const SAFE_HREF = /^(https?:|mailto:|tel:)/i;
const safeHref = (h: unknown): string | null => (typeof h === "string" && SAFE_HREF.test(h.trim()) && !/[\s<>"]/.test(h.trim()) ? h.trim() : null);
// Estilos en línea: la hoja de estilos del documento exportado no cambia y cada galería se ve igual en cualquier visor.
const galleryBox = (layout: "mosaic" | "columns" | "carousel", rowRem: number): string =>
  layout === "mosaic" ? `display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:${rowRem}rem;grid-auto-flow:dense;gap:.5rem;margin:1rem 0`
  : layout === "columns" ? "column-width:12rem;column-gap:.5rem;margin:1rem 0"
  : "display:flex;gap:.5rem;overflow-x:auto;margin:1rem 0";
const GALLERY_FIGURE = { mosaic: "margin:0;min-height:0", columns: "margin:0 0 .5rem;break-inside:avoid", carousel: "margin:0;flex:0 0 min(80%,22rem)" } as const;
const galleryImg = (layout: "mosaic" | "columns" | "carousel", fit: string, carouselRem: number): string =>
  layout === "mosaic" ? `display:block;width:100%;height:100%;object-fit:${fit}`
  : layout === "carousel" ? `display:block;width:100%;height:${carouselRem}rem;object-fit:${fit}`
  : "display:block;width:100%;height:auto";
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function inline(items: Inline[], ctx: RenderContext): string {
  return items.map((i) => {
    if (i.type === "link") {
      const inner = inline(i.content, ctx);
      const href = safeHref(i.href);
      return href ? `<a href="${esc(href)}">${inner}</a>` : inner;
    }
    if (i.type === "math") return `<span class="math">${katex.renderToString(i.formula, { displayMode: false, output: "mathml", throwOnError: false })}</span>`;
    if (i.type === "mention") {
      const anchor = ctx.pageAnchors.get(i.pageId);
      return anchor ? `<a class="mention" href="#${esc(anchor)}">${esc(i.title)}</a>` : `<span class="mention">${esc(i.title)}</span>`;
    }
    let out = esc(i.text);
    const st = i.styles;
    if (st.code) out = `<code>${out}</code>`;
    if (st.bold) out = `<strong>${out}</strong>`;
    if (st.italic) out = `<em>${out}</em>`;
    if (st.underline) out = `<u>${out}</u>`;
    if (st.strike) out = `<s>${out}</s>`;
    const ul = parseUnderline(st[UNDERLINE_STYLE_KEY]);
    if (ul) out = `<span class="ul" data-ul-kind="${ul.kind}" data-ul-color="${ul.color}">${out}</span>`;
    const cls = [typeof st.textColor === "string" && COLORS.has(st.textColor) ? `c-${st.textColor}` : "", typeof st.backgroundColor === "string" && COLORS.has(st.backgroundColor) ? `bg-${st.backgroundColor}` : ""].filter(Boolean);
    return cls.length ? `<span class="${cls.join(" ")}">${out}</span>` : out;
  }).join("");
}
const body = (b: Block, ctx: RenderContext) => (Array.isArray(b.content) ? inline(b.content, ctx) : "");
const alignAttr = (b: Block) => {
  const a = b.props.textAlignment;
  return typeof a === "string" && ALIGN.has(a) && a !== "left" ? ` class="align-${a}"` : "";
};

/** Direcciones `asset:` de los bloques (también anidados), sin repetir, para resolverlas antes de renderizar. */
export function collectAssetUrls(blocks: Block[]): string[] {
  const out = new Set<string>();
  const walk = (list: Block[]) => {
    for (const b of list) {
      if ((b.type === "image" || b.type === "file") && parseAssetUrl(str(b.props.url))) out.add(str(b.props.url));
      if (b.type === "gallery") for (const g of parseGallery(b.props.images)) if (parseAssetUrl(g.url)) out.add(g.url);
      walk(b.children);
    }
  };
  walk(blocks);
  return [...out];
}

const missing = (ctx: RenderContext, name: string, url: string): string => {
  ctx.report.missing.push({ name, url });
  return `<span class="missing">[Adjunto no disponible: ${esc(name || "sin nombre")}]</span>`;
};
const warn = (ctx: RenderContext, message: string): string => { ctx.report.warnings.push(message); return message; };

function figure(svg: string): string { return `<figure class="diagram">${svg}</figure>`; }
function organizer(b: Block, ctx: RenderContext, label: string, make: (data: string) => string | null): string {
  const svg = make(str(b.props.data));
  return svg ? figure(svg) : `<p class="missing">${esc(warn(ctx, `${label}: no se pudo leer su contenido`))}</p>`;
}

function formatCell(prop: Property, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "error" in v) return "⚠";
  if (prop.type === "checkbox" || typeof v === "boolean") return v === true ? "Sí" : "No";
  if (prop.type === "select" || prop.type === "status") return prop.config.options?.find((o) => o.id === v)?.name ?? String(v);
  if (prop.type === "multi_select" && Array.isArray(v)) return v.map((id) => prop.config.options?.find((o) => o.id === id)?.name ?? String(id)).join(", ");
  if (prop.type === "files" && Array.isArray(v)) return (v as { name?: string }[]).map((f) => f.name ?? "").join(", ");
  if (prop.type === "relation" && Array.isArray(v)) return `${v.length}`;
  if (typeof v === "object" && !Array.isArray(v) && "start" in (v as object)) { const d = v as { start: string; end?: string }; return d.end ? `${d.start} → ${d.end}` : d.start; }
  return String(v);
}

function database(b: Block, ctx: RenderContext): string {
  const snap = ctx.databases.get(b.id);
  if (!snap) return `<p class="missing">${esc(warn(ctx, "Vista de base de datos: no está disponible"))}</p>`;
  const head = `<th>Título</th>${snap.properties.map((p) => `<th>${esc(p.name)}</th>`).join("")}`;
  const rows = snap.rows.map((r) => `<tr><td>${esc(r.title)}</td>${snap.properties.map((p) => `<td>${esc(formatCell(p, r.values[p.id]))}</td>`).join("")}</tr>`).join("");
  return `<table class="database"><caption>${esc(snap.name)} · ${esc(snap.viewName)}</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

const LIST_TAG: Record<string, "ul" | "ol" | "todo"> = { bulletListItem: "ul", numberedListItem: "ol", checkListItem: "todo" };

function renderOne(b: Block, ctx: RenderContext): string {
  const inner = body(b, ctx);
  const kids = b.children.length ? blocksToHtml(b.children, ctx) : "";
  switch (b.type) {
    case "paragraph": return `<p${alignAttr(b)}>${inner}</p>${kids}`;
    case "heading": {
      const l = Math.min(3, Math.max(1, Number(b.props.level) || 1));
      const anchor = ctx.toc?.byBlock.get(b.id);
      return `<h${l}${anchor ? ` id="${esc(anchor)}"` : ""}${alignAttr(b)}>${inner}</h${l}>${kids}`;
    }
    case "toc": return tocHtml(ctx.toc?.entries ?? []);
    case "quote": return `<blockquote>${inner}</blockquote>${kids}`;
    case "divider": return "<hr>";
    case "toggleListItem": return `<details><summary>${inner}</summary>${kids}</details>`;
    case "codeBlock": {
      const lang = str(b.props.language);
      const text = Array.isArray(b.content) ? inlineToText(b.content) : "";
      return `<pre><code${LANG.test(lang) && lang !== "text" ? ` class="language-${lang}"` : ""}>${esc(text)}</code></pre>`;
    }
    case "table": {
      const rows = b.content && !Array.isArray(b.content) ? b.content.rows : [];
      const cell = (tag: string, c: Inline[]) => `<${tag}>${inline(c, ctx)}</${tag}>`;
      const [first, ...rest] = rows;
      if (!first) return "<table></table>";
      return `<table><thead><tr>${first.map((c) => cell("th", c)).join("")}</tr></thead><tbody>${rest.map((r) => `<tr>${r.map((c) => cell("td", c)).join("")}</tr>`).join("")}</tbody></table>`;
    }
    case "image": {
      const url = str(b.props.url), name = str(b.props.name), caption = str(b.props.caption);
      let src: string | null = null;
      if (parseAssetUrl(url)) {
        const a = ctx.assets.get(url);
        if (!a) return missing(ctx, name, url);
        src = a.dataUri;
      } else src = safeHref(url) && /^https?:/i.test(url.trim()) ? url.trim() : null;
      if (!src) return missing(ctx, name || url, url);
      return `<figure><img src="${esc(src)}" alt="${esc(caption || name)}">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`;
    }
    case "gallery": {
      const imgs = parseGallery(b.props.images);
      const layout = galleryLayoutOf(b.props.layout);
      const baseFit = galleryFitOf(b.props.fit);
      const custom = layout === "mosaic" && galleryMosaicStyleOf(b.props.mosaicStyle) === "custom";
      const items = imgs.map((g) => {
        let src: string | null = null;
        if (parseAssetUrl(g.url)) { const a = ctx.assets.get(g.url); if (!a) { missing(ctx, g.name, g.url); return ""; } src = a.dataUri; }
        else src = safeHref(g.url) && /^https?:/i.test(g.url.trim()) ? g.url.trim() : null;
        if (!src) { missing(ctx, g.name || g.url, g.url); return ""; }
        return `<figure style="${GALLERY_FIGURE[layout]}${custom ? `;grid-column:span ${g.cols};grid-row:span ${g.rows}` : ""}"><img src="${esc(src)}" alt="${esc(g.caption || g.name)}" style="${galleryImg(layout, galleryFitOf(g.fit, baseFit), galleryCarouselRem(b.props.rowHeight))}">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}</figure>`;
      }).join("");
      return items ? `<div class="gallery gallery-${layout}" style="${galleryBox(layout, galleryRowRem(b.props.rowHeight))}">${items}</div>` : "";
    }
    case "file": {
      const url = str(b.props.url), name = str(b.props.name) || url;
      if (parseAssetUrl(url)) {
        const a = ctx.assets.get(url);
        return a ? `<p class="file"><a href="${esc(a.dataUri)}" download="${esc(name)}">${esc(name)}</a></p>` : `<p class="file">${missing(ctx, name, url)}</p>`;
      }
      const href = safeHref(url);
      return href ? `<p class="file"><a href="${esc(href)}">${esc(name)}</a></p>` : `<p class="file">${esc(name)}</p>`;
    }
    case "task": {
      const when = [b.props.due ? `vence ${str(b.props.due)}` : "", b.props.remindAt ? `aviso ${str(b.props.remindAt)}` : ""].filter(Boolean).join(", ");
      return `<p class="task"><input type="checkbox" disabled${b.props.checked ? " checked" : ""}> ${inner}${when ? ` <span class="when">(${esc(when)})</span>` : ""}</p>${kids}`;
    }
    case "callout": { const v = str(b.props.variant); return `<aside class="callout callout-${VARIANTS.has(v) ? v : "info"}">${inner}</aside>${kids}`; }
    case "linkCard": {
      const url = str(b.props.url), title = str(b.props.title) || url, href = safeHref(url);
      return href ? `<a class="link-card" href="${esc(href)}">${esc(title)}</a>` : `<p class="link-card">${esc(title)}</p>`;
    }
    case "diagram": return organizer(b, ctx, "Diagrama", (d) => { const r = parseDiagram(d); return r.ok ? diagramToSvg(r.value) : null; });
    case "mindmap": case "orgchart": return organizer(b, ctx, b.type === "mindmap" ? "Mapa mental" : "Organigrama", (d) => { const r = parseTree(d); return r.ok ? treeToSvg(r.value, b.type as "mindmap" | "orgchart") : null; });
    case "timeline": return organizer(b, ctx, "Línea de tiempo", (d) => { const r = parseTimeline(d); return r.ok ? timelineToSvg(r.value) : null; });
    case "matrix": return organizer(b, ctx, "Matriz", (d) => { const r = parseMatrix(d); return r.ok ? matrixToSvg(r.value) : null; });
    case "equation": return `<div class="equation">${katex.renderToString(str(b.props.formula), { displayMode: true, output: "mathml", throwOnError: false })}</div>${kids}`;
    // Dibujar Mermaid necesita un navegador: lo aporta quien exporta (ctx.mermaid); sin dibujo, el documento conserva su texto.
    case "mermaid": {
      const svg = ctx.mermaid?.get(b.id);
      return svg ? `<figure class="mermaid">${svg}</figure>${kids}` : `<pre><code class="language-mermaid">${esc(str(b.props.code))}</code></pre>${kids}`;
    }
    case "flashcard": return `<details class="flashcard"><summary>${esc(str(b.props.front))}</summary><p>${esc(str(b.props.back))}</p></details>${kids}`;
    case "databaseView": return database(b, ctx);
    default: return `<p>${inner}</p>${kids}`;
  }
}

/** Índice del bloque `toc` (RF-7.4): lista anidada de enlaces a los encabezados. */
function tocHtml(entries: readonly TocEntry[]): string {
  if (entries.length === 0) return '<nav class="toc" aria-label="Índice"></nav>';
  const top = Math.min(...entries.map((e) => e.level));
  let html = "<ul>", depth = 0;
  entries.forEach((e, i) => {
    if (i > 0) {
      const level = Math.min(e.level - top, depth + 1); // un salto de dos niveles se anida un solo nivel: nunca hay <ul> sin <li>
      if (level > depth) { html += "<ul>"; depth++; }
      else { html += "</li>"; while (depth > level) { html += "</ul></li>"; depth--; } }
    }
    html += `<li><a href="#${esc(e.anchor)}">${esc(e.text)}</a>`;
  });
  return `<nav class="toc" aria-label="Índice">${html}</li>${"</ul></li>".repeat(depth)}</ul></nav>`;
}

/** Convierte bloques a HTML (sin documento envolvente). Las listas consecutivas se agrupan y los hijos se anidan. */
export function blocksToHtml(blocks: Block[], ctx: RenderContext): string {
  // Con un bloque de índice, los encabezados llevan su ancla; sin él la salida es la de siempre.
  if (ctx.toc === undefined && hasTocBlock(blocks)) {
    const entries = tocEntries(blocks);
    ctx = { ...ctx, toc: { entries, byBlock: new Map(entries.map((e) => [e.id, e.anchor])) } };
  }
  const out: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const kind = LIST_TAG[b.type];
    if (!kind) { out.push(renderOne(b, ctx)); continue; }
    const items: string[] = [];
    while (i < blocks.length && LIST_TAG[blocks[i]!.type] === kind) {
      const it = blocks[i]!;
      const kids = it.children.length ? blocksToHtml(it.children, ctx) : "";
      const text = body(it, ctx);
      items.push(kind === "todo" ? `<li><input type="checkbox" disabled${it.props.checked ? " checked" : ""}> ${text}${kids}</li>` : `<li>${text}${kids}</li>`);
      i++;
    }
    i--;
    out.push(kind === "todo" ? `<ul class="todo">${items.join("")}</ul>` : `<${kind}>${items.join("")}</${kind}>`);
  }
  return out.join("");
}
