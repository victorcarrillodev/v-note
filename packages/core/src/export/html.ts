import { inlineToText, type Block, type Inline } from "../blocks/types";
import { parseAssetUrl } from "../assets/attach";
import { parseDiagram } from "../diagrams/diagram";
import { parseMatrix } from "../diagrams/matrix";
import { parseTimeline } from "../diagrams/timeline";
import { parseTree } from "../diagrams/tree";
import type { Property } from "../databases/databaseService";
import type { QueryRow } from "../databases/query";
import { diagramToSvg, escapeXml, matrixToSvg, timelineToSvg, treeToSvg } from "./svg";

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
};
export const newReport = (): ExportReport => ({ missing: [], warnings: [] });

const esc = escapeXml;
const COLORS = new Set(["gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"]);
const ALIGN = new Set(["left", "center", "right", "justify"]);
const VARIANTS = new Set(["info", "warning", "success", "error", "note"]);
const LANG = /^[A-Za-z0-9_+#.-]{1,32}$/;
const SAFE_HREF = /^(https?:|mailto:|tel:)/i;
const safeHref = (h: unknown): string | null => (typeof h === "string" && SAFE_HREF.test(h.trim()) && !/[\s<>"]/.test(h.trim()) ? h.trim() : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function inline(items: Inline[], ctx: RenderContext): string {
  return items.map((i) => {
    if (i.type === "link") {
      const inner = inline(i.content, ctx);
      const href = safeHref(i.href);
      return href ? `<a href="${esc(href)}">${inner}</a>` : inner;
    }
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
    case "heading": { const l = Math.min(3, Math.max(1, Number(b.props.level) || 1)); return `<h${l}${alignAttr(b)}>${inner}</h${l}>${kids}`; }
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
    case "databaseView": return database(b, ctx);
    default: return `<p>${inner}</p>${kids}`;
  }
}

/** Convierte bloques a HTML (sin documento envolvente). Las listas consecutivas se agrupan y los hijos se anidan. */
export function blocksToHtml(blocks: Block[], ctx: RenderContext): string {
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
