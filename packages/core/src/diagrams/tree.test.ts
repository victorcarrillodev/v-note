// T-339, T-340 (prueba primero): árbol de los organizadores (mapa mental y organigrama) y su disposición automática.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { newTree, addChild, addSibling, renameNode, deleteTreeNode, toggleCollapsed, moveTreeNode, visibleNodes, findNode, serializeTree, parseTree, treeText, layoutTree, NODE_W, NODE_H, type Tree } from "./tree";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const sample = (): Tree => {
  let t = newTree("Tema");
  t = must(addChild(t, "root", "A", "a")).tree; t = must(addChild(t, "root", "B", "b")).tree;
  t = must(addChild(t, "a", "A1", "a1")).tree; t = must(addChild(t, "a", "A2", "a2")).tree; t = must(addChild(t, "a1", "A1x", "a1x")).tree;
  return t;
};
const ids = (t: Tree) => visibleNodes(t).map((n) => n.id);

describe("operaciones sobre el árbol (T-339)", () => {
  it("nace con una raíz con el texto indicado", () => {
    const t = newTree("Idea central");
    expect(findNode(t, "root")).toMatchObject({ text: "Idea central", children: [] });
  });
  it("agregar un hijo lo coloca al final de su padre; agregar hermano, justo después del nodo", () => {
    let t = sample();
    expect(findNode(t, "root")!.children.map((c) => c.id)).toEqual(["a", "b"]);
    t = must(addSibling(t, "a", "A'", "a'")).tree;
    expect(findNode(t, "root")!.children.map((c) => c.id)).toEqual(["a", "a'", "b"]);
  });
  it("la raíz no tiene hermanos y un padre inexistente da error", () => {
    expect(addSibling(sample(), "root", "x").ok).toBe(false);
    expect(addChild(sample(), "zzz", "x").ok).toBe(false);
  });
  it("renombrar", () => { expect(findNode(renameNode(sample(), "a1", "Nuevo"), "a1")!.text).toBe("Nuevo"); });
  it("eliminar un nodo elimina su subárbol e informa cuántos nodos se fueron; la raíz no se puede eliminar", () => {
    const r = must(deleteTreeNode(sample(), "a"));
    expect(r.removed).toBe(4); // a, a1, a1x, a2
    expect(findNode(r.tree, "a1x")).toBeNull();
    expect(deleteTreeNode(sample(), "root").ok).toBe(false);
  });
  it("colapsar oculta los descendientes y recuerda el estado en los datos (T-342)", () => {
    let t = toggleCollapsed(sample(), "a");
    expect(ids(t)).toEqual(["root", "a", "b"]);
    expect(findNode(t, "a")!.collapsed).toBe(true);
    const back = must(parseTree(serializeTree(t)));
    expect(ids(back)).toEqual(["root", "a", "b"]); // el estado sobrevive a guardar y leer
    t = toggleCollapsed(t, "a");
    expect(ids(t)).toContain("a1x");
  });
  it("los nodos sin hijos no se pueden colapsar (no hay nada que ocultar)", () => {
    expect(findNode(toggleCollapsed(sample(), "b"), "b")!.collapsed).toBeFalsy();
  });
  it("reubicar un nodo (con su subárbol) bajo otro padre en una posición", () => {
    const t = must(moveTreeNode(sample(), "a1", "b", 0));
    expect(findNode(t, "b")!.children.map((c) => c.id)).toEqual(["a1"]);
    expect(findNode(t, "a")!.children.map((c) => c.id)).toEqual(["a2"]);
    expect(findNode(t, "a1")!.children.map((c) => c.id)).toEqual(["a1x"]);
  });
  it("reordenar entre hermanos", () => {
    const t = must(moveTreeNode(sample(), "b", "root", 0));
    expect(findNode(t, "root")!.children.map((c) => c.id)).toEqual(["b", "a"]);
  });
  it("no se puede mover un nodo dentro de sí mismo ni de sus descendientes, ni mover la raíz", () => {
    expect(moveTreeNode(sample(), "a", "a1", 0).ok).toBe(false);
    expect(moveTreeNode(sample(), "a", "a", 0).ok).toBe(false);
    expect(moveTreeNode(sample(), "root", "a", 0).ok).toBe(false);
    expect(moveTreeNode(sample(), "a", "zzz", 0).ok).toBe(false);
  });
  it("ida y vuelta de datos; texto dañado se rechaza sin lanzar", () => {
    const t = sample();
    expect(must(parseTree(serializeTree(t)))).toEqual(t);
    for (const bad of ["{ roto", "[]", '{"root":5}', JSON.stringify({ root: { id: "r", text: "x", children: [{ id: "r", text: "y", children: [] }] } })]) expect(parseTree(bad).ok, bad).toBe(false);
    expect(parseTree("").ok).toBe(true);
  });
  it("texto para búsqueda: todos los nodos, incluso los colapsados", () => {
    const text = treeText(toggleCollapsed(sample(), "a"));
    for (const w of ["Tema", "A", "B", "A1", "A1x", "A2"]) expect(text).toContain(w);
  });
});

