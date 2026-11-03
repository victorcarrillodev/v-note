// U-241 (RNF-2, RNF-11): tras el rediseño, la tabla con 50 000 filas y la palabra clave siguen dentro de los presupuestos de la spec 001.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import type { Property, QueryRow } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { TableView } from "./TableView";
import type { DatabaseController } from "./databaseController";
import { matchesKeyword } from "./toolbar";

const N = 50_000;
const props: Property[] = [{ id: "c", databaseId: "d", name: "Costo", type: "number", position: "a", config: {} }, { id: "n", databaseId: "d", name: "Notas", type: "text", position: "b", config: {} }];
const rows: QueryRow[] = Array.from({ length: N }, (_, i) => ({ pageId: `p${i}`, title: `Fila ${i}${i % 97 === 0 ? " urgente" : ""}`, position: String(i).padStart(6, "0"), values: { c: (i * 37) % 1000, n: `nota ${i}` } }));
const snapshot = { database: { id: "d", name: "Grande" }, properties: props, views: [], activeViewId: null, keyword: "", result: { rows, groups: null, visibleProperties: ["c", "n"], properties: props, view: {} } };
const fake = { subscribe: () => () => {}, getSnapshot: () => snapshot } as unknown as DatabaseController;

describe("rendimiento de la interfaz con 50 000 filas", () => {
  it("la tabla se pinta en menos de 2 s y solo monta las filas visibles", async () => {
    const t0 = performance.now();
    await renderWithI18n(<TableView controller={fake} height={480} />);
    const ms = performance.now() - t0;
    expect(await screen.findByRole("status", { name: "Conteo de filas" })).toHaveTextContent("50000 filas");
    expect(document.querySelectorAll('[role="row"]').length).toBeLessThan(80);
    expect(ms).toBeLessThan(2000);
  });
  it("la palabra clave recorre 50 000 filas en menos de 500 ms", () => {
    const t0 = performance.now();
    const out = rows.filter((r) => matchesKeyword(r, "urgente"));
    const ms = performance.now() - t0;
    expect(out.length).toBeGreaterThan(400);
    expect(ms).toBeLessThan(500);
  });
});
