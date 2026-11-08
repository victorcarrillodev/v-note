// G-011 a G-018 (prueba primero): los ocho anclajes de cada forma, su dirección y la búsqueda del más cercano.
import { describe, it, expect } from "vitest";
import { ANCHORS, anchorPosition, anchorOutline, anchorDirection, nearestAnchor, type ShapeBox } from "./anchors";

const at = (shape: ShapeBox["shape"], w = 140, h = 60, x = 0, y = 0): ShapeBox => ({ shape, x, y, w, h });
const near = (a: { x: number; y: number }, b: { x: number; y: number }) => { expect(a.x).toBeCloseTo(b.x, 6); expect(a.y).toBeCloseTo(b.y, 6); };

describe("constantes", () => {
  it("hay exactamente ocho anclajes con nombre", () => {
    expect([...ANCHORS]).toEqual(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);
  });
});

describe("proceso y nota: centros de lado y esquinas", () => {
  for (const shape of ["process", "note"] as const) {
    it(`${shape}: valores exactos en dos tamaños`, () => {
      const b = at(shape, 140, 60, 10, 20);
      expect(anchorPosition(b, "n")).toEqual({ x: 80, y: 20 });
      expect(anchorPosition(b, "ne")).toEqual({ x: 150, y: 20 });
      expect(anchorPosition(b, "e")).toEqual({ x: 150, y: 50 });
      expect(anchorPosition(b, "se")).toEqual({ x: 150, y: 80 });
      expect(anchorPosition(b, "s")).toEqual({ x: 80, y: 80 });
      expect(anchorPosition(b, "sw")).toEqual({ x: 10, y: 80 });
      expect(anchorPosition(b, "w")).toEqual({ x: 10, y: 50 });
      expect(anchorPosition(b, "nw")).toEqual({ x: 10, y: 20 });
      const c = at(shape, 40, 24);
      expect(anchorPosition(c, "se")).toEqual({ x: 40, y: 24 });
    });
  }
});

describe("inicio/fin: esquinas proyectadas sobre el arco", () => {
  it("los centros de lado son los de la caja", () => {
    const b = at("terminator", 140, 50);
    expect(anchorPosition(b, "n")).toEqual({ x: 70, y: 0 });
    expect(anchorPosition(b, "e")).toEqual({ x: 140, y: 25 });
    expect(anchorPosition(b, "s")).toEqual({ x: 70, y: 50 });
    expect(anchorPosition(b, "w")).toEqual({ x: 0, y: 25 });
  });
  it("las cuatro esquinas están a 45° sobre el arco de radio h/2", () => {
    const b = at("terminator", 140, 50);
    const k = 25 * Math.SQRT1_2;
    near(anchorPosition(b, "ne"), { x: 115 + k, y: 25 - k });
    near(anchorPosition(b, "se"), { x: 115 + k, y: 25 + k });
    near(anchorPosition(b, "sw"), { x: 25 - k, y: 25 + k });
    near(anchorPosition(b, "nw"), { x: 25 - k, y: 25 - k });
  });
});

describe("decisión (rombo)", () => {
  it("n, e, s, w son los vértices y las esquinas, los puntos medios de los lados", () => {
    const b = at("decision", 140, 80);
    expect(anchorPosition(b, "n")).toEqual({ x: 70, y: 0 });
    expect(anchorPosition(b, "e")).toEqual({ x: 140, y: 40 });
    expect(anchorPosition(b, "s")).toEqual({ x: 70, y: 80 });
    expect(anchorPosition(b, "w")).toEqual({ x: 0, y: 40 });
    expect(anchorPosition(b, "ne")).toEqual({ x: 70 + 140 / 4, y: 40 - 80 / 4 });
    expect(anchorPosition(b, "se")).toEqual({ x: 70 + 140 / 4, y: 40 + 80 / 4 });
    expect(anchorPosition(b, "sw")).toEqual({ x: 70 - 140 / 4, y: 40 + 80 / 4 });
    expect(anchorPosition(b, "nw")).toEqual({ x: 70 - 140 / 4, y: 40 - 80 / 4 });
  });
});

