// R-126 a R-145 (prueba primero): el mapa mental sobre el lienzo compartido, con clic único, menú junto al globo y color por globo y rama.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, screen, within, cleanup, waitFor } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { MindMapEditor } from "./MindMapEditor";
import { GRID_PREFS_KEY } from "../canvas/gridPrefs";
import { addChild, findNode, parseTree, serializeTree, newTree, type Tree } from "@vnote/core";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const sample = (extra: Partial<Tree> = {}): Tree => {
  let t = newTree("Tema");
  t = must(addChild(t, "root", "A", "a")).tree; t = must(addChild(t, "root", "B", "b")).tree;
  t = must(addChild(t, "a", "A1", "a1")).tree; t = must(addChild(t, "a1", "A1x", "a1x")).tree;
  return { ...t, ...extra };
};
async function mount(t: Tree | "") {
  const saved: string[] = [];
  const onChange = vi.fn((s: string) => { saved.push(s); });
  const utils = await renderWithI18n(<MindMapEditor value={t === "" ? "" : serializeTree(t)} onChange={onChange} />);
  return { ...utils, saved, onChange, last: (): Tree => must(parseTree(saved[saved.length - 1]!)) };
}
const bubble = (id: string) => document.querySelector(`[data-mind-id="${id}"]`) as HTMLElement;
const frame = () => screen.getByTestId("mindmap");
const menu = () => document.querySelector("[data-floating-menu]") as HTMLElement | null;
const click = (id: string) => { fireEvent.pointerDown(bubble(id), { button: 0, clientX: 10, clientY: 10, pointerId: 1 }); fireEvent.pointerUp(window, { clientX: 10, clientY: 10, pointerId: 1 }); };
const dragTo = (id: string, dx: number, dy: number) => {
  fireEvent.pointerDown(bubble(id), { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: 100 + dx / 2, clientY: 100 + dy / 2, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1 });
};

