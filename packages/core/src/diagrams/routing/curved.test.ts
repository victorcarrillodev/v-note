// G-099, G-100 (prueba primero): trazado redondeado.
import { describe, it, expect } from "vitest";
import { curvedCmds, curvatureForPoint, curveHandle, CURVATURE_MIN, CURVATURE_MAX, DEFAULT_CURVATURE } from "./curved";

const E = { x: 1, y: 0 }, W = { x: -1, y: 0 };

describe("trazado redondeado", () => {
  it("la tangente en cada extremo coincide con la dirección de salida de su anclaje", () => {
    const [m, c] = curvedCmds({ x: 0, y: 0 }, E, { x: 300, y: 200 }, W) as unknown as [{ p: { x: number; y: number } }, { c1: { x: number; y: number }; c2: { x: number; y: number }; p: { x: number; y: number } }];
    expect(c.c1.y).toBe(m.p.y); expect(c.c1.x).toBeGreaterThan(m.p.x);
    expect(c.c2.y).toBe(c.p.y); expect(c.c2.x).toBeLessThan(c.p.x);
  });
  it("la separación de los puntos de control, con la curvatura por defecto, va entre 24 y 160", () => {
    const k = (d: number) => (curvedCmds({ x: 0, y: 0 }, E, { x: d, y: 0 }, W)[1] as { c1: { x: number } }).c1.x;
    expect(k(10)).toBe(24); expect(k(200)).toBe(100); expect(k(10_000)).toBe(160);
  });
  it("con una curvatura elegida ya no hay tope de 160 (solo el mínimo de 24) y cuanto mayor, más se separa", () => {
    const k = (cur: number) => (curvedCmds({ x: 0, y: 0 }, E, { x: 1000, y: 0 }, W, cur)[1] as { c1: { x: number } }).c1.x;
    expect(k(0.2)).toBe(200); expect(k(1)).toBe(1000); expect(k(1)).toBeGreaterThan(k(0.5));
    expect((curvedCmds({ x: 0, y: 0 }, E, { x: 10, y: 0 }, W, 0.2)[1] as { c1: { x: number } }).c1.x).toBe(24);
  });
  it("las constantes son 0,2 a 1 con 0,5 por defecto", () => { expect([CURVATURE_MIN, CURVATURE_MAX, DEFAULT_CURVATURE]).toEqual([0.2, 1, 0.5]); });
});

describe("asa de curvatura: la curvatura cuyo punto de control queda más cerca del puntero", () => {
  const a = { x: 0, y: 0 }, b = { x: 400, y: 200 };
  it("el asa está en el primer punto de control, sobre la dirección de salida", () => {
    const h = curveHandle(a, E, b, W, 0.6);
    expect(h.y).toBe(0); expect(h.x).toBeCloseTo(Math.hypot(400, 200) * 0.6, 6);
  });
  it("al soltar el asa en la posición de una curvatura se recupera esa curvatura", () => {
    for (const cur of [0.3, 0.6, 0.9]) expect(curvatureForPoint(a, E, b, W, curveHandle(a, E, b, W, cur))).toBeCloseTo(cur, 2);
  });
  it("siempre devuelve un valor dentro del rango", () => {
    expect(curvatureForPoint(a, E, b, W, { x: -5000, y: 9000 })).toBe(CURVATURE_MIN);
    expect(curvatureForPoint(a, E, b, W, { x: 5000, y: -9000 })).toBe(CURVATURE_MAX);
  });
});
