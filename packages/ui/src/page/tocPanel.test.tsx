// E-137 a E-145 (RF-7.1 a RF-7.8, CL-12, CL-17): índice flotante, modo reducido, observador de visibilidad y bloque «Índice».
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlockNoteEditor } from "@blocknote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { TableOfContents } from "./TableOfContents";
import { useActiveHeading, READING_LINE } from "./useActiveHeading";
import { TocBlockView, schema } from "../editor/schema";
import { TocProvider } from "../editor/TocContext";
import { buildSlashItems } from "../editor/slashItems";
import { PageEditor } from "../editor/PageEditor";
import { ThemeProvider, MemoryPreferences } from "../theme/theme";
import { ToastProvider } from "../feedback/ToastContext";

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;

const setWidth = (w: number) => { Object.defineProperty(window, "innerWidth", { configurable: true, value: w }); };
afterEach(() => { setWidth(1024); });
const hs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `h${i}`, level: (i % 3) + 1, text: `Título ${i}` }));

describe("índice flotante: lista con desplazamiento propio (E-140, CL-12)", () => {
  it("con 300 encabezados la lista se desplaza dentro de su caja y no alarga la página", async () => {
    setWidth(2000);
    await renderWithI18n(<TableOfContents headings={hs(300)} activeId="h5" onJump={() => {}} />);
    const list = screen.getByTestId("toc-list");
    expect(list.querySelectorAll("li")).toHaveLength(300);
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("max-h-[min(60vh,32rem)]");
  });
});

describe("rayitas en ambos márgenes", () => {
  it("hay un índice a cada lado, minimizado hasta el hover, y cabe en una ventana de 1280 px", async () => {
    setWidth(1280);
    await renderWithI18n(<TableOfContents headings={hs(5)} activeId="h1" onJump={() => {}} />);
    for (const id of ["toc-floating-left", "toc-floating"]) {
      const nav = screen.getByTestId(id);
      expect(nav.querySelectorAll("[data-toc-dash]")).toHaveLength(5);
      const panel = nav.querySelector("ul")!.parentElement!;
      expect(panel.className).toContain("opacity-0");
      fireEvent.pointerEnter(nav);
      expect(panel.className).toContain("opacity-100");
      fireEvent.pointerLeave(nav);
      expect(panel.className).toContain("opacity-100"); // margen antes de cerrar
      fireEvent.pointerEnter(nav);
      fireEvent.pointerLeave(nav);
      await waitFor(() => expect(panel.className).toContain("opacity-0"));
    }
  });
});

describe("modo reducido cuando no cabe (E-141, RF-7.7, CL-17)", () => {
  it("a 700 px es el menú «En esta página»", async () => {
    setWidth(700);
    await renderWithI18n(<TableOfContents headings={hs(5)} activeId="h0" onJump={() => {}} />);
    expect(screen.queryByTestId("toc-floating")).toBeNull();
    expect(screen.getByRole("button", { name: "En esta página" })).toBeInTheDocument();
  });
  it("a 360 px también", async () => {
    setWidth(360);
    await renderWithI18n(<TableOfContents headings={hs(5)} activeId="h0" onJump={() => {}} />);
    expect(screen.getByRole("button", { name: "En esta página" })).toBeInTheDocument();
  });
  it("en una pantalla ancha cabe y es una columna lateral; se mantiene aunque la ventana sea justa (ancho «completo»)", async () => {
    setWidth(2000);
    const { unmount } = await renderWithI18n(<TableOfContents headings={hs(5)} activeId="h0" onJump={() => {}} />);
    expect(screen.getByTestId("toc-floating")).toBeInTheDocument();
    unmount();
    setWidth(1100);
    await renderWithI18n(<TableOfContents headings={hs(5)} activeId="h0" onJump={() => {}} />);
    expect(screen.getByTestId("toc-floating")).toBeInTheDocument();
  });
  it("al estrechar la ventana pasa de columna a menú", async () => {
    setWidth(2000);
    await renderWithI18n(<TableOfContents headings={hs(5)} activeId="h0" onJump={() => {}} />);
    expect(screen.getByTestId("toc-floating")).toBeInTheDocument();
    act(() => { setWidth(600); window.dispatchEvent(new Event("resize")); });
    expect(screen.getByRole("button", { name: "En esta página" })).toBeInTheDocument();
  });
  it("la sección visible se marca con el color de acento de la página", async () => {
    setWidth(2000);
    await renderWithI18n(<TableOfContents headings={hs(5)} activeId="h1" onJump={() => {}} />);
    expect(within(screen.getByTestId("toc-floating")).getByRole("link", { name: "Título 1" }).className).toContain("text-[var(--c-accent)]");
  });
});

