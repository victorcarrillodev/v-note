// T-347, T-348, T-350 (prueba primero): línea de tiempo (orden y empates) y matriz comparativa (incluida la 2×2).
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { emptyTimeline, addEvent, moveEvent, renameEvent, deleteEvent, sortedEvents, placeEvents, serializeTimeline, parseTimeline, timelineText, EVENT_W, type Timeline } from "./timeline";
import { emptyMatrix, template2x2, addRow, addCol, renameRow, renameCol, deleteRow, deleteCol, addItem, editItem, moveItem, deleteItem, serializeMatrix, parseMatrix, matrixText } from "./matrix";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

describe("línea de tiempo: orden cronológico (T-347)", () => {
  it("los eventos agregados en desorden se ordenan por fecha", () => {
    let t = emptyTimeline();
    for (const [d, n] of [["2026-05-10", "C"], ["2026-01-02", "A"], ["2026-03-15", "B"]] as const) t = must(addEvent(t, { date: d, title: n })).timeline;
    expect(sortedEvents(t).map((e) => e.title)).toEqual(["A", "B", "C"]);
  });
  it("rechaza fechas inexistentes o con formato raro", () => {
    for (const bad of ["2026-02-30", "ayer", "2026-13-01", "2026-3-5", ""]) expect(addEvent(emptyTimeline(), { date: bad, title: "x" }).ok, bad).toBe(false);
  });
  it("renombrar y eliminar", () => {
    let t = must(addEvent(emptyTimeline(), { date: "2026-01-01", title: "Uno", id: "e1" })).timeline;
    t = renameEvent(t, "e1", "Dos"); expect(t.events[0]!.title).toBe("Dos");
    expect(deleteEvent(t, "e1").events).toEqual([]);
  });
  it("mover un evento a otra fecha lo reordena (arrastrar cambia la fecha)", () => {
    let t = emptyTimeline();
    for (const [d, n, id] of [["2026-01-01", "A", "a"], ["2026-02-01", "B", "b"], ["2026-03-01", "C", "c"]] as const) t = must(addEvent(t, { date: d, title: n, id })).timeline;
    t = must(moveEvent(t, "a", "2026-04-01"));
    expect(sortedEvents(t).map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(moveEvent(t, "a", "basura").ok).toBe(false);
    expect(moveEvent(t, "zzz", "2026-01-01").ok).toBe(false);
  });
  it("ida y vuelta; datos dañados se rechazan", () => {
    const t = must(addEvent(emptyTimeline(), { date: "2026-01-01", title: "ñandú", id: "e1" })).timeline;
    expect(must(parseTimeline(serializeTimeline(t)))).toEqual(t);
    for (const bad of ["{ roto", "[]", '{"events":[{"id":"a","date":"x","title":"t"}]}']) expect(parseTimeline(bad).ok, bad).toBe(false);
    expect(must(parseTimeline(""))).toEqual(emptyTimeline());
    expect(timelineText(t)).toContain("ñandú");
  });
});

describe("línea de tiempo: empates estables y sin solaparse (T-348, CL-10)", () => {
  it("dos eventos en la misma fecha se muestran ambos, en el orden en que se agregaron, en carriles distintos", () => {
    let t = emptyTimeline();
    t = must(addEvent(t, { date: "2026-03-01", title: "Primero", id: "p" })).timeline;
    t = must(addEvent(t, { date: "2026-03-01", title: "Segundo", id: "s" })).timeline;
    expect(sortedEvents(t).map((e) => e.id)).toEqual(["p", "s"]);
    const pl = placeEvents(t);
    expect(pl.map((p) => p.id)).toEqual(["p", "s"]);
    expect(pl[0]!.lane).not.toBe(pl[1]!.lane);
  });
  it("el orden de los empates es estable aunque se reordene el resto", () => {
    let t = emptyTimeline();
    for (const id of ["a", "b", "c", "d"]) t = must(addEvent(t, { date: "2026-03-01", title: id, id })).timeline;
    t = must(addEvent(t, { date: "2026-01-01", title: "antes", id: "z" })).timeline;
    expect(sortedEvents(t).map((e) => e.id)).toEqual(["z", "a", "b", "c", "d"]);
  });
  it("eventos lejanos comparten carril; los cercanos se reparten sin tocarse", () => {
    let t = emptyTimeline();
    t = must(addEvent(t, { date: "2026-01-01", title: "a", id: "a" })).timeline;
    t = must(addEvent(t, { date: "2026-12-01", title: "b", id: "b" })).timeline;
    expect(new Set(placeEvents(t).map((p) => p.lane)).size).toBe(1);
  });
  it("propiedad: nunca hay dos eventos solapados en el mismo carril, y las x respetan el orden de las fechas", () => {
    const date = fc.record({ m: fc.integer({ min: 1, max: 12 }), d: fc.integer({ min: 1, max: 28 }) }).map(({ m, d }) => `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    fc.assert(fc.property(fc.array(date, { minLength: 1, maxLength: 60 }), (dates) => {
      let t: Timeline = emptyTimeline();
      dates.forEach((d, i) => { t = must(addEvent(t, { date: d, title: `e${i}`, id: `e${i}` })).timeline; });
      const pl = placeEvents(t);
      expect(pl).toHaveLength(dates.length);
      for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) {
        if (pl[i]!.lane === pl[j]!.lane) expect(Math.abs(pl[i]!.x - pl[j]!.x)).toBeGreaterThanOrEqual(EVENT_W);
      }
      for (let i = 1; i < pl.length; i++) expect(pl[i]!.x).toBeGreaterThanOrEqual(pl[i - 1]!.x);
    }), { numRuns: 200 });
  });
});

describe("matriz comparativa (T-350)", () => {
  it("la plantilla 2×2 trae sus cuatro cuadrantes", () => {
    const m = template2x2();
    expect(m.rows.map((r) => r.title)).toEqual(["Importante", "No importante"]);
    expect(m.cols.map((c) => c.title)).toEqual(["Urgente", "No urgente"]);
  });
  it("una matriz vacía arranca con una fila y una columna", () => {
    const m = emptyMatrix();
    expect(m.rows).toHaveLength(1); expect(m.cols).toHaveLength(1);
  });
  it("agregar, renombrar y eliminar filas y columnas; eliminar informa cuántos elementos se fueron", () => {
    let m = template2x2();
    m = must(addRow(m, "Tal vez", "r3")); m = must(addCol(m, "Nunca", "c3"));
    expect(m.rows).toHaveLength(3); expect(m.cols).toHaveLength(3);
    m = renameRow(m, "r3", "Quizá"); m = renameCol(m, "c3", "Jamás");
    expect(m.rows[2]!.title).toBe("Quizá"); expect(m.cols[2]!.title).toBe("Jamás");
    m = must(addItem(m, "r3", "c3", "algo", "i1")).matrix;
    const r = must(deleteRow(m, "r3"));
    expect(r.removedItems).toBe(1); expect(r.matrix.items).toEqual([]);
    expect(must(deleteCol(r.matrix, "c3")).removedItems).toBe(0);
  });
  it("no se puede eliminar la última fila ni la última columna", () => {
    const m = emptyMatrix();
    expect(deleteRow(m, m.rows[0]!.id).ok).toBe(false);
    expect(deleteCol(m, m.cols[0]!.id).ok).toBe(false);
  });
  it("agregar elementos a una celda, editarlos, moverlos entre celdas y eliminarlos", () => {
    let m = template2x2();
    const [r1, r2] = m.rows.map((r) => r.id) as [string, string]; const [c1, c2] = m.cols.map((c) => c.id) as [string, string];
    m = must(addItem(m, r1, c1, "Pagar impuestos", "i1")).matrix;
    m = must(addItem(m, r1, c1, "Llamar al banco", "i2")).matrix;
    expect(m.items.filter((i) => i.row === r1 && i.col === c1).map((i) => i.id)).toEqual(["i1", "i2"]);
    m = editItem(m, "i1", "Pagar ISR"); expect(m.items[0]!.text).toBe("Pagar ISR");
    m = must(moveItem(m, "i2", r2, c2));
    expect(m.items.find((i) => i.id === "i2")).toMatchObject({ row: r2, col: c2 });
    m = deleteItem(m, "i1"); expect(m.items.map((i) => i.id)).toEqual(["i2"]);
    expect(addItem(m, "zzz", c1, "x").ok).toBe(false);
    expect(moveItem(m, "i2", "zzz", c1).ok).toBe(false);
  });
  it("ida y vuelta, datos dañados y texto para búsqueda", () => {
    let m = template2x2(); m = must(addItem(m, m.rows[0]!.id, m.cols[0]!.id, "Entregar informe", "i1")).matrix;
    expect(must(parseMatrix(serializeMatrix(m)))).toEqual(m);
    expect(parseMatrix("{ roto").ok).toBe(false);
    expect(parseMatrix(JSON.stringify({ rows: [], cols: [], items: [] })).ok).toBe(false); // sin filas ni columnas
    expect(parseMatrix(JSON.stringify({ rows: [{ id: "r", title: "" }], cols: [{ id: "c", title: "" }], items: [{ id: "i", text: "t", row: "zz", col: "c" }] })).ok).toBe(false);
    const text = matrixText(m);
    for (const w of ["Importante", "Urgente", "Entregar informe"]) expect(text).toContain(w);
  });
});
