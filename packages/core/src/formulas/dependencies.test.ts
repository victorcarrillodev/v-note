// T-257, T-258, T-259 (prueba primero): grafo de dependencias entre propiedades calculadas, orden de cálculo y detección de ciclos.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { dependenciesOf, computeOrder, findCycle, tryAddDefinition, type PropDef } from "./dependencies";

const f = (id: string, expression: string, db = "d1"): PropDef => ({ id, name: id, databaseId: db, type: "formula", config: { expression } });
const n = (id: string, db = "d1"): PropDef => ({ id, name: id, databaseId: db, type: "number", config: {} });
const rel = (id: string, db: string, target: string): PropDef => ({ id, name: id, databaseId: db, type: "relation", config: { targetDatabaseId: target } });
const roll = (id: string, db: string, relationPropertyId: string, targetPropertyId?: string): PropDef => ({ id, name: id, databaseId: db, type: "rollup", config: { relationPropertyId, ...(targetPropertyId ? { targetPropertyId } : {}), fn: targetPropertyId ? "sum" : "count" } });

describe("dependenciesOf", () => {
  it("una fórmula depende de las propiedades de su base que cita con prop()", () => {
    const defs = [n("a"), n("b"), f("c", 'prop("a") + prop("b") * 2')];
    expect(dependenciesOf(defs[2]!, defs).sort()).toEqual(["a", "b"]);
  });
  it("ignora nombres que no existen y propiedades de otras bases", () => {
    const defs = [n("a", "d2"), f("c", 'prop("a") + prop("zzz")')];
    expect(dependenciesOf(defs[1]!, defs)).toEqual([]);
  });
  it("una fórmula con sintaxis inválida no depende de nada (el error se muestra en la celda)", () => {
    expect(dependenciesOf(f("c", "1 +"), [])).toEqual([]);
  });
  it("un rollup depende de su relación y de la propiedad que calcula", () => {
    const defs = [rel("r", "d1", "d2"), n("horas", "d2"), roll("total", "d1", "r", "horas")];
    expect(dependenciesOf(defs[2]!, defs).sort()).toEqual(["horas", "r"]);
    expect(dependenciesOf(roll("cuenta", "d1", "r"), defs)).toEqual(["r"]);
  });
  it("número, texto, relación... no dependen de nada", () => {
    expect(dependenciesOf(n("a"), [n("a")])).toEqual([]);
    expect(dependenciesOf(rel("r", "d1", "d2"), [])).toEqual([]);
  });
});

describe("orden de cálculo (T-257)", () => {
  it("las dependencias se calculan antes que quien las usa", () => {
    const defs = [n("base"), f("doble", 'prop("base") * 2'), f("cuadruple", 'prop("doble") * 2'), f("texto", 'prop("cuadruple") + "!"')];
    const r = computeOrder(defs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const pos = (id: string) => r.value.indexOf(id);
      expect(pos("doble")).toBeLessThan(pos("cuadruple"));
      expect(pos("cuadruple")).toBeLessThan(pos("texto"));
      expect(r.value).not.toContain("base"); // solo propiedades calculadas
    }
  });
  it("el orden es estable: independiente de cómo se listen las propiedades", () => {
    const a = [f("x", 'prop("y") + 1'), f("y", "1")];
    const b = [...a].reverse();
    const ra = computeOrder(a), rb = computeOrder(b);
    expect(ra.ok && rb.ok && ra.value).toEqual(rb.ok ? rb.value : null);
    expect(ra.ok && ra.value).toEqual(["y", "x"]);
  });
  it("un rollup entre bases va después de la fórmula de la que depende, aunque esté en otra base", () => {
    const defs = [rel("r", "d1", "d2"), n("horas", "d2"), f("costo", 'prop("horas") * 10', "d2"), roll("total", "d1", "r", "costo")];
    const r = computeOrder(defs);
    expect(r.ok && r.value.indexOf("costo") < r.value.indexOf("total")).toBe(true);
  });
});

