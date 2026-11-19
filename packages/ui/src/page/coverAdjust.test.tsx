// E-088 a E-094 (RF-3.1 a RF-3.5, CL-2, CL-3): altura, reposicionar, oscurecido, esquinas y deshacer.
import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";

async function setup(opts: { cover?: string; style?: object } = {}) {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  await controller.setPageProps(r.value.id, { cover: opts.cover ?? "gradient:sky", ...(opts.style ? { style: opts.style } : {}) });
  await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} />);
  const page = () => { const f = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): any => ns.flatMap((n) => (n.page.id === r.value.id ? [n.page] : f(n.children)))[0]; return f(controller.getSnapshot().tree); };
  return { controller, id: r.value.id, page, user: userEvent.setup() };
}
const openAdjust = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: "Ajustes de la portada" })); await screen.findByRole("group", { name: "Ajustes de la portada" }); };
const range = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

describe("altura (E-088)", () => {
  it("cada valor cambia la altura de la portada", async () => {
    const { user, page } = await setup();
    expect(screen.getByTestId("cover")).toHaveAttribute("data-cover-height", "medium");
    await openAdjust(user);
    for (const [label, key] of [["Baja", "low"], ["Alta", "high"]] as const) {
      await user.click(screen.getByRole("radio", { name: label }));
      expect(screen.getByTestId("cover")).toHaveAttribute("data-cover-height", key);
      expect(screen.getByTestId("cover").style.height).toBe(`var(--cover-height-${key})`);
    }
    expect(page().style.cover.height).toBe("high");
    await user.click(screen.getByRole("radio", { name: "Media" }));
    expect(page().style.cover).toBeUndefined(); // «media» es el valor predeterminado: no se guarda
  });
});

describe("reposicionar (E-089, E-090)", () => {
  const start = async (user: ReturnType<typeof userEvent.setup>) => { await openAdjust(user); await user.click(screen.getByRole("button", { name: "Reposicionar" })); return screen.findByRole("group", { name: "Reposicionar la portada" }); };
  it("«Cancelar» no cambia nada", async () => {
    const { user, controller, id, page } = await setup();
    const area = await start(user);
    area.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(page().style.cover).toBeUndefined();
    expect(controller.canUndoPageProps(id)).toBe(true); // solo el cambio de portada inicial
    expect(screen.queryByRole("group", { name: "Reposicionar la portada" })).toBeNull();
  });
  it("Esc también cancela", async () => {
    const { user, page } = await setup();
    const area = await start(user);
    area.focus();
    await user.keyboard("{ArrowDown}{Escape}");
    expect(page().style.cover).toBeUndefined();
    expect(screen.queryByRole("group", { name: "Reposicionar la portada" })).toBeNull();
  });
  it("con el teclado: flechas ±1 % y Mayús+flechas ±10 %; «Guardar» es una sola entrada del historial", async () => {
    const { user, controller, id, page } = await setup();
    const area = await start(user);
    area.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}");
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    // x 50 → 52, y 50 → 51 → 61
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(page().style.cover).toEqual({ posX: 52, posY: 61 }));
    // Deshacer una vez vuelve a la posición central, no a un paso intermedio.
    await controller.undoPageProps(id);
    expect(page().style.cover).toBeUndefined();
  });
});

describe("oscurecido (E-091, E-092)", () => {
  it("al soltar el deslizador se guarda una sola vez", async () => {
    const { user, controller, id, page } = await setup({ style: { header: { titleOverCover: true } } });
    await openAdjust(user);
    const before = page().updatedAt;
    const r = range("Oscurecido");
    fireEvent.change(r, { target: { value: "70" } });
    fireEvent.change(r, { target: { value: "80" } });
    fireEvent.change(r, { target: { value: "90" } });
    expect(page().style.cover).toBeUndefined(); // solo vista previa
    expect(page().updatedAt).toBe(before);
    expect(screen.getByTestId("cover-paint")).toHaveAttribute("data-overlay", "90");
    fireEvent.pointerUp(r);
    fireEvent.pointerUp(r); // soltar dos veces no duplica
    await waitFor(() => expect(page().style.cover.overlay).toBe(90));
    await controller.undoPageProps(id);
    expect(page().style.cover).toBeUndefined(); // una sola entrada
  });
  it("avisa con 54 y no con 55 cuando el título va sobre la portada", async () => {
    const { user } = await setup({ style: { header: { titleOverCover: true } } });
    await openAdjust(user);
    fireEvent.change(range("Oscurecido"), { target: { value: "54" } });
    expect(await screen.findByText(/el título puede costar leerse/)).toBeInTheDocument();
    fireEvent.change(range("Oscurecido"), { target: { value: "55" } });
    expect(screen.queryByText(/el título puede costar leerse/)).toBeNull();
  });
  it("no avisa si el título no está sobre la portada", async () => {
    const { user } = await setup();
    await openAdjust(user);
    fireEvent.change(range("Oscurecido"), { target: { value: "0" } });
    expect(screen.queryByText(/el título puede costar leerse/)).toBeNull();
  });
});

describe("esquinas (E-093)", () => {
  it("un valor para las cuatro", async () => {
    const { user, page } = await setup();
    await openAdjust(user);
    fireEvent.change(range("Esquinas"), { target: { value: "24" } });
    expect(screen.getByTestId("cover").style.borderRadius).toBe("24px");
    fireEvent.pointerUp(range("Esquinas"));
    await waitFor(() => expect(page().style.cover.radius).toBe(24));
  });
  it("separar, ajustar una esquina y volver a unir usa la superior izquierda", async () => {
    const { user, page } = await setup({ style: { cover: { radius: 10 } } });
    await openAdjust(user);
    await user.click(screen.getByRole("button", { name: "Esquinas por separado" }));
    expect(screen.getAllByRole("slider")).toHaveLength(1 + 4); // oscurecido + 4 esquinas
    fireEvent.change(range("Inferior derecha"), { target: { value: "30" } });
    fireEvent.pointerUp(range("Inferior derecha"));
    await waitFor(() => expect(page().style.cover.radius).toEqual([10, 10, 30, 10]));
    expect(screen.getByTestId("cover").style.borderRadius).toBe("10px 10px 30px 10px");
    await user.click(screen.getByRole("button", { name: "Las cuatro iguales" }));
    await waitFor(() => expect(page().style.cover.radius).toBe(10));
    expect(screen.getByRole("button", { name: "Esquinas por separado" })).toBeInTheDocument();
  });
});

describe("deshacer fuera del editor (E-094)", () => {
  it("Ctrl+Z deshace el último ajuste y Ctrl+Mayús+Z lo rehace", async () => {
    const { user, page } = await setup();
    await openAdjust(user);
    await user.click(screen.getByRole("radio", { name: "Alta" }));
    await user.keyboard("{Escape}");
    expect(page().style.cover.height).toBe("high");
    await user.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(page().style.cover).toBeUndefined());
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    await waitFor(() => expect(page().style.cover.height).toBe("high"));
  });
  it("dentro de un campo de texto no se toca el historial de la página", async () => {
    const { user, page } = await setup();
    await openAdjust(user);
    await user.click(screen.getByRole("radio", { name: "Alta" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("textbox", { name: "Título de la página" }));
    await user.keyboard("{Control>}z{/Control}");
    expect(page().style.cover.height).toBe("high");
  });
});
