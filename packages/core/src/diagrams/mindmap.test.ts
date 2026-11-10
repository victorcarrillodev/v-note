// R-111 a R-125 (spec 004, Hito 3): posición efectiva, mover ramas, reordenar, globo nuevo sin choque y estilo por rama.
import { describe, it, expect } from "vitest";
import { addChild, addSibling, deleteTreeNode, findNode, layoutTree, newTree, toggleCollapsed, renameNode, NODE_H, NODE_W, type Tree } from "./tree";
import { GRID } from "./grid";
import { resolveTreeLayout, moveBranch, reflowAuto, placeNewNode, setTreeNodeStyle, applyStyleToBranch, setTreeNodeOffset, effectiveBase } from "./mindmap";

const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("no ok"); return r.value as T; };
const sample = (): Tree => {
  let t = newTree("Tema");
  t = must(addChild(t, "root", "A", "a")).tree; t = must(addChild(t, "root", "B", "b")).tree;
  t = must(addChild(t, "a", "A1", "a1")).tree; t = must(addChild(t, "a", "A2", "a2")).tree; t = must(addChild(t, "a1", "A1x", "a1x")).tree;
  return t;
};
const pos = (t: Tree, id: string) => resolveTreeLayout(t, "mindmap").get(id)!;
const mod = (v: number) => ((v % GRID) + GRID) % GRID;
const rel = (t: Tree, a: string, b: string) => ({ x: pos(t, b).x - pos(t, a).x, y: pos(t, b).y - pos(t, a).y });

describe("posición efectiva (R-111 a R-114)", () => {
  it("automática + off del globo y de sus ancestros (R-111)", () => {
    let t = sample();
    const auto = layoutTree(t, "mindmap");
    t = setTreeNodeOffset(t, "a", { x: 40, y: 20 }); t = setTreeNodeOffset(t, "a1", { x: -20, y: 60 }); t = setTreeNodeOffset(t, "a1x", { x: 0, y: 20 });
    expect(pos(t, "a")).toEqual({ x: auto.get("a")!.x + 40, y: auto.get("a")!.y + 20 });
    expect(pos(t, "a1")).toEqual({ x: auto.get("a1")!.x + 40 - 20, y: auto.get("a1")!.y + 20 + 60 });
    expect(pos(t, "a1x")).toEqual({ x: auto.get("a1x")!.x + 20, y: auto.get("a1x")!.y + 100 });
    expect(pos(t, "b")).toEqual(auto.get("b"));
  });
  it("sin ningún off es idéntica a layoutTree (R-112)", () => {
    const t = sample();
    expect(resolveTreeLayout(t, "mindmap")).toEqual(layoutTree(t, "mindmap"));
    expect(resolveTreeLayout(t, "orgchart")).toEqual(layoutTree(t, "orgchart"));
  });
  it("el organigrama ignora los off", () => {
    const t = setTreeNodeOffset(sample(), "a", { x: 100, y: 100 });
    expect(resolveTreeLayout(t, "orgchart")).toEqual(layoutTree(t, "orgchart"));
  });
  it("mover la raíz desplaza todo sin cambiar los demás off (R-113)", () => {
    const t0 = setTreeNodeOffset(sample(), "a1", { x: 20, y: 40 });
    const t1 = setTreeNodeOffset(t0, "root", { x: 60, y: -20 });
    for (const id of ["a", "a1", "a1x", "b"]) { expect(pos(t1, id).x - pos(t0, id).x).toBe(60); expect(pos(t1, id).y - pos(t0, id).y).toBe(-20); }
    expect(findNode(t1, "a1")!.off).toEqual({ x: 20, y: 40 });
  });
  it("colapsar y expandir un globo movido conserva la posición de sus hijos (R-114)", () => {
    let t = setTreeNodeOffset(sample(), "a", { x: 40, y: 40 }); t = setTreeNodeOffset(t, "a1", { x: 0, y: 20 });
    const before = pos(t, "a1");
    const hidden = toggleCollapsed(t, "a");
    expect(resolveTreeLayout(hidden, "mindmap").has("a1")).toBe(false);
    expect(pos(toggleCollapsed(hidden, "a"), "a1")).toEqual(before);
  });
});

