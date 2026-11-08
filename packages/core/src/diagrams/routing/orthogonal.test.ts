// G-089 a G-098 (prueba primero): ruta de ángulos de 90°. Solo tramos horizontales y verticales, sin cruzar las formas unidas y determinista.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { orthogonalRoute, validWaypoints, clearStub, routeWithPin, routeCacheSize, clearRouteCache, ROUTE_CACHE_MAX } from "./orthogonal";
import { anchorDirection, anchorPosition, type Anchor, type Shape } from "../anchors";
import { segmentCrossesBoxInterior, type Box, type Point } from "../geometry";

const box = (x: number, y: number, w = 140, h = 60): Box => ({ x, y, w, h });
const E = { x: 1, y: 0 }, W = { x: -1, y: 0 }, S = { x: 0, y: 1 }, N = { x: 0, y: -1 };
const isOrtho = (pts: Point[]) => pts.slice(1).every((p, i) => p.x === pts[i]!.x || p.y === pts[i]!.y);
const crosses = (pts: Point[], boxes: Box[]) => pts.slice(1).some((p, i) => boxes.some((b) => segmentCrossesBoxInterior(pts[i]!, p, b)));
const noCollinear = (pts: Point[]) => pts.every((p, i) => i === 0 || i === pts.length - 1 || !((pts[i - 1]!.x === p.x && p.x === pts[i + 1]!.x) || (pts[i - 1]!.y === p.y && p.y === pts[i + 1]!.y)));

describe("formas básicas (G-089, G-090)", () => {
  const a = box(0, 0), b = box(400, 200);
  it("este → oeste con las formas en diagonal: una «Z» con el tramo vertical a mitad de camino", () => {
    const r = orthogonalRoute({ start: { x: 140, y: 30 }, startDir: E, end: { x: 400, y: 230 }, endDir: W, obstacles: [a, b] });
    expect(r).toEqual([{ x: 140, y: 30 }, { x: 270, y: 30 }, { x: 270, y: 230 }, { x: 400, y: 230 }]);
  });
  it("alineadas a la misma altura es una sola línea recta", () => {
    const r = orthogonalRoute({ start: { x: 140, y: 30 }, startDir: E, end: { x: 400, y: 30 }, endDir: W, obstacles: [a, box(400, 0)] });
    expect(r).toEqual([{ x: 140, y: 30 }, { x: 400, y: 30 }]);
  });
  it("es determinista: la misma entrada da la misma ruta", () => {
    const o = { start: { x: 70, y: 60 }, startDir: S, end: { x: 470, y: 200 }, endDir: N, obstacles: [a, b] };
    expect(orthogonalRoute(o)).toEqual(orthogonalRoute(o));
  });
  it("minimiza los giros: de abajo hacia arriba en diagonal usa dos giros, no más", () => {
    const r = orthogonalRoute({ start: { x: 70, y: 60 }, startDir: S, end: { x: 470, y: 200 }, endDir: N, obstacles: [a, b] });
    expect(r).toHaveLength(4);
    expect(isOrtho(r)).toBe(true); expect(crosses(r, [a, b])).toBe(false);
  });
});

describe("tramo corto al salir y llegar (G-091)", () => {
  it("el primer tramo sale en la dirección del anclaje y el último llega por la del anclaje de destino", () => {
    const a = box(0, 0), b = box(400, 200);
    const r = orthogonalRoute({ start: { x: 140, y: 30 }, startDir: E, end: { x: 470, y: 200 }, endDir: N, obstacles: [a, b] });
    expect(r[1]!.x).toBeGreaterThan(r[0]!.x); expect(r[1]!.y).toBe(r[0]!.y);          // sale hacia la derecha
    const n = r.length; expect(r[n - 1]!.x).toBe(r[n - 2]!.x); expect(r[n - 2]!.y).toBeLessThan(r[n - 1]!.y); // llega desde arriba
  });
  it("el tramo corto mide 16 si hay espacio y la mitad del hueco si las formas están muy juntas", () => {
    expect(clearStub({ x: 140, y: 30 }, E, [box(0, 0), box(400, 0)])).toBe(16);
    expect(clearStub({ x: 140, y: 30 }, E, [box(0, 0), box(150, 0)])).toBe(5);
  });
  it("con las formas pegadas y anclajes enfrentados queda una línea recta corta", () => {
    const r = orthogonalRoute({ start: { x: 140, y: 30 }, startDir: E, end: { x: 150, y: 30 }, endDir: W, obstacles: [box(0, 0), box(150, 0)] });
    expect(r).toEqual([{ x: 140, y: 30 }, { x: 150, y: 30 }]);
  });
});

