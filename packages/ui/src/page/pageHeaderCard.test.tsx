// E-095 a E-106 (RF-1.1 a RF-1.8, RF-2.5, CL-4, CL-17, D-13, D-20): cabecera tipo tarjeta y clásica.
import { describe, it, expect } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 16, 12);

async function setup(opts: { cover?: string | null; style?: object; description?: string; icon?: string; credit?: object; updatedAgo?: number; locked?: boolean } = {}) {
  const { controller, clock } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  if (opts.icon) await controller.setIcon(r.value.id, opts.icon);
  await controller.setPageProps(r.value.id, {
    ...(opts.cover !== null ? { cover: opts.cover ?? "gradient:sky" } : {}),
    ...(opts.style ? { style: opts.style } : {}), ...(opts.description ? { description: opts.description } : {}),
    ...(opts.credit ? { coverCredit: opts.credit as never } : {}), ...(opts.locked ? { locked: true } : {}),
  });
  void clock;
  const page = () => { const f = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): any => ns.flatMap((n) => (n.page.id === r.value.id ? [n.page] : f(n.children)))[0]; return f(controller.getSnapshot().tree); };
  const updatedAt = page().updatedAt as number;
  await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} workspaceName="Mi espacio" now={updatedAt + (opts.updatedAgo ?? 0)} />);
  return { controller, id: r.value.id, page, user: userEvent.setup(), header: () => screen.getByTestId("page-header") };
}
const over = { header: { titleOverCover: true } };

describe("modo de la cabecera (E-095)", () => {
  it.each([
    ["con portada y título sobre la portada", "gradient:sky", true, "card"],
    ["con portada y título debajo", "gradient:sky", false, "classic"],
    ["sin portada y título sobre la portada", null, true, "classic"],
    ["sin portada y título debajo", null, false, "classic"],
  ] as const)("%s → %s", async (_n, cover, titleOver, mode) => {
    const { header } = await setup({ cover, style: titleOver ? over : {} });
    expect(header()).toHaveAttribute("data-mode", mode);
  });
  it("sin portada las piezas que dependen de ella no se muestran y no quedan huecos (RF-1.6)", async () => {
    await setup({ cover: null, icon: "📓", style: { header: { titleOverCover: true, iconOverlap: true, gradient: true } } });
    expect(screen.queryByTestId("cover")).toBeNull();
    expect(screen.queryByTestId("cover-overlay")).toBeNull();
    expect(screen.getByTestId("page-icon").className).not.toContain("absolute");
  });
});

describe("modo tarjeta (E-096, E-097)", () => {
  it("el título está dentro de la portada, es editable y crece con el texto", async () => {
    const { user, controller, id } = await setup({ style: over });
    const title = within(screen.getByTestId("cover")).getByRole("textbox", { name: "Título de la página" });
    await user.clear(title);
    await user.type(title, "Un título muy largo que ocupa varias líneas dentro de la tarjeta de portada{Enter}");
    expect(controller.getSnapshot().tree[0]!.page.title).toContain("varias líneas");
    expect(screen.getByTestId("cover").className).not.toContain("overflow-visible");
    expect(screen.getByTestId("cover").style.minHeight).toBe("var(--cover-height-medium)"); // alto mínimo: crece
    expect(screen.getByTestId("cover").style.height).toBe("");
    void id;
  });
  it("con un título de tres líneas el campo se ajusta a su contenido", async () => {
    const { user } = await setup({ style: over });
    const title = screen.getByRole("textbox", { name: "Título de la página" }) as HTMLTextAreaElement;
    Object.defineProperty(title, "scrollHeight", { configurable: true, value: 180 });
    await user.type(title, "x");
    expect(title.style.height).toBe("180px");
  });
  it("la descripción es editable dentro de la portada y se guarda al salir", async () => {
    const { user, page } = await setup({ style: { header: { titleOverCover: true, description: true } } });
    await user.click(within(screen.getByTestId("cover")).getByRole("button", { name: /^Descripción de la página/ }));
    await user.type(screen.getByRole("textbox", { name: "Descripción de la página" }), "Un resumen{Enter}");
    expect(page().description).toBe("Un resumen");
  });
  it("fuera de edición la descripción se corta en dos líneas y al editarla se ve completa (CL-4)", async () => {
    const { user, page } = await setup({ description: "x ".repeat(200), style: over });
    const shown = screen.getByRole("button", { name: /^Descripción de la página/ });
    expect(shown.className).toContain("line-clamp-2");
    await user.click(shown);
    const editor = screen.getByRole("textbox", { name: "Descripción de la página" });
    expect(editor.className).not.toContain("line-clamp");
    expect(editor).toHaveValue(page().description); // la descripción completa (hasta 280 caracteres)
    expect((page().description as string).length).toBeGreaterThan(200);
  });
});