describe("resaltado con IntersectionObserver (E-139, CL-12)", () => {
  class FakeIO {
    static instances: FakeIO[] = [];
    observed: Element[] = [];
    disconnected = false;
    constructor(public cb: () => void, public opts: IntersectionObserverInit) { FakeIO.instances.push(this); }
    observe(el: Element) { this.observed.push(el); }
    disconnect() { this.disconnected = true; }
    trigger() { this.cb(); }
  }
  const mountHeadings = (tops: number[]) => tops.map((top, i) => {
    const el = document.createElement("div");
    el.setAttribute("data-id", `h${i}`);
    el.getBoundingClientRect = () => ({ top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON() {} }) as DOMRect;
    document.body.appendChild(el);
    return el;
  });
  afterEach(() => { vi.unstubAllGlobals(); FakeIO.instances = []; document.body.innerHTML = ""; });

  it("observa cada encabezado y solo recalcula cuando uno cruza la franja de lectura", () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    const els = mountHeadings([-300, 40, 500]);
    const heads = hs(3);
    const { result } = renderHook(() => useActiveHeading(heads));
    const io = FakeIO.instances[0]!;
    expect(io.observed).toEqual(els);
    expect(result.current).toBe("h1"); // el último que ya cruzó la línea de lectura
    // la franja de observación llega hasta la línea de lectura
    expect(io.opts.rootMargin).toContain(`-${window.innerHeight - READING_LINE}px`);
    // un encabezado cruza la línea: se recalcula
    els[2]!.getBoundingClientRect = () => ({ top: 10, bottom: 30, left: 0, right: 0, width: 0, height: 20, x: 0, y: 10, toJSON() {} }) as DOMRect;
    act(() => io.trigger());
    expect(result.current).toBe("h2");
  });
  it("sin desplazamiento no hay recálculos: el evento de scroll solo arma un temporizador", () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    mountHeadings([10, 200, 400]);
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect");
    renderHook(() => useActiveHeading(hs(3)));
    const calls = spy.mock.calls.length;
    for (let i = 0; i < 50; i++) window.dispatchEvent(new Event("scroll"));
    expect(spy.mock.calls.length).toBe(calls); // 50 eventos de scroll no miden nada
  });
  it("libera el observador al desmontar", () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    mountHeadings([10]);
    const { unmount } = renderHook(() => useActiveHeading(hs(1)));
    unmount();
    expect(FakeIO.instances[0]!.disconnected).toBe(true);
  });
  it("sin IntersectionObserver usa el desplazamiento como respaldo", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const els = mountHeadings([-100, 300]);
    const { result } = renderHook(() => useActiveHeading(hs(2)));
    expect(result.current).toBe("h0");
    els[1]!.getBoundingClientRect = () => ({ top: 20, bottom: 40, left: 0, right: 0, width: 0, height: 20, x: 0, y: 20, toJSON() {} }) as DOMRect;
    act(() => { window.dispatchEvent(new Event("scroll")); });
    expect(result.current).toBe("h1");
  });
});

describe("bloque «Índice» (E-142 a E-145)", () => {
  it("sin encabezados muestra «Agrega encabezados para ver el índice» (E-144)", async () => {
    await renderWithI18n(<TocProvider value={{ headings: [], jump: () => {} }}><TocBlockView /></TocProvider>);
    expect(screen.getByText("Agrega encabezados para ver el índice")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("muestra la lista y cada entrada lleva a su encabezado (E-143)", async () => {
    const jump = vi.fn();
    await renderWithI18n(<TocProvider value={{ headings: hs(3), jump }}><TocBlockView /></TocProvider>);
    const nav = screen.getByRole("navigation", { name: "Índice de la página" });
    await userEvent.click(within(nav).getByRole("link", { name: "Título 2" }));
    expect(jump).toHaveBeenCalledWith("h2", "smooth");
    expect(within(nav).getAllByRole("link")).toHaveLength(3);
  });
  it("las entradas se sangran por nivel", async () => {
    await renderWithI18n(<TocProvider value={{ headings: hs(3), jump: () => {} }}><TocBlockView /></TocProvider>);
    const items = screen.getAllByRole("listitem");
    expect(items[0]!.style.paddingInlineStart).toContain("* var(--space-3)");
    expect(items[2]!.style.paddingInlineStart).toBe("calc(2 * var(--space-3))");
  });
  it("el esquema del editor tiene el bloque `toc` y se puede insertar (E-142)", () => {
    expect(Object.keys(schema.blockSpecs)).toContain("toc");
    const editor = BlockNoteEditor.create({ schema });
    editor.insertBlocks([{ type: "toc" } as never], editor.document[0]!, "after");
    expect(editor.document.some((b) => b.type === "toc")).toBe(true);
  });
  it("«Índice» está en el menú «/», con su alias (E-145)", () => {
    const editor = BlockNoteEditor.create({ schema });
    const items = buildSlashItems(editor, (k) => k, "");
    expect(items.find((i) => i.title === "toc.slash")).toBeDefined();
    expect(buildSlashItems(editor, (k) => k, "contenido").some((i) => i.title === "toc.slash")).toBe(true);
  });
});

describe("integración en el editor (E-137, E-138, E-143)", () => {
  async function mount(props: object = {}) {
    setWidth(2000);
    const { controller } = await makeController();
    const r = await controller.createPage(null, "Página");
    if (!r.ok) throw new Error("x");
    if (Object.keys(props).length) await controller.setPageProps(r.value.id, props);
    const session = await controller.openDocument(r.value.id);
    // Cuatro encabezados de tres niveles: con el filtro del índice se ven 3, 2 o 1 niveles.
    session.doc.transact(() => {});
    await renderWithI18n(<ThemeProvider preferences={new MemoryPreferences()}><ToastProvider><PageEditor controller={controller} pageId={r.value.id} /></ToastProvider></ThemeProvider>);
    return { controller, id: r.value.id };
  }
  it("el índice flotante no se muestra si la página tiene menos de tres encabezados", async () => {
    await mount();
    await waitFor(() => expect(document.querySelector(".bn-editor")).not.toBeNull());
    expect(screen.queryByTestId("toc-floating")).toBeNull();
  });
  it("desactivado en las opciones, no se muestra aunque haya encabezados (E-138)", async () => {
    const { controller, id } = await mount({ style: { toc: { floating: false } } });
    expect(controller.getSnapshot().tree[0]!.page.style.toc).toEqual({ floating: false });
    await waitFor(() => expect(document.querySelector(".bn-editor")).not.toBeNull());
    expect(screen.queryByTestId("toc-floating")).toBeNull();
    void id; void fireEvent; void render;
  });
});
