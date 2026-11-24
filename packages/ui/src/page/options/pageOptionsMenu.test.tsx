// E-107 a E-111 (RF-4.1, RF-4.2, RF-4.4, RF-4.6, RF-1.3, D-19): menú «Opciones de la página».
import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../../tests/renderWithI18n";
import { makeController } from "../../../tests/withController";
import { AppHeader } from "../../layout/AppHeader";
import { PageHeader } from "../PageHeader";
import { ToastProvider } from "../../feedback/ToastContext";

async function setup(opts: { select?: boolean; cover?: string; withHeader?: boolean } = {}) {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  if (opts.cover) await controller.setPageProps(r.value.id, { cover: opts.cover });
  await controller.select(opts.select === false ? null : r.value.id);
  await renderWithI18n(
    <ToastProvider>
      <header><AppHeader controller={controller} now={() => 0} onNavigate={() => {}} /></header>
      {opts.withHeader !== false && opts.select !== false && <PageHeader controller={controller} pageId={r.value.id} workspaceName="Mi espacio" />}
    </ToastProvider>,
  );
  const page = () => { const f = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): any => ns.flatMap((n) => (n.page.id === r.value.id ? [n.page] : f(n.children)))[0]; return f(controller.getSnapshot().tree); };
  return { controller, id: r.value.id, page, user: userEvent.setup() };
}
const trigger = () => screen.getByRole("button", { name: "Opciones de la página" });
const menu = () => screen.findByRole("group", { name: "Opciones de la página" });

describe("botón de opciones (E-107)", () => {
  it("aparece en el extremo derecho de la barra cuando hay una página abierta", async () => {
    await setup();
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("button", { name: "Opciones de la página" })).toBeInTheDocument();
    const all = Array.from(header.querySelectorAll("button"));
    expect(all[all.length - 1]).toBe(trigger()); // el último: extremo derecho
  });
  it("no aparece sin página abierta (p. ej. en Ajustes)", async () => {
    await setup({ select: false });
    expect(screen.queryByRole("button", { name: "Opciones de la página" })).toBeNull();
  });
});

