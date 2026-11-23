// E-120 a E-130 (RF-5.2, RF-5.3, RF-6.1, RF-6.3 a RF-6.5, RF-8.2 a RF-8.5, RF-4.6, CL-17): secciones del menú de opciones.
import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cssVarsFor, DocStore, FONT_IDS, PageService } from "@vnote/core";
import { renderWithI18n } from "../../../tests/renderWithI18n";
import { makeController } from "../../../tests/withController";
import { appendTextUpdate, para, updateFor } from "../../../../core/tests/support/builders";
import { AppHeader } from "../../layout/AppHeader";
import { ToastProvider } from "../../feedback/ToastContext";
import { choose, dropdownOptions } from "../../../tests/dropdown";

async function setup(opts: { props?: object } = {}) {
  const { controller, db, clock } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  if (opts.props) await controller.setPageProps(r.value.id, opts.props);
  await controller.select(r.value.id);
  await renderWithI18n(<ToastProvider><header><AppHeader controller={controller} now={() => 0} onNavigate={() => {}} /></header></ToastProvider>);
  const page = () => { const f = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): any => ns.flatMap((n) => (n.page.id === r.value.id ? [n.page] : f(n.children)))[0]; return f(controller.getSnapshot().tree); };
  return { controller, db, clock, id: r.value.id, page, user: userEvent.setup() };
}
const open = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: "Opciones de la página" })); return screen.findByRole("group", { name: "Opciones de la página" }); };

describe("tipografía (E-120)", () => {
  const openSelect = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole("button", { name: new RegExp(name) }));
    return screen.getByRole("listbox", { name });
  };
  it("dos selectores cerrados; al abrir, «Predeterminado» y todas las fuentes (14) escritas en su fuente", async () => {
    const { user } = await setup();
    await open(user);
    expect(screen.queryByRole("listbox")).toBeNull();
    for (const name of ["Fuente del texto", "Fuente de los títulos"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toHaveAttribute("aria-expanded", "false");
      const options = within(await openSelect(user, name)).getAllByRole("option");
      expect(options).toHaveLength(FONT_IDS.length + 1);
      expect(options[0]).toHaveTextContent("Predeterminado");
      expect(options[0]).toHaveAttribute("aria-selected", "true");
      expect(options[0]!.style.fontFamily).toBe("");
      expect(options[1]!.style.fontFamily).toBe("var(--font-inter)");
      await waitFor(() => expect(options[0]).toHaveFocus());
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).toBeNull();
    }
  });
  it("elegir una fuente la guarda, cierra la lista y «Predeterminado» la quita", async () => {
    const { user, page } = await setup();
    await open(user);
    await user.click(within(await openSelect(user, "Fuente del texto")).getByRole("option", { name: /Lora/ }));
    expect(screen.queryByRole("listbox")).toBeNull();
    await user.click(within(await openSelect(user, "Fuente de los títulos")).getByRole("option", { name: /Caveat/ }));
    expect(page().style.typography).toEqual({ body: "lora", headings: "caveat" });
    expect(screen.getByRole("button", { name: /Fuente del texto/ })).toHaveTextContent("Lora");
    await user.click(within(await openSelect(user, "Fuente del texto")).getByRole("option", { name: "Predeterminado" }));
    expect(page().style.typography).toEqual({ headings: "caveat" });
    await user.click(within(await openSelect(user, "Fuente de los títulos")).getByRole("option", { name: "Predeterminado" }));
    expect(page().style.typography).toBeUndefined();
  });
  it("las flechas mueven el foco y Enter elige", async () => {
    const { user, page } = await setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: /Fuente del texto/ }));
    await waitFor(() => expect(within(screen.getByRole("listbox")).getByRole("option", { name: "Predeterminado" })).toHaveFocus());
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(page().style.typography?.body).toBe("inter"));
  });
});

