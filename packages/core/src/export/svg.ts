import type { Diagram, DNode } from "../diagrams/diagram";
import { diagramBounds } from "../diagrams/diagram";
import { connectorPath, pathToSvg, type ConnectorPath } from "../diagrams/path";
import { EDGE_WIDTH_PX, dashArray, fillHexLight, isColor, strongHexLight } from "../diagrams/style";
import { styledPath, type CapShape } from "../diagrams/caps";
import { layoutTree, NODE_H, NODE_W, type TNode, type Tree } from "../diagrams/tree";
import { resolveTreeLayout } from "../diagrams/mindmap";
import { EVENT_H, EVENT_W, placeEvents, sortedEvents, type Timeline } from "../diagrams/timeline";
import type { Matrix } from "../diagrams/matrix";

// Renderizadores SVG de diagramas y organizadores para la exportación (RF-24). Solo producen texto: sin DOM, deterministas y con todo el texto escapado.

export const escapeXml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const fill = (c: string, fallback: string) => (COLOR.test(c) ? c : fallback);
const n = (v: number) => String(Math.round(v * 100) / 100);
const PAD = 16;
const FONT = 'font-family="system-ui, sans-serif" font-size="13"';

/** Parte un texto en líneas de como máximo `max` caracteres, respetando saltos de línea y cortando las palabras demasiado largas. */
export function wrapText(text: string, max: number): string[] {
  const width = Math.max(1, Math.floor(max));
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.trim() === "") { if (text.includes("\n") && raw === "" && text.trim() !== "") out.push(""); continue; }
    let line = "";
    for (let word of raw.split(/\s+/).filter(Boolean)) {
      while (word.length > width) {
        if (line) { out.push(line); line = ""; }
        out.push(word.slice(0, width)); word = word.slice(width);
      }
      if (line === "") line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
  }
  return out;
}

type Box = { x: number; y: number; w: number; h: number };
function wrapSvg(box: Box, body: string, defs = ""): string {
  const w = box.w + PAD * 2, h = box.h + PAD * 2;
  const inner = `${defs}${body}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(box.x - PAD)} ${n(box.y - PAD)} ${n(w)} ${n(h)}" width="${n(w)}" height="${n(h)}" role="img">${inner}</svg>`;
}
const EMPTY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0" width="0" height="0" role="img"></svg>`;
const ARROW = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#475569"/></marker></defs>`;

function label(cx: number, cy: number, w: number, h: number, text: string, anchor = "middle", color = "#0f172a"): string {
  const lines = wrapText(text, w / 7.2).slice(0, Math.max(1, Math.floor(h / 16)));
  if (lines.length === 0) return "";
  const top = cy - ((lines.length - 1) * 16) / 2;
  return lines.map((l, i) => `<text x="${n(cx)}" y="${n(top + i * 16)}" text-anchor="${anchor}" dominant-baseline="central" ${FONT} fill="${color}">${escapeXml(l)}</text>`).join("");
}

/** Relleno de una forma para exportar (siempre con los valores del tema claro): «none», id de paleta o hexadecimal válido. */
function exportFill(value: string): string {
  if (value === "none") return "none";
  if (value.startsWith("palette:")) return fillHexLight(value.slice(8)) ?? "#dbeafe";
  return isColor(value) ? value : "#dbeafe";
}

function nodeShape(nd: DNode): string {
  const c = exportFill(nd.style.fill);
  const { x, y, w, h } = nd;
  const sw = nd.style.strokeWidth, dash = dashArray(nd.style.strokeDash, sw);
  const paint = `fill="${c}"${nd.style.fillOpacity < 1 ? ` fill-opacity="${n(nd.style.fillOpacity)}"` : ""} stroke="${exportStroke(nd.style.stroke, "#334155")}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}`;
  switch (nd.shape) {
    case "decision": return `<polygon points="${n(x + w / 2)},${n(y)} ${n(x + w)},${n(y + h / 2)} ${n(x + w / 2)},${n(y + h)} ${n(x)},${n(y + h / 2)}" ${paint}/>`;
    case "io": return `<polygon points="${n(x + 16)},${n(y)} ${n(x + w)},${n(y)} ${n(x + w - 16)},${n(y + h)} ${n(x)},${n(y + h)}" ${paint}/>`;
    case "terminator": return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" ${paint}/>`;
    default: return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${nd.shape === "note" ? 0 : 4}" ${paint}/>`;
  }
}

