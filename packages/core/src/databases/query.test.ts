// T-237…T-240 (prueba primero): filtros por tipo, grupos AND/OR anidados, orden múltiple y agrupación sobre filas.
import { describe, it, expect } from "vitest";
import { applyQuery, groupRows, type Filter, type QueryRow, type Sort } from "./query";
import type { Property } from "./databaseService";
import type { CellValue } from "./values";

const prop = (id: string, type: Property["type"], config: Property["config"] = {}): Property => ({ id, databaseId: "d", name: id, type, position: id, config });
const props: Property[] = [
  prop("txt", "text"), prop("num", "number"), prop("chk", "checkbox"), prop("sel", "select", { options: [{ id: "a", name: "Alta" }, { id: "m", name: "Media" }, { id: "b", name: "Baja" }] }),
  prop("multi", "multi_select", { options: [{ id: "x", name: "X" }, { id: "y", name: "Y" }, { id: "z", name: "Z" }] }),
  prop("dt", "date"), prop("url", "url"), prop("files", "files"), prop("st", "status", { options: [{ id: "todo", name: "Por hacer" }, { id: "in_progress", name: "En curso" }, { id: "done", name: "Hecho" }] }),
  prop("cr", "created_time"),
];
let n = 0;
const row = (title: string, values: Record<string, CellValue | null> = {}): QueryRow => ({ pageId: `r${++n}`, title, position: String(n).padStart(4, "0"), values });
const ids = (rows: QueryRow[]) => rows.map((r) => r.title);
const q = (rows: QueryRow[], filter?: Filter, sorts: Sort[] = []) => ids(applyQuery(rows, props, { ...(filter ? { filter } : {}), sorts }));
const c = (property: string, op: string, value?: unknown): Filter => ({ type: "condition", property, op, value } as Filter);