describe("mover y reordenar (R-115 a R-117)", () => {
  it("moveBranch cambia solo el off del globo y acomoda a la cuadrícula (R-115)", () => {
    const t = sample();
    const m = moveBranch(t, "a1", { x: 123, y: 77 }, { snap: true });
    expect(mod(pos(m, "a1").x)).toBe(0); expect(mod(pos(m, "a1").y)).toBe(0);
    expect(findNode(m, "a")!.off).toBeUndefined(); expect(findNode(m, "b")!.off).toBeUndefined();
    const free = moveBranch(t, "a1", { x: 123, y: 77 }, { snap: false });
    expect(pos(free, "a1")).toEqual({ x: 123, y: 77 });
  });
  it("los descendientes conservan su distancia relativa (R-116)", () => {
    const t = setTreeNodeOffset(sample(), "a1x", { x: 20, y: 40 });
    const m = moveBranch(t, "a1", { x: 131, y: 59 }, { snap: true });
    expect(rel(m, "a1", "a1x")).toEqual(rel(t, "a1", "a1x"));
  });
  it("mover un globo sin cambio deja sin off", () => {
    const t = sample();
    const m = moveBranch(t, "a", pos(t, "a"), { snap: false });
    expect(findNode(m, "a")!.off).toBeUndefined();
  });
  it("reflowAuto borra todos los off (R-117)", () => {
    let t = sample(); t = setTreeNodeOffset(t, "a", { x: 40, y: 20 }); t = setTreeNodeOffset(t, "root", { x: 20, y: 20 });
    const r = reflowAuto(t);
    expect(resolveTreeLayout(r, "mindmap")).toEqual(layoutTree(r, "mindmap"));
    expect(JSON.stringify(r)).not.toContain("off");
  });
  it("effectiveBase = posición sin el off propio", () => {
    const t = setTreeNodeOffset(setTreeNodeOffset(sample(), "a", { x: 40, y: 20 }), "a1", { x: 20, y: 0 });
    expect(effectiveBase(t, "a1")).toEqual({ x: pos(t, "a1").x - 20, y: pos(t, "a1").y });
  });
});

describe("globo nuevo (R-118, R-119)", () => {
  const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H;
  it("no se superpone con otros globos visibles (R-118)", () => {
    let t = sample();
    // un globo movido encima del lugar donde irá el nuevo hijo
    const r = must(addChild(t, "b", "B1", "b1")); t = r.tree;
    t = moveBranch(t, "a2", pos(t, "b1"), { snap: false });
    t = placeNewNode(t, "b1");
    const ids = [...resolveTreeLayout(t, "mindmap").keys()];
    for (const other of ids) if (other !== "b1") expect(overlap(pos(t, "b1"), pos(t, other))).toBe(false);
  });
  it("deja el globo en un punto de la cuadrícula si hizo falta moverlo (R-119)", () => {
    let t = sample();
    t = must(addChild(t, "b", "B1", "b1")).tree;
    t = moveBranch(t, "a2", { x: pos(t, "b1").x + 7, y: pos(t, "b1").y + 3 }, { snap: false });
    t = placeNewNode(t, "b1");
    expect(findNode(t, "b1")!.off).toBeDefined();
    expect(mod(pos(t, "b1").x)).toBe(0); expect(mod(pos(t, "b1").y)).toBe(0);
  });
  it("si no hay choque no mueve nada", () => {
    const t = must(addSibling(sample(), "a", "A'", "a'")).tree;
    expect(findNode(placeNewNode(t, "a'"), "a'")!.off).toBeUndefined();
  });
});

describe("estilo (R-120 a R-122)", () => {
  it("setTreeNodeStyle cambia cada color y rechaza los inválidos (R-120)", () => {
    let t = sample();
    for (const k of ["fill", "stroke", "text", "line"] as const) t = must(setTreeNodeStyle(t, "a", k, "#112233"));
    expect(findNode(t, "a")!.style).toEqual({ fill: "#112233", stroke: "#112233", text: "#112233", line: "#112233" });
    expect(setTreeNodeStyle(t, "a", "fill", "rojo").ok).toBe(false);
    expect(setTreeNodeStyle(t, "zz", "fill", "#fff").ok).toBe(false);
    const cleared = must(setTreeNodeStyle(t, "a", "fill", undefined));
    expect(findNode(cleared, "a")!.style!.fill).toBeUndefined();
  });
  it("aplicar a la rama copia el estilo a los descendientes actuales (R-121)", () => {
    let t = must(setTreeNodeStyle(sample(), "a", "fill", "palette:green"));
    t = must(setTreeNodeStyle(t, "a", "line", "#336699"));
    const r = must(applyStyleToBranch(t, "a"));
    for (const id of ["a1", "a2", "a1x"]) expect(findNode(r, id)!.style).toEqual({ fill: "palette:green", line: "#336699" });
    expect(findNode(r, "root")!.style).toBeUndefined(); expect(findNode(r, "b")!.style).toBeUndefined();
  });
  it("un hijo nuevo nace sin estilo (R-122)", () => {
    const r = must(applyStyleToBranch(must(setTreeNodeStyle(sample(), "a", "fill", "palette:green")), "a"));
    const n = must(addChild(r, "a", "nuevo", "n")).tree;
    expect(findNode(n, "n")!.style).toBeUndefined();
  });
});

describe("borrado y texto vacío (R-123, R-124)", () => {
  it("el conteo incluye todos los descendientes (R-123)", () => {
    expect(must(deleteTreeNode(sample(), "a")).removed).toBe(4);
  });
  it("el modelo no elimina un globo de texto vacío (R-124)", () => {
    const t = renameNode(sample(), "a", "");
    expect(findNode(t, "a")).not.toBeNull(); expect(findNode(t, "a")!.text).toBe("");
  });
});

describe("superposición (R-150)", () => {
  it("se permite superponer globos y «Reordenar» los separa", () => {
    const t = sample();
    const over = moveBranch(t, "b", pos(t, "a"), { snap: false });
    expect(pos(over, "b")).toEqual(pos(over, "a"));
    const r = reflowAuto(over);
    expect(pos(r, "b")).not.toEqual(pos(r, "a"));
  });
});
