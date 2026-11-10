// R-174, R-175 (spec 004, Hito 4): la exportación del mapa aplica `off` y colores con la misma resolución que el lienzo.
import { describe, it, expect } from "vitest";
import { addChild, newTree, type Tree } from "../diagrams/tree";
import { moveBranch, resolveTreeLayout, setTreeNodeStyle, setTreeNodeOffset } from "../diagrams/mindmap";
import { treeToSvg } from "./svg";
import { blocksToHtml, newReport, type RenderContext } from "./html";
import type { Block } from "../blocks/types";
import { serializeTree } from "../diagrams/tree";

const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("no ok"); return r.value as T; };
const base = (): Tree => must(addChild(newTree("Tema"), "root", "A", "a")).tree;
const rects = (svg: string) => [...svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="160" height="40"[^>]*fill="([^"]+)" stroke="([^"]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), fill: m[3], stroke: m[4] }));

describe("SVG del mapa (R-174)", () => {
  it("sin campos nuevos sale igual que antes", () => {
    const svg = treeToSvg(base(), "mindmap");
    const r = rects(svg);
    expect(r).toHaveLength(2);
    expect(r[0]!.fill).toBe("#bfdbfe"); expect(r[1]!.fill).toBe("#f1f5f9");
  });
  it("aplica off con resolveTreeLayout: lo exportado coincide con lo que se ve", () => {
    const t = moveBranch(base(), "a", { x: 300, y: 100 }, { snap: false });
    const pos = resolveTreeLayout(t, "mindmap").get("a")!;
    const r = rects(treeToSvg(t, "mindmap"));
    const moved = r.find((q) => q.x === pos.x - 80)!;
    expect(moved.y).toBe(pos.y - 20);
  });
  it("aplica los colores de relleno, borde, texto y línea", () => {
    let t = base();
    t = must(setTreeNodeStyle(t, "a", "fill", "#ff0000")); t = must(setTreeNodeStyle(t, "a", "stroke", "palette:green")); t = must(setTreeNodeStyle(t, "a", "text", "#00ff00")); t = must(setTreeNodeStyle(t, "a", "line", "#0000ff"));
    const svg = treeToSvg(t, "mindmap");
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('fill="#00ff00"');
    expect(svg).toContain('stroke="#0000ff"');
    expect(svg).not.toContain('stroke="palette:');
  });
  it("el organigrama ignora off y colores", () => {
    const t = must(setTreeNodeStyle(setTreeNodeOffset(base(), "a", { x: 99, y: 99 }), "a", "fill", "#ff0000"));
    expect(treeToSvg(t, "orgchart")).toBe(treeToSvg(base(), "orgchart"));
  });
});

describe("HTML y PDF usan la misma función (R-175)", () => {
  it("el HTML incluye el mismo SVG que treeToSvg", () => {
    const t = must(setTreeNodeStyle(moveBranch(base(), "a", { x: 300, y: 100 }, { snap: true }), "a", "fill", "#ff0000"));
    const b: Block = { id: "m", type: "mindmap", props: { data: serializeTree(t) }, content: undefined, children: [] };
    const ctx = { report: newReport() } as unknown as RenderContext;
    expect(blocksToHtml([b], ctx)).toContain(treeToSvg(t, "mindmap"));
  });
});