describe("sin tramos colineales (G-092)", () => {
  it("la ruta nunca deja tres puntos seguidos en la misma línea", () => {
    for (const end of [{ x: 400, y: 230 }, { x: 400, y: 30 }, { x: 300, y: 300 }]) {
      const r = orthogonalRoute({ start: { x: 140, y: 30 }, startDir: E, end, endDir: W, obstacles: [box(0, 0), box(end.x, end.y - 30)] });
      expect(noCollinear(r)).toBe(true);
    }
  });
});

describe("anclajes enfrentados o que miran hacia afuera (CL-1, CL-4, G-094)", () => {
  it("salir por la izquierda hacia un destino a la derecha rodea la forma de origen sin cruzarla", () => {
    const a = box(0, 0), b = box(400, 0);
    const r = orthogonalRoute({ start: { x: 0, y: 30 }, startDir: W, end: { x: 400, y: 30 }, endDir: W, obstacles: [a, b] });
    expect(isOrtho(r)).toBe(true); expect(crosses(r, [a, b])).toBe(false);
    expect(r[0]).toEqual({ x: 0, y: 30 }); expect(r[r.length - 1]).toEqual({ x: 400, y: 30 });
    expect(Math.min(...r.map((p) => p.x))).toBeLessThan(0); // sale por el lado izquierdo
  });
  it("destino a la izquierda del origen con este → oeste: rodea ambas formas", () => {
    const a = box(400, 0), b = box(0, 0);
    const r = orthogonalRoute({ start: { x: 540, y: 30 }, startDir: E, end: { x: 0, y: 30 }, endDir: W, obstacles: [a, b] });
    expect(isOrtho(r)).toBe(true); expect(crosses(r, [a, b])).toBe(false);
  });
  it("dos formas una sobre otra con norte y sur enfrentados: ruta limpia", () => {
    const a = box(0, 0), b = box(0, 120);
    const r = orthogonalRoute({ start: { x: 70, y: 60 }, startDir: S, end: { x: 70, y: 120 }, endDir: N, obstacles: [a, b] });
    expect(r).toEqual([{ x: 70, y: 60 }, { x: 70, y: 120 }]);
  });
});