describe("espaciado (E-121)", () => {
  it("ancho, tamaño de texto e interlineado: cada valor cambia la variable correcta", async () => {
    const { user, page } = await setup();
    await open(user);
    await choose(user, screen.getByLabelText("Ancho de la página"), "wide");
    expect(cssVarsFor(page().style)["--size-reading-width"]).toBe("var(--page-width-wide)");
    await choose(user, screen.getByLabelText("Ancho de la página"), "full");
    expect(cssVarsFor(page().style)["--size-reading-width"]).toBe("none");
    await choose(user, screen.getByLabelText("Tamaño del texto"), "large");
    expect(cssVarsFor(page().style)["--text-reading-size"]).toBe("var(--page-text-large)");
    await choose(user, screen.getByLabelText("Interlineado"), "relaxed");
    expect(cssVarsFor(page().style)["--block-gap"]).toBe("var(--page-gap-relaxed)");
    expect(cssVarsFor(page().style)["--text-reading-line"]).toBe("var(--page-leading-relaxed)");
  });
  it("cada lista ofrece «Predeterminado», que quita el valor", async () => {
    const { user, page } = await setup({ props: { style: { spacing: { width: "narrow", textSize: "small", leading: "compact" } } } });
    await open(user);
    expect(screen.getByLabelText("Ancho de la página")).toHaveAttribute("data-value", "narrow");
    for (const l of ["Ancho de la página", "Tamaño del texto", "Interlineado"]) {
      expect((await dropdownOptions(screen.getByLabelText(l)))[0]!.label).toBe("Predeterminado");
      await choose(user, screen.getByLabelText(l), "");
    }
    expect(page().style.spacing).toBeUndefined();
    expect(Object.keys(cssVarsFor(page().style))).toEqual([]);
  });
  it("el ancho ofrece los cuatro valores", async () => {
    const { user } = await setup();
    await open(user);
    expect((await dropdownOptions(screen.getByLabelText("Ancho de la página"))).map((o) => o.label)).toEqual(["Predeterminado", "Estrecho", "Normal", "Amplio", "Completo"]);
  });
});

