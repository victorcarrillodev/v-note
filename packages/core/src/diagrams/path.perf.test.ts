// G-118 (RNF-1): 200 formas y 300 conectores de 90°; mover una forma recalcula solo sus conectores y cabe en el presupuesto de 100 ms.
import { describe, it, expect } from "vitest";
import { addNode, connect, emptyDiagram, moveNode, type Diagram } from "./diagram";
import { connectorPath } from "./path";

const big = (): Diagram => {
  let d = emptyDiagram();
  for (let n = 0; n < 200; n++) d = addNode(d, { shape: n % 5 === 0 ? "decision" : "process", x: (n % 20) * 220, y: Math.floor(n / 20) * 140, id: `n${n}` }).diagram;
  const anchors = ["e", "s", "w", "n"] as const;
  for (let n = 0; n < 300; n++) {
    const a = n % 200, b = (a + 1 + (n % 37) * 5) % 200;
    if (a === b) continue;
    const r = connect(d, { node: `n${a}`, anchor: anchors[n % 4]! }, { node: `n${b}`, anchor: anchors[(n + 2) % 4]! }, { route: "orthogonal" });
    if (r.ok) d = r.value.diagram;
  }
  return d;
};

describe("rendimiento de los trazados (RNF-1, G-118)", () => {
  const d = big();
  it("el diagrama de prueba tiene 200 formas y unos 300 conectores", () => {
    expect(d.nodes).toHaveLength(200); expect(d.edges.length).toBeGreaterThanOrEqual(290);
  });
  it("calcular los 300 conectores de 90° cabe en un segundo (holgado: el uso real solo recalcula los de la forma movida)", () => {
    const t0 = performance.now();
    for (const e of d.edges) expect(connectorPath(d, e)).not.toBeNull();
    expect(performance.now() - t0).toBeLessThan(1000);
  });
  it("mover una forma con varios conectores recalcula sus rutas en menos de 100 ms", () => {
    const hub = "n42";
    let x = d;
    for (let k = 0; k < 10; k++) { const r = connect(x, { node: hub, anchor: (["e", "s", "w", "n"] as const)[k % 4]! }, { node: `n${(k * 17 + 3) % 200}`, anchor: "w" }, { route: "orthogonal" }); if (r.ok) x = r.value.diagram; }
    const moved = moveNode(x, hub, 3000, 2000);
    const touching = moved.edges.filter((e) => ("node" in e.from && e.from.node === hub) || ("node" in e.to && e.to.node === hub));
    expect(touching.length).toBeGreaterThanOrEqual(10);
    const t0 = performance.now();
    for (const e of touching) connectorPath(moved, e);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
