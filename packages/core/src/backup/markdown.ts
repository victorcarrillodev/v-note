import { parseGallery } from "../blocks/gallery";
import { inlineToText, type Block, type Inline } from "../blocks/types";
import { isAttached, parseDiagram, type Endpoint } from "../diagrams/diagram";
import type { Anchor } from "../diagrams/anchors";

/** Nombre en español de cada punto de unión, para el Markdown legible del respaldo. */
const ANCHOR_ES: Record<Anchor, string> = { n: "arriba", ne: "arriba a la derecha", e: "derecha", se: "abajo a la derecha", s: "abajo", sw: "abajo a la izquierda", w: "izquierda", nw: "arriba a la izquierda" };
import { parseMatrix } from "../diagrams/matrix";
import { sortedEvents, parseTimeline } from "../diagrams/timeline";
import { parseTree, type TNode } from "../diagrams/tree";
import { hasTocBlock, tocEntries, type TocEntry } from "../pages/toc";

const esc = (s: string) => s.replace(/([\\`*_#[\]])/g, "\\$1");

function inline(items: Inline[]): string {
  return items
    .map((i) => {
      if (i.type === "link") return `[${inline(i.content)}](${i.href})`;
      if (i.type === "mention") return `[${esc(i.title)}](page:${i.pageId})`;
      const st = i.styles;
      if (st.code) return `\`${i.text}\``;
      let t = esc(i.text);
      if (st.bold) t = `**${t}**`;
      if (st.italic) t = `*${t}*`;
      if (st.strike) t = `~~${t}~~`;
      if (st.underline) t = `<u>${t}</u>`;
      return t;
    })
    .join("");
}
const plain = inlineToText;
const text = (b: Block) => (Array.isArray(b.content) ? inline(b.content) : "");
const LISTS = new Set(["bulletListItem", "numberedListItem", "checkListItem", "toggleListItem"]);

