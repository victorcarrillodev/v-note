// R-007 y R-009 (spec 004, verificación previa): ¿qué hace hoy el lector del árbol con campos que no conoce?
import { describe, it, expect } from "vitest";
import { parseTree, serializeTree } from "./tree";

const withExtras = JSON.stringify({
  view: { height: 500 },
  root: { id: "root", text: "Idea", off: { x: 20, y: -40 }, style: { fill: "palette:blue" }, children: [{ id: "c1", text: "Hijo", off: { x: 0, y: 20 }, children: [] }] },
});

describe("R-007 y R-009: campos desconocidos en el árbol", () => {
  it("los campos adicionales de los globos se conservan al leer y al escribir", () => {
    const r = parseTree(withExtras);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = JSON.parse(serializeTree(r.value));
    expect(out.root.off).toEqual({ x: 20, y: -40 });
    expect(out.root.style).toEqual({ fill: "palette:blue" });
    expect(out.root.children[0].off).toEqual({ x: 0, y: 20 });
  });
  it("el `view` de nivel superior se pierde hoy al leer (hay que conservarlo en el Hito 3)", () => {
    const r = parseTree(withExtras);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.parse(serializeTree(r.value)).view).toBeUndefined();
  });
  it("un árbol sin campos nuevos se serializa con las mismas claves de siempre", () => {
    const plain = JSON.stringify({ root: { id: "root", text: "Idea", children: [] } });
    const r = parseTree(plain);
    expect(r.ok && JSON.parse(serializeTree(r.value))).toEqual({ root: { id: "root", text: "Idea", children: [] } });
  });
});
