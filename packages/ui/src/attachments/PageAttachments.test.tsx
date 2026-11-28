// backlog-b7-b11 T-6: la sección de adjuntos abre la vista previa y guarda notas.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as Y from "yjs";
import axe from "axe-core";
import { assetUrl, AssetNotesService, MemoryAssetStore, migrate, migrations, systemClock, toYjs, type DocSession } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { PageAttachments } from "./PageAttachments";

const serious = async (root: Element) => {
  const r = await axe.run(root, { rules: { "color-contrast": { enabled: false } }, runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 120)) }));
};

describe("adjuntos de la página", () => {
  it("lista la imagen, la abre, agrega una nota con teclado y la quita", async () => {
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
    expect(await serious(screen.getByRole("dialog"))).toEqual([]);
    // Con teclado: Intro marca una zona, una flecha la mueve y Mayús+flecha la ensancha.
    screen.getByRole("application").focus();
    await user.keyboard("{Enter}{ArrowRight}{Shift>}{ArrowRight}{/Shift}");
    await user.type(screen.getByRole("textbox", { name: "Nota para la zona marcada" }), "revisar");
    await user.click(screen.getByRole("button", { name: "Agregar nota" }));
    expect(await screen.findByRole("list", { name: "Notas" })).toHaveTextContent("revisar");
    const rect = (await new AssetNotesService(store, systemClock).list(hash))[0]!.rect;
    expect([rect.x, rect.y, rect.w, rect.h].map((v) => Math.round(v * 100))).toEqual([42, 40, 22, 20]);
    await user.click(screen.getByRole("button", { name: "Quitar" }));
    expect((await new AssetNotesService(store, systemClock).list(hash))).toEqual([]);
  });
});