describe("disposición automática (T-340)", () => {
  const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H;
  const noOverlap = (pos: Map<string, { x: number; y: number }>) => {
    const p = [...pos.values()];
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (overlap(p[i]!, p[j]!)) return false;
    return true;
  };
  for (const kind of ["orgchart", "mindmap"] as const) {
    it(`${kind}: todos los nodos visibles tienen posición y ninguno se solapa`, () => {
      const pos = layoutTree(sample(), kind);
      expect([...pos.keys()].sort()).toEqual(ids(sample()).sort());
      expect(noOverlap(pos)).toBe(true);
    });
    it(`${kind}: los nodos colapsados no ocupan sitio`, () => {
      const pos = layoutTree(toggleCollapsed(sample(), "a"), kind);
      expect([...pos.keys()].sort()).toEqual(["a", "b", "root"]);
    });
    it(`${kind}: propiedad — para árboles aleatorios nunca hay solapamientos`, () => {
      fc.assert(fc.property(fc.array(fc.nat(30), { minLength: 1, maxLength: 40 }), (parents) => {
        let t = newTree("r");
        parents.forEach((p, i) => { const all = visibleNodes(t).map((n) => n.id); t = must(addChild(t, all[p % all.length]!, `n${i}`, `n${i}`)).tree; });
        const pos = layoutTree(t, kind);
        expect(pos.size).toBe(visibleNodes(t).length);
        expect(noOverlap(pos)).toBe(true);
      }), { numRuns: 100 });
    });
  }
  it("organigrama: cada nivel está más abajo que el anterior (padre arriba, hijos debajo)", () => {
    const pos = layoutTree(sample(), "orgchart");
    expect(pos.get("a")!.y).toBeGreaterThan(pos.get("root")!.y);
    expect(pos.get("a1")!.y).toBeGreaterThan(pos.get("a")!.y);
    expect(pos.get("a1x")!.y).toBeGreaterThan(pos.get("a1")!.y);
  });
  it("mapa mental: las ramas se reparten a ambos lados de la idea central", () => {
    const pos = layoutTree(sample(), "mindmap");
    const root = pos.get("root")!;
    expect(pos.get("a")!.x).not.toBe(root.x);
    expect(Math.sign(pos.get("a")!.x - root.x)).not.toBe(Math.sign(pos.get("b")!.x - root.x));
    // los hijos se alejan del centro en el mismo lado que su rama
    expect(Math.sign(pos.get("a1")!.x - root.x)).toBe(Math.sign(pos.get("a")!.x - root.x));
  });
  it("es determinista: el mismo árbol da las mismas posiciones", () => {
    expect([...layoutTree(sample(), "mindmap")]).toEqual([...layoutTree(sample(), "mindmap")]);
  });
});
