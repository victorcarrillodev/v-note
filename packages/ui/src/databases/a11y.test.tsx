// U-240 (RF-14, RNF-3): auditoría axe de bases, tablero, calendarios, cronograma y modal, en claro y oscuro.
// El contraste de color se garantiza en los tokens (tokens.test.ts); jsdom no calcula estilos, por eso se desactiva aquí.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { FakeClock, migrate, migrations, DatabaseService, ViewService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";
import { TaskScheduleDialog } from "../schedule/TaskScheduleDialog";
import { PageTags } from "../tags/PageTags";
import { makeController } from "../../tests/withController";

const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("x"); return r.value as T; };
async function audit(root: Element) {
  const r = await axe.run(root, { rules: { "color-contrast": { enabled: false } }, runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 140)) }));
}
async function database(type: "table" | "list" | "gallery" | "board" | "calendar" | "timeline") {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 15, 12));
  const dbs = new DatabaseService(store, clock), views = new ViewService(store);
  const d = must(await dbs.createDatabase({ name: "Plan" }));
  const fecha = must(await dbs.addProperty(d.id, { name: "Fecha", type: "date", config: { asTask: true } }));
  const estado = must(await dbs.addProperty(d.id, { name: "Estado", type: "status" }));
  for (let i = 0; i < 4; i++) must(await dbs.addRow(d.id, { title: `Fila ${i}`, values: { [fecha.id]: { start: `2026-03-${10 + i}`, end: `2026-03-${12 + i}` }, [estado.id]: ["todo", "in_progress", "done", "todo"][i] } }));
  const v = must(await views.create(d.id, { name: type, type }));
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  await c.setActiveView(v.id);
  return await renderWithI18n(<DatabaseView controller={c} showTitle today="2026-03-15" />);
}

for (const theme of ["light", "dark"] as const) {
  describe(`accesibilidad (${theme})`, () => {
    const set = () => document.documentElement.setAttribute("data-theme", theme);
    for (const type of ["table", "list", "gallery", "board", "calendar", "timeline"] as const) {
      it(`vista ${type}`, async () => {
        set();
        const { container } = await database(type);
        await screen.findAllByRole("tab");
        expect(await audit(container)).toEqual([]);
      });
    }
    it("calendario semanal", async () => {
      set();
      const { container } = await database("calendar");
      await userEvent.click(await screen.findByRole("button", { name: "Semana" }));
      expect(await audit(container)).toEqual([]);
    });
    it("modal «Nueva tarea con horario»", async () => {
      set();
      await renderWithI18n(<TaskScheduleDialog open onOpenChange={() => {}} onSave={() => {}} nowLocal={() => "2026-03-04T10:00"} />);
      expect(await audit(await screen.findByRole("dialog"))).toEqual([]);
    });
    it("etiquetas de página", async () => {
      set();
      const { controller } = await makeController();
      const p = must(await controller.createPage(null, "Nota"));
      const t = must(await controller.tags.create({ name: "Casa", color: "green" }));
      await controller.tags.assign(p.id, t.id);
      const { container } = await renderWithI18n(<PageTags controller={controller} pageId={p.id} />);
      await screen.findByText("Casa");
      expect(await audit(container)).toEqual([]);
    });
  });
}
