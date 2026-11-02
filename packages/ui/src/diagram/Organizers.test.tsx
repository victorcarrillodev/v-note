// T-341…T-351: los organizadores guardan en el bloque lo que el usuario edita y lo conservan al volver a montarse.
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { MatrixEditor, TimelineEditor, TreeEditor } from "./Organizers";

let saved = "";
function Host({ children }: { children: (v: string, set: (d: string) => void) => React.ReactNode }) {
  const [v, setV] = useState(saved);
  return <>{children(v, (d) => { saved = d; setV(d); })}</>;
}
const depths = () => [...document.querySelectorAll("[data-node-id]")].map((n) => `${(n as HTMLElement).dataset.depth}:${n.textContent}`);

describe("árbol (mapa mental / organigrama)", () => {
  for (const kind of ["mindmap", "orgchart"] as const) {
    it(`${kind}: agregar hijos y hermanos, editar texto y persistir`, async () => {
      saved = "";
      const user = userEvent.setup();
      await renderWithI18n(<Host>{(v, set) => <TreeEditor kind={kind} value={v} onChange={set} />}</Host>);
      await user.click(screen.getByRole("button", { name: "Agregar hijo" }));
      fireEvent.change(within(screen.getByRole("region")).getByRole("textbox"), { target: { value: "Rama A" } });
      await user.click(document.querySelector("[data-node-id=root]")!);
      await user.click(screen.getByRole("button", { name: "Agregar hijo" }));
      fireEvent.change(within(screen.getByRole("region")).getByRole("textbox"), { target: { value: "Rama B" } });
      expect(depths().map((d) => d.replace(/ \+$/, ""))).toEqual([expect.stringMatching(/^0:/), "1:Rama A", "1:Rama B"]);
      expect(JSON.parse(saved).root.children.map((c: { text: string }) => c.text)).toEqual(["Rama A", "Rama B"]);
    });
  }
});

describe("línea de tiempo", () => {
  it("agrega eventos, rechaza fechas inválidas y los ordena", async () => {
    saved = "";
    const user = userEvent.setup();
    await renderWithI18n(<Host>{(v, set) => <TimelineEditor value={v} onChange={set} />}</Host>);
    const date = screen.getByLabelText("Fecha") as HTMLInputElement, title = screen.getByLabelText("Título");
    await user.click(screen.getByRole("button", { name: "Agregar evento" }));
    expect(screen.getByRole("status")).toBeTruthy();
    fireEvent.change(date, { target: { value: "2026-03-10" } }); await user.type(title, "B"); await user.click(screen.getByRole("button", { name: "Agregar evento" }));
    fireEvent.change(date, { target: { value: "2026-03-01" } }); await user.clear(title); await user.type(title, "A"); await user.click(screen.getByRole("button", { name: "Agregar evento" }));
    expect([...document.querySelectorAll("[data-event-id]")].map((e) => (e as HTMLElement).dataset.date)).toEqual(["2026-03-01", "2026-03-10"]);
  });
});

describe("matriz", () => {
  it("parte de la plantilla 2×2 y agrega elementos que persisten", async () => {
    saved = "";
    const user = userEvent.setup();
    await renderWithI18n(<Host>{(v, set) => <MatrixEditor value={v} onChange={set} />}</Host>);
    expect([...document.querySelectorAll("th input")].map((i) => (i as HTMLInputElement).value)).toEqual(["Urgente", "No urgente", "Importante", "No importante"]);
    const cell = document.querySelector("td[data-cell] input") as HTMLInputElement;
    await user.type(cell, "Tarea{Enter}");
    expect(JSON.parse(saved).items.map((i: { text: string }) => i.text)).toEqual(["Tarea"]);
  });
});