describe("filtros por tipo (T-237)", () => {
  it("texto y título: es, no es, contiene (sin distinguir mayúsculas ni acentos), empieza, termina, vacío", () => {
    const rows = [row("Manzana", { txt: "Árbol frutal" }), row("Pera", { txt: "arbusto" }), row("Uva")];
    expect(q(rows, c("txt", "is", "arbusto"))).toEqual(["Pera"]);
    expect(q(rows, c("txt", "is_not", "arbusto"))).toEqual(["Manzana", "Uva"]);
    expect(q(rows, c("txt", "contains", "ARBOL"))).toEqual(["Manzana"]);
    expect(q(rows, c("txt", "not_contains", "ar"))).toEqual(["Uva"]);
    expect(q(rows, c("txt", "starts_with", "arbu"))).toEqual(["Pera"]);
    expect(q(rows, c("txt", "ends_with", "FRUTAL"))).toEqual(["Manzana"]);
    expect(q(rows, c("txt", "is_empty"))).toEqual(["Uva"]);
    expect(q(rows, c("txt", "is_not_empty"))).toEqual(["Manzana", "Pera"]);
    expect(q(rows, c("title", "contains", "er"))).toEqual(["Pera"]);
    expect(q(rows, c("title", "starts_with", "m"))).toEqual(["Manzana"]);
  });
  it("número: igual, distinto, mayor, menor, rangos y vacío (el cero no es vacío)", () => {
    const rows = [row("a", { num: 1 }), row("b", { num: 5 }), row("c", { num: 10 }), row("d", { num: 0 }), row("e")];
    expect(q(rows, c("num", "eq", 5))).toEqual(["b"]);
    expect(q(rows, c("num", "neq", 5))).toEqual(["a", "c", "d", "e"]);
    expect(q(rows, c("num", "gt", 5))).toEqual(["c"]);
    expect(q(rows, c("num", "gte", 5))).toEqual(["b", "c"]);
    expect(q(rows, c("num", "lt", 5))).toEqual(["a", "d"]);
    expect(q(rows, c("num", "lte", 1))).toEqual(["a", "d"]);
    expect(q(rows, c("num", "is_empty"))).toEqual(["e"]);
    expect(q(rows, c("num", "is_not_empty"))).toEqual(["a", "b", "c", "d"]);
  });
  it("casilla: está marcada o no (sin valor cuenta como desmarcada)", () => {
    const rows = [row("si", { chk: true }), row("no", { chk: false }), row("nada")];
    expect(q(rows, c("chk", "is", true))).toEqual(["si"]);
    expect(q(rows, c("chk", "is", false))).toEqual(["no", "nada"]);
  });
  it("selección y estado: es, no es, vacío", () => {
    const rows = [row("1", { sel: "a", st: "done" }), row("2", { sel: "b", st: "todo" }), row("3")];
    expect(q(rows, c("sel", "is", "a"))).toEqual(["1"]);
    expect(q(rows, c("sel", "is_not", "a"))).toEqual(["2", "3"]);
    expect(q(rows, c("sel", "is_empty"))).toEqual(["3"]);
    expect(q(rows, c("st", "is", "done"))).toEqual(["1"]);
    expect(q(rows, c("st", "is_not_empty"))).toEqual(["1", "2"]);
  });
  it("selección múltiple: contiene una opción, no la contiene, vacío", () => {
    const rows = [row("1", { multi: ["x", "y"] }), row("2", { multi: ["y"] }), row("3")];
    expect(q(rows, c("multi", "contains", "x"))).toEqual(["1"]);
    expect(q(rows, c("multi", "contains", "y"))).toEqual(["1", "2"]);
    expect(q(rows, c("multi", "not_contains", "x"))).toEqual(["2", "3"]);
    expect(q(rows, c("multi", "is_empty"))).toEqual(["3"]);
  });
  it("fecha: es (mismo día), antes, después, en o antes, en o después, entre y vacío", () => {
    const rows = [row("a", { dt: { start: "2026-03-01" } }), row("b", { dt: { start: "2026-03-05T10:00" } }), row("c", { dt: { start: "2026-03-10", end: "2026-03-12" } }), row("d")];
    expect(q(rows, c("dt", "is", "2026-03-05"))).toEqual(["b"]);
    expect(q(rows, c("dt", "before", "2026-03-05"))).toEqual(["a"]);
    expect(q(rows, c("dt", "after", "2026-03-05"))).toEqual(["c"]);
    expect(q(rows, c("dt", "on_or_before", "2026-03-05"))).toEqual(["a", "b"]);
    expect(q(rows, c("dt", "on_or_after", "2026-03-05"))).toEqual(["b", "c"]);
    expect(q(rows, c("dt", "between", ["2026-03-02", "2026-03-10"]))).toEqual(["b", "c"]);
    expect(q(rows, c("dt", "is_empty"))).toEqual(["d"]);
  });
  it("fechas automáticas: se filtran como fechas", () => {
    const rows = [row("a", { cr: "2026-03-01T08:00:00.000Z" }), row("b", { cr: "2026-04-01T08:00:00.000Z" })];
    expect(q(rows, c("cr", "after", "2026-03-15"))).toEqual(["b"]);
  });
  it("enlace web: como texto; archivos: vacío o no", () => {
    const f = { hash: "a".repeat(64), name: "a", size: 1 };
    const rows = [row("1", { url: "https://example.com/x", files: [f] }), row("2", { url: "https://otro.org" })];
    expect(q(rows, c("url", "contains", "example"))).toEqual(["1"]);
    expect(q(rows, c("files", "is_empty"))).toEqual(["2"]);
    expect(q(rows, c("files", "is_not_empty"))).toEqual(["1"]);
  });
  it("un operador inválido para el tipo o una propiedad inexistente no deja pasar nada y no lanza", () => {
    const rows = [row("a", { num: 1 })];
    expect(q(rows, c("num", "contains", "1"))).toEqual([]);
    expect(q(rows, c("zzz", "is", "x"))).toEqual([]);
  });
});

describe("grupos AND y OR anidados (T-238)", () => {
  const rows = [
    row("A", { num: 1, sel: "a", chk: true }), row("B", { num: 2, sel: "a", chk: false }), row("C", { num: 3, sel: "b", chk: true }), row("D", { num: 4, sel: "b", chk: false }),
  ];
  const and = (...filters: Filter[]): Filter => ({ type: "group", op: "and", filters });
  const or = (...filters: Filter[]): Filter => ({ type: "group", op: "or", filters });
  it("AND exige todas", () => expect(q(rows, and(c("sel", "is", "a"), c("chk", "is", true)))).toEqual(["A"]));
  it("OR basta con una", () => expect(q(rows, or(c("num", "eq", 1), c("num", "eq", 4)))).toEqual(["A", "D"]));
  it("anidados: (sel=a OR sel=b) AND (num>2 OR chk)", () => {
    expect(q(rows, and(or(c("sel", "is", "a"), c("sel", "is", "b")), or(c("num", "gt", 2), c("chk", "is", true))))).toEqual(["A", "C", "D"]);
  });
  it("profundidad: AND(OR(AND(x, y), z), w)", () => {
    const f = and(or(and(c("sel", "is", "a"), c("num", "lt", 2)), c("num", "eq", 4)), c("chk", "is", false));
    expect(q(rows, f)).toEqual(["D"]);
  });
  it("grupo vacío: AND vacío deja pasar todo, OR vacío no deja pasar nada", () => {
    expect(q(rows, and())).toEqual(["A", "B", "C", "D"]);
    expect(q(rows, or())).toEqual([]);
  });
  it("sin filtro devuelve todas las filas", () => expect(q(rows)).toEqual(["A", "B", "C", "D"]));
});