/** Color de línea o texto para exportar (tema claro): tinta → gris de siempre; id de paleta → su tono fuerte; hexadecimal válido → tal cual. */
function exportStroke(value: string, ink: string): string {
  if (value.startsWith("palette:")) return strongHexLight(value.slice(8)) ?? ink;
  return isColor(value) ? value : ink;
}

/** Diagrama de flujo (RF-9) como SVG: formas, conectores (mismos caminos que el lienzo) con flecha y etiquetas. */
export function diagramToSvg(d: Diagram): string {
  const nb = diagramBounds(d);
  if (!nb) return EMPTY;
  // El dibujo también debe incluir los conectores con extremos libres o curvas que salen de la caja de las formas.
  let x0 = nb.x, y0 = nb.y, x1 = nb.x + nb.w, y1 = nb.y + nb.h;
  const edges = d.edges.flatMap((e) => {
    const p = connectorPath(d, e);
    if (!p) return [];
    for (const c of p.cmds) for (const q of c.t === "C" ? [c.c1, c.c2, c.p] : [c.p]) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    const stroke = exportStroke(e.style.color, "#475569"), width = EDGE_WIDTH_PX[e.style.width], dash = dashArray(e.style.dash, width);
    const sp = styledPath(p, e.style);
    for (const cap of [sp.start, sp.end]) if (cap) for (const q of cap.kind === "circle" ? [{ x: cap.center.x - cap.r, y: cap.center.y - cap.r }, { x: cap.center.x + cap.r, y: cap.center.y + cap.r }] : cap.points) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    const line = `<path data-connector="" d="${pathToSvg({ ...p, cmds: sp.cmds })}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
    const capSvg = (c: CapShape | null, kind: string) => (c === null ? "" : c.kind === "circle"
      ? `<circle data-cap="${kind}" cx="${n(c.center.x)}" cy="${n(c.center.y)}" r="${n(c.r)}" fill="${stroke}"/>`
      : `<polygon data-cap="${kind}"${kind === "arrow" ? " data-arrow=\"\"" : ""} points="${c.points.map((q) => `${n(q.x)},${n(q.y)}`).join(" ")}" fill="${stroke}"/>`);
    const arrow = capSvg(sp.start, e.style.startCap) + capSvg(sp.end, e.style.endCap);
    const text = e.label.trim() === "" ? "" : `<text x="${n(p.midpoint.x)}" y="${n(p.midpoint.y - 6)}" text-anchor="middle" ${FONT} fill="${exportStroke(e.style.textColor, "#334155")}">${escapeXml(e.label)}</text>`;
    return [line + arrow + text];
  });
  // Las líneas van debajo: cada forma tapa el tramo de conector que la atraviesa.
  const shapes = d.nodes.map((nd) => nodeShape(nd) + label(nd.x + nd.w / 2, nd.y + nd.h / 2, nd.w - 12, nd.h, nd.text, "middle", exportStroke(nd.style.textColor, "#0f172a")));
  return wrapSvg({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, edges.join("") + shapes.join(""));
}

/** Organigrama o mapa mental (solo las ideas visibles; lo plegado no se dibuja). */
export function treeToSvg(t: Tree, kind: "orgchart" | "mindmap"): string {
  const pos = resolveTreeLayout(t, kind); // el mapa aplica los desplazamientos; el organigrama los ignora
  if (pos.size === 0) return EMPTY;
  const styled = kind === "mindmap"; // los colores por globo son del mapa mental
  const lines: string[] = [], boxes: string[] = [];
  const walk = (node: TNode, parent: TNode | null) => {
    const p = pos.get(node.id);
    if (!p) return;
    if (parent) {
      const q = pos.get(parent.id);
      if (q) lines.push(`<line x1="${n(q.x)}" y1="${n(q.y)}" x2="${n(p.x)}" y2="${n(p.y)}" stroke="${styled && node.style?.line ? exportStroke(node.style.line, "#64748b") : "#64748b"}" stroke-width="1.5"/>`);
    }
    boxes.push(`<rect x="${n(p.x - NODE_W / 2)}" y="${n(p.y - NODE_H / 2)}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="${styled && node.style?.fill ? exportFill(node.style.fill) : node.id === t.root.id ? "#bfdbfe" : "#f1f5f9"}" stroke="${styled && node.style?.stroke ? (node.style.stroke === "none" ? "none" : exportStroke(node.style.stroke, "#334155")) : "#334155"}" stroke-width="1.5"/>${label(p.x, p.y, NODE_W - 12, NODE_H, node.text, "middle", styled && node.style?.text ? exportStroke(node.style.text, "#0f172a") : "#0f172a")}`);
    if (!node.collapsed) node.children.forEach((c) => walk(c, node));
  };
  walk(t.root, null);
  const xs = [...pos.values()].map((v) => v.x), ys = [...pos.values()].map((v) => v.y);
  const x0 = Math.min(...xs) - NODE_W / 2, y0 = Math.min(...ys) - NODE_H / 2;
  return wrapSvg({ x: x0, y: y0, w: Math.max(...xs) + NODE_W / 2 - x0, h: Math.max(...ys) + NODE_H / 2 - y0 }, lines.join("") + boxes.join(""));
}

/** Línea de tiempo (RF-9): eje por fechas y carriles para que los eventos no se superpongan. */
export function timelineToSvg(t: Timeline): string {
  const placed = placeEvents(t);
  if (placed.length === 0) return EMPTY;
  const byId = new Map(sortedEvents(t).map((e) => [e.id, e]));
  const axisY = 0, top = 12;
  const items = placed.map((p) => {
    const e = byId.get(p.id)!;
    const y = top + p.y;
    return `<line x1="${n(p.x)}" y1="${axisY}" x2="${n(p.x)}" y2="${n(y)}" stroke="#94a3b8" stroke-width="1"/>`
      + `<rect x="${n(p.x)}" y="${n(y)}" width="${EVENT_W}" height="${EVENT_H}" rx="4" fill="#fef9c3" stroke="#334155" stroke-width="1.5"/>`
      + label(p.x + EVENT_W / 2, y + 11, EVENT_W - 10, 16, e.title)
      + `<text x="${n(p.x + EVENT_W / 2)}" y="${n(y + 26)}" text-anchor="middle" ${FONT.replace('font-size="13"', 'font-size="11"')} fill="#475569">${escapeXml(e.date)}</text>`;
  });
  const w = Math.max(...placed.map((p) => p.x)) + EVENT_W, h = top + Math.max(...placed.map((p) => p.y)) + EVENT_H;
  return wrapSvg({ x: 0, y: axisY, w, h }, `<line x1="0" y1="${axisY}" x2="${n(w)}" y2="${axisY}" stroke="#334155" stroke-width="2"/>${items.join("")}`);
}

/** Matriz (RF-9): cuadrícula con títulos de filas y columnas y los elementos de cada celda. */
export function matrixToSvg(m: Matrix): string {
  const CELL_W = 180, HEAD_W = 120, HEAD_H = 32, LINE = 16;
  const cellH = (rowId: string) => Math.max(64, ...m.cols.map((c) => 12 + m.items.filter((i) => i.row === rowId && i.col === c.id).reduce((s, i) => s + Math.max(1, wrapText(i.text, (CELL_W - 12) / 7.2).length) * LINE, 0)));
  const heights = m.rows.map((r) => cellH(r.id));
  const out: string[] = [];
  m.cols.forEach((c, ci) => out.push(`<rect x="${HEAD_W + ci * CELL_W}" y="0" width="${CELL_W}" height="${HEAD_H}" fill="#e2e8f0" stroke="#334155"/>${label(HEAD_W + ci * CELL_W + CELL_W / 2, HEAD_H / 2, CELL_W - 12, HEAD_H, c.title.trim() || "·")}`));
  let y = HEAD_H;
  m.rows.forEach((r, ri) => {
    const h = heights[ri]!;
    out.push(`<rect x="0" y="${y}" width="${HEAD_W}" height="${h}" fill="#e2e8f0" stroke="#334155"/>${label(HEAD_W / 2, y + h / 2, HEAD_W - 12, h, r.title.trim() || "·")}`);
    m.cols.forEach((c, ci) => {
      out.push(`<rect x="${HEAD_W + ci * CELL_W}" y="${y}" width="${CELL_W}" height="${h}" fill="#ffffff" stroke="#334155"/>`);
      let ty = y + 14;
      for (const it of m.items.filter((i) => i.row === r.id && i.col === c.id)) {
        for (const l of wrapText(it.text, (CELL_W - 12) / 7.2)) { out.push(`<text x="${HEAD_W + ci * CELL_W + 8}" y="${ty}" ${FONT} fill="#0f172a">${escapeXml(l)}</text>`); ty += LINE; }
      }
    });
    y += h;
  });
  return wrapSvg({ x: 0, y: 0, w: HEAD_W + m.cols.length * CELL_W, h: y }, out.join(""));
}
