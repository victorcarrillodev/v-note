// U-197 y U-198 (RF-6.2): palabra clave y chips de filtro, orden y agrupación activos.
import { describe, it, expect } from "vitest";
import type { Property, QueryRow, ViewConfig } from "@vnote/core";
import { activeChips, matchesKeyword, removeChip } from "./toolbar";

const prop = (id: string, name: string, type: Property["type"] = "text"): Property => ({ id, databaseId: "d", name, type, position: id, config: {} });
const props = [prop("p1", "Estado", "status"), prop("p2", "Notas"), prop("p3", "Prioridad", "select")];
const row = (title: string, values: QueryRow["values"] = {}): QueryRow => ({ pageId: title, title, position: "a", values });

describe("matchesKeyword", () => {
  it("vacío o solo espacios deja pasar todo", () => { expect(matchesKeyword(row("A"), "  ")).toBe(true); });
  it("busca en el título sin distinguir mayúsculas ni acentos", () => {
    expect(matchesKeyword(row("Planeación Anual"), "planeacion")).toBe(true);
    expect(matchesKeyword(row("Otra"), "planeacion")).toBe(false);
  });
  it("busca en celdas de texto y en listas, pero ignora números y errores", () => {
    expect(matchesKeyword(row("A", { p2: "llamar al banco" }), "banco")).toBe(true);
    expect(matchesKeyword(row("A", { x: ["urgente", "casa"] }), "casa")).toBe(true);
    expect(matchesKeyword(row("A", { x: { error: { message: "boom" } } as never }), "boom")).toBe(false);
  });
});

describe("activeChips", () => {
  it("sin configuración no hay chips", () => { expect(activeChips({}, props)).toEqual([]); });
  it("un filtro simple, un orden y una agrupación producen un chip cada uno, con texto legible", () => {
    const cfg: ViewConfig = { filter: { type: "condition", property: "p1", op: "is", value: "done" }, sorts: [{ property: "p3", direction: "desc" }], groupBy: "p1" };
    const chips = activeChips(cfg, props);
    expect(chips.map((c) => c.kind)).toEqual(["filter", "sort", "group"]);
    expect(chips[0]!.label).toContain("Estado");
    expect(chips[1]!.label).toContain("Prioridad");
    expect(chips[2]!.label).toContain("Estado");
  });
  it("un grupo de filtros produce un chip por condición", () => {
    const cfg: ViewConfig = { filter: { type: "group", op: "and", filters: [{ type: "condition", property: "p1", op: "is", value: "a" }, { type: "condition", property: "p2", op: "contains", value: "x" }] } };
    expect(activeChips(cfg, props).filter((c) => c.kind === "filter")).toHaveLength(2);
  });
  it("una propiedad borrada aparece con un nombre neutro en vez de romper", () => {
    expect(activeChips({ sorts: [{ property: "zzz", direction: "asc" }] }, props)[0]!.label).toBeTruthy();
  });
});

describe("removeChip", () => {
  const cfg: ViewConfig = {
    filter: { type: "group", op: "and", filters: [{ type: "condition", property: "p1", op: "is", value: "a" }, { type: "condition", property: "p2", op: "contains", value: "x" }] },
    sorts: [{ property: "p3", direction: "asc" }, { property: "p2", direction: "desc" }], groupBy: "p1",
  };
  it("quitar un filtro deja el resto", () => {
    const chips = activeChips(cfg, props);
    const patch = removeChip(cfg, chips.find((c) => c.kind === "filter")!);
    expect(patch.filter).toMatchObject({ type: "condition", property: "p2" });
  });
  it("quitar el último filtro quita el campo", () => {
    const one: ViewConfig = { filter: { type: "condition", property: "p1", op: "is", value: "a" } };
    expect("filter" in removeChip(one, activeChips(one, props)[0]!) && removeChip(one, activeChips(one, props)[0]!).filter === undefined).toBe(true);
  });
  it("quitar un orden o la agrupación", () => {
    const chips = activeChips(cfg, props);
    expect(removeChip(cfg, chips.find((c) => c.kind === "sort")!).sorts).toEqual([{ property: "p2", direction: "desc" }]);
    expect(removeChip(cfg, chips.find((c) => c.kind === "group")!)).toEqual({ groupBy: undefined });
  });
});