describe("orden múltiple (T-239)", () => {
  const rows = [row("b", { num: 2, txt: "x" }), row("a", { num: 2, txt: "y" }), row("c", { num: 1, txt: "x" }), row("d", { txt: "z" })];
  it("ascendente y descendente por una propiedad; los vacíos van siempre al final", () => {
    expect(q(rows, undefined, [{ property: "num", direction: "asc" }])).toEqual(["c", "b", "a", "d"]);
    expect(q(rows, undefined, [{ property: "num", direction: "desc" }])).toEqual(["b", "a", "c", "d"]);
  });
  it("desempates con la segunda propiedad", () => {
    expect(q(rows, undefined, [{ property: "num", direction: "asc" }, { property: "txt", direction: "desc" }])).toEqual(["c", "a", "b", "d"]);
  });
  it("por título, sin distinguir mayúsculas ni acentos", () => {
    const r = [row("Árbol"), row("zorro"), row("abeja")];
    expect(q(r, undefined, [{ property: "title", direction: "asc" }])).toEqual(["abeja", "Árbol", "zorro"]);
  });
  it("selección: por el orden de las opciones, no alfabético", () => {
    const r = [row("1", { sel: "b" }), row("2", { sel: "a" }), row("3", { sel: "m" })];
    expect(q(r, undefined, [{ property: "sel", direction: "asc" }])).toEqual(["2", "3", "1"]);
  });
  it("es estable: lo igual conserva el orden original", () => {
    const r = [row("1", { num: 1 }), row("2", { num: 1 }), row("3", { num: 1 })];
    expect(q(r, undefined, [{ property: "num", direction: "asc" }])).toEqual(["1", "2", "3"]);
    expect(q(r, undefined, [{ property: "num", direction: "desc" }])).toEqual(["1", "2", "3"]);
  });
  it("filtra y luego ordena", () => {
    expect(q(rows, c("txt", "is", "x"), [{ property: "num", direction: "desc" }])).toEqual(["b", "c"]);
  });
});

describe("agrupación (T-240)", () => {
  it("por selección: un grupo por opción en el orden de las opciones, y «sin valor» al final", () => {
    const rows = [row("1", { sel: "b" }), row("2", { sel: "a" }), row("3"), row("4", { sel: "a" })];
    const g = groupRows(rows, props, "sel");
    expect(g.map((x) => [x.key, ids(x.rows)])).toEqual([["a", ["2", "4"]], ["m", []], ["b", ["1"]], [null, ["3"]]]);
  });
  it("por estado: incluye los grupos vacíos (columnas del tablero)", () => {
    const g = groupRows([row("1", { st: "done" })], props, "st");
    expect(g.map((x) => x.key)).toEqual(["todo", "in_progress", "done"]); // «sin valor» solo aparece si hay filas sin valor
  });
  it("por casilla: marcadas y desmarcadas", () => {
    const g = groupRows([row("1", { chk: true }), row("2", { chk: false }), row("3")], props, "chk");
    expect(g.map((x) => [x.key, ids(x.rows)])).toEqual([[true, ["1"]], [false, ["2", "3"]]]);
  });
  it("por texto: un grupo por valor distinto, ordenados", () => {
    const g = groupRows([row("1", { txt: "b" }), row("2", { txt: "a" }), row("3", { txt: "b" }), row("4")], props, "txt");
    expect(g.map((x) => [x.key, ids(x.rows)])).toEqual([["a", ["2"]], ["b", ["1", "3"]], [null, ["4"]]]);
  });
  it("por fecha: un grupo por día", () => {
    const g = groupRows([row("1", { dt: { start: "2026-03-05T10:00" } }), row("2", { dt: { start: "2026-03-05" } }), row("3", { dt: { start: "2026-03-04" } })], props, "dt");
    expect(g.map((x) => [x.key, ids(x.rows)])).toEqual([["2026-03-04", ["3"]], ["2026-03-05", ["1", "2"]]]);
  });
  it("selección múltiple: una fila aparece en cada uno de sus grupos", () => {
    const g = groupRows([row("1", { multi: ["x", "y"] }), row("2", { multi: ["y"] })], props, "multi");
    expect(g.map((x) => [x.key, ids(x.rows)])).toEqual([["x", ["1"]], ["y", ["1", "2"]], ["z", []]]);
  });
  it("conserva el orden relativo de las filas dentro del grupo", () => {
    const g = groupRows([row("1", { sel: "a" }), row("2", { sel: "a" }), row("3", { sel: "a" })], props, "sel");
    expect(ids(g[0]!.rows)).toEqual(["1", "2", "3"]);
  });
});
