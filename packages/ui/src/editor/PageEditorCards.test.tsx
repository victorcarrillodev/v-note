// study-features-2 T-4 (prueba primero): el atajo «generar tarjetas» crea tarjetas desde las notas de la página.
import { describe, it, expect } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { FakeClock, PageService } from "@vnote/core";
import { para, updateFor } from "../../../core/tests/support/builders";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageEditor } from "./PageEditor";
import { ThemeProvider, MemoryPreferences } from "../theme/theme";
import { ToastProvider } from "../feedback/ToastContext";
import { GENERATE_CARDS_EVENT } from "../study/generateCards";

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as never;

async function mount(lines: string[]) {
  const { controller, db } = await makeController();
  const r = await controller.createPage(null, "Estudio");
  if (!r.ok) throw new Error("x");
  await new PageService(db, new FakeClock(1_000)).saveUpdate(r.value.id, updateFor(lines.map((l) => para(l))));
  await controller.openDocument(r.value.id);
  await renderWithI18n(<ThemeProvider preferences={new MemoryPreferences()}><ToastProvider><PageEditor controller={controller} pageId={r.value.id} /></ToastProvider></ThemeProvider>);
  await waitFor(() => expect(document.querySelector("[data-color-scheme]")).not.toBeNull());
}
const fire = () => act(async () => { window.dispatchEvent(new Event(GENERATE_CARDS_EVENT)); });

describe("generar tarjetas desde las notas", () => {
  it("crea una tarjeta por cada patrón reconocido y avisa cuántas", async () => {
    await mount(["Cola :: estructura FIFO", "Pila :: estructura LIFO", "Texto suelto"]);
    await fire();
    expect(await screen.findByText("Se crearon 2 tarjetas.")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelectorAll('[data-content-type="flashcard"]').length).toBe(2));
  });
  it("repetir el atajo no duplica las tarjetas", async () => {
    await mount(["Cola :: estructura FIFO"]);
    await fire();
    await waitFor(() => expect(document.querySelectorAll('[data-content-type="flashcard"]').length).toBe(1));
    await fire();
    expect(await screen.findByText("No encontré nada nuevo que convertir en tarjetas.")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-content-type="flashcard"]').length).toBe(1);
  });
});
