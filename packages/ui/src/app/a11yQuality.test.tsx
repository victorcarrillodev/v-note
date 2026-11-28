// B-12: auditoría axe de las pantallas añadidas desde la última revisión (el contraste se revisa en el navegador real).
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import axe from "axe-core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { ClipperHelp } from "../capture/ClipperHelp";
import { Backlinks } from "../editor/Backlinks";
import { RestoreAllPanel } from "../backup/RestoreAllPanel";

async function serious(root: Element) {
  const r = await axe.run(root, { rules: { "color-contrast": { enabled: false } }, runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 120)) }));
}

describe("accesibilidad", () => {
  it("recortador, retroenlaces y restaurar todo no tienen infracciones graves", async () => {
    const { controller } = await makeController();
    const p = await controller.createPage(null, "Uno");
    if (!p.ok) throw new Error("x");
    const { container } = await renderWithI18n(<main><ClipperHelp /><Backlinks controller={controller} pageId={p.value.id} /><RestoreAllPanel restore={async () => ({ restored: 0 }) as never} onDone={() => {}} onCancel={() => {}} /></main>);
    await screen.findByText("Ninguna página enlaza aquí.");
    expect(await serious(container)).toEqual([]);
  });
});