describe("color de acento (E-123)", () => {
  const swatches = () => within(screen.getByRole("radiogroup", { name: /^(Vivos|Pastel|Degradados|Míos)$/ })).queryAllByRole("radio");
  it("«Predeterminado» quita el acento y no hay pestaña de colores del tema", async () => {
    const { user, page } = await setup();
    await open(user);
    expect(screen.queryByRole("tab", { name: "Tema" })).toBeNull();
    await user.click(swatches()[0]!);
    expect(page().style.accent).toMatch(/^#[0-9a-f]{6}$/);
    await user.click(screen.getByRole("radio", { name: "Predeterminado" }));
    expect(page().style.accent).toBeUndefined();
  });
  it("vivos, pastel y degradados traen 66 colores cada uno", async () => {
    const { user, page } = await setup();
    await open(user);
    for (const tab of ["Vivos", "Pastel", "Degradados"]) {
      await user.click(screen.getByRole("tab", { name: tab }));
      expect(swatches()).toHaveLength(66);
    }
    await user.click(swatches()[3]!);
    expect(page().style.accent).toMatch(/^#[0-9a-f]{6}~#[0-9a-f]{6}$/);
    expect(cssVarsFor(page().style)["--c-accent-fill"]).toContain("linear-gradient");
    await user.click(screen.getByRole("tab", { name: "Vivos" }));
    await user.click(swatches()[0]!);
    expect(page().style.accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(cssVarsFor(page().style)["--c-on-accent"]).toMatch(/^#(000000|ffffff)$/);
  });
  it("se crea un color propio, se guarda para otras páginas y se puede eliminar", async () => {
    localStorage.clear();
    const { user, page } = await setup();
    await open(user);
    await user.click(screen.getByRole("tab", { name: "Míos" }));
    expect(swatches()).toHaveLength(0);
    await user.click(screen.getByRole("checkbox", { name: "Degradado" }));
    await user.click(screen.getByRole("button", { name: "Guardar y usar" }));
    expect(swatches()).toHaveLength(1);
    expect(page().style.accent).toMatch(/~/);
    expect(JSON.parse(localStorage.getItem("vnote.page.savedAccents")!)).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Eliminar este color" }));
    expect(swatches()).toHaveLength(0);
    expect(page().style.accent).toBeUndefined();
  });
});

describe("estadísticas (E-125)", () => {
  it("se calculan al abrir el menú y se recalculan al volver a abrirlo", async () => {
    const { user, db, clock, id, controller } = await setup();
    const svc = new PageService(db, clock);
    await svc.saveUpdate(id, updateFor([para("uno dos tres")]));
    const stat = (k: string) => (document.querySelector(`[data-stat="${k}"]`) as HTMLElement).textContent;
    await open(user);
    await waitFor(() => expect(stat("words")).toBe("3"));
    expect(stat("characters")).toBe("12");
    expect(stat("reading")).toBe("1 min");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("group", { name: "Opciones de la página" })).toBeNull());
    // Edición real del documento ya guardado: se añade texto al primer párrafo (no se mezcla otro documento).
    const loaded = await new DocStore(db, clock).load(id);
    if (!loaded.ok) throw new Error("x");
    const saved = await svc.saveUpdate(id, appendTextUpdate(loaded.value, " cuatro cinco"));
    expect(saved.ok).toBe(true);
    expect((await controller.pageStats(id))!.words).toBe(5);
    await open(user);
    await waitFor(() => expect(stat("words")).toBe("5")); // se volvió a calcular con el contenido nuevo
  });
  it("una página vacía muestra 0 palabras y sin tiempo de lectura", async () => {
    const { user } = await setup();
    await open(user);
    await waitFor(() => expect((document.querySelector('[data-stat="words"]') as HTMLElement).textContent).toBe("0"));
    expect((document.querySelector('[data-stat="reading"]') as HTMLElement).textContent).toBe("—");
  });
  it("muestra las fechas de creación y de modificación", async () => {
    const { user } = await setup();
    await open(user);
    const dl = screen.getByText("Creada").closest("dl")!;
    expect(within(dl).getByText("Modificada")).toBeInTheDocument();
  });
});

describe("restablecer y predeterminado (E-126, E-127)", () => {
  it("«Restablecer estilo» deja el estilo en blanco, conserva portada y descripción, y «Deshacer» lo devuelve", async () => {
    const { user, page } = await setup({ props: { cover: "gradient:sky", description: "Resumen", style: { accent: "blue", spacing: { width: "wide" } } } });
    await open(user);
    await user.click(screen.getByRole("button", { name: "Restablecer estilo" }));
    await waitFor(() => expect(page().style).toEqual({}));
    expect(page().cover).toBe("gradient:sky");
    expect(page().description).toBe("Resumen");
    await user.click(await screen.findByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(page().style).toEqual({ accent: "blue", spacing: { width: "wide" } }));
  });
  it("sin estilo, «Restablecer» está desactivado", async () => {
    const { user } = await setup();
    await open(user);
    expect(screen.getByRole("button", { name: "Restablecer estilo" })).toBeDisabled();
  });
  it("«Usar como predeterminado» avisa y una página nueva sale con ese estilo; las existentes no cambian", async () => {
    const { user, controller, page } = await setup({ props: { style: { accent: "green", typography: { body: "lora" } } } });
    await open(user);
    await user.click(screen.getByRole("button", { name: "Usar como predeterminado" }));
    expect(await screen.findByText("Estilo guardado como predeterminado de las páginas nuevas")).toBeInTheDocument();
    const fresh = await controller.createPage(null, "Nueva");
    if (!fresh.ok) throw new Error("x");
    const created = controller.getSnapshot().tree.find((n) => n.page.id === fresh.value.id)!.page;
    expect(created.style).toEqual({ accent: "green", typography: { body: "lora" } });
    await controller.setPageProps(page().id, { style: { accent: "red" } });
    expect(controller.getSnapshot().tree.find((n) => n.page.id === fresh.value.id)!.page.style.accent).toBe("green");
  });
});

describe("ancho en pantallas estrechas (E-129, CL-17)", () => {
  it("el menú ocupa todo el ancho disponible en 360 px", async () => {
    const { user } = await setup();
    const m = await open(user);
    // La barra lateral nunca pasa del ancho de la ventana: en 360 px la ocupa entera.
    expect(m.closest("[data-drawer]")!.className).toContain("max-w-full");
  });
});

describe("índice en el menú (E-146)", () => {
  it("el interruptor está activado de serie; apagarlo y elegir niveles se guarda", async () => {
    const { user, page } = await setup();
    await open(user);
    const sw = screen.getByRole("switch", { name: "Índice flotante" });
    expect(sw).toBeChecked();
    await user.click(sw);
    expect(page().style.toc).toEqual({ floating: false });
    await user.click(sw);
    expect(page().style.toc).toBeUndefined();
    expect(screen.getByLabelText("Niveles del índice")).toHaveAttribute("data-value", "3");
    await choose(user, screen.getByLabelText("Niveles del índice"), "2");
    expect(page().style.toc).toEqual({ maxLevel: 2 });
    await choose(user, screen.getByLabelText("Niveles del índice"), "3");
    expect(page().style.toc).toBeUndefined();
  });
});
