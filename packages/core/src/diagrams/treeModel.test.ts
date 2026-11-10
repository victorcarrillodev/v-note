// R-104 a R-110, R-124 (spec 004, Hito 3): campos nuevos del árbol (`off`, `style`, `view`), lectura tolerante y compatibilidad.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTree, serializeTree, addChild, renameNode, newTree, type Tree, type TNode } from "./tree";

const fx = (n: string) => readFileSync(resolve(__dirname, "fixtures/trees", n), "utf8");
const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("no ok"); return r.value as T; };

// Lector anterior (spec 003) fijado como fixture: solo exige id, text y children y devuelve únicamente `root`.
function legacyParse(text: string): { root: unknown } | null {
  const raw = JSON.parse(text); const ids = new Set<string>();
  const check = (n: any): boolean => { if (!n || typeof n.id !== "string" || typeof n.text !== "string" || !Array.isArray(n.children) || ids.has(n.id)) return false; ids.add(n.id); return n.children.every(check); };
  return check(raw?.root) ? { root: raw.root } : null;
}

describe("tipos (R-104)", () => {
  it("los campos nuevos son opcionales", () => {
    const n: TNode = { id: "x", text: "t", children: [] };
    const t: Tree = { root: n };
    expect(t.view).toBeUndefined(); expect(n.off).toBeUndefined(); expect(n.style).toBeUndefined();
  });
});

describe("lectura (R-105 a R-107)", () => {
  it("conserva `view`, `off` y `style` válidos (R-105)", () => {
    const t = must(parseTree(fx("full.json")));
    expect(t.view).toEqual({ height: 480 });
    expect(t.root.off).toEqual({ x: 20, y: 0 });
    expect(t.root.children[0]!.off).toEqual({ x: 40, y: -20 });
    expect(t.root.children[0]!.style).toEqual({ fill: "palette:green", line: "#336699", stroke: "none", text: "palette:ink" });
    expect(JSON.parse(serializeTree(t))).toEqual(JSON.parse(fx("full.json")));
  });
  it("descarta `off` no numérico y colores inválidos sin lanzar (R-106)", () => {
    const raw = { root: { id: "r", text: "t", off: { x: "1", y: 2 }, style: { fill: "rojo", line: 5, text: "palette:nope" }, children: [{ id: "c", text: "c", off: { x: NaN, y: 1 }, style: { fill: "#fff", extra: 1 }, children: [] }] } };
    const t = must(parseTree(JSON.stringify(raw)));
    expect(t.root.off).toBeUndefined(); expect(t.root.style).toBeUndefined();
    expect(t.root.children[0]!.off).toBeUndefined();
    expect(t.root.children[0]!.style).toEqual({ fill: "#fff" });
  });
  it("acota `view.height` al rango permitido (R-107)", () => {
    expect(must(parseTree(JSON.stringify({ root: { id: "r", text: "", children: [] }, view: { height: 10 } }))).view).toEqual({ height: 240 });
    expect(must(parseTree(JSON.stringify({ root: { id: "r", text: "", children: [] }, view: { height: 99999 } }))).view).toEqual({ height: 1600 });
    expect(must(parseTree(JSON.stringify({ root: { id: "r", text: "", children: [] }, view: { height: "x" } }))).view).toBeUndefined();
  });
});

describe("escritura (R-108)", () => {
  it("un árbol sin editar produce los mismos bytes que antes", () => {
    const plain = fx("plain.json");
    expect(serializeTree(must(parseTree(plain)))).toBe(plain);
  });
  it("no emite campos vacíos", () => {
    const t: Tree = { root: { id: "r", text: "t", children: [], style: {}, off: { x: 0, y: 0 } }, view: {} };
    const out = JSON.parse(serializeTree(t));
    expect(out).toEqual({ root: { id: "r", text: "t", children: [] } });
  });
  it("las operaciones conservan `view`", () => {
    const t = must(parseTree(fx("full.json")));
    expect(renameNode(t, "a", "Z").view).toEqual({ height: 480 });
    expect(must(addChild(t, "root", "n", "n")).tree.view).toEqual({ height: 480 });
    expect(newTree("x").view).toBeUndefined();
  });
});

describe("compatibilidad (R-109, R-110)", () => {
  it("un lector anterior lee un árbol nuevo sin error", () => {
    const r = legacyParse(serializeTree(must(parseTree(fx("full.json")))));
    expect(r).not.toBeNull();
    expect((r!.root as TNode).children).toHaveLength(2);
  });
  it("el mapa anterior se abre igual (R-110)", () => {
    const t = must(parseTree(fx("plain.json")));
    expect(t.view).toBeUndefined(); expect(t.root.children[1]!.collapsed).toBe(true);
  });
});
