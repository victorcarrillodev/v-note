import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { toYjs } from "@vnote/core";
import { EquationView } from "./EquationBlock";
import { MermaidView } from "./MermaidBlock";
import { ReviewView, localDay } from "./ReviewView";
import { templateBlocks, TEMPLATE_IDS } from "./templates";
import type { StudyCard } from "../workspace/controller";

const now = () => new Date("2026-03-10T12:00:00").getTime();

describe("ecuación", () => {
  it("compone la fórmula y permite editarla", async () => {
    let saved = "";
    const { container } = await renderWithI18n(<EquationView formula="x^2" editable onChange={(f) => (saved = f)} />);
    expect(container.querySelector(".katex")).not.toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar la ecuación" }));
    await user.type(screen.getByRole("textbox", { name: "Fórmula en LaTeX" }), "+1");
    expect(saved).toBe("x^2+1");
  });
});

describe("diagrama por texto", () => {
  it("dibuja el código y avisa si no se puede", async () => {
    const render = async (_id: string, code: string) => { if (code === "mal") throw new Error("sintaxis"); return "<svg data-ok></svg>"; };
    const { unmount } = await renderWithI18n(<MermaidView code="graph TD" editable onChange={() => {}} render={render} />);
    await waitFor(() => expect(screen.getByTestId("mermaid-drawing").querySelector("svg")).not.toBeNull());
    unmount();
    await renderWithI18n(<MermaidView code="mal" editable onChange={() => {}} render={render} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("sintaxis"));
  });
});

describe("plantillas", () => {
  it("cada una trae bloques con textos traducidos", async () => {
    const { createI18n } = await import("../i18n");
    for (const lang of ["es-MX", "en"] as const) {
      const i18n = await createI18n(lang === "en" ? "en" : undefined);
      for (const id of TEMPLATE_IDS) {
        const blocks = templateBlocks(id, (k) => i18n.t(k));
        expect(blocks.length).toBeGreaterThan(2);
        expect(JSON.stringify(blocks)).not.toContain("study.");
      }
    }
  });
});

describe("repaso", () => {
  const card = (id: string, due = ""): StudyCard => ({ blockId: id, pageId: "p", pageTitle: "Pilas", front: `P-${id}`, back: `R-${id}`, due, interval: 0, ease: 2.5, reps: 0, last: "", lapses: 0, reviews: 0, days: "" });

  it("recorre las tarjetas de hoy y guarda cada calificación; «Otra vez» la repite", async () => {
    const saved: [string, string][] = [];
    const controller = { listFlashcards: async () => [card("a"), card("futura", "2026-04-01"), card("b")], saveFlashcard: async (_p: string, id: string, s: { due: string }) => { saved.push([id, s.due]); return true; } };
    await renderWithI18n(<ReviewView controller={controller} now={now} onOpenPage={() => {}} />);
    const user = userEvent.setup();
    const answer = async (grade: string) => { await user.click(await screen.findByRole("button", { name: "Mostrar respuesta" })); await user.click(screen.getByRole("button", { name: grade })); };
    expect(await screen.findByText("P-a")).toBeInTheDocument();
    expect(screen.queryByText("R-a")).toBeNull();
    await answer("Otra vez");
    await answer("Bien"); // b
    await answer("Fácil"); // a, de nuevo
    expect(await screen.findByText("No quedan tarjetas por repasar hoy.")).toBeInTheDocument();
    expect(saved).toEqual([["a", localDay(now())], ["b", "2026-03-11"], ["a", "2026-03-14"]]);
  });

  it("el resultado queda guardado en el documento de la página", async () => {
    const { controller } = await makeController();
    const page = await controller.createPage(null, "Estudio");
    if (!page.ok) throw new Error("x");
    const Y = await import("yjs");
    const { DocStore } = await import("@vnote/core");
    const doc = new Y.Doc();
    toYjs([{ id: "c1", type: "flashcard", props: { front: "¿FIFO?", back: "Cola", due: "", interval: 0, ease: 2.5, reps: 0 }, content: undefined as never, children: [] }], doc.getXmlFragment("doc"));
    await new DocStore(controller.store, { now }).appendUpdate(page.value.id, Y.encodeStateAsUpdate(doc));
    await controller.refresh();
    const [found] = await controller.listFlashcards();
    expect([found?.front, found?.pageTitle]).toEqual(["¿FIFO?", "Estudio"]);
    expect(await controller.saveFlashcard(page.value.id, "c1", { due: "2026-03-11", interval: 1, ease: 2.5, reps: 1, last: "2026-03-10", lapses: 0, reviews: 1, days: "2026-03-10" })).toBe(true);
    expect((await controller.listFlashcards())[0]).toMatchObject({ due: "2026-03-11", interval: 1, reps: 1 });
  });
});

