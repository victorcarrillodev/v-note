// T-263 (RNF-13): con 10 000 filas, recalcular tras un cambio es inmediato, y el cálculo completo cede el control sin bloquear.
import { describe, it, expect } from "vitest";
import { FormulaEngine, type EngineInput } from "./engine";
import type { PropDef } from "./dependencies";

const prop = (id: string, db: string, type: string, config: Record<string, unknown> = {}): PropDef => ({ id, name: id, databaseId: db, type, config });
const N = 10_000;
function bigModel(): EngineInput {
  const props = [
    prop("costo", "d1", "number"), prop("cant", "d1", "number"),
    prop("total", "d1", "formula", { expression: 'prop("costo") * prop("cant")' }),
    prop("iva", "d1", "formula", { expression: 'redondear(prop("total") * 0.16, 2)' }),
    prop("etq", "d1", "formula", { expression: 'si(prop("total") > 1000, "grande", "chico") + " " + texto(prop("iva"))' }),
    prop("r", "d1", "relation", { targetDatabaseId: "d2", pairedPropertyId: "rp" }), prop("rp", "d2", "relation", { targetDatabaseId: "d1", pairedPropertyId: "r" }),
    prop("h", "d2", "number"), prop("suma", "d1", "rollup", { relationPropertyId: "r", targetPropertyId: "h", fn: "sum" }),
  ];
  const rows: EngineInput["rows"] = { d1: {}, d2: {} };
  const links: EngineInput["links"] = { r: {}, rp: {} };
  for (let i = 0; i < N; i++) {
    rows.d1![`p${i}`] = { costo: i % 500, cant: (i % 7) + 1 };
    if (i < 3000) { rows.d2![`t${i}`] = { h: i % 10 }; links.r![`p${i}`] = [`t${i}`]; links.rp![`t${i}`] = [`p${i}`]; }
  }
  return { props, rows, links, now: () => Date.UTC(2026, 2, 5) };
}

describe(`${N} filas (RNF-13)`, () => {
  it("el cálculo completo cede el control en tramos cortos (la interfaz no se congela) y termina en pocos segundos", async () => {
    const e = new FormulaEngine(bigModel());
    const slices: number[] = [];
    let last = performance.now();
    const t0 = last;
    await e.computeAll({ chunk: 1000, onYield: () => { const now = performance.now(); slices.push(now - last); last = now; } });
    const total = performance.now() - t0;
    const longest = Math.max(...slices);
    console.log(`computeAll ${N} filas: ${total.toFixed(0)} ms en ${slices.length} tramos; el más largo ${longest.toFixed(1)} ms`);
    expect(slices.length).toBeGreaterThan(20);
    expect(longest).toBeLessThan(100); // ningún tramo bloquea el hilo más de 100 ms
    expect(total).toBeLessThan(5000);
    expect(e.get("d1", "p7", "total")).toBe(7 * 1);
  });
  it("tras cambiar un valor, el recálculo incremental tarda menos de 20 ms y toca solo lo afectado", async () => {
    const e = new FormulaEngine(bigModel());
    await e.computeAll();
    const t0 = performance.now();
    const r = e.setCell("d1", "p42", "costo", 9999);
    const ms = performance.now() - t0;
    console.log(`incremental: ${ms.toFixed(2)} ms, ${r.recomputed.length} celdas`);
    expect(ms).toBeLessThan(20);
    expect(r.recomputed.length).toBeLessThanOrEqual(3);
    expect(e.get("d1", "p42", "etq")).toMatch(/^grande /);
  });
  it("cambiar un valor relacionado recalcula el rollup y solo ese", async () => {
    const e = new FormulaEngine(bigModel());
    await e.computeAll();
    const t0 = performance.now();
    const r = e.setCell("d2", "t10", "h", 99);
    expect(performance.now() - t0).toBeLessThan(20);
    expect(r.recomputed.map((c) => `${c.pageId}/${c.propId}`)).toEqual(["p10/suma"]);
    expect(e.get("d1", "p10", "suma")).toBe(99);
  });
});
