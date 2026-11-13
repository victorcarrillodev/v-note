// R-033, R-034 (prueba primero): reglas puras del menú emergente (plan 004, §5.3).
import { describe, it, expect } from "vitest";
import { anchorVisible, maxMenuHeight, menuSide, MENU_HEIGHT_RATIO, MENU_OFFSET } from "./menuGeometry";

const area = { left: 100, top: 50, width: 800, height: 500 };

describe("anchorVisible", () => {
  it("un punto dentro del área visible es visible", () => { expect(anchorVisible({ x: 400, y: 300 }, area)).toBe(true); });
  it("los bordes cuentan como visibles", () => {
    expect(anchorVisible({ x: 100, y: 50 }, area)).toBe(true);
    expect(anchorVisible({ x: 900, y: 550 }, area)).toBe(true);
  });
  it("un punto fuera del área se oculta", () => {
    expect(anchorVisible({ x: 99, y: 300 }, area)).toBe(false);
    expect(anchorVisible({ x: 400, y: 551 }, area)).toBe(false);
    expect(anchorVisible({ x: 901, y: 300 }, area)).toBe(false);
    expect(anchorVisible({ x: 400, y: 49 }, area)).toBe(false);
  });
  it("sin área conocida se considera visible", () => { expect(anchorVisible({ x: -5000, y: 9 }, undefined)).toBe(true); });
  it("un rectángulo es visible si se cruza con el área", () => {
    expect(anchorVisible({ left: 80, top: 100, width: 40, height: 40 }, area)).toBe(true);
    expect(anchorVisible({ left: 0, top: 0, width: 40, height: 40 }, area)).toBe(false);
  });
});

describe("tamaño del menú (RNF-4)", () => {
  it("el alto máximo es el 40 % del alto visible", () => {
    expect(MENU_HEIGHT_RATIO).toBe(0.4);
    expect(maxMenuHeight(500)).toBe(200);
    expect(maxMenuHeight(333)).toBe(133);
  });
  it("nunca es negativo ni NaN", () => {
    expect(maxMenuHeight(-10)).toBe(0);
    expect(maxMenuHeight(NaN)).toBe(0);
  });
  it("deja una separación mínima con el elemento para no taparlo", () => { expect(MENU_OFFSET).toBeGreaterThanOrEqual(8); });
});

describe("lado del menú", () => {
  const box = (top: number) => ({ left: 400, top, width: 140, height: 60 });
  it("va arriba del elemento cuando cabe ahí", () => { expect(menuSide(box(400), area, 200)).toBe("top"); });
  it("pasa abajo cuando arriba no cabe y abajo hay más sitio (elemento cerca del borde superior)", () => { expect(menuSide(box(70), area, 200)).toBe("bottom"); });
  it("se queda arriba si abajo tampoco hay más sitio", () => { expect(menuSide(box(250), { ...area, height: 300 }, 260)).toBe("top"); });
  it("sin área conocida, arriba", () => { expect(menuSide(box(10), undefined, 200)).toBe("top"); });
});