describe("estadísticas de repaso (study-features-2 T-5)", () => {
  const mk = (id: string, over: Partial<StudyCard> = {}): StudyCard => ({ blockId: id, pageId: "p", pageTitle: "Pilas", front: `P-${id}`, back: `R-${id}`, due: "", interval: 0, ease: 2.5, reps: 0, last: "", lapses: 0, reviews: 0, days: "", ...over });
  /** Valor exacto de una estadística (el texto del `dd`, sin la etiqueta). */
  const stat = (name: string) => within(screen.getByRole("group", { name: "Estadísticas de repaso" })).getByText(name).nextElementSibling!.textContent;

  it("muestra pendientes, nuevas, dominadas y repasadas hoy, y se actualiza al calificar", async () => {
    const cards = [mk("a"), mk("b", { due: "2026-03-01", interval: 3, reps: 2, last: "2026-02-26" }), mk("c", { due: "2026-05-01", interval: 40, reps: 6, last: "2026-03-01" })];
    const controller = { listFlashcards: async () => cards, saveFlashcard: async () => true };
    await renderWithI18n(<ReviewView controller={controller} now={now} onOpenPage={() => {}} />);
    const user = userEvent.setup();
    await screen.findByText("P-a");
    expect(stat("Pendientes hoy")).toBe("2");
    expect(stat("Nuevas")).toBe("1");
    expect(stat("Dominadas")).toBe("1");
    expect(stat("Repasadas hoy")).toBe("0");
    await user.click(screen.getByRole("button", { name: "Mostrar respuesta" }));
    await user.click(screen.getByRole("button", { name: "Bien" }));
    await screen.findByText("P-b");
    expect(stat("Pendientes hoy")).toBe("1");
    expect(stat("Repasadas hoy")).toBe("1");
    expect(stat("Retención estimada")).toBe("100 %");
  });

  it("sin repasos previos la retención aparece como «—» y «Otra vez» cuenta un olvido", async () => {
    const controller = { listFlashcards: async () => [mk("a")], saveFlashcard: async () => true };
    await renderWithI18n(<ReviewView controller={controller} now={now} onOpenPage={() => {}} />);
    const user = userEvent.setup();
    await screen.findByText("P-a");
    expect(stat("Retención estimada")).toBe("—");
    await user.click(screen.getByRole("button", { name: "Mostrar respuesta" }));
    await user.click(screen.getByRole("button", { name: "Otra vez" }));
    expect(stat("Olvidos")).toBe("1");
  });

  it("muestra la racha diaria y la mejor racha, y al repasar hoy la racha crece", async () => {
    const cards = [mk("a", { due: "2026-03-01", interval: 1, reps: 1, last: "2026-03-09", days: "2026-03-08,2026-03-09" })];
    const controller = { listFlashcards: async () => cards, saveFlashcard: async () => true };
    await renderWithI18n(<ReviewView controller={controller} now={now} onOpenPage={() => {}} />);
    const user = userEvent.setup();
    await screen.findByText("P-a");
    expect(stat("Racha")).toBe("2 días");
    expect(stat("Mejor racha")).toBe("2 días");
    await user.click(screen.getByRole("button", { name: "Mostrar respuesta" }));
    await user.click(screen.getByRole("button", { name: "Bien" }));
    expect(stat("Racha")).toBe("3 días");
    expect(stat("Mejor racha")).toBe("3 días");
  });

  it("sin días de repaso la racha es 0 días", async () => {
    const controller = { listFlashcards: async () => [mk("a")], saveFlashcard: async () => true };
    await renderWithI18n(<ReviewView controller={controller} now={now} onOpenPage={() => {}} />);
    await screen.findByText("P-a");
    expect(stat("Racha")).toBe("0 días");
  });

  it("también se ven cuando ya no quedan tarjetas por repasar", async () => {
    const controller = { listFlashcards: async () => [mk("x", { due: "2026-06-01", interval: 25, reps: 4, last: "2026-03-10" })], saveFlashcard: async () => true };
    await renderWithI18n(<ReviewView controller={controller} now={now} onOpenPage={() => {}} />);
    expect(await screen.findByText("No quedan tarjetas por repasar hoy.")).toBeInTheDocument();
    expect(stat("Dominadas")).toBe("1");
    expect(stat("Repasadas hoy")).toBe("1");
  });
});
