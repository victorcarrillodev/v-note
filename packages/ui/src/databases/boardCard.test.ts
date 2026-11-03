// U-205, U-206 (RF-6.4, CL-9, RF-14.9): etiquetas con «+N» y fecha vencida en la tarjeta.
import { describe, it, expect } from "vitest";
import type { Property, QueryRow } from "@vnote/core";
import { cardTags, dueState, MAX_TAGS } from "./boardCard";

const multi: Property = { id: "tags", databaseId: "d", name: "Etiquetas", type: "multi_select", position: "a", config: { options: ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, name: id.toUpperCase() })) } };
const row = (v: unknown): QueryRow => ({ pageId: "p", title: "T", position: "a", values: { tags: v as never } });

describe("cardTags", () => {
  it("con 6 etiquetas muestra 3 y resume el resto como +3", () => {
    const r = cardTags(row(["a", "b", "c", "d", "e", "f"]), [multi]);
    expect(MAX_TAGS).toBe(3);
    expect(r.shown.map((t) => t.name)).toEqual(["A", "B", "C"]);
    expect(r.more).toBe(3);
  });
  it("con pocas etiquetas no hay +N", () => {
    expect(cardTags(row(["a"]), [multi])).toMatchObject({ more: 0, shown: [{ name: "A" }] });
  });
  it("sin propiedad de etiquetas o sin valor, nada", () => {
    expect(cardTags(row(null), [multi])).toEqual({ shown: [], more: 0 });
    expect(cardTags(row(["a"]), [])).toEqual({ shown: [], more: 0 });
  });
  it("una opción borrada se omite en vez de mostrar su id", () => {
    expect(cardTags(row(["a", "zzz"]), [multi]).shown.map((t) => t.name)).toEqual(["A"]);
  });
});

describe("dueState", () => {
  it("antes de hoy y sin completar está vencida", () => { expect(dueState("2026-03-04", "2026-03-05", false)).toBe("overdue"); });
  it("hoy no está vencida", () => { expect(dueState("2026-03-05", "2026-03-05", false)).toBe("today"); });
  it("después de hoy es futura", () => { expect(dueState("2026-03-06T09:00", "2026-03-05", false)).toBe("future"); });
  it("una tarjeta hecha nunca está vencida", () => { expect(dueState("2026-03-01", "2026-03-05", true)).toBe("done"); });
  it("ignora la hora al comparar el día", () => { expect(dueState("2026-03-04T23:59", "2026-03-05", false)).toBe("overdue"); });
});
