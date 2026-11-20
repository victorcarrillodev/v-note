// Eliminar la vista activa de una base, con confirmación; la última vista no se puede eliminar.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";

async function setup() {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 15, 12));
  const d = await new DatabaseService(store, clock).createDatabase({ name: "Plan" });
  if (!d.ok) throw new Error("x");
  const c = (await DatabaseController.forPage(store, clock, d.value.pageId!))!;
  await renderWithI18n(<DatabaseView controller={c} showTitle={false} />);
  return { c, user: userEvent.setup() };
}

describe("eliminar vistas", () => {
  it("con una sola vista el botón está desactivado", async () => {
    await setup();
    expect(await screen.findByRole("button", { name: "Eliminar vista" })).toBeDisabled();
  });
  it("con varias, confirma y elimina la activa", async () => {
    const { c, user } = await setup();
    await c.createView("gallery", "Galería");
    await c.setActiveView(c.getSnapshot().views[1]!.id);
    await user.click(await screen.findByRole("button", { name: "Eliminar vista" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(await (await import("@testing-library/react")).within(dialog).findByRole("button", { name: "Eliminar vista" }));
    await waitFor(() => expect(c.getSnapshot().views).toHaveLength(1));
  });
});