beforeEach(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe("lienzo (R-126, R-128, R-133, R-141)", () => {
  it("se muestra dentro del marco, con el alto guardado", async () => {
    await mount(sample({ view: { height: 500 } }));
    expect(frame()).toHaveAttribute("role", "group");
    expect(frame().style.width).toBe("100%");
    expect(frame().style.height).toBe("500px");
    expect(frame()).toHaveAccessibleName("Mapa mental");
  });
  it("un mapa nuevo tiene un alto entre 320 y 560 px y no se escribe al abrirlo", async () => {
    const { onChange } = await mount("");
    const h = parseInt(frame().style.height, 10);
    expect(h).toBeGreaterThanOrEqual(320); expect(h).toBeLessThanOrEqual(560);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("las líneas toman el color `line` del hijo (R-127)", async () => {
    let t = sample();
    t = must((await import("@vnote/core")).setTreeNodeStyle(t, "a", "line", "#336699"));
    await mount(t);
    expect(document.querySelector('[data-edge="root>a"]')!.getAttribute("stroke")).toBe("#336699");
    expect(document.querySelector('[data-edge="root>b"]')).not.toBeNull();
  });
  it("los colapsados ocultan a sus descendientes y muestran el indicador (R-128)", async () => {
    await mount(sample({ root: { ...sample().root, children: sample().root.children.map((c) => (c.id === "a" ? { ...c, collapsed: true } : c)) } }));
    expect(bubble("a1")).toBeNull();
    expect(bubble("a").querySelector("[data-mind-hidden]")!.textContent).toBe("+2");
    expect(bubble("a")).toHaveAttribute("aria-expanded", "false");
  });
  it("no existen el campo «Texto hijo» ni la franja inferior (R-141)", async () => {
    await mount(sample());
    expect(screen.queryByLabelText(/Texto hijo/i)).toBeNull();
    expect(screen.queryByRole("region", { name: "Propiedades de la idea" })).toBeNull();
  });
});

describe("clic único (R-134 a R-137, R-140)", () => {
  it("un clic sin movimiento selecciona, abre el menú y pone el texto en edición", async () => {
    await mount(sample());
    click("a");
    expect(bubble("a")).toHaveAttribute("data-selected", "true");
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(within(bubble("a")).getByRole("textbox")).toHaveValue("A");
  });
  it("un arrastre de más de 5 px no abre el campo de texto", async () => {
    await mount(sample());
    dragTo("b", 60, 0);
    expect(within(bubble("b")).queryByRole("textbox")).toBeNull();
  });
  it("el texto se confirma al salir del campo, un paso de historial por edición (R-136)", async () => {
    const { onChange, last } = await mount(sample());
    click("a");
    const input = within(bubble("a")).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Rama A" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(findNode(last(), "a")!.text).toBe("Rama A");
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(findNode(last(), "a")!.text).toBe("A");
  });
  it("Enter confirma el texto", async () => {
    const { last } = await mount(sample());
    click("b");
    const input = within(bubble("b")).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Otra" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(findNode(last(), "b")!.text).toBe("Otra");
    expect(within(bubble("b")).queryByRole("textbox")).toBeNull();
  });
  it("Esc cierra el menú sin perder el texto escrito (R-137)", async () => {
    const { last } = await mount(sample());
    click("b");
    const input = within(bubble("b")).getByRole("textbox");
    fireEvent.change(input, { target: { value: "A medias" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(findNode(last(), "b")!.text).toBe("A medias");
    await waitFor(() => expect(menu()).toBeNull());
  });
  it("un globo vacío muestra el texto de relleno y se conserva (R-140)", async () => {
    const { last } = await mount(sample());
    click("b");
    const input = within(bubble("b")).getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(findNode(last(), "b")).not.toBeNull();
    expect(bubble("b").textContent).toContain("Escribe una idea");
  });
});

describe("menú del globo (R-138, R-139, R-145)", () => {
  it("agregar hijo y hermano; la raíz no ofrece hermano ni eliminar", async () => {
    const { last } = await mount(sample());
    click("root");
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(within(menu()!).queryByRole("button", { name: "Agregar hermano" })).toBeNull();
    expect(within(menu()!).queryByRole("button", { name: "Eliminar" })).toBeNull();
    fireEvent.click(within(menu()!).getByRole("button", { name: "Agregar hijo" }));
    expect(findNode(last(), "root")!.children).toHaveLength(3);
    const id = findNode(last(), "root")!.children[2]!.id;
    expect(findNode(last(), id)!.style).toBeUndefined();
    click("b");
    fireEvent.click(within(menu()!).getByRole("button", { name: "Agregar hermano" }));
    expect(findNode(last(), "root")!.children.map((c) => c.id).slice(0, 3)).toEqual(["a", "b", expect.any(String)]);
  });
  it("colapsar y expandir solo con hijos", async () => {
    const { last } = await mount(sample());
    click("b");
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(within(menu()!).queryByRole("button", { name: "Colapsar" })).toBeNull();
    click("a");
    fireEvent.click(within(menu()!).getByRole("button", { name: "Colapsar" }));
    expect(findNode(last(), "a")!.collapsed).toBe(true);
  });
  it("eliminar con hijos avisa cuántos globos se eliminan y se puede deshacer (R-139)", async () => {
    const { last, saved } = await mount(sample());
    click("a");
    await waitFor(() => expect(menu()).not.toBeNull());
    fireEvent.click(within(menu()!).getByRole("button", { name: "Eliminar" }));
    expect(findNode(last(), "a")).toBeNull();
    const notice = document.querySelector("[data-mind-notice]") as HTMLElement;
    expect(notice.textContent).toContain("3 globos");
    fireEvent.click(within(notice).getByRole("button", { name: "Deshacer" }));
    expect(findNode(last(), "a1x")).not.toBeNull();
    expect(saved.length).toBe(2);
  });
});

describe("color (R-142 a R-145)", () => {
  it("cada color se aplica al elemento correcto (R-142)", async () => {
    const { last } = await mount(sample());
    click("b");
    await waitFor(() => expect(menu()).not.toBeNull());
    for (const [label, key] of [["Relleno", "fill"], ["Borde", "stroke"], ["Texto", "text"], ["Línea", "line"]] as const) {
      fireEvent.click(within(menu()!).getByRole("button", { name: label }));
      const group = within(menu()!).getByRole("group", { name: label });
      fireEvent.click(within(group).getAllByRole("button")[2]!);
      expect(findNode(last(), "b")!.style![key]).toMatch(/^palette:/);
    }
  });
  it("avisa del poco contraste sin impedir la elección (R-143)", async () => {
    const { last } = await mount(sample());
    click("b");
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(menu()!.querySelector("[data-contrast-warning]")).toBeNull();
    fireEvent.click(within(menu()!).getByRole("button", { name: "Relleno" }));
    fireEvent.change(within(within(menu()!).getByRole("group", { name: "Relleno" })).getByRole("textbox"), { target: { value: "#ffff00" } });
    fireEvent.click(within(menu()!).getByRole("button", { name: "Texto" }));
    fireEvent.change(within(within(menu()!).getByRole("group", { name: "Texto" })).getByRole("textbox"), { target: { value: "#ffffcc" } });
    expect(menu()!.querySelector("[data-contrast-warning]")).not.toBeNull();
    expect(findNode(last(), "b")!.style).toEqual({ fill: "#ffff00", text: "#ffffcc" });
  });
  it("«Aplicar a la rama» copia el estilo a los descendientes en un solo paso (R-144)", async () => {
    const { last, saved } = await mount(sample());
    click("a");
    await waitFor(() => expect(menu()).not.toBeNull());
    fireEvent.click(within(menu()!).getByRole("button", { name: "Relleno" }));
    const fill = within(menu()!).getByRole("group", { name: "Relleno" });
    fireEvent.click(within(fill).getAllByRole("button")[1]!);
    const before = saved.length;
    fireEvent.click(within(menu()!).getByRole("button", { name: "Aplicar a la rama" }));
    expect(saved.length).toBe(before + 1);
    expect(findNode(last(), "a1x")!.style!.fill).toBe(findNode(last(), "a")!.style!.fill);
    expect(findNode(last(), "b")!.style).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(findNode(last(), "a1x")!.style).toBeUndefined();
  });
});

describe("mover (R-146, R-147, R-149)", () => {
  it("arrastrar mueve el globo con su rama y guarda un solo paso al soltar", async () => {
    localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: true, snap: false }));
    const { onChange, last } = await mount(sample());
    const before = parseTree(serializeTree(sample())).ok;
    expect(before).toBe(true);
    dragTo("a", 80, 40);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(findNode(last(), "a")!.off).toEqual({ x: 80, y: 40 });
    expect(findNode(last(), "a1")!.off).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(findNode(last(), "a")!.off).toBeUndefined();
  });
  it("con acomodo activo la posición queda en la cuadrícula", async () => {
    const { last } = await mount(sample());
    dragTo("b", 77, 33);
    const off = findNode(last(), "b")!.off!;
    expect((off.x + 0) % 20).toBe(0);
  });
  it("«Reordenar automáticamente» borra los desplazamientos en un paso (R-149)", async () => {
    const { last, onChange } = await mount(sample());
    dragTo("b", 80, 40);
    onChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Reordenar automáticamente" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(last())).not.toContain("off");
  });
});

describe("teclado y avisos (R-155 a R-163)", () => {
  const focusKey = (id: string, init: KeyboardEventInit) => fireEvent.keyDown(bubble(id), init);
  it("Enter abre el menú y la edición del globo enfocado (R-160)", async () => {
    await mount(sample());
    bubble("b").focus();
    focusKey("b", { key: "Enter" });
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(within(bubble("b")).getByRole("textbox")).toBeTruthy();
  });
  it("las flechas mueven una celda, Mayús cinco; con el acomodo apagado, 1 y 10 px (R-161)", async () => {
    const { last } = await mount(sample());
    focusKey("b", { key: "ArrowRight" });
    expect(findNode(last(), "b")!.off).toEqual({ x: 20, y: 0 });
    focusKey("b", { key: "ArrowDown", shiftKey: true });
    expect(findNode(last(), "b")!.off).toEqual({ x: 20, y: 100 });
    cleanup();
    localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: true, snap: false }));
    const m = await mount(sample());
    focusKey("b", { key: "ArrowLeft" });
    expect(findNode(m.last(), "b")!.off).toEqual({ x: -1, y: 0 });
    focusKey("b", { key: "ArrowUp", shiftKey: true });
    expect(findNode(m.last(), "b")!.off).toEqual({ x: -1, y: -10 });
  });
  it("Supr elimina y avisa en la región de estado (R-162, R-163)", async () => {
    const { last } = await mount(sample());
    focusKey("a", { key: "Delete" });
    expect(findNode(last(), "a")).toBeNull();
    expect(document.querySelector("[data-mind-status]")!.textContent).toContain("3 globos");
  });
  it("Ctrl+C y Ctrl+V copian y pegan una rama como hija (R-162)", async () => {
    const { last } = await mount(sample());
    focusKey("a", { key: "c", ctrlKey: true });
    focusKey("b", { key: "v", ctrlKey: true });
    const b = findNode(last(), "b")!;
    expect(b.children).toHaveLength(1);
    expect(b.children[0]!.text).toBe("A");
    expect(b.children[0]!.children[0]!.children[0]!.text).toBe("A1x");
    expect(b.children[0]!.id).not.toBe("a");
  });
  it("seleccionar anuncia el globo en la región de estado (R-163)", async () => {
    await mount(sample());
    click("a");
    expect(document.querySelector("[data-mind-status]")!.textContent).toContain("A");
  });
  it("+ − 0 hacen zoom y F ajusta (R-162)", async () => {
    await mount(sample());
    const out = () => screen.getByLabelText("Nivel de zoom").textContent;
    focusKey("b", { key: "0" });
    await waitFor(() => expect(out()).toContain("100"));
    focusKey("b", { key: "-" });
    await waitFor(() => expect(out()).not.toContain("100 %"));
  });
});