describe("entrada/salida (paralelogramo de 15°)", () => {
  it("las esquinas son los vértices y e/w el punto medio del lado inclinado", () => {
    const b = at("io", 140, 60);
    const s = 60 * Math.tan((15 * Math.PI) / 180);
    near(anchorPosition(b, "nw"), { x: s, y: 0 });
    near(anchorPosition(b, "ne"), { x: 140, y: 0 });
    near(anchorPosition(b, "se"), { x: 140 - s, y: 60 });
    near(anchorPosition(b, "sw"), { x: 0, y: 60 });
    near(anchorPosition(b, "n"), { x: 70 + s / 2, y: 0 });
    near(anchorPosition(b, "s"), { x: 70 - s / 2, y: 60 });
    near(anchorPosition(b, "e"), { x: 140 - s / 2, y: 30 });
    near(anchorPosition(b, "w"), { x: s / 2, y: 30 });
  });
});

describe("todos los anclajes están sobre el contorno real, también con tamaño mínimo y proporciones extremas", () => {
  const sizes: [number, number][] = [[40, 24], [40, 200], [400, 24], [140, 60]];
  for (const shape of ["process", "note", "terminator", "decision", "io"] as const) {
    it(`${shape}: ocho puntos distintos y sobre el contorno`, () => {
      for (const [w, h] of sizes) {
        const b = at(shape, w, h, 5, 7);
        const pts = ANCHORS.map((a) => anchorPosition(b, a));
        expect(new Set(pts.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)).size).toBe(8);
        const outline = anchorOutline(b);
        for (const p of pts) {
          // distancia mínima del punto a algún lado del contorno
          let best = Infinity;
          for (let i = 0; i < outline.length; i++) {
            const a = outline[i]!, c = outline[(i + 1) % outline.length]!;
            const dx = c.x - a.x, dy = c.y - a.y, l2 = dx * dx + dy * dy;
            const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
            best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
          }
          // el terminador es curvo: su contorno poligonal aproxima el arco, se tolera una fracción de unidad
          expect(best).toBeLessThan(shape === "terminator" ? 0.6 : 1e-6);
        }
      }
    });
  }
});

describe("dirección de salida", () => {
  it("los cuatro lados tienen dirección fija hacia afuera", () => {
    expect(anchorDirection("n")).toEqual({ x: 0, y: -1 });
    expect(anchorDirection("e")).toEqual({ x: 1, y: 0 });
    expect(anchorDirection("s")).toEqual({ x: 0, y: 1 });
    expect(anchorDirection("w")).toEqual({ x: -1, y: 0 });
  });
  it("las esquinas eligen el eje dominante según la posición del otro extremo", () => {
    expect(anchorDirection("ne", { x: 100, y: 10 })).toEqual({ x: 1, y: 0 });   // el otro está sobre todo a la derecha
    expect(anchorDirection("ne", { x: 10, y: -100 })).toEqual({ x: 0, y: -1 }); // sobre todo arriba
    expect(anchorDirection("sw", { x: -100, y: 10 })).toEqual({ x: -1, y: 0 });
    expect(anchorDirection("sw", { x: -10, y: 100 })).toEqual({ x: 0, y: 1 });
    expect(anchorDirection("se", { x: 50, y: 50 })).toEqual({ x: 1, y: 0 });    // empate → horizontal
  });
  it("una esquina sin referencia usa su eje horizontal", () => {
    expect(anchorDirection("nw")).toEqual({ x: -1, y: 0 });
    expect(anchorDirection("se")).toEqual({ x: 1, y: 0 });
  });
});

describe("nearestAnchor", () => {
  const shapes = [{ id: "a", ...at("process", 100, 50, 0, 0) }, { id: "b", ...at("process", 100, 50, 300, 0) }];
  it("devuelve el anclaje más cercano dentro del radio", () => {
    const r = nearestAnchor(shapes, { x: 98, y: 26 }, 16);
    expect(r).toMatchObject({ node: "a", anchor: "e" });
    expect(r!.distance).toBeCloseTo(Math.hypot(2, 1), 6);
  });
  it("fuera del radio no devuelve nada", () => {
    expect(nearestAnchor(shapes, { x: 200, y: 25 }, 16)).toBeNull();
  });
  it("con empate gana la forma que se dibuja más arriba (la última de la lista)", () => {
    const stacked = [{ id: "a", ...at("process", 100, 50, 0, 0) }, { id: "b", ...at("process", 100, 50, 0, 0) }];
    expect(nearestAnchor(stacked, { x: 100, y: 25 }, 16)).toMatchObject({ node: "b", anchor: "e" });
  });
  it("puede excluir una forma (para no unir un extremo con su propia forma a sí mismo)", () => {
    expect(nearestAnchor(shapes, { x: 100, y: 25 }, 16, "a")).toBeNull();
  });
});
