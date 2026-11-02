// T-256, T-260, T-261, T-262 (prueba primero): motor de recálculo de fórmulas y rollups, incremental, cancelable y con errores aislados por celda.
import { describe, it, expect } from "vitest";
import { FormulaEngine, isErrorValue, type EngineInput } from "./engine";
import type { PropDef } from "./dependencies";

const prop = (id: string, db: string, type: string, config: Record<string, unknown> = {}, name = id): PropDef => ({ id, name, databaseId: db, type, config });
const NOW = Date.UTC(2026, 2, 5, 12, 0);

// Proyectos(d1): costo (número), cant (número), total = costo * cant (fórmula), horas = rollup suma de tareas.horas, gran = total + horas (fórmula que usa un rollup)
// Tareas(d2): h (número), h2 = h * 2 (fórmula)
function model(): EngineInput {
  return {
    props: [
      prop("costo", "d1", "number"), prop("cant", "d1", "number"),
      prop("total", "d1", "formula", { expression: 'prop("costo") * prop("cant")' }),
      prop("r", "d1", "relation", { targetDatabaseId: "d2", pairedPropertyId: "rp" }), prop("rp", "d2", "relation", { targetDatabaseId: "d1", pairedPropertyId: "r" }),
      prop("h", "d2", "number"), prop("h2", "d2", "formula", { expression: 'prop("h") * 2' }),
      prop("horas", "d1", "rollup", { relationPropertyId: "r", targetPropertyId: "h2", fn: "sum" }),
      prop("gran", "d1", "formula", { expression: 'prop("total") + prop("horas")' }),
    ],
    rows: {
      d1: { p1: { costo: 10, cant: 2 }, p2: { costo: 5, cant: 0 }, p3: { costo: 7, cant: 1 } },
      d2: { t1: { h: 1 }, t2: { h: 2 }, t3: { h: 3 } },
    },
    links: { r: { p1: ["t1", "t2"], p2: ["t3"] }, rp: { t1: ["p1"], t2: ["p1"], t3: ["p2"] } },
    now: () => NOW,
  };
}
const make = async () => { const e = new FormulaEngine(model()); await e.computeAll(); return e; };

describe("cálculo completo (T-256)", () => {
  it("evalúa fórmulas sobre propiedades y rollups, cruzando bases en el orden correcto", async () => {
    const e = await make();
    expect(e.get("d1", "p1", "total")).toBe(20);
    expect(e.get("d2", "t1", "h2")).toBe(2);
    expect(e.get("d1", "p1", "horas")).toBe(6); // (1+2)*2 sobre las tareas relacionadas
    expect(e.get("d1", "p1", "gran")).toBe(26); // fórmula que usa otra fórmula y un rollup
    expect(e.get("d1", "p3", "horas")).toBe(0); // sin tareas
    expect(e.get("d1", "p3", "gran")).toBe(7);
  });
  it("un rollup puede calcular sobre una fórmula de la otra base", async () => {
    const e = await make();
    expect(e.get("d1", "p2", "horas")).toBe(6);
  });
  it("las propiedades de fecha y las automáticas se pueden usar en fórmulas", async () => {
    const m = model();
    m.props.push(prop("fecha", "d1", "date"), prop("dias", "d1", "formula", { expression: 'diffecha(prop("fecha"), hoy(), "dias")' }));
    m.rows.d1!.p1!.fecha = { start: "2026-03-10" };
    const e = new FormulaEngine(m); await e.computeAll();
    expect(e.get("d1", "p1", "dias")).toBe(5);
  });
  it("selección y estado se leen como su nombre; multi-selección, como lista; casilla, como booleano", async () => {
    const m = model();
    m.props.push(prop("sel", "d1", "select", { options: [{ id: "a", name: "Alta" }] }), prop("mul", "d1", "multi_select", { options: [{ id: "x", name: "X" }, { id: "y", name: "Y" }] }),
      prop("chk", "d1", "checkbox"), prop("f", "d1", "formula", { expression: 'prop("sel") + "/" + prop("mul") + "/" + si(prop("chk"), "sí", "no")' }));
    Object.assign(m.rows.d1!.p1!, { sel: "a", mul: ["x", "y"], chk: true });
    const e = new FormulaEngine(m); await e.computeAll();
    expect(e.get("d1", "p1", "f")).toBe("Alta/X, Y/sí");
  });
  it("el resultado fecha se guarda como {start}", async () => {
    const m = model();
    m.props.push(prop("f", "d1", "formula", { expression: 'sumarfecha(hoy(), 3, "dias")' }));
    const e = new FormulaEngine(m); await e.computeAll();
    expect(e.get("d1", "p1", "f")).toEqual({ start: "2026-03-08" });
  });
});