describe("alto y vista ampliada (R-158, R-159)", () => {
  it("el alto se cambia con el teclado, un paso de historial", async () => {
    const { last, onChange } = await mount(sample({ view: { height: 400 } }));
    fireEvent.keyDown(screen.getByRole("separator", { name: "Alto del lienzo" }), { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last().view).toEqual({ height: 420 });
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(last().view).toEqual({ height: 400 });
  });
  it("ampliar y salir conserva la selección y el texto a medias (R-159)", async () => {
    await mount(sample());
    click("a");
    const input = within(bubble("a")).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Escribiendo" } });
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    expect(frame()).toHaveAttribute("data-expanded");
    fireEvent.click(screen.getByRole("button", { name: "Salir de la vista ampliada" }));
    expect(bubble("a")).toHaveAttribute("data-selected", "true");
    expect(within(bubble("a")).getByRole("textbox")).toHaveValue("Escribiendo");
  });
  it("Ctrl+Mayús+F amplía con el texto del globo en edición (R-162)", async () => {
    await mount(sample());
    click("a");
    const input = within(bubble("a")).getByRole("textbox");
    fireEvent.keyDown(input, { key: "F", ctrlKey: true, shiftKey: true });
    expect(frame()).toHaveAttribute("data-expanded");
    fireEvent.keyDown(input, { key: "F", ctrlKey: true, shiftKey: true });
    expect(frame()).not.toHaveAttribute("data-expanded");
  });
});

describe("cuadrícula, vista y foco (R-129, R-151, R-152, R-157, R-165)", () => {
  it("el texto largo se ajusta en líneas dentro del globo (R-129)", async () => {
    await mount(sample({ root: { ...sample().root, children: [{ id: "a", text: "Un texto muy largo ".repeat(20), children: [] }] } }));
    const span = bubble("a").querySelector("span")!;
    expect(span.className).toContain("line-clamp-2");
    expect(span.getAttribute("title")).toContain("Un texto muy largo");
  });
  it("la cuadrícula del mapa usa el paso del núcleo (R-151)", async () => {
    await mount(sample());
    const pattern = document.querySelector(`${"[data-testid=mindmap]"} .react-flow__background pattern`);
    expect(pattern).not.toBeNull();
    expect(Number(pattern!.getAttribute("width"))).toBe(20);
  });
  it("con Alt el movimiento es libre aunque el acomodo esté activo (R-152)", async () => {
    const { last } = await mount(sample());
    fireEvent.pointerDown(bubble("b"), { button: 0, clientX: 100, clientY: 100, pointerId: 1, altKey: true });
    fireEvent.pointerMove(window, { clientX: 137, clientY: 113, pointerId: 1, altKey: true });
    fireEvent.pointerUp(window, { clientX: 137, clientY: 113, pointerId: 1, altKey: true });
    expect(findNode(last(), "b")!.off).toEqual({ x: 37, y: 13 });
  });
  it("«Ajustar a pantalla» avisa si el mapa no cabe ni al zoom mínimo (R-157)", async () => {
    let t = sample();
    t = { ...t, root: { ...t.root, children: t.root.children.map((c) => (c.id === "a" ? { ...c, off: { x: 400000, y: 0 } } : c)) } };
    await mount(t);
    fireEvent.click(screen.getByRole("button", { name: "Ajustar a pantalla" }));
    expect(document.querySelector("[data-mind-notice]")!.textContent).toContain("no cabe");
  });
  it("Tab no atrapa el foco fuera de la vista ampliada (R-165)", async () => {
    await mount(sample());
    const last = [...frame().querySelectorAll<HTMLElement>("button")].pop()!;
    expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(true);
  });
});

describe("táctil (R-164)", () => {
  it("el globo amplía su área sensible con un puntero grueso", async () => {
    await mount(sample());
    expect(bubble("a").className).toContain("pointer:coarse");
  });
});

describe("pulido visual (menú compacto y controles)", () => {
  it("el menú es una barra compacta: los selectores de color solo aparecen al abrir su botón, de uno en uno", async () => {
    await mount(sample());
    click("b");
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(within(menu()!).queryByRole("group", { name: "Relleno" })).toBeNull();
    const fill = within(menu()!).getByRole("button", { name: "Relleno" });
    expect(fill).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(fill);
    expect(fill).toHaveAttribute("aria-expanded", "true");
    expect(within(menu()!).getByRole("group", { name: "Relleno" })).toBeTruthy();
    fireEvent.click(within(menu()!).getByRole("button", { name: "Borde" }));
    expect(within(menu()!).queryByRole("group", { name: "Relleno" })).toBeNull();
    expect(within(menu()!).getByRole("group", { name: "Borde" })).toBeTruthy();
  });
  it("la raíz no ofrece color de línea (no tiene línea a un padre)", async () => {
    await mount(sample());
    click("root");
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(within(menu()!).queryByRole("button", { name: "Línea" })).toBeNull();
  });
  it("el porcentaje de zoom es el botón que vuelve al 100 %", async () => {
    await mount(sample());
    const reset = screen.getByRole("button", { name: "Restablecer al 100 %" });
    expect(within(reset).getByLabelText("Nivel de zoom")).toBeTruthy();
  });
});

describe("alta rápida de globos", () => {
  it("sin selección no hay botón de alta rápida; el globo seleccionado lo muestra fuera del globo", async () => {
    await mount(sample());
    expect(screen.queryByRole("button", { name: "Nuevo globo hijo" })).toBeNull();
    click("b");
    const add = await screen.findByRole("button", { name: "Nuevo globo hijo" });
    expect(bubble("b").contains(add)).toBe(false); // sin controles anidados dentro del globo
  });
  it("el botón + agrega un hijo, conserva el texto que se estaba escribiendo y deja el nuevo en edición", async () => {
    const { last } = await mount(sample());
    click("b");
    fireEvent.change(within(bubble("b")).getByRole("textbox"), { target: { value: "Beta" } });
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo globo hijo" }));
    const b = findNode(last(), "b")!;
    expect(b.text).toBe("Beta");
    expect(b.children).toHaveLength(1);
    await waitFor(() => expect(within(bubble(b.children[0]!.id)).getByRole("textbox")).toBeTruthy());
    expect(menu()).not.toBeNull();
  });
  it("Tab mientras se escribe guarda el texto y agrega un hijo", async () => {
    const { last } = await mount(sample());
    click("b");
    const input = within(bubble("b")).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Beta" } });
    fireEvent.keyDown(input, { key: "Tab" });
    const b = findNode(last(), "b")!;
    expect(b.text).toBe("Beta");
    expect(b.children).toHaveLength(1);
  });
  it("Mayús + Tab no agrega nada (sigue siendo navegación)", async () => {
    const { onChange } = await mount(sample());
    click("b");
    fireEvent.keyDown(within(bubble("b")).getByRole("textbox"), { key: "Tab", shiftKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });
});

