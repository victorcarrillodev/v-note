// R-072 a R-080 (prueba primero): puntos de quiebre de los conectores (plan 004, §8.1).
import { describe, it, expect } from "vitest";
import { addNode, connect, emptyDiagram, setRoute, type Diagram, type DEdge } from "./diagram";
import { connectorPath, pathToSvg, pointAtPath } from "./path";
import { addBendAt, removeBend, bendsOf, nearestOnPath, MIN_BEND_GAP } from "./bends";
import { snapPoint } from "./grid";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message ?? "error"); return r.value as T; };
/** Conector con ambos extremos libres, en horizontal, con el trazado pedido. */
function free(route: "straight" | "orthogonal" | "curved" | "free", a = { x: 0, y: 0 }, b = { x: 300, y: 0 }) {
  const r = must(connect(emptyDiagram(), a, b, { route }));
  return { d: r.diagram, id: r.edge.id };
}
const edgeOf = (d: Diagram, id: string): DEdge => d.edges.find((e) => e.id === id)!;
const pathOf = (d: Diagram, id: string) => connectorPath(d, edgeOf(d, id))!;
const near = (a: { x: number; y: number }, b: { x: number; y: number }, tol = 1e-6) => { expect(a.x).toBeCloseTo(b.x, 4); expect(a.y).toBeCloseTo(b.y, 4); void tol; };

describe("nearestOnPath: trazado recto (R-072)", () => {
  const { d, id } = free("straight");
  const path = pathOf(d, id);
  it("proyecta el clic sobre el tramo", () => {
    const r = nearestOnPath(path, { x: 50, y: 30 });
    near(r.point, { x: 50, y: 0 });
    expect(r.distance).toBeCloseTo(30, 6);
    expect(r.t).toBeCloseTo(50 / 300, 3);
  });
  it("fuera de los extremos se acota al extremo", () => {
    expect(nearestOnPath(path, { x: -40, y: 5 }).t).toBe(0);
    expect(nearestOnPath(path, { x: 500, y: 5 }).t).toBe(1);
  });
  it("un punto sobre el trazado está a distancia cero", () => { expect(nearestOnPath(path, { x: 120, y: 0 }).distance).toBeCloseTo(0, 6); });
  it("con una diagonal", () => {
    const g = free("straight", { x: 0, y: 0 }, { x: 100, y: 100 });
    const r = nearestOnPath(pathOf(g.d, g.id), { x: 100, y: 0 });
    near(r.point, { x: 50, y: 50 });
    expect(r.t).toBeCloseTo(0.5, 3);
  });
  it("el trazado de longitud cero no revienta", () => {
    const z = free("straight", { x: 5, y: 5 }, { x: 5, y: 5 });
    const r = nearestOnPath(pathOf(z.d, z.id), { x: 9, y: 9 });
    expect(Number.isFinite(r.distance)).toBe(true);
  });
});

describe("nearestOnPath: 90°, libre y curvo (R-073, R-074)", () => {
  it("90°: un punto del propio trazado está a distancia cero y el punto devuelto es de la ruta", () => {
    const g = free("orthogonal", { x: 0, y: 0 }, { x: 200, y: 120 });
    const path = pathOf(g.d, g.id);
    for (const t of [0.2, 0.5, 0.8]) {
      const on = pointAtPath(path, t);
      const r = nearestOnPath(path, on);
      expect(r.distance).toBeLessThan(0.5);
      expect(r.t).toBeCloseTo(t, 1);
    }
  });
  it("libre con puntos: elige el tramo más cercano", () => {
    let g = free("free");
    g = { ...g, d: must(connect(emptyDiagram(), { x: 0, y: 0 }, { x: 300, y: 0 }, { route: "free" })).diagram };
    const e = g.d.edges[0]!;
    const withPts: Diagram = { ...g.d, edges: [{ ...e, points: [{ x: 100, y: 80 }, { x: 200, y: 80 }] }] };
    const path = connectorPath(withPts, withPts.edges[0]!)!;
    const r = nearestOnPath(path, { x: 150, y: 90 });
    near(r.point, { x: 150, y: 80 });
    expect(r.distance).toBeCloseTo(10, 6);
  });
  it("curvo: el error de proyección sobre la curva es menor de una unidad", () => {
    const g = free("curved", { x: 0, y: 0 }, { x: 200, y: 160 });
    const path = pathOf(g.d, g.id);
    for (const t of [0.15, 0.4, 0.75]) {
      const on = pointAtPath(path, t);
      const r = nearestOnPath(path, { x: on.x + 0.2, y: on.y - 0.2 });
      expect(r.distance).toBeLessThan(1);
      expect(Math.hypot(r.point.x - on.x, r.point.y - on.y)).toBeLessThan(1);
    }
  });
});