describe("descripción en el modo clásico (E-098)", () => {
  it("se muestra bajo el título cuando existe", async () => {
    await setup({ cover: null, description: "Resumen" });
    const title = screen.getByRole("textbox", { name: "Título de la página" });
    const desc = screen.getByRole("button", { name: /^Descripción de la página/ });
    expect(desc).toHaveTextContent("Resumen");
    expect(title.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("sin descripción no se muestra, salvo que se active en las opciones", async () => {
    await setup({ cover: null });
    expect(screen.queryByRole("button", { name: /^Descripción de la página/ })).toBeNull();
  });
  it("activada y vacía muestra el marcador para escribirla", async () => {
    await setup({ cover: null, style: { header: { description: true } } });
    expect(screen.getByRole("button", { name: /^Descripción de la página/ })).toHaveTextContent("Añade una descripción");
  });
  it("desactivada, no se muestra aunque exista", async () => {
    await setup({ cover: null, description: "Oculta", style: { header: { description: false } } });
    expect(screen.queryByRole("button", { name: /^Descripción de la página/ })).toBeNull();
  });
});

describe("etiqueta (E-099)", () => {
  it("muestra el nombre del espacio", async () => {
    await setup({ style: { header: { tag: true } } });
    expect(screen.getByLabelText("Etiqueta de la página")).toHaveTextContent("Mi espacio");
  });
  it("muestra el texto propio cuando lo hay", async () => {
    await setup({ style: { header: { tag: true, tagText: "Notas de clase" } } });
    expect(screen.getByLabelText("Etiqueta de la página")).toHaveTextContent("Notas de clase");
  });
  it("apagada, no aparece", async () => {
    await setup({});
    expect(screen.queryByLabelText("Etiqueta de la página")).toBeNull();
  });
});

describe("fecha de actualización (E-100)", () => {
  it("«hoy» el mismo día, con la fecha exacta al enfocar", async () => {
    const { user } = await setup({ style: { header: { updated: true } } });
    const when = screen.getByText("Actualizada hoy");
    await user.tab(); // el foco llega a la fecha en algún punto del recorrido
    act(() => when.focus());
    expect(await screen.findAllByText(/Última actualización:/)).not.toHaveLength(0);
  });
  it("«hace 3 días»", async () => {
    await setup({ style: { header: { updated: true } }, updatedAgo: 3 * DAY });
    expect(screen.getByText("Actualizada hace 3 días")).toBeInTheDocument();
  });
  it("«ayer» al día siguiente", async () => {
    await setup({ style: { header: { updated: true } }, updatedAgo: DAY });
    expect(screen.getByText("Actualizada ayer")).toBeInTheDocument();
  });
  it("lleva la fecha en formato máquina", async () => {
    await setup({ style: { header: { updated: true } } });
    expect(screen.getByText("Actualizada hoy").getAttribute("datetime")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  void NOW;
});

describe("ícono que sobresale (E-101)", () => {
  it("va dentro de un cuadro claro redondeado a caballo del borde inferior", async () => {
    await setup({ icon: "📓", style: { header: { iconOverlap: true } } });
    const icon = screen.getByTestId("page-icon");
    expect(icon.className).toContain("absolute");
    expect(icon.className).toContain("-bottom-7");
    expect(icon.className).toContain("rounded-2xl");
    expect(icon.className).toContain("bg-[var(--c-card)]");
    expect(icon.className).toContain("h-14"); // 56 px
    expect(icon.parentElement).not.toBe(screen.getByTestId("cover")); // fuera del recorte de la portada
  });
  it("apagado, el ícono va junto al título", async () => {
    await setup({ icon: "📓", style: over });
    expect(within(screen.getByTestId("cover")).getByTestId("page-icon").className).not.toContain("absolute");
  });
});

describe("degradado y esquinas redondeadas (E-102)", () => {
  it("el degradado sigue al interruptor, y en modo tarjeta está encendido de serie", async () => {
    const a = await setup({ style: over });
    expect(screen.getByTestId("cover-overlay")).toBeInTheDocument();
    void a;
  });
  it("apagado explícitamente, no hay degradado", async () => {
    await setup({ style: { header: { titleOverCover: true, gradient: false } } });
    expect(screen.queryByTestId("cover-overlay")).toBeNull();
  });
  it("en el modo clásico el degradado está apagado de serie y se puede activar", async () => {
    await setup({ style: { header: { gradient: true } } });
    expect(screen.getByTestId("cover-overlay")).toBeInTheDocument();
  });
  it("«esquinas redondeadas» redondea la portada, y el ajuste de esquinas manda sobre él", async () => {
    await setup({ style: { header: { rounded: true } } });
    expect(screen.getByTestId("cover").style.borderRadius).toBe("16px");
  });
  it("con un radio propio se usa ese", async () => {
    await setup({ style: { header: { rounded: true }, cover: { radius: 30 } } });
    expect(screen.getByTestId("cover").style.borderRadius).toBe("30px");
  });
  it("sin nada, las esquinas son rectas", async () => {
    await setup({});
    expect(screen.getByTestId("cover").style.borderRadius).toMatch(/^0(px)?$/);
  });
});

describe("texto sobre la portada y «Cambiar portada» (E-103)", () => {
  it("el título lleva texto blanco con sombra", async () => {
    await setup({ style: over });
    const title = screen.getByRole("textbox", { name: "Título de la página" });
    expect(title.className).toContain("text-white");
    expect(title.className).toContain("text-shadow");
  });
  it("«Cambiar portada» solo se ve con puntero o foco, y siempre en táctil", async () => {
    await setup({ style: over });
    const btn = screen.getByRole("button", { name: "Cambiar portada" });
    expect(btn.className).toContain("opacity-0");
    expect(btn.className).toContain("group-hover/header:opacity-100"); // puntero
    expect(btn.className).toContain("group-focus-within/header:opacity-100"); // foco dentro de la cabecera
    expect(btn.className).toContain("focus-visible:opacity-100"); // foco en el propio botón
    expect(btn.className).toContain("[@media(pointer:coarse)]:opacity-100"); // táctil
    expect(screen.getByTestId("page-header").className).toContain("group/header");
  });
  it("una página bloqueada no ofrece cambiar la portada", async () => {
    await setup({ style: over, locked: true });
    expect(screen.queryByRole("button", { name: "Cambiar portada" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Título de la página" })).toHaveAttribute("readonly");
  });
});

describe("crédito de la foto (E-104)", () => {
  const credit = { source: "unsplash", photoId: "abc", author: "Ana Pérez", authorUrl: "https://unsplash.com/@ana?utm_source=app", photoUrl: "https://unsplash.com/photos/abc?utm_source=app" };
  const hash = "ab".repeat(32);
  it("abajo a la derecha, con enlaces al autor y a Unsplash", async () => {
    await setup({ cover: `asset:${hash}`, credit });
    const c = screen.getByTestId("cover-credit");
    expect(c.className).toContain("bottom-");
    expect(c.className).toContain("right-");
    expect(within(c).getByRole("link", { name: "Ana Pérez" })).toHaveAttribute("href", credit.authorUrl);
    expect(within(c).getByRole("link", { name: "Unsplash" })).toHaveAttribute("href", credit.photoUrl);
    expect(within(c).getByRole("link", { name: "Unsplash" })).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("sin crédito no se muestra", async () => {
    await setup({ cover: `asset:${hash}` });
    expect(screen.queryByTestId("cover-credit")).toBeNull();
  });
});

describe("pantallas estrechas (E-106, CL-17)", () => {
  it("la tarjeta usa un margen menor y crece con el contenido en 360 px", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
    window.dispatchEvent(new Event("resize"));
    await setup({ style: over });
    const inner = screen.getByTestId("cover").querySelector("textarea")!.closest("div.relative")!;
    expect(inner.className).toContain("max-sm:px-4");
    expect(inner.className).toContain("min-h-[inherit]");
    expect(screen.getByTestId("cover").style.minHeight).toBe("var(--cover-height-medium)");
    expect(screen.getByTestId("page-header").className).not.toMatch(/w-\[\d+px\]/); // sin anchos fijos
    fireEvent.resize(window);
  });
});