describe("errores por celda (T-262)", () => {
  it("una celda con error no altera las demás", async () => {
    const m = model();
    m.props.push(prop("ratio", "d1", "formula", { expression: 'prop("costo") / prop("cant")' }));
    const e = new FormulaEngine(m); await e.computeAll();
    expect(e.get("d1", "p1", "ratio")).toBe(5);
    const bad = e.get("d1", "p2", "ratio");
    expect(isErrorValue(bad)).toBe(true);
    if (isErrorValue(bad)) { expect(bad.error.code).toBe("DIV_ZERO"); expect(bad.error.message).toMatch(/cero/i); }
    expect(e.get("d1", "p3", "ratio")).toBe(7);
    expect(e.get("d1", "p2", "total")).toBe(0); // las otras fórmulas de la misma fila siguen bien
  });
  it("quien depende de una celda con error muestra un error que lo explica", async () => {
    const m = model();
    m.props.push(prop("ratio", "d1", "formula", { expression: 'prop("costo") / prop("cant")' }), prop("doble", "d1", "formula", { expression: 'prop("ratio") * 2' }));
    const e = new FormulaEngine(m); await e.computeAll();
    const v = e.get("d1", "p2", "doble");
    expect(isErrorValue(v) && v.error.message).toContain("ratio");
    expect(e.get("d1", "p1", "doble")).toBe(10);
  });
  it("una fórmula con propiedad inexistente o sintaxis inválida da error en cada fila, sin afectar al resto", async () => {
    const m = model();
    m.props.push(prop("mala", "d1", "formula", { expression: 'prop("fantasma") + 1' }), prop("rota", "d1", "formula", { expression: "1 +" }));
    const e = new FormulaEngine(m); await e.computeAll();
    expect(isErrorValue(e.get("d1", "p1", "mala"))).toBe(true);
    expect(isErrorValue(e.get("d1", "p1", "rota"))).toBe(true);
    expect(e.get("d1", "p1", "total")).toBe(20);
  });
  it("un error en una tarea se propaga al rollup de su proyecto, pero no a otros proyectos", async () => {
    const m = model();
    m.props.push(prop("inv", "d2", "formula", { expression: "1 / (prop(\"h\") - 3)" }), prop("suma", "d1", "rollup", { relationPropertyId: "r", targetPropertyId: "inv", fn: "sum" }));
    const e = new FormulaEngine(m); await e.computeAll();
    expect(isErrorValue(e.get("d1", "p2", "suma"))).toBe(true); // su tarea t3 tiene h = 3
    expect(isErrorValue(e.get("d1", "p1", "suma"))).toBe(false);
  });
});

