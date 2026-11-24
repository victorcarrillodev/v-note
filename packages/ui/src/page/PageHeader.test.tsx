// T-115 y T-116 (prueba primero): título, ícono, portada, favoritos, migas de pan y duplicar.
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";

async function setup(title = "Mi página") {
  const { controller } = await makeController();
  const r = await controller.createPage(null, title);
  if (!r.ok) throw new Error("x");
  const view = await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} />);
  return { controller, id: r.value.id, user: userEvent.setup(), ...view };
}
const current = (c: Awaited<ReturnType<typeof makeController>>["controller"], id: string) => {
  const find = (ns: ReturnType<typeof c.getSnapshot>["tree"]): any => ns.flatMap((n) => (n.page.id === id ? [n.page] : find(n.children)))[0];
  return find(c.getSnapshot().tree);
};

describe("título (T-115)", () => {
  it("muestra el título actual y lo guarda al salir del campo", async () => {
    const { controller, id, user } = await setup();
    const input = screen.getByRole("textbox", { name: "Título de la página" });
    expect(input).toHaveValue("Mi página");
    await user.clear(input);
    await user.type(input, "Nuevo título");
    await user.tab();
    expect(current(controller, id).title).toBe("Nuevo título");
  });
  it("Enter también guarda, y Escape descarta los cambios", async () => {
    const { controller, id, user } = await setup();
    const input = screen.getByRole("textbox", { name: "Título de la página" });
    await user.clear(input); await user.type(input, "Con Enter{Enter}");
    expect(current(controller, id).title).toBe("Con Enter");
    await user.clear(input); await user.type(input, "Descartado{Escape}");
    expect(current(controller, id).title).toBe("Con Enter");
    expect(input).toHaveValue("Con Enter");
  });
  it("una página sin título muestra el texto de reemplazo como marcador", async () => {
    await setup("");
    expect(screen.getByRole("textbox", { name: "Título de la página" })).toHaveAttribute("placeholder", "Sin título");
  });
  it("no guarda si no cambió nada", async () => {
    const { controller, id, user } = await setup();
    const before = current(controller, id).updatedAt;
    await user.click(screen.getByRole("textbox", { name: "Título de la página" }));
    await user.tab();
    expect(current(controller, id).updatedAt).toBe(before);
  });
});

describe("foco (T-115)", () => {
  it("una página nueva sin título recibe el foco en su título para escribir de inmediato", async () => {
    const { controller } = await makeController();
    const r = await controller.createPage(null, "");
    if (!r.ok) throw new Error("x");
    await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} />);
    expect(screen.getByRole("textbox", { name: "Título de la página" })).toHaveFocus();
  });
  it("se puede escribir el título de una página nueva y Enter lo guarda", async () => {
    const { controller } = await makeController();
    const r = await controller.createPage(null, "");
    if (!r.ok) throw new Error("x");
    await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} />);
    const user = userEvent.setup();
    await user.keyboard("Mi título nuevo{Enter}");
    expect(controller.getSnapshot().tree[0]!.page.title).toBe("Mi título nuevo");
  });
  it("cambiar a otra página nueva reinicia el borrador y enfoca el título", async () => {
    const { controller } = await makeController();
    const a = await controller.createPage(null, "Con título"); const b = await controller.createPage(null, "");
    if (!a.ok || !b.ok) throw new Error("x");
    const { rerender } = await renderWithI18n(<PageHeader controller={controller} pageId={a.value.id} />);
    expect(screen.getByRole("textbox", { name: "Título de la página" })).toHaveValue("Con título");
    rerender(<PageHeader controller={controller} pageId={b.value.id} />);
    // (sin I18nextProvider en rerender se usarían claves; basta con comprobar el valor y el foco)
    const box = screen.getByRole("textbox");
    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
  });
  it("una página con título no roba el foco", async () => {
    await setup("Con título");
    expect(screen.getByRole("textbox", { name: "Título de la página" })).not.toHaveFocus();
  });
});

describe("ícono y portada (T-115)", () => {
  it("añade un emoji desde el selector y lo quita desde el mismo selector", async () => {
    const { controller, id, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Añadir ícono" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar un emoji…" }), "cuaderno");
    await user.click(screen.getByRole("button", { name: "📓 cuaderno" }));
    expect(current(controller, id).icon).toBe("📓");
    await user.click(screen.getByRole("button", { name: "Cambiar ícono" })); // el ícono mismo abre el selector
    await user.click(screen.getByRole("button", { name: "Quitar" }));
    expect(current(controller, id).icon).toBeNull();
  });
  it("«Quitar ícono» junto a las acciones también lo quita", async () => {
    const { controller, id, user } = await setup();
    await controller.setIcon(id, "📓");
    await user.click(await screen.findByRole("button", { name: "Quitar ícono" }));
    expect(current(controller, id).icon).toBeNull();
  });
  it("«Añadir portada» abre el selector (E-087); se elige un degradado y se quita desde «Cambiar portada»", async () => {
    const { controller, id, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Añadir portada" }));
    expect(current(controller, id).cover).toBeNull(); // ya no pone un degradado al azar
    await user.click(await screen.findByRole("tab", { name: "Degradados" }));
    await user.click(screen.getByRole("button", { name: "Cielo" }));
    expect(current(controller, id).cover).toBe("gradient:sky");
    expect(screen.getByTestId("cover")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cambiar portada" }));
    await user.click(await screen.findByRole("button", { name: "Quitar portada" }));
    expect(current(controller, id).cover).toBeNull();
  });
});

