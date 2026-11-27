// backlog-b7-b11 T-6: la sección de adjuntos abre la vista previa y guarda notas.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as Y from "yjs";
import { assetUrl, AssetNotesService, MemoryAssetStore, migrate, migrations, systemClock, toYjs, type DocSession } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { PageAttachments } from "./PageAttachments";

describe("adjuntos de la página", () => {
  it("lista la imagen, la abre, agrega una nota a toda la página y la quita", async () => {
    const store = await createNodeSqliteStore(":memory:");
    await migrate(store, migrations);
    const assets = new MemoryAssetStore();
    const { hash } = await assets.put(new Uint8Array([9]));
    const doc = new Y.Doc();
    toYjs([{ id: "i", type: "image", props: { url: assetUrl(hash), name: "mapa.png" }, content: undefined, children: [] }], doc.getXmlFragment("doc"));
    URL.createObjectURL ??= () => "blob:x";
    URL.revokeObjectURL ??= () => {};
    await renderWithI18n(<PageAttachments session={{ doc, flush: async () => {} } as unknown as DocSession} assets={assets} store={store} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Previsualizar mapa.png" }));
    await user.type(screen.getByRole("textbox", { name: "Nota para toda la página" }), "revisar");
    await user.click(screen.getByRole("button", { name: "Agregar nota" }));
    expect(await screen.findByRole("list", { name: "Notas" })).toHaveTextContent("revisar");
    expect((await new AssetNotesService(store, systemClock).list(hash))[0]!.rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    await user.click(screen.getByRole("button", { name: "Quitar" }));
    expect((await new AssetNotesService(store, systemClock).list(hash))).toEqual([]);
  });
});
