// backlog-b7-b11 T-3: la página muestra quién la enlaza, también desde formas del lienzo.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as Y from "yjs";
import { addNode, emptyDiagram, FakeClock, migrate, migrations, PageService, serializeDiagram, setNodePage, toYjs } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { WorkspaceController } from "../workspace/controller";
import { Backlinks } from "./Backlinks";

describe("retroenlaces", () => {
  it("una forma enlazada hace aparecer la página de origen y abrirla navega", async () => {
    const store = await createNodeSqliteStore(":memory:");
    await migrate(store, migrations);
    const clock = new FakeClock(1_000);
    const pages = new PageService(store, clock);
    const target = await pages.create({ title: "Destino" });
    const source = await pages.create({ title: "Lienzo" });
    if (!target.ok || !source.ok) throw new Error("create");
    const node = addNode(emptyDiagram(), { shape: "process", x: 0, y: 0, text: "n" });
    const doc = new Y.Doc();
    toYjs([{ id: "d", type: "diagram", props: { data: serializeDiagram(setNodePage(node.diagram, node.node.id, target.value.id)) }, content: undefined, children: [] }], doc.getXmlFragment("doc"));
    await pages.saveUpdate(source.value.id, Y.encodeStateAsUpdate(doc));
    const controller = new WorkspaceController(store, clock);
    const select = vi.spyOn(controller, "select").mockResolvedValue();
    await renderWithI18n(<Backlinks controller={controller} pageId={target.value.id} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lienzo" }));
    expect(select).toHaveBeenCalledWith(source.value.id);
  });
});