describe("ciclos (T-258)", () => {
  it("una fórmula que se cita a sí misma es un ciclo", () => {
    expect(findCycle([f("a", 'prop("a") + 1')])).toEqual(["a", "a"]);
  });
  it("dos fórmulas que se citan mutuamente", () => {
    const c = findCycle([f("a", 'prop("b")'), f("b", 'prop("a")')]);
    expect(c).not.toBeNull();
    expect(new Set(c)).toEqual(new Set(["a", "b"]));
  });
  it("ciclos largos y a través de un rollup entre bases", () => {
    const defs = [rel("r", "d1", "d2"), f("a", 'prop("t")', "d2"), roll("t", "d1", "r", "a")];
    // `a` (d2) cita «t», pero «t» vive en d1: no es una propiedad de d2, así que no hay ciclo
    expect(findCycle(defs)).toBeNull();
    const circ = [rel("r", "d1", "d2"), rel("rr", "d2", "d1"), f("a", 'prop("t2")', "d2"), roll("t", "d1", "r", "a"), roll("t2", "d2", "rr", "t")];
    expect(findCycle(circ)).not.toBeNull();
  });
  it("sin ciclos devuelve null", () => {
    expect(findCycle([n("a"), f("b", 'prop("a")'), f("c", 'prop("b") + prop("a")')])).toBeNull();
  });
  it("tryAddDefinition rechaza la definición circular con un mensaje que nombra el ciclo, y acepta las demás", () => {
    const existing = [n("a"), f("b", 'prop("a") + 1')];
    const bad = tryAddDefinition(existing, f("a2", 'prop("b")'));
    expect(bad.ok).toBe(true);
    const cyc = tryAddDefinition([f("x", 'prop("y")'), f("y", "1")], { ...f("y", 'prop("x")'), id: "y" });
    expect(cyc.ok).toBe(false);
    if (!cyc.ok) { expect(cyc.error.code).toBe("CYCLE"); expect(cyc.error.message).toMatch(/circular|ciclo/i); expect(cyc.error.message).toContain("x"); }
  });
  it("tryAddDefinition también reemplaza una definición existente (editar una fórmula)", () => {
    const existing = [f("x", "1"), f("y", 'prop("x")')];
    expect(tryAddDefinition(existing, f("x", 'prop("y")')).ok).toBe(false); // x -> y -> x
    expect(tryAddDefinition(existing, f("x", "2")).ok).toBe(true);
  });
});

describe("propiedad: ninguna definición aceptada contiene un ciclo (T-259, CL-26)", () => {
  const names = ["a", "b", "c", "d", "e", "f"];
  const defArb = fc.record({
    id: fc.constantFrom(...names),
    kind: fc.constantFrom("formula", "number"),
    refs: fc.array(fc.constantFrom(...names), { maxLength: 3 }),
  });
  it("1 000 secuencias aleatorias de altas y ediciones: el conjunto aceptado siempre es acíclico y ordenable", () => {
    fc.assert(
      fc.property(fc.array(defArb, { minLength: 1, maxLength: 25 }), (ops) => {
        let accepted: PropDef[] = [];
        for (const op of ops) {
          const def = op.kind === "number" ? n(op.id) : f(op.id, op.refs.length ? op.refs.map((r) => `prop("${r}")`).join(" + ") : "1");
          const r = tryAddDefinition(accepted, def);
          if (r.ok) accepted = r.value;
          expect(findCycle(accepted)).toBeNull();
        }
        const order = computeOrder(accepted);
        expect(order.ok).toBe(true);
        if (order.ok) {
          const pos = new Map(order.value.map((id, i) => [id, i]));
          for (const p of accepted) for (const d of dependenciesOf(p, accepted)) {
            if (pos.has(p.id) && pos.has(d)) expect(pos.get(d)!).toBeLessThan(pos.get(p.id)!);
          }
        }
      }),
      { numRuns: 1000 },
    );
  });
});
