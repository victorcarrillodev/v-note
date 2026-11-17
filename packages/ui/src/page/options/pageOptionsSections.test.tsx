// E-120 a E-130 (RF-5.2, RF-5.3, RF-6.1, RF-6.3 a RF-6.5, RF-8.2 a RF-8.5, RF-4.6, CL-17): secciones del menú de opciones.
import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cssVarsFor, DocStore, PageService } from "@vnote/core";
import { renderWithI18n } from "../../../tests/renderWithI18n";
import { makeController } from "../../../tests/withController";
import { appendTextUpdate, para, updateFor } from "../../../../core/tests/support/builders";
import { AppHeader } from "../../layout/AppHeader";
import { ToastProvider } from "../../feedback/ToastContext";

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
  it("dos listas, cada una con «Predeterminado» y las 10 fuentes escritas en su fuente", async () => {
    const { user } = await setup();
    await open(user);
    for (const name of ["Fuente del texto", "Fuente de los títulos"]) {
      const radios = within(screen.getByRole("radiogroup", { name })).getAllByRole("radio");
      expect(radios).toHaveLength(11);
      expect(radios[0]).toHaveTextContent("Predeterminado");
      expect(radios[0]).toBeChecked();
      expect(radios[0]!.style.fontFamily).toBe("");
      expect(radios[1]!.style.fontFamily).toBe("var(--font-inter)");
    }
    const lora = within(screen.getByRole("radiogroup", { name: "Fuente del texto" })).getByRole("radio", { name: /Lora/ });
    expect(lora.style.fontFamily).toBe("var(--font-lora)");
  });
  it("elegir una fuente la guarda y «Predeterminado» la quita", async () => {
    const { user, page } = await setup();
    await open(user);
    const body = within(screen.getByRole("radiogroup", { name: "Fuente del texto" }));
    const heads = within(screen.getByRole("radiogroup", { name: "Fuente de los títulos" }));
    await user.click(body.getByRole("radio", { name: /Lora/ }));
    await user.click(heads.getByRole("radio", { name: /Caveat/ }));
    expect(page().style.typography).toEqual({ body: "lora", headings: "caveat" });
    expect(body.getByRole("radio", { name: /Lora/ })).toBeChecked();
    await user.click(body.getByRole("radio", { name: "Predeterminado" }));
    expect(page().style.typography).toEqual({ headings: "caveat" });
    await user.click(heads.getByRole("radio", { name: "Predeterminado" }));
    expect(page().style.typography).toBeUndefined();
  });
  it("las flechas cambian la selección", async () => {
    const { user, page } = await setup();
    await open(user);
    const checked = within(screen.getByRole("radiogroup", { name: "Fuente del texto" })).getByRole("radio", { checked: true });
    checked.focus();
    await user.keyboard("{ArrowDown}");
    expect(page().style.typography.body).toBe("inter");
    await user.keyboard("{ArrowDown}");
    expect(page().style.typography.body).toBe("geist");
  });
});

describe("espaciado (E-121)", () => {
  it("ancho, tamaño de texto e interlineado: cada valor cambia la variable correcta", async () => {
    const { user, page } = await setup();
    await open(user);
    await user.selectOptions(screen.getByLabelText("Ancho de la página"), "wide");
    expect(cssVarsFor(page().style)["--size-reading-width"]).toBe("var(--page-width-wide)");
    await user.selectOptions(screen.getByLabelText("Ancho de la página"), "full");
    expect(cssVarsFor(page().style)["--size-reading-width"]).toBe("none");
    await user.selectOptions(screen.getByLabelText("Tamaño del texto"), "large");
    expect(cssVarsFor(page().style)["--text-reading-size"]).toBe("var(--page-text-large)");
    await user.selectOptions(screen.getByLabelText("Interlineado"), "relaxed");
    expect(cssVarsFor(page().style)["--block-gap"]).toBe("var(--page-gap-relaxed)");
    expect(cssVarsFor(page().style)["--text-reading-line"]).toBe("var(--page-leading-relaxed)");
  });
  it("cada lista ofrece «Predeterminado», que quita el valor", async () => {
    const { user, page } = await setup({ props: { style: { spacing: { width: "narrow", textSize: "small", leading: "compact" } } } });
    await open(user);
    expect(screen.getByLabelText("Ancho de la página")).toHaveValue("narrow");
    for (const l of ["Ancho de la página", "Tamaño del texto", "Interlineado"]) {
      expect(within(screen.getByLabelText(l)).getAllByRole("option")[0]).toHaveTextContent("Predeterminado");
      await user.selectOptions(screen.getByLabelText(l), "");
    }
    expect(page().style.spacing).toBeUndefined();
    expect(Object.keys(cssVarsFor(page().style))).toEqual([]);
  });
  it("el ancho ofrece los cuatro valores", async () => {
    const { user } = await setup();
    await open(user);
    expect(within(screen.getByLabelText("Ancho de la página")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Predeterminado", "Estrecho", "Normal", "Amplio", "Completo"]);
  });
});

describe("color de acento (E-123)", () => {
  it("nueve muestras y «Predeterminado»; elegir una cambia --c-accent", async () => {
    const { user, page } = await setup();
    await open(user);
    const group = within(screen.getByRole("radiogroup", { name: "Color de acento" }));
    expect(group.getAllByRole("radio")).toHaveLength(10);
    await user.click(group.getByRole("radio", { name: "Morado" }));
    expect(cssVarsFor(page().style)["--c-accent"]).toBe("var(--block-purple-text)");
    await user.click(group.getByRole("radio", { name: "Predeterminado" }));
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
    expect(m.className).toContain("max-sm:w-[calc(100vw-2rem)]");
    expect(m.className).toContain("max-w-[calc(100vw-2rem)]");
    expect(m.className).toContain("w-80");
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
    expect(screen.getByLabelText("Niveles del índice")).toHaveValue("3");
    await user.selectOptions(screen.getByLabelText("Niveles del índice"), "2");
    expect(page().style.toc).toEqual({ maxLevel: 2 });
    await user.selectOptions(screen.getByLabelText("Niveles del índice"), "3");
    expect(page().style.toc).toBeUndefined();
  });
});