describe("bendsOf", () => {
  it("90° usa waypoints; curvo y libre usan points; recto no tiene", () => {
    const base = free("straight");
    expect(bendsOf(edgeOf(base.d, base.id))).toEqual([]);
    expect(bendsOf({ ...edgeOf(base.d, base.id), route: "orthogonal", waypoints: [{ x: 1, y: 2 }] })).toEqual([{ x: 1, y: 2 }]);
    expect(bendsOf({ ...edgeOf(base.d, base.id), route: "curved", points: [{ x: 3, y: 4 }] })).toEqual([{ x: 3, y: 4 }]);
    expect(bendsOf({ ...edgeOf(base.d, base.id), route: "free", points: [{ x: 5, y: 6 }] })).toEqual([{ x: 5, y: 6 }]);
  });
});

describe("addBendAt (R-075 a R-077)", () => {
  it("90°: inserta un punto de paso sobre el trazado", () => {
    const g = free("orthogonal", { x: 0, y: 0 }, { x: 200, y: 120 });
    const mid = pathOf(g.d, g.id).midpoint;
    const d = must(addBendAt(g.d, g.id, mid));
    const bends = edgeOf(d, g.id).waypoints!;
    expect(bends).toHaveLength(1);
    expect(Math.hypot(bends[0]!.x - mid.x, bends[0]!.y - mid.y)).toBeLessThan(1);
  });
  it("90°: dos puntos quedan en el orden del recorrido", () => {
    let g = free("orthogonal", { x: 0, y: 0 }, { x: 400, y: 200 });
    const p1 = pointAtPath(pathOf(g.d, g.id), 0.7);
    let d = must(addBendAt(g.d, g.id, p1));
    const p2 = pointAtPath(pathOf(d, g.id), 0.25);
    d = must(addBendAt(d, g.id, p2));
    const w = edgeOf(d, g.id).waypoints!;
    expect(w).toHaveLength(2);
    const path = pathOf(d, g.id);
    expect(nearestOnPath(path, w[0]!).t).toBeLessThan(nearestOnPath(path, w[1]!).t);
  });
  it("libre: inserta en la posición correcta de la lista", () => {
    const base = free("free");
    const d0: Diagram = { ...base.d, edges: [{ ...edgeOf(base.d, base.id), points: [{ x: 100, y: 50 }, { x: 200, y: 50 }] }] };
    const d = must(addBendAt(d0, base.id, { x: 150, y: 50 }));
    const pts = edgeOf(d, base.id).points!;
    expect(pts).toHaveLength(3);
    near(pts[1]!, { x: 150, y: 50 });
    near(pts[0]!, { x: 100, y: 50 });
    near(pts[2]!, { x: 200, y: 50 });
  });
  it("libre: antes del primero y después del último", () => {
    const base = free("free");
    const d0: Diagram = { ...base.d, edges: [{ ...edgeOf(base.d, base.id), points: [{ x: 100, y: 50 }, { x: 200, y: 50 }] }] };
    const first = must(addBendAt(d0, base.id, { x: 50, y: 25 }));
    expect(edgeOf(first, base.id).points![0]!.x).toBeLessThan(100);
    const last = must(addBendAt(d0, base.id, { x: 260, y: 25 }));
    expect(edgeOf(last, base.id).points!.at(-1)!.x).toBeGreaterThan(200);
  });
  it("curvo: añade un punto por el que pasará la curva y conserva el trazado", () => {
    const g = free("curved", { x: 0, y: 0 }, { x: 200, y: 160 });
    const at = pointAtPath(pathOf(g.d, g.id), 0.5);
    const d = must(addBendAt(g.d, g.id, at));
    expect(edgeOf(d, g.id).route).toBe("curved");
    expect(edgeOf(d, g.id).points).toHaveLength(1);
  });
  it("recto: el trazado pasa a libre con el punto", () => {
    const g = free("straight");
    const d = must(addBendAt(g.d, g.id, { x: 150, y: 3 }));
    const e = edgeOf(d, g.id);
    expect(e.route).toBe("free");
    expect(e.points).toHaveLength(1);
    near(e.points![0]!, { x: 150, y: 0 });
    expect(e.smooth ?? false).toBe(false);
  });
  it("muy cerca de un extremo el punto se separa del anclaje (CL-4)", () => {
    const g = free("free");
    for (const click of [{ x: 2, y: 0 }, { x: 298, y: 0 }]) {
      const d = must(addBendAt(g.d, g.id, click));
      const p = edgeOf(d, g.id).points![0]!;
      const path = pathOf(g.d, g.id);
      expect(Math.hypot(p.x - path.start.x, p.y - path.start.y)).toBeGreaterThanOrEqual(MIN_BEND_GAP - 1e-6);
      expect(Math.hypot(p.x - path.end.x, p.y - path.end.y)).toBeGreaterThanOrEqual(MIN_BEND_GAP - 1e-6);
    }
  });
  it("con acomodo a la cuadrícula el punto queda en ella", () => {
    const g = free("free", { x: 0, y: 0 }, { x: 301, y: 3 });
    const d = must(addBendAt(g.d, g.id, { x: 133, y: 1 }, { snap: snapPoint }));
    const p = edgeOf(d, g.id).points![0]!;
    expect(Math.abs(p.x % 20)).toBe(0);
    expect(Math.abs(p.y % 20)).toBe(0);
  });
  it("un conector demasiado corto para separar el punto de ambos extremos da error", () => {
    const g = free("straight", { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(addBendAt(g.d, g.id, { x: 5, y: 0 }).ok).toBe(false);
  });
});

describe("removeBend (R-078, R-079)", () => {
  it("quita el punto indicado en 90°, curvo y libre", () => {
    const base = free("free");
    const free3: Diagram = { ...base.d, edges: [{ ...edgeOf(base.d, base.id), points: [{ x: 50, y: 20 }, { x: 100, y: 40 }, { x: 150, y: 20 }] }] };
    const d = must(removeBend(free3, base.id, 1));
    expect(edgeOf(d, base.id).points).toEqual([{ x: 50, y: 20 }, { x: 150, y: 20 }]);
    const curved: Diagram = { ...free3, edges: [{ ...edgeOf(free3, base.id), route: "curved" }] };
    expect(edgeOf(must(removeBend(curved, base.id, 0)), base.id).points).toHaveLength(2);
    const { points: _p, ...noPoints } = edgeOf(free3, base.id); void _p;
    const ortho: Diagram = { ...free3, edges: [{ ...noPoints, route: "orthogonal", waypoints: [{ x: 10, y: 10 }, { x: 90, y: 90 }] }] };
    expect(edgeOf(must(removeBend(ortho, base.id, 1)), base.id).waypoints).toEqual([{ x: 10, y: 10 }]);
  });
  it("al quitar el último punto el conector queda directo, como uno sin puntos", () => {
    for (const route of ["curved", "free"] as const) {
      const g = free(route, { x: 0, y: 0 }, { x: 200, y: 160 });
      const withPoint = must(addBendAt(g.d, g.id, pointAtPath(pathOf(g.d, g.id), 0.5)));
      const back = must(removeBend(withPoint, g.id, 0));
      expect(edgeOf(back, g.id).points ?? []).toEqual([]);
      expect(pathToSvg(pathOf(back, g.id))).toBe(pathToSvg(pathOf(g.d, g.id)));
    }
    const o = free("orthogonal", { x: 0, y: 0 }, { x: 200, y: 160 });
    const withW = must(addBendAt(o.d, o.id, pointAtPath(pathOf(o.d, o.id), 0.5)));
    const backO = must(removeBend(withW, o.id, 0));
    expect(edgeOf(backO, o.id).waypoints ?? []).toEqual([]);
    expect(pathToSvg(pathOf(backO, o.id))).toBe(pathToSvg(pathOf(o.d, o.id)));
  });
  it("no deja claves vacías (los datos sin editar no cambian de bytes)", () => {
    const g = free("free");
    const d = must(removeBend(must(addBendAt(g.d, g.id, { x: 150, y: 0 })), g.id, 0));
    expect("points" in edgeOf(d, g.id)).toBe(false);
  });
});

describe("errores sin lanzar (R-080)", () => {
  const g = free("free");
  it("conector inexistente", () => {
    expect(addBendAt(g.d, "nope", { x: 1, y: 1 }).ok).toBe(false);
    expect(removeBend(g.d, "nope", 0).ok).toBe(false);
  });
  it("índice fuera de rango", () => {
    expect(removeBend(g.d, g.id, 0).ok).toBe(false);
    expect(removeBend(g.d, g.id, -1).ok).toBe(false);
    expect(removeBend(g.d, g.id, 99).ok).toBe(false);
  });
  it("recto no tiene puntos que quitar", () => {
    const s = free("straight");
    expect(removeBend(s.d, s.id, 0).ok).toBe(false);
  });
  it("punto no finito", () => {
    expect(addBendAt(g.d, g.id, { x: NaN, y: 0 }).ok).toBe(false);
    expect(addBendAt(g.d, g.id, { x: 0, y: Infinity }).ok).toBe(false);
  });
  it("conector con una forma que ya no existe", () => {
    let d = emptyDiagram();
    d = addNode(d, { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram;
    d = addNode(d, { shape: "process", x: 300, y: 0, id: "b", text: "B" }).diagram;
    const c = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "free" }));
    const broken: Diagram = { ...c.diagram, nodes: c.diagram.nodes.filter((n) => n.id !== "b") };
    expect(addBendAt(broken, c.edge.id, { x: 100, y: 0 }).ok).toBe(false);
  });
  it("setRoute sigue siendo posible tras añadir puntos", () => {
    const o = free("orthogonal");
    const withW = must(addBendAt(o.d, o.id, { x: 150, y: 0 }));
    expect(must(setRoute(withW, o.id, "curved")).diagram.edges[0]!.route).toBe("curved");
  });
});

describe("moveBend (R-094)", () => {
  it("mueve un punto en 90° (paso), curvo y libre", async () => {
    const { moveBend } = await import("./bends");
    const g = free("curved", { x: 0, y: 0 }, { x: 200, y: 160 });
    const withP = must(addBendAt(g.d, g.id, pointAtPath(pathOf(g.d, g.id), 0.5)));
    const moved = must(moveBend(withP, g.id, 0, { x: 50, y: 60 }));
    expect(edgeOf(moved, g.id).points).toEqual([{ x: 50, y: 60 }]);
    const o = free("orthogonal", { x: 0, y: 0 }, { x: 200, y: 160 });
    const withW = must(addBendAt(o.d, o.id, pointAtPath(pathOf(o.d, o.id), 0.5)));
    expect(edgeOf(must(moveBend(withW, o.id, 0, { x: 70, y: 80 })), o.id).waypoints).toEqual([{ x: 70, y: 80 }]);
  });
  it("errores sin lanzar", async () => {
    const { moveBend } = await import("./bends");
    const g = free("free");
    expect(moveBend(g.d, g.id, 0, { x: 1, y: 1 }).ok).toBe(false);
    expect(moveBend(g.d, "nope", 0, { x: 1, y: 1 }).ok).toBe(false);
    const w = must(addBendAt(g.d, g.id, { x: 150, y: 0 }));
    expect(moveBend(w, g.id, 0, { x: NaN, y: 1 }).ok).toBe(false);
  });
});

describe("rendimiento con muchos puntos (R-097, RNF-1)", () => {
  it("50 puntos en un conector curvo se calculan en milisegundos", () => {
    const g = free("curved", { x: 0, y: 0 }, { x: 2000, y: 0 });
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: 40 * (i + 1), y: i % 2 === 0 ? 60 : -60 }));
    const d: Diagram = { ...g.d, edges: [{ ...edgeOf(g.d, g.id), points: pts }] };
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) connectorPath(d, d.edges[0]!);
    const per = (performance.now() - t0) / 20;
    expect(per).toBeLessThan(10);
    expect(connectorPath(d, d.edges[0]!)!.cmds.filter((c) => c.t === "C")).toHaveLength(51);
  });
});
