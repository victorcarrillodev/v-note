// G-009, G-010 (prueba primero): geometría pura de los diagramas.
import { describe, it, expect } from "vitest";
import { dist, lerp, pointOnSegment, segmentLength, segmentBoxIntersections, segmentCrossesBoxInterior, segmentPolygonIntersections, inflate, boxContains } from "./geometry";

describe("distancia y segmentos", () => {
  it("distancia, interpolación y longitud con casos conocidos", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(pointOnSegment({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
    expect(pointOnSegment({ x: 0, y: 0 }, { x: 10, y: 20 }, 0)).toEqual({ x: 0, y: 0 });
    expect(pointOnSegment({ x: 0, y: 0 }, { x: 10, y: 20 }, 1)).toEqual({ x: 10, y: 20 });
    expect(segmentLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11);
  });
  it("una lista vacía o de un punto mide cero", () => {
    expect(segmentLength([])).toBe(0);
    expect(segmentLength([{ x: 1, y: 1 }])).toBe(0);
  });
});

describe("cajas", () => {
  const box = { x: 0, y: 0, w: 100, h: 50 };
  it("ampliar una caja y comprobar si contiene un punto (borde incluido)", () => {
    expect(inflate(box, 10)).toEqual({ x: -10, y: -10, w: 120, h: 70 });
    expect(boxContains(box, { x: 100, y: 50 })).toBe(true);
    expect(boxContains(box, { x: 101, y: 50 })).toBe(false);
  });
  it("un segmento que atraviesa la caja corta su contorno en dos puntos", () => {
    const hits = segmentBoxIntersections({ x: -50, y: 25 }, { x: 150, y: 25 }, box);
    expect(hits).toEqual([{ x: 0, y: 25 }, { x: 100, y: 25 }]);
  });
  it("un segmento que sale desde dentro corta el contorno una vez", () => {
    expect(segmentBoxIntersections({ x: 50, y: 25 }, { x: 150, y: 25 }, box)).toEqual([{ x: 100, y: 25 }]);
  });
  it("un segmento que no toca la caja no tiene cortes", () => {
    expect(segmentBoxIntersections({ x: -50, y: -10 }, { x: 150, y: -10 }, box)).toEqual([]);
  });
  it("cruza el interior solo si entra de verdad (tocar el borde no cuenta)", () => {
    expect(segmentCrossesBoxInterior({ x: -50, y: 25 }, { x: 150, y: 25 }, box)).toBe(true);
    expect(segmentCrossesBoxInterior({ x: -50, y: 0 }, { x: 150, y: 0 }, box)).toBe(false); // roza el borde de arriba
    expect(segmentCrossesBoxInterior({ x: 100, y: -20 }, { x: 100, y: 80 }, box)).toBe(false); // corre por el borde derecho
    expect(segmentCrossesBoxInterior({ x: 150, y: 25 }, { x: 200, y: 25 }, box)).toBe(false);
    expect(segmentCrossesBoxInterior({ x: 50, y: 10 }, { x: 50, y: 20 }, box)).toBe(true); // entero dentro
  });
});

describe("contornos poligonales", () => {
  const diamond = [{ x: 50, y: 0 }, { x: 100, y: 25 }, { x: 50, y: 50 }, { x: 0, y: 25 }];
  it("de centro a una esquina de la caja corta el rombo en el punto medio del lado", () => {
    const hits = segmentPolygonIntersections({ x: 50, y: 25 }, { x: 100, y: 0 }, diamond);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.x).toBeCloseTo(75, 6);
    expect(hits[0]!.y).toBeCloseTo(12.5, 6);
  });
  it("un segmento fuera del polígono no lo corta", () => {
    expect(segmentPolygonIntersections({ x: 0, y: 0 }, { x: 10, y: 0 }, diamond)).toEqual([]);
  });
  it("un segmento paralelo a un lado y separado de él no lo corta", () => {
    expect(segmentPolygonIntersections({ x: 0, y: -5 }, { x: 100, y: -5 }, diamond)).toEqual([]);
  });
});
