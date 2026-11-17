// E-089 y E-090 (RF-3.1, RNF-3): arrastre y teclado al reposicionar la portada.
import { describe, it, expect } from "vitest";
import { dragPosition, keyPosition } from "./reposition";

describe("arrastre", () => {
  const box = { w: 1000, h: 200 };
  const natural = { w: 2000, h: 1000 }; // cubre a 1000×500: sobran 300 px en vertical, 0 en horizontal
  it("solo se mueve donde sobra imagen y sigue al puntero uno a uno", () => {
    expect(dragPosition({ x: 50, y: 50 }, { dx: 400, dy: 0 }, box, natural)).toEqual({ x: 50, y: 50 });
    expect(dragPosition({ x: 50, y: 50 }, { dx: 0, dy: -30 }, box, natural)).toEqual({ x: 50, y: 60 }); // 30 px de 300 = 10 %
    expect(dragPosition({ x: 50, y: 50 }, { dx: 0, dy: 30 }, box, natural)).toEqual({ x: 50, y: 40 });
  });
  it("nunca sale de 0–100", () => {
    expect(dragPosition({ x: 50, y: 5 }, { dx: 0, dy: 500 }, box, natural).y).toBe(0);
    expect(dragPosition({ x: 50, y: 95 }, { dx: 0, dy: -500 }, box, natural).y).toBe(100);
  });
  it("sin medidas de la imagen conserva la posición", () => {
    expect(dragPosition({ x: 10, y: 20 }, { dx: 99, dy: 99 }, box, null)).toEqual({ x: 10, y: 20 });
  });
});

describe("teclado (E-090)", () => {
  it("las flechas mueven 1 %", () => {
    expect(keyPosition({ x: 50, y: 50 }, "ArrowLeft", false)).toEqual({ x: 49, y: 50 });
    expect(keyPosition({ x: 50, y: 50 }, "ArrowRight", false)).toEqual({ x: 51, y: 50 });
    expect(keyPosition({ x: 50, y: 50 }, "ArrowUp", false)).toEqual({ x: 50, y: 49 });
    expect(keyPosition({ x: 50, y: 50 }, "ArrowDown", false)).toEqual({ x: 50, y: 51 });
  });
  it("con Mayús mueven 10 %", () => {
    expect(keyPosition({ x: 50, y: 50 }, "ArrowRight", true)).toEqual({ x: 60, y: 50 });
    expect(keyPosition({ x: 50, y: 50 }, "ArrowUp", true)).toEqual({ x: 50, y: 40 });
  });
  it("respeta los límites y ignora otras teclas", () => {
    expect(keyPosition({ x: 3, y: 50 }, "ArrowLeft", true)).toEqual({ x: 0, y: 50 });
    expect(keyPosition({ x: 99, y: 50 }, "ArrowRight", true)).toEqual({ x: 100, y: 50 });
    expect(keyPosition({ x: 50, y: 50 }, "a", false)).toBeNull();
  });
});