describe("acciones (T-116)", () => {
  it("favorito alterna y expone su estado", async () => {
    const { controller, user } = await setup();
    const btn = screen.getByRole("button", { name: "Marcar como favorita" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await user.click(btn);
    expect(controller.getSnapshot().favorites).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Quitar de favoritos" })).toHaveAttribute("aria-pressed", "true");
  });
  it("duplicar con y sin subpáginas", async () => {
    const { controller, id, user } = await setup("Original");
    await controller.createPage(id, "Hija");
    await controller.select(id);
    await user.click(screen.getByRole("button", { name: "Duplicar" }));
    await user.click(screen.getByRole("menuitem", { name: "Solo esta página" }));
    expect(controller.getSnapshot().tree.map((n) => n.children.length).sort()).toEqual([0, 1]);
    await user.click(screen.getByRole("button", { name: "Duplicar" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicar con subpáginas" }));
    expect(controller.getSnapshot().tree.map((n) => n.children.length).sort()).toEqual([0, 1, 1]);
  });
  it("eliminar manda la página a la papelera", async () => {
    const { controller, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(controller.getSnapshot().tree).toEqual([]);
    expect(controller.getSnapshot().trash).toHaveLength(1);
  });
});

describe("eliminar una página que está en varias bases (T-278, RF-22)", () => {
  async function inDatabases(count: number) {
    const { DatabaseService } = await import("@vnote/core");
    const { controller, db, clock } = await makeController();
    const dbs = new DatabaseService(db, clock);
    const ids: string[] = [];
    for (let i = 0; i < count; i++) { const d = await dbs.createDatabase({ name: `Base ${i + 1}` }); if (!d.ok) throw new Error("x"); ids.push(d.value.id); }
    const row = await dbs.addRow(ids[0]!, { title: "Compartida" });
    if (!row.ok) throw new Error("x");
    for (const id of ids.slice(1)) await dbs.addExistingPage(id, row.value.pageId);
    await controller.refresh();
    await renderWithI18n(<PageHeader controller={controller} pageId={row.value.pageId} />);
    return { controller, pageId: row.value.pageId, user: userEvent.setup() };
  }
  it("en varias bases avisa, nombra las bases y solo elimina al confirmar", async () => {
    const { controller, pageId, user } = await inDatabases(2);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    const dlg = await screen.findByRole("alertdialog");
    expect(dlg).toHaveTextContent("2 bases de datos");
    expect(within(dlg).getByText("Base 1")).toBeInTheDocument();
    expect(within(dlg).getByText("Base 2")).toBeInTheDocument();
    expect(controller.getSnapshot().trash).toHaveLength(0); // aún no se eliminó
    await user.click(within(dlg).getByRole("button", { name: "Eliminar de todos" }));
    await vi_waitFor(() => expect(controller.getSnapshot().trash.map((e) => e.page.id)).toContain(pageId));
  });
  it("cancelar no elimina nada", async () => {
    const { controller, user } = await inDatabases(2);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(controller.getSnapshot().trash).toHaveLength(0);
  });
  it("en una sola base se elimina sin advertencia", async () => {
    const { controller, user } = await inDatabases(1);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await vi_waitFor(() => expect(controller.getSnapshot().trash).toHaveLength(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
describe("título largo y vacío (U-153)", () => {
  it("U-153: un título de 300 caracteres se parte en varias líneas sin desbordar", async () => {
    const { controller } = await makeController();
    const long = "x".repeat(300);
    const r = await controller.createPage(null, long);
    if (!r.ok) throw new Error("x");
    await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} />);
    const input = screen.getByRole("textbox", { name: "Título de la página" });
    expect(input.tagName).toBe("TEXTAREA");
    expect(input.className).toContain("break-words");
    expect(input.className).toContain("resize-none");
    expect(input).toHaveValue(long);
  });
  it("U-153: sin título muestra «Sin título» atenuado", async () => {
    const { controller } = await makeController();
    const r = await controller.createPage(null, "");
    if (!r.ok) throw new Error("x");
    await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} />);
    const input = screen.getByRole("textbox", { name: "Título de la página" });
    expect(input).toHaveValue("");
    expect(input.getAttribute("placeholder")).toBe("Sin título");
    expect(input.className).toContain("placeholder:text-[var(--c-text-muted)]");
  });
  it("U-153: Enter no inserta salto de línea en el título", async () => {
    const { controller, id, user } = await setup();
    const input = screen.getByRole("textbox", { name: "Título de la página" });
    await user.clear(input);
    await user.type(input, "Hola{Enter}");
    expect((input as HTMLTextAreaElement).value).toBe("Hola");
    expect(current(controller, id).title).toBe("Hola");
  });
});
import { waitFor as vi_waitFor } from "@testing-library/react";
