// T-416 (parcial): auditoría axe de las pantallas nuevas de exportar y de actualizaciones (RNF-9). El contraste se revisa en el navegador real (tests-e2e/a11y).
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import axe from "axe-core";
import { MemoryAssetStore } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { ExportDialog } from "./ExportDialog";
import { UpdateNotice } from "../app/UpdateNotice";

async function violations(root: Element) {
  const r = await axe.run(root, { rules: { "color-contrast": { enabled: false } }, runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 120)) }));
}

describe("accesibilidad de las pantallas nuevas", () => {
  it("el diálogo de exportar no tiene infracciones graves", async () => {
    const { controller } = await makeController();
    const p = await controller.createPage(null, "Informe");
    if (!p.ok) throw new Error("x");
    await renderWithI18n(<ExportDialog controller={controller} pageId={p.value.id} assets={new MemoryAssetStore()} runtime={{ saveHtml: vi.fn(async () => {}), printHtml: vi.fn(async () => {}) }} onClose={() => {}} />);
    const dialog = await screen.findByRole("alertdialog");
    expect(await violations(dialog)).toEqual([]);
  });
  it("el aviso de versión nueva no tiene infracciones graves", async () => {
    const { container } = await renderWithI18n(<UpdateNotice check={async () => ({ available: true, version: "0.2.0", url: "https://github.com/a/b/releases/tag/v0.2.0" })} onDownload={() => {}} />);
    await screen.findByRole("status");
    expect(await violations(container)).toEqual([]);
  });
});
