// Spec 006 (T-045, RF-3.2): el editor recibe la VARIANTE del tema de color (Esmeralda → oscuro; Océano → claro).
import { describe, it, expect } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageEditor } from "./PageEditor";
import { ThemeProvider, MemoryPreferences } from "../theme/theme";
import { ToastProvider } from "../feedback/ToastContext";

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;

async function mount(theme: string) {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  await controller.openDocument(r.value.id);
  const prefs = new MemoryPreferences(); prefs.set("theme", theme);
  await renderWithI18n(<ThemeProvider preferences={prefs}><ToastProvider><PageEditor controller={controller} pageId={r.value.id} /></ToastProvider></ThemeProvider>);
  await waitFor(() => expect(document.querySelector("[data-color-scheme]")).not.toBeNull());
}

describe("PageEditor y los temas de color", () => {
  it("con Esmeralda el editor usa la variante oscura", async () => {
    await mount("esmeralda");
    expect(document.querySelector("[data-color-scheme]")!.getAttribute("data-color-scheme")).toBe("dark");
  });
  it("con Océano el editor usa la variante clara", async () => {
    await mount("oceano");
    expect(document.querySelector("[data-color-scheme]")!.getAttribute("data-color-scheme")).toBe("light");
  });
});
