// U-156 y U-157 (RF-5.4): menú «/» con grupos nombrados, ícono, nombre, descripción y atajo; filtrado, vacío.
import { describe, it, expect } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { schema } from "./schema";
import { buildSlashItems } from "./slashItems";

const t = (k: string) => k;
const make = () => BlockNoteEditor.create({ schema });

describe("menú «/»", () => {
  it("todos los elementos tienen grupo, título, descripción e ícono", () => {
    const items = buildSlashItems(make(), t, "");
    expect(items.length).toBeGreaterThan(10);
    for (const i of items) {
      expect(i.group, i.title).toBeTruthy();
      expect(i.title, i.title).toBeTruthy();
      expect(i.subtext, i.title).toBeTruthy();
      expect(i.icon, i.title).toBeTruthy();
    }
  });
  it("hay varios grupos con nombre y los elementos de un grupo van juntos", () => {
    const groups = buildSlashItems(make(), t, "").map((i) => i.group);
    const unique = [...new Set(groups)];
    expect(unique.length).toBeGreaterThanOrEqual(3);
    const seen = new Set<string>();
    let prev = "";
    for (const g of groups) { if (g !== prev) { expect(seen.has(g!), `grupo repetido ${g}`).toBe(false); seen.add(g!); prev = g!; } }
  });
  it("los bloques de texto básicos muestran su atajo", () => {
    const items = buildSlashItems(make(), t, "");
    expect(items.some((i) => typeof i.badge === "string" && i.badge.length > 0)).toBe(true);
  });
  it("filtra por título y por alias", () => {
    const e = make();
    expect(buildSlashItems(e, t, "tarea").map((i) => i.title)).toContain("task.slash");
    expect(buildSlashItems(e, t, "callout").map((i) => i.title)).toContain("editor.callout");
  });
  it("sin coincidencias devuelve un único elemento informativo que no hace nada", () => {
    const items = buildSlashItems(make(), t, "zzzzzzzz");
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("editor.noResults");
    expect(() => items[0]!.onItemClick()).not.toThrow();
  });
});
