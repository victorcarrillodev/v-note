// Spec 006 (T-074, T-077 a T-080): el aspecto de la exportación (Estándar o Tema actual) y su paso al HTML y al PDF.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryAssetStore, buildExportCss } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { ThemeProvider, MemoryPreferences } from "../theme/theme";
import { ExportDialog, type ExportRuntime } from "./ExportDialog";
import { exportPaletteFor } from "../design/exportPalette";
import { resources } from "../i18n";

beforeEach(() => { (window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); });

async function open(theme: string | null, systemDark = false) {
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: systemDark, addEventListener() {}, removeEventListener() {} });
  const { controller } = await makeController();
  const root = await controller.createPage(null, "Informe");
  if (!root.ok) throw new Error("x");
  const runtime: ExportRuntime = { saveHtml: vi.fn(async () => {}), printHtml: vi.fn(async () => {}) };
  const prefs = new MemoryPreferences(); if (theme) prefs.set("theme", theme);
  const view = () => <ThemeProvider preferences={prefs}><ExportDialog controller={controller} pageId={root.value.id} assets={new MemoryAssetStore()} runtime={runtime} onClose={() => {}} /></ThemeProvider>;
  const r = await renderWithI18n(view());
  return { controller, id: root.value.id, runtime, user: userEvent.setup(), view, ...r };
}
const html = (runtime: ExportRuntime, fn: "saveHtml" | "printHtml") => (runtime[fn] as ReturnType<typeof vi.fn>).mock.calls[0]!.at(-1) as string;

describe("controlador", () => {
  it("exportPages pasa la paleta a exportHtml", async () => {
    const { controller } = await makeController();
    const p = await controller.createPage(null, "Doc");
    if (!p.ok) throw new Error("x");
    const palette = exportPaletteFor("grafito", true);
    const r = await controller.exportPages(p.value.id, { withChildren: false, assets: new MemoryAssetStore(), palette });
    if (!r.ok || r.value.status !== "done") throw new Error("x");
    expect(r.value.html).toContain(`<style>${buildExportCss(palette)}</style>`);
    const plain = await controller.exportPages(p.value.id, { withChildren: false, assets: new MemoryAssetStore() });
    if (!plain.ok || plain.value.status !== "done") throw new Error("x");
    expect(plain.value.html).not.toContain("color-scheme:dark");
  });
});

describe("diagramas Mermaid al exportar (study-features-2 T-2)", () => {
  it("el diálogo entrega a exportPages un dibujante de Mermaid; la exportación sigue funcionando si no hay diagramas", async () => {
    const { controller, user, runtime } = await open(null);
    const spy = vi.spyOn(controller, "exportPages");
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ mermaid: expect.any(Function) }));
  });
});

describe("grupo «Aspecto»", () => {
  it("«Estándar» viene seleccionado y exportar sin tocar nada no pasa paleta", async () => {
    const { user, runtime } = await open("oceano");
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByRole("group", { name: "Aspecto" })).toBeInTheDocument();
    expect(within(dlg).getByRole("radio", { name: "Estándar" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalled());
    expect(html(runtime, "saveHtml")).toContain(`<style>${buildExportCss()}</style>`);
  });
  it("con «Tema actual (Océano)» el HTML lleva la paleta de Océano", async () => {
    const { user, runtime } = await open("oceano");
    await user.click(screen.getByRole("radio", { name: "Tema actual (Océano)" }));
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalled());
    expect(html(runtime, "saveHtml")).toContain(`<style>${buildExportCss(exportPaletteFor("oceano", false))}</style>`);
  });
  it("con «Sistema» usa la variante que muestra el sistema ahora (oscuro)", async () => {
    const { user, runtime } = await open(null, true);
    await user.click(screen.getByRole("radio", { name: "Tema actual (Seguir al sistema)" }));
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalled());
    expect(html(runtime, "saveHtml")).toContain(":root{color-scheme:dark}");
  });
  it("el PDF usa la misma paleta que el HTML", async () => {
    const { user, runtime } = await open("esmeralda", true);
    await user.click(screen.getByRole("radio", { name: "PDF" }));
    await user.click(screen.getByRole("radio", { name: "Tema actual (Esmeralda)" }));
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.printHtml).toHaveBeenCalled());
    expect(html(runtime, "printHtml")).toContain(`<style>${buildExportCss(exportPaletteFor("esmeralda", true))}</style>`);
  });
  it("el aspecto elegido no se conserva: al cerrar y reabrir vuelve a «Estándar»", async () => {
    const { user, view, unmount } = await open("oceano");
    await user.click(screen.getByRole("radio", { name: "Tema actual (Océano)" }));
    unmount();
    await renderWithI18n(view());
    expect(screen.getByRole("radio", { name: "Estándar" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Tema actual (Océano)" })).not.toBeChecked();
  });
  it("sin ThemeProvider el diálogo sigue funcionando y no ofrece el grupo", async () => {
    const { controller } = await makeController();
    const p = await controller.createPage(null, "Doc");
    if (!p.ok) throw new Error("x");
    await renderWithI18n(<ExportDialog controller={controller} pageId={p.value.id} assets={new MemoryAssetStore()} runtime={{ saveHtml: vi.fn(), printHtml: vi.fn() }} onClose={() => {}} />);
    expect(screen.queryByRole("group", { name: "Aspecto" })).toBeNull();
  });
});

describe("textos del aspecto (T-076)", () => {
  it("existen en español e inglés", () => {
    const es = resources["es-MX"].translation.export as Record<string, string>, en = resources.en.translation.export as Record<string, string>;
    expect([es.look, es.lookStandard, es.lookTheme]).toEqual(["Aspecto", "Estándar", "Tema actual ({{name}})"]);
    expect([en.look, en.lookStandard, en.lookTheme]).toEqual(["Look", "Standard", "Current theme ({{name}})"]);
  });
});
