// R-012 a R-015 (prueba primero): acomodo a la cuadrícula (plan 004, §7.1).
import { describe, it, expect } from "vitest";
import { GRID, snap, snapPoint, snapBox, snapOffset } from "./grid";

describe("snap (R-012)", () => {
  it("la cuadrícula es de 20", () => { expect(GRID).toBe(20); });
  it("acomoda al múltiplo más cercano", () => {
    expect(snap(0)).toBe(0);
    expect(snap(9)).toBe(0);
    expect(snap(11)).toBe(20);
    expect(snap(40)).toBe(40);
    expect(snap(41.9)).toBe(40);
  });
  it("las medias suben (hacia +∞) y nunca devuelve -0", () => {
    expect(snap(10)).toBe(20);
    expect(snap(-10)).toBe(0);
    expect(Object.is(snap(-10), -0)).toBe(false);
    expect(snap(-9)).toBe(0);
    expect(Object.is(snap(-3), -0)).toBe(false);
  });
  it("con negativos", () => {
    expect(snap(-11)).toBe(-20);
    expect(snap(-35)).toBe(-40);
    expect(snap(-40)).toBe(-40);
  });
  it("acepta otra separación", () => { expect(snap(33, 10)).toBe(30); });
  it("un valor no finito se devuelve sin cambios", () => {
    expect(Number.isNaN(snap(NaN))).toBe(true);
    expect(snap(Infinity)).toBe(Infinity);
  });
});

describe("snapPoint (R-013)", () => {
  it("acomoda ambos ejes", () => { expect(snapPoint({ x: 13, y: 47 })).toEqual({ x: 20, y: 40 }); });
  it("un punto ya acomodado no cambia", () => { expect(snapPoint({ x: 60, y: -20 })).toEqual({ x: 60, y: -20 }); });
});

describe("snapBox (R-014, CL-16)", () => {
  const min = { w: 40, h: 24 };
  it("acomoda la esquina y los bordes", () => {
    expect(snapBox({ x: 13, y: 22, w: 137, h: 58 }, min)).toEqual({ x: 20, y: 20, w: 140, h: 60 });
  });
  it("el borde derecho e inferior son múltiplos de la cuadrícula", () => {
    const b = snapBox({ x: 7, y: 7, w: 101, h: 77 }, min);
    expect((b.x + b.w) % GRID).toBe(0);
    expect((b.y + b.h) % GRID).toBe(0);
  });
  it("respeta el tamaño mínimo y, si no es múltiplo, sube al siguiente", () => {
    const b = snapBox({ x: 0, y: 0, w: 10, h: 10 }, min);
    expect(b).toEqual({ x: 0, y: 0, w: 40, h: 40 });   // h mínimo 24 → 40
    expect(b.w).toBeGreaterThanOrEqual(min.w);
    expect(b.h).toBeGreaterThanOrEqual(min.h);
  });
  it("con un mínimo mayor que la celda se acomoda al punto más cercano sin bajar del mínimo", () => {
    const b = snapBox({ x: 31, y: 29, w: 45, h: 30 }, { w: 45, h: 30 });
    expect(b.w).toBeGreaterThanOrEqual(45);
    expect(b.h).toBeGreaterThanOrEqual(30);
    expect(b.x % GRID).toBe(0);
    expect(b.y % GRID).toBe(0);
  });
  it("una caja ya acomodada no cambia", () => {
    const b = { x: 40, y: 60, w: 140, h: 60 };
    expect(snapBox(b, min)).toEqual(b);
  });
});

describe("snapOffset (R-015, CL-17)", () => {
  it("devuelve el desplazamiento que deja la posición efectiva en la cuadrícula", () => {
    const base = { x: 13, y: 7 };           // distribución automática + desplazamientos de los ancestros
    const off = snapOffset({ x: 55, y: 31 }, base);
    expect(off).toEqual({ x: 47, y: 33 });
    expect((base.x + off.x) % GRID).toBe(0);
    expect((base.y + off.y) % GRID).toBe(0);
  });
  it("con la base ya en la cuadrícula el desplazamiento es múltiplo", () => {
    expect(snapOffset({ x: 58, y: -23 }, { x: 40, y: 0 })).toEqual({ x: 20, y: -20 });
  });
  it("sin -0 en los resultados", () => {
    const o = snapOffset({ x: 3, y: 4 }, { x: 0, y: 0 });
    expect(Object.is(o.x, -0) || Object.is(o.y, -0)).toBe(false);
  });
});