describe("sin camino posible: ruta en «U» alrededor de ambas cajas (G-095, CL-4)", () => {
  it("con las formas encimadas devuelve una ruta ortogonal que va por fuera de ambas", () => {
    const a = box(0, 0), b = box(100, 0); // b tapa el anclaje este de a
    const r = orthogonalRoute({ start: { x: 140, y: 30 }, startDir: E, end: { x: 240, y: 30 }, endDir: E, obstacles: [a, b] });
    expect(isOrtho(r)).toBe(true);
    expect(r.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(r[0]).toEqual({ x: 140, y: 30 }); expect(r[r.length - 1]).toEqual({ x: 240, y: 30 });
    expect(Math.max(...r.map((p) => p.x))).toBeGreaterThan(240); // rodea por la derecha de ambas
  });
});

describe("puntos de paso (G-096, G-097, G-098)", () => {
  const a = box(0, 0), b = box(400, 200);
  const base = { start: { x: 140, y: 30 }, startDir: E, end: { x: 400, y: 230 }, endDir: W, obstacles: [a, b] };
  it("la ruta pasa por el punto de paso", () => {
    const r = orthogonalRoute({ ...base, waypoints: [{ x: 270, y: 120 }] });
    expect(r.some((p) => p.x === 270 && p.y === 120) || r.slice(1).some((p, i) => { const q = r[i]!; return (q.x === p.x && q.x === 270 && Math.min(q.y, p.y) <= 120 && Math.max(q.y, p.y) >= 120) || (q.y === p.y && q.y === 120 && Math.min(q.x, p.x) <= 270 && Math.max(q.x, p.x) >= 270); })).toBe(true);
    expect(isOrtho(r)).toBe(true); expect(crosses(r, [a, b])).toBe(false);
  });
  it("mover el tramo vertical de la Z a otra x la ruta la sigue", () => {
    const r = orthogonalRoute({ ...base, waypoints: [{ x: 200, y: 130 }] });
    expect(r.some((p) => p.x === 200)).toBe(true);
    expect(isOrtho(r)).toBe(true);
  });
  it("con dos puntos de paso pasa por ambos en orden", () => {
    const r = orthogonalRoute({ ...base, waypoints: [{ x: 200, y: 130 }, { x: 330, y: 130 }] });
    expect(isOrtho(r)).toBe(true); expect(crosses(r, [a, b])).toBe(false);
    const hit = (pt: Point) => r.findIndex((p, i) => i > 0 && ((r[i - 1]!.x === p.x && p.x === pt.x && Math.min(r[i - 1]!.y, p.y) <= pt.y && pt.y <= Math.max(r[i - 1]!.y, p.y)) || (r[i - 1]!.y === p.y && p.y === pt.y && Math.min(r[i - 1]!.x, p.x) <= pt.x && pt.x <= Math.max(r[i - 1]!.x, p.x))));
    expect(hit({ x: 200, y: 130 })).toBeGreaterThan(0); expect(hit({ x: 330, y: 130 })).toBeGreaterThanOrEqual(hit({ x: 200, y: 130 }));
  });
  it("los puntos de paso dentro de una forma se descartan y los demás se conservan", () => {
    const inside = { x: 50, y: 20 }, ok = { x: 270, y: 120 };
    expect(validWaypoints([inside, ok, { x: NaN, y: 1 }], [a, b])).toEqual([ok]);
    const r = orthogonalRoute({ ...base, waypoints: [inside] });
    expect(crosses(r, [a, b])).toBe(false);
  });
  it("sin puntos de paso (restablecer) vuelve al cálculo automático", () => {
    expect(orthogonalRoute({ ...base, waypoints: [] })).toEqual(orthogonalRoute(base));
  });
});

describe("extremos libres", () => {
  it("un extremo libre sin dirección se alcanza con tramos rectos", () => {
    const a = box(0, 0);
    const r = orthogonalRoute({ start: { x: 140, y: 30 }, startDir: E, end: { x: 500, y: 300 }, endDir: null, obstacles: [a] });
    expect(isOrtho(r)).toBe(true); expect(r[r.length - 1]).toEqual({ x: 500, y: 300 });
  });
  it("los dos libres: una L o una Z limpia", () => {
    const r = orthogonalRoute({ start: { x: 0, y: 0 }, startDir: null, end: { x: 200, y: 100 }, endDir: null, obstacles: [] });
    expect(isOrtho(r)).toBe(true); expect(r[0]).toEqual({ x: 0, y: 0 }); expect(r[r.length - 1]).toEqual({ x: 200, y: 100 });
  });
});

describe("pruebas de propiedades con diseños aleatorios de semilla fija (G-093)", () => {
  const SHAPE_ANCHORS: Anchor[] = ["n", "e", "s", "w"];
  it("200 diseños: solo tramos H/V, sin cruzar las dos formas, extremos exactos y sin colineales", () => {
    const shape = fc.constantFrom<Shape>("process", "note", "decision", "terminator");
    const gen = fc.record({
      ax: fc.integer({ min: -300, max: 300 }), ay: fc.integer({ min: -300, max: 300 }), aw: fc.integer({ min: 40, max: 200 }), ah: fc.integer({ min: 24, max: 120 }),
      dx: fc.integer({ min: -500, max: 500 }), dy: fc.integer({ min: -500, max: 500 }), bw: fc.integer({ min: 40, max: 200 }), bh: fc.integer({ min: 24, max: 120 }),
      sa: shape, sb: shape, aa: fc.constantFrom(...SHAPE_ANCHORS), ab: fc.constantFrom(...SHAPE_ANCHORS),
    });
    fc.assert(fc.property(gen, (g) => {
      const A: Box = { x: g.ax, y: g.ay, w: g.aw, h: g.ah };
      const B: Box = { x: g.ax + g.dx, y: g.ay + g.dy, w: g.bw, h: g.bh };
      const overlap = A.x < B.x + B.w + 4 && B.x < A.x + A.w + 4 && A.y < B.y + B.h + 4 && B.y < A.y + A.h + 4;
      fc.pre(!overlap);
      const s = anchorPosition({ shape: g.sa, ...A }, g.aa), e = anchorPosition({ shape: g.sb, ...B }, g.ab);
      const r = orthogonalRoute({ start: s, startDir: anchorDirection(g.aa), end: e, endDir: anchorDirection(g.ab), obstacles: [A, B] });
      expect(r[0]).toEqual(s); expect(r[r.length - 1]).toEqual(e);
      expect(isOrtho(r)).toBe(true);
      expect(crosses(r, [A, B])).toBe(false);
      expect(noCollinear(r)).toBe(true);
      expect(r.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    }), { numRuns: 200, seed: 20261108 });
  });
});

describe("arrastrar un tramo (G-109)", () => {
  const a = box(0, 0), b = box(400, 200);
  const base = { start: { x: 140, y: 30 }, startDir: E, end: { x: 400, y: 230 }, endDir: W, obstacles: [a, b] };
  it("mover el tramo vertical de la «Z» crea un punto de paso en su nueva posición y el resto se reajusta", () => {
    const route = orthogonalRoute(base); // tramo vertical en x = 270, índice 1 (de route[1] a route[2])
    const pins = routeWithPin(route, 1, { x: 330, y: 999 }, []);
    expect(pins).toHaveLength(1);
    expect(pins[0]!.x).toBe(330); // un tramo vertical solo se mueve en x
    const moved = orthogonalRoute({ ...base, waypoints: pins });
    expect(moved.some((p) => p.x === 330)).toBe(true);
    expect(isOrtho(moved)).toBe(true);
  });
  it("mover un tramo horizontal solo cambia la y del punto de paso", () => {
    const route = orthogonalRoute({ start: { x: 70, y: 60 }, startDir: S, end: { x: 470, y: 200 }, endDir: N, obstacles: [a, b] });
    const i = route.findIndex((p, k) => k > 0 && p.y === route[k - 1]!.y && p.x !== route[k - 1]!.x);
    const pins = routeWithPin(route, i - 1, { x: 12345, y: 150 }, []);
    expect(pins[0]!.y).toBe(150);
  });
  it("si el tramo ya pasa por un punto de paso se mueve ese punto en lugar de añadir otro", () => {
    const route = orthogonalRoute({ ...base, waypoints: [{ x: 330, y: 130 }] });
    const k = route.findIndex((p, i) => i > 0 && p.x === 330 && route[i - 1]!.x === 330);
    expect(k).toBeGreaterThan(0);
    const pins = routeWithPin(route, k - 1, { x: 300, y: 0 }, [{ x: 330, y: 130 }]);
    expect(pins).toEqual([{ x: 300, y: 130 }]);
  });
});

describe("memoria de rutas: no se recalcula lo que no cambió (G-118, RNF-1)", () => {
  const a = box(0, 0), b = box(400, 200);
  const input = { start: { x: 140, y: 30 }, startDir: E, end: { x: 400, y: 230 }, endDir: W, obstacles: [a, b] };
  it("la misma entrada da el mismo resultado y ocupa una sola entrada en la memoria", () => {
    clearRouteCache();
    const r1 = orthogonalRoute(input), r2 = orthogonalRoute({ ...input, obstacles: [{ ...a }, { ...b }] });
    expect(r2).toEqual(r1); expect(routeCacheSize()).toBe(1);
  });
  it("una entrada distinta (otra posición, otros puntos de paso) es otra entrada", () => {
    clearRouteCache();
    orthogonalRoute(input); orthogonalRoute({ ...input, end: { x: 400, y: 260 } }); orthogonalRoute({ ...input, waypoints: [{ x: 270, y: 130 }] });
    expect(routeCacheSize()).toBe(3);
  });
  it("lo guardado no se corrompe si quien llama modifica su copia", () => {
    clearRouteCache();
    const fresh = () => ({ ...input, start: { ...input.start }, end: { ...input.end } });
    const r1 = orthogonalRoute(fresh()); r1.push({ x: 9999, y: 9999 }); r1[0]!.x = -1; r1[1]!.y = -1;
    expect(orthogonalRoute(fresh())).toEqual([{ x: 140, y: 30 }, { x: 270, y: 30 }, { x: 270, y: 230 }, { x: 400, y: 230 }]);
  });
  it("la memoria está acotada", () => {
    clearRouteCache();
    for (let i = 0; i < ROUTE_CACHE_MAX + 50; i++) orthogonalRoute({ ...input, end: { x: 400, y: 230 + i } });
    expect(routeCacheSize()).toBeLessThanOrEqual(ROUTE_CACHE_MAX);
  });
});