describe("estructura del menú (E-108)", () => {
  it("tiene las cinco secciones, en orden", async () => {
    const { user } = await setup();
    await user.click(trigger());
    const m = await menu();
    expect(within(m).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Tipografía", "Espaciado", "Cabecera y portada", "Índice", "Página"]);
    // Barra lateral derecha: ancho de panel (380 px) y desplazamiento interno en el cuerpo.
    const drawer = m.closest("[data-drawer]")!;
    expect(drawer.className).toContain("w-[var(--size-panel-width)]");
    expect(drawer.querySelector("[data-drawer-body]")!.className).toContain("overflow-y-auto");
  });
  it("las secciones aún sin controles están vacías; «Cabecera y portada» tiene los suyos", async () => {
    const { user } = await setup();
    await user.click(trigger());
    const m = await menu();
    const section = (id: string) => m.querySelector(`[data-section="${id}"]`)!;
    expect(within(section("typography" as never) as HTMLElement).queryAllByRole("switch")).toHaveLength(0);
    expect(within(section("header") as HTMLElement).getAllByRole("switch").length).toBeGreaterThanOrEqual(6);
  });
});

describe("teclado y foco (E-109)", () => {
  it("Esc cierra el menú y devuelve el foco al botón", async () => {
    const { user } = await setup();
    await user.click(trigger());
    await menu();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("group", { name: "Opciones de la página" })).toBeNull());
    expect(trigger()).toHaveFocus();
  });
  it("un clic fuera cierra el menú", async () => {
    const { user } = await setup();
    await user.click(trigger());
    await menu();
    await user.click(screen.getByRole("textbox", { name: "Título de la página" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Opciones de la página" })).toBeNull());
  });
  it("se llega a los controles con Tab y un interruptor se acciona con el teclado", async () => {
    const { user, page } = await setup();
    await user.click(trigger());
    await menu();
    screen.getByRole("switch", { name: "Fecha de actualización" }).focus();
    await user.keyboard(" ");
    await waitFor(() => expect(page().style.header.updated).toBe(true));
  });
  it("se abre con el teclado", async () => {
    const { user } = await setup();
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(await menu()).toBeInTheDocument();
  });
});

describe("sección «Cabecera y portada» (E-110)", () => {
  it("cada interruptor cambia su pieza al instante", async () => {
    const { user, page } = await setup({ cover: "gradient:sky" });
    await user.click(trigger());
    await menu();
    // Etiqueta
    await user.click(screen.getByRole("switch", { name: "Etiqueta" }));
    expect(screen.getByLabelText("Etiqueta de la página")).toBeInTheDocument();
    // Fecha de actualización
    await user.click(screen.getByRole("switch", { name: "Fecha de actualización" }));
    expect(screen.getByText(/^Actualizada /)).toBeInTheDocument();
    // Descripción (vacía: aparece el marcador)
    await user.click(screen.getByRole("switch", { name: "Descripción" }));
    expect(screen.getByRole("button", { name: /^Descripción de la página/ })).toBeInTheDocument();
    // Título sobre la portada
    await user.click(screen.getByRole("switch", { name: "Título sobre la portada" }));
    expect(screen.getByTestId("page-header")).toHaveAttribute("data-mode", "card");
    // Degradado (en modo tarjeta, de serie encendido)
    expect(screen.getByRole("switch", { name: "Degradado bajo el texto" })).toBeChecked();
    await user.click(screen.getByRole("switch", { name: "Degradado bajo el texto" }));
    expect(document.querySelector("[data-testid=cover-paint][data-overlay]")).toBeNull();
    // apagar vuelve al valor predeterminado
    await user.click(screen.getByRole("switch", { name: "Título sobre la portada" }));
    expect(screen.getByTestId("page-header")).toHaveAttribute("data-mode", "classic");
    expect(page().style.header.titleOverCover).toBeUndefined();
  });
  it("el ícono que sobresale cambia su colocación", async () => {
    const { controller, id, user } = await setup({ cover: "gradient:sky" });
    await controller.setIcon(id, "📓");
    await user.click(trigger());
    await menu();
    await user.click(screen.getByRole("switch", { name: "Ícono sobre el borde" }));
    expect(screen.getByTestId("page-icon").className).toContain("absolute");
  });
  it("el texto de la etiqueta se guarda al salir del campo, y vacío vuelve al nombre del espacio", async () => {
    const { user, page } = await setup({ cover: "gradient:sky" });
    await user.click(trigger());
    await menu();
    await user.click(screen.getByRole("switch", { name: "Etiqueta" }));
    const input = screen.getByLabelText("Texto de la etiqueta");
    await user.type(input, "Apuntes{Enter}");
    expect(page().style.header.tagText).toBe("Apuntes");
    await user.clear(input);
    await user.tab();
    expect(page().style.header.tagText).toBeUndefined();
  });
  it("los interruptores que dependen de la portada están desactivados sin portada (RF-1.6)", async () => {
    const { user } = await setup();
    await user.click(trigger());
    await menu();
    for (const n of ["Título sobre la portada", "Ícono sobre el borde", "Degradado bajo el texto"]) expect(screen.getByRole("switch", { name: n })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Etiqueta" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Ajustes de la portada…" })).toBeNull();
  });
  it("«Cambiar portada…» abre el selector y «Ajustes de la portada…» los ajustes", async () => {
    const { user } = await setup({ cover: "gradient:sky" });
    await user.click(trigger());
    await menu();
    await user.click(screen.getByRole("button", { name: "Cambiar portada…" }));
    expect(await screen.findByRole("group", { name: "Portada de la página" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(trigger());
    await menu();
    await user.click(screen.getByRole("button", { name: "Ajustes de la portada…" }));
    expect(await screen.findByRole("group", { name: "Ajustes de la portada" })).toBeInTheDocument();
  });
});

describe("historial y «Deshacer» (E-111)", () => {
  it("cada cambio muestra el aviso y «Deshacer» lo revierte", async () => {
    const { user, page } = await setup();
    await user.click(trigger());
    await menu();
    await user.click(screen.getByRole("switch", { name: "Fecha de actualización" }));
    expect(await screen.findByText("Opción de la página cambiada")).toBeInTheDocument();
    expect(page().style.header.updated).toBe(true);
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(page().style.header).toBeUndefined());
  });
  it("cada cambio es una entrada: dos cambios se deshacen de uno en uno", async () => {
    const { user, controller, id, page } = await setup();
    await user.click(trigger());
    await menu();
    await user.click(screen.getByRole("switch", { name: "Fecha de actualización" }));
    await user.click(screen.getByRole("switch", { name: "Etiqueta" }));
    await controller.undoPageProps(id);
    expect(page().style.header).toEqual({ updated: true });
    await controller.undoPageProps(id);
    expect(page().style.header).toBeUndefined();
  });
});