describe("recálculo incremental (T-260)", () => {
  const cells = (r: { recomputed: { dbId: string; pageId: string; propId: string }[] }) => r.recomputed.map((c) => `${c.dbId}/${c.pageId}/${c.propId}`).sort();
  it("cambiar una celda recalcula solo lo que depende de ella", async () => {
    const e = await make();
    const r = e.setCell("d1", "p3", "costo", 100);
    expect(cells(r)).toEqual(["d1/p3/gran", "d1/p3/total"]);
    expect(e.get("d1", "p3", "total")).toBe(100);
    expect(e.get("d1", "p3", "gran")).toBe(100);
    expect(e.get("d1", "p1", "total")).toBe(20); // otras filas intactas
  });
  it("el cambio se propaga entre bases: tarea → fórmula de la tarea → rollup del proyecto → fórmula del proyecto", async () => {
    const e = await make();
    const r = e.setCell("d2", "t1", "h", 10);
    expect(cells(r)).toEqual(["d1/p1/gran", "d1/p1/horas", "d2/t1/h2"]);
    expect(e.get("d1", "p1", "horas")).toBe(24); // (10+2)*2
    expect(e.get("d1", "p1", "gran")).toBe(44);
    expect(e.get("d1", "p2", "horas")).toBe(6); // otro proyecto: sin tocar
  });
  it("si el valor recalculado no cambia, la propagación se detiene", async () => {
    const e = await make();
    const r = e.setCell("d1", "p1", "costo", 10); // mismo valor
    expect(cells(r)).toEqual(["d1/p1/total"]); // total se reevalúa pero da lo mismo, así que «gran» no
  });
  it("vincular y desvincular recalcula los rollups de ambos lados", async () => {
    const e = await make();
    const r = e.setLinks("r", "p3", ["t1"]);
    expect(cells(r)).toContain("d1/p3/horas");
    expect(e.get("d1", "p3", "horas")).toBe(2);
    expect(e.get("d1", "p3", "gran")).toBe(9);
    e.setLinks("r", "p3", []);
    expect(e.get("d1", "p3", "horas")).toBe(0);
  });
  it("añadir y quitar filas calcula la fila nueva y actualiza los rollups afectados", async () => {
    const e = await make();
    e.addRow("d2", "t4", { h: 50 });
    e.setLinks("r", "p3", ["t4"]);
    expect(e.get("d2", "t4", "h2")).toBe(100);
    expect(e.get("d1", "p3", "horas")).toBe(100);
    const r = e.removeRow("d2", "t4");
    expect(cells(r)).toContain("d1/p3/horas");
    expect(e.get("d1", "p3", "horas")).toBe(0);
  });
  it("con 1 000 filas, un cambio recalcula un puñado de celdas, no miles", async () => {
    const m = model();
    for (let i = 0; i < 1000; i++) m.rows.d1![`x${i}`] = { costo: i, cant: 2 };
    const e = new FormulaEngine(m); await e.computeAll();
    const r = e.setCell("d1", "x500", "costo", 1);
    expect(r.recomputed.length).toBeLessThanOrEqual(2);
    expect(e.get("d1", "x500", "total")).toBe(2);
  });
  it("el recálculo incremental da exactamente lo mismo que recalcularlo todo", async () => {
    const e = await make();
    e.setCell("d2", "t2", "h", 9); e.setLinks("r", "p3", ["t1", "t3"]); e.setCell("d1", "p2", "cant", 4); e.removeRow("d2", "t3");
    const snapshot = JSON.stringify(e.snapshot());
    const fresh = new FormulaEngine(e.input());
    await fresh.computeAll();
    expect(JSON.stringify(fresh.snapshot())).toBe(snapshot);
  });
});

describe("cancelación (T-261)", () => {
  it("cancelar a la mitad no deja valores a medias: los valores previos quedan intactos", async () => {
    const m = model();
    for (let i = 0; i < 5000; i++) m.rows.d1![`x${i}`] = { costo: i, cant: 2 };
    const e = new FormulaEngine(m);
    await e.computeAll();
    e.setRawCell("d1", "x10", "costo", 999); // cambia el dato sin recalcular, para que un recálculo completo sí cambie valores
    const before = JSON.stringify(e.snapshot());
    const ac = new AbortController();
    let yields = 0;
    const result = e.computeAll({ signal: ac.signal, chunk: 500, onYield: () => { if (++yields === 3) ac.abort(); } });
    await expect(result).rejects.toThrow(/cancel/i);
    expect(JSON.stringify(e.snapshot())).toBe(before); // nada cambió: ninguna fórmula quedó a medias
    expect(e.get("d1", "x10", "total")).toBe(20); // el valor viejo, completo y coherente
  });
  it("tras cancelar se puede volver a calcular y queda todo correcto", async () => {
    const m = model();
    for (let i = 0; i < 2000; i++) m.rows.d1![`x${i}`] = { costo: i, cant: 3 };
    const e = new FormulaEngine(m);
    const ac = new AbortController(); ac.abort();
    await expect(e.computeAll({ signal: ac.signal })).rejects.toThrow();
    await e.computeAll();
    expect(e.get("d1", "x7", "total")).toBe(21);
  });
  it("cede el control entre bloques para no congelar la interfaz", async () => {
    const m = model();
    for (let i = 0; i < 3000; i++) m.rows.d1![`x${i}`] = { costo: i, cant: 1 };
    let yields = 0;
    await new FormulaEngine(m).computeAll({ chunk: 500, onYield: () => { yields++; } });
    expect(yields).toBeGreaterThanOrEqual(5);
  });
});
