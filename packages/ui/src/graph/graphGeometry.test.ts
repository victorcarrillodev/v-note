// T-367, T-368 (prueba primero): geometría del lienzo del grafo — zoom, desplazamiento, acierto de nodos y conexiones resaltadas.
import { describe, it, expect } from "vitest";
import type { GraphData } from "@vnote/core";
import { connections, fitTransform, hitNode, panBy, toScreen, toWorld, zoomAt } from "./graphGeometry";

const graph: GraphData = {
  hasLinks: true,
  nodes: ["a", "b", "c", "d"].map((id) => ({ id, title: id.toUpperCase(), kind: "note" as const, trashed: false, degree: 1 })),
  edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "a" }],
};

describe("conexiones de un nodo (T-368)", () => {
  it("devuelve vecinos en ambas direcciones y las aristas que lo tocan", () => {
    const c = connections(graph, "a");
    expect([...c.nodes].sort()).toEqual(["a", "b", "c"]);
    expect(c.edges).toEqual([0, 2]);
  });
  it("un nodo aislado solo se resalta a sí mismo", () => {
    const c = connections(graph, "d");
    expect([...c.nodes]).toEqual(["d"]);
    expect(c.edges).toEqual([]);
  });
});

describe("transformación de vista (T-367)", () => {
  it("toScreen y toWorld son inversas", () => {
    const t = { x: 30, y: -10, k: 2 };
    const p = toWorld(t, toScreen(t, { x: 5, y: 7 }));
    expect(p.x).toBeCloseTo(5); expect(p.y).toBeCloseTo(7);
  });
  it("zoomAt mantiene fijo el punto bajo el cursor y respeta los límites", () => {
    const t = { x: 0, y: 0, k: 1 };
    const z = zoomAt(t, { x: 100, y: 50 }, 2);
    expect(toWorld(z, { x: 100, y: 50 })).toEqual(toWorld(t, { x: 100, y: 50 }));
    expect(zoomAt(t, { x: 0, y: 0 }, 1000).k).toBeLessThanOrEqual(8);
    expect(zoomAt(t, { x: 0, y: 0 }, 0.00001).k).toBeGreaterThanOrEqual(0.05);
  });
  it("panBy desplaza sin cambiar el zoom", () => {
    expect(panBy({ x: 1, y: 2, k: 3 }, 10, -4)).toEqual({ x: 11, y: -2, k: 3 });
  });
  it("fitTransform encuadra todos los nodos dentro de la vista", () => {
    const pos = new Map([["a", { x: -100, y: -50 }], ["b", { x: 300, y: 150 }]]);
    const t = fitTransform(pos, { w: 800, h: 400 });
    for (const p of pos.values()) {
      const s = toScreen(t, p);
      expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThanOrEqual(800);
      expect(s.y).toBeGreaterThanOrEqual(0); expect(s.y).toBeLessThanOrEqual(400);
    }
    expect(fitTransform(new Map(), { w: 800, h: 400 })).toEqual({ x: 400, y: 200, k: 1 });
  });
});

describe("acierto de nodos (T-367)", () => {
  const pos = new Map([["a", { x: 0, y: 0 }], ["b", { x: 50, y: 0 }]]);
  it("encuentra el nodo bajo el puntero y ninguno fuera", () => {
    const t = { x: 100, y: 100, k: 1 };
    expect(hitNode(graph, pos, t, { x: 101, y: 101 })).toBe("a");
    expect(hitNode(graph, pos, t, { x: 151, y: 100 })).toBe("b");
    expect(hitNode(graph, pos, t, { x: 400, y: 400 })).toBeNull();
  });
  it("con zoom el radio de acierto crece con el nodo", () => {
    expect(hitNode(graph, pos, { x: 0, y: 0, k: 4 }, { x: 10, y: 0 })).toBe("a");
  });
});
