// backlog-b7-b11 T-2: la búsqueda combina etiquetas y fecha, con y sin texto.
import { describe, it, expect } from "vitest";
import { FakeClock, migrate, migrations, TagService, PageService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { WorkspaceController } from "../workspace/controller";

const DAY = 86_400_000;

describe("filtros de búsqueda", () => {
  it("solo quedan las páginas con la etiqueta y modificadas dentro del plazo", async () => {
    const store = await createNodeSqliteStore(":memory:");
    await migrate(store, migrations);
    const clock = new FakeClock(100 * DAY);
    const pages = new PageService(store, clock), tags = new TagService(store, clock);
    const tag = await tags.create({ name: "Examen", color: "red" });
    if (!tag.ok) throw new Error("tag");
    const make = async (title: string, tagged: boolean) => {
      const p = await pages.create({ title });
      if (!p.ok) throw new Error("page");
      if (tagged) await tags.assign(p.value.id, tag.value.id);
    };
    await make("Redes vieja", true);
    clock.set(140 * DAY);
    await make("Redes nueva", true);
    await make("Redes sin etiqueta", false);
    const controller = new WorkspaceController(store, clock);
    for (const query of ["", "Redes"]) {
      const hits = await controller.search({ query, tagIds: [tag.value.id], withinDays: 7 });
      expect(hits.map((h) => h.title)).toEqual(["Redes nueva"]);
    }
  });
});
