import type { Diagram, DNode } from "../diagrams/diagram";
import { diagramBounds } from "../diagrams/diagram";
import { layoutTree, NODE_H, NODE_W, type TNode, type Tree } from "../diagrams/tree";
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

function label(cx: number, cy: number, w: number, h: number, text: string, anchor = "middle"): string {
  const lines = wrapText(text, w / 7.2).slice(0, Math.max(1, Math.floor(h / 16)));
  if (lines.length === 0) return "";
  const top = cy - ((lines.length - 1) * 16) / 2;
  return lines.map((l, i) => `<text x="${n(cx)}" y="${n(top + i * 16)}" text-anchor="${anchor}" dominant-baseline="central" ${FONT} fill="#0f172a">${escapeXml(l)}</text>`).join("");
}

function nodeShape(nd: DNode): string {
  const c = fill(nd.color, "#dbeafe");
  const { x, y, w, h } = nd;
  const stroke = `stroke="#334155" stroke-width="1.5"`;
  switch (nd.shape) {
    case "decision": return `<polygon points="${n(x + w / 2)},${n(y)} ${n(x + w)},${n(y + h / 2)} ${n(x + w / 2)},${n(y + h)} ${n(x)},${n(y + h / 2)}" fill="${c}" ${stroke}/>`;
    case "io": return `<polygon points="${n(x + 16)},${n(y)} ${n(x + w)},${n(y)} ${n(x + w - 16)},${n(y + h)} ${n(x)},${n(y + h)}" fill="${c}" ${stroke}/>`;
    case "terminator": return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="${c}" ${stroke}/>`;
    case "note": return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    default: return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="4" fill="${c}" ${stroke}/>`;
  }
}

/** Punto del borde de `node` por donde sale (o llega) el conector hacia `other`: así la punta de la flecha no queda tapada por la forma. */
function borderPoint(node: DNode, other: DNode): [number, number] {
  const cx = node.x + node.w / 2, cy = node.y + node.h / 2;
  const dx = other.x + other.w / 2 - cx, dy = other.y + other.h / 2 - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const hw = node.w / 2, hh = node.h / 2;
  // Rombo: |dx|/hw + |dy|/hh = 1; el resto de formas se tratan como rectángulos: max(|dx|/hw, |dy|/hh) = 1.
  const k = node.shape === "decision" ? Math.abs(dx) / hw + Math.abs(dy) / hh : Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  return [cx + dx / k, cy + dy / k];
}

/** Diagrama de flujo (RF-9) como SVG: formas, conectores con flecha y etiquetas. */
export function diagramToSvg(d: Diagram): string {
  const b = diagramBounds(d);
  if (!b) return EMPTY;
  const byId = new Map(d.nodes.map((nd) => [nd.id, nd]));
  const edges = d.edges.flatMap((e) => {
    const a = byId.get(e.from), z = byId.get(e.to);
    if (!a || !z) return [];
    const [x1, y1] = borderPoint(a, z), [x2, y2] = borderPoint(z, a);
    const line = `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#475569" stroke-width="1.5" marker-end="url(#arrow)"/>`;
    const text = e.label.trim() === "" ? "" : `<text x="${n((x1 + x2) / 2)}" y="${n((y1 + y2) / 2 - 6)}" text-anchor="middle" ${FONT} fill="#334155">${escapeXml(e.label)}</text>`;
    return [line + text];
  });
  // Las líneas van debajo: cada forma tapa el tramo de conector que la atraviesa hasta su borde.
  const shapes = d.nodes.map((nd) => nodeShape(nd) + label(nd.x + nd.w / 2, nd.y + nd.h / 2, nd.w - 12, nd.h, nd.text));
  return wrapSvg(b, edges.join("") + shapes.join(""), ARROW);
}

/** Organigrama o mapa mental (solo las ideas visibles; lo plegado no se dibuja). */
export function treeToSvg(t: Tree, kind: "orgchart" | "mindmap"): string {
  const pos = layoutTree(t, kind);
  if (pos.size === 0) return EMPTY;
  const lines: string[] = [], boxes: string[] = [];
  const walk = (node: TNode, parent: TNode | null) => {
    const p = pos.get(node.id);
    if (!p) return;
    if (parent) {
      const q = pos.get(parent.id);
      if (q) lines.push(`<line x1="${n(q.x)}" y1="${n(q.y)}" x2="${n(p.x)}" y2="${n(p.y)}" stroke="#64748b" stroke-width="1.5"/>`);
    }
    boxes.push(`<rect x="${n(p.x - NODE_W / 2)}" y="${n(p.y - NODE_H / 2)}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="${node.id === t.root.id ? "#bfdbfe" : "#f1f5f9"}" stroke="#334155" stroke-width="1.5"/>${label(p.x, p.y, NODE_W - 12, NODE_H, node.text)}`);
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