function render(blocks: Block[], indent: string, toc: readonly TocEntry[]): string[] {
  const out: string[] = [];
  let n = 0;
  let prev: string | null = null;
  for (const b of blocks) {
    n = b.type === "numberedListItem" ? n + 1 : 0;
    const lines: string[] = [];
    switch (b.type) {
      // Bloque «Índice» (RF-7.4): lista anidada de enlaces a los encabezados; sin encabezados no escribe nada.
      case "toc": {
        const top = Math.min(...toc.map((e) => e.level));
        for (const e of toc) lines.push(`${"  ".repeat(e.level - top)}- [${esc(e.text)}](#${e.anchor})`);
        break;
      }
      case "heading": lines.push(`${"#".repeat(Number(b.props.level) || 1)} ${text(b)}`); break;
      case "bulletListItem": case "toggleListItem": lines.push(`- ${text(b)}`); break;
      case "numberedListItem": lines.push(`${n}. ${text(b)}`); break;
      case "checkListItem": lines.push(`- [${b.props.checked ? "x" : " "}] ${text(b)}`); break;
      case "quote": lines.push(`> ${text(b)}`); break;
      case "divider": lines.push("---"); break;
      case "codeBlock": {
        const lang = typeof b.props.language === "string" && b.props.language !== "text" ? b.props.language : "";
        lines.push("```" + lang, Array.isArray(b.content) ? plain(b.content) : "", "```");
        break;
      }
      case "image": lines.push(`![${String(b.props.caption || b.props.name || "")}](${String(b.props.url ?? "")})`); break;
      case "gallery": parseGallery(b.props.images).forEach((g, i, a) => { if (i > 0 && a.length > 0) lines.push(""); lines.push(`![${g.caption || g.name}](${g.url})`); }); break;
      case "file": lines.push(`[${String(b.props.name || b.props.url || "")}](${String(b.props.url ?? "")})`); break;
      case "table": {
        const rows = b.content && !Array.isArray(b.content) ? b.content.rows : [];
        const cell = (c: Inline[]) => inline(c).replace(/\|/g, "\\|").replace(/\n/g, " ");
        rows.forEach((r, i) => {
          lines.push(`| ${r.map(cell).join(" | ")} |`);
          if (i === 0) lines.push(`| ${r.map(() => "---").join(" | ")} |`);
        });
        break;
      }
      case "task": {
        const when = [b.props.due ? `vence ${String(b.props.due)}` : "", b.props.remindAt ? `aviso ${String(b.props.remindAt)}` : ""].filter(Boolean).join(", ");
        lines.push(`- [${b.props.checked ? "x" : " "}] ${text(b)}${when ? ` (${when})` : ""}`);
        break;
      }
      case "diagram": {
        const d = parseDiagram(String(b.props.data ?? ""));
        if (!d.ok) { lines.push("> Diagrama (no se pudo leer)"); break; }
        const label = (e: Endpoint) => (isAttached(e) ? `${d.value.nodes.find((n) => n.id === e.node)?.text.trim() || "(sin texto)"} (${ANCHOR_ES[e.anchor]})` : "(extremo libre)");
        lines.push("> Diagrama");
        for (const n of d.value.nodes) lines.push(`> - ${n.text.trim() || "(sin texto)"} [${n.shape}]`);
        for (const e of d.value.edges) lines.push(`> - ${label(e.from)} → ${label(e.to)}${e.label.trim() ? ` (${e.label.trim()})` : ""}`);
        break;
      }
      case "mindmap": case "orgchart": {
        const r = parseTree(String(b.props.data ?? ""));
        lines.push(`> ${b.type === "mindmap" ? "Mapa mental" : "Organigrama"}`);
        if (r.ok) { const walk = (n: TNode, depth: number) => { lines.push(`> ${"  ".repeat(depth)}- ${n.text.trim() || "(sin texto)"}`); n.children.forEach((c) => walk(c, depth + 1)); }; walk(r.value.root, 0); }
        break;
      }
      case "timeline": {
        const r = parseTimeline(String(b.props.data ?? ""));
        lines.push("> Línea de tiempo");
        if (r.ok) for (const e of sortedEvents(r.value)) lines.push(`> - ${e.date}: ${e.title.trim() || "(sin título)"}`);
        break;
      }
      case "matrix": {
        const r = parseMatrix(String(b.props.data ?? ""));
        lines.push("> Matriz");
        if (r.ok) {
          const m = r.value;
          lines.push(`> | | ${m.cols.map((c) => c.title.trim() || "·").join(" | ")} |`);
          lines.push(`> |---|${m.cols.map(() => "---").join("|")}|`);
          for (const row of m.rows) lines.push(`> | ${row.title.trim() || "·"} | ${m.cols.map((c) => m.items.filter((i) => i.row === row.id && i.col === c.id).map((i) => i.text).join("; ")).join(" | ")} |`);
        }
        break;
      }
      case "databaseView": lines.push(`> Vista de base de datos (${String(b.props.databaseId ?? "")})`); break;
      case "callout": lines.push(`> **${String(b.props.variant ?? "info")}:** ${text(b)}`); break;
      case "linkCard": {
        const url = String(b.props.url ?? "");
        lines.push(`[${String(b.props.title || url)}](${url})`);
        break;
      }
      default: lines.push(text(b));
    }
    if (lines.length === 0) continue; // p. ej. un índice sin encabezados
    const family = LISTS.has(b.type) ? "list" : b.type;
    if (prev !== null && !(family === "list" && prev === "list")) out.push("");
    out.push(...lines.map((l) => (l === "" ? l : indent + l)));
    if (b.children.length) out.push(...render(b.children, indent + "  ", toc).filter((l, i, a) => !(l === "" && (i === 0 || a[i - 1] === ""))));
    prev = family;
  }
  return out;
}

/** Markdown legible de una página (RF-15). El detalle sin pérdida (colores, diagramas...) va en el JSON. */
export function blocksToMarkdown(blocks: Block[], description: string | null = null): string {
  const lines = render(blocks, "", hasTocBlock(blocks) ? tocEntries(blocks) : []);
  // La descripción de la página (spec 005, RNF-8) va en cursiva al principio, bajo el título que ya da el nombre del archivo.
  const intro = description ? [`*${description.replace(/\*/g, "\\*")}*`, ...(lines.length ? [""] : [])] : [];
  const all = [...intro, ...lines];
  return all.length ? all.join("\n") + "\n" : "";
}
