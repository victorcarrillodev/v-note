// G-101, G-102 (prueba primero): trazado libre con puntos de control.
import { describe, it, expect } from "vitest";
import { freeCmds, insertIndexFor } from "./free";

const a = { x: 0, y: 0 }, b = { x: 300, y: 0 };
const pts = [{ x: 100, y: 80 }, { x: 200, y: -60 }];

describe("poligonal", () => {
  it("pasa por todos los puntos en orden con segmentos rectos", () => {
    expect(freeCmds(a, pts, b, false)).toEqual([{ t: "M", p: a }, { t: "L", p: pts[0] }, { t: "L", p: pts[1] }, { t: "L", p: b }]);
  });
  it("sin puntos de control es una línea recta", () => { expect(freeCmds(a, [], b, false)).toEqual([{ t: "M", p: a }, { t: "L", p: b }]); });
});

describe("suavizado (Catmull-Rom)", () => {
  it("cada curva termina en un punto de control y el trazado empieza y acaba en los extremos", () => {
    const cmds = freeCmds(a, pts, b, true);
    expect(cmds[0]).toEqual({ t: "M", p: a });
    expect(cmds.slice(1).every((c) => c.t === "C")).toBe(true);
    expect(cmds.slice(1).map((c) => c.p)).toEqual([pts[0], pts[1], b]);
  });
  it("sin puntos de control suavizado equivale a una recta", () => { expect(freeCmds(a, [], b, true)).toEqual([{ t: "M", p: a }, { t: "L", p: b }]); });
  it("es continuo: la curva que sale de un punto usa la misma tangente que la que llega", () => {
    const cmds = freeCmds(a, pts, b, true) as { t: "C"; c1: { x: number; y: number }; c2: { x: number; y: number }; p: { x: number; y: number } }[] & { t: string }[];
    const c1 = cmds[1] as { c2: { x: number; y: number }; p: { x: number; y: number } }, c2 = cmds[2] as { c1: { x: number; y: number } };
    // c2 de la primera y c1 de la segunda son simétricos respecto al punto compartido
    expect(c1.p.x - c1.c2.x).toBeCloseTo(c2.c1.x - c1.p.x, 6); expect(c1.p.y - c1.c2.y).toBeCloseTo(c2.c1.y - c1.p.y, 6);
  });
});

describe("dónde insertar un punto de control nuevo (doble clic sobre el trazado, G-112)", () => {
  it("devuelve el tramo más cercano: 0 antes del primero, n después del último", () => {
    expect(insertIndexFor(a, pts, b, { x: 50, y: 40 })).toBe(0);     // entre el origen y el primer punto
    expect(insertIndexFor(a, pts, b, { x: 150, y: 10 })).toBe(1);    // entre los dos puntos
    expect(insertIndexFor(a, pts, b, { x: 260, y: -30 })).toBe(2);   // entre el último punto y el destino
  });
  it("sin puntos de control siempre es 0", () => { expect(insertIndexFor(a, [], b, { x: 100, y: 5 })).toBe(0); });
});
