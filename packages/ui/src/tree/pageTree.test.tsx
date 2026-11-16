// T-111 (prueba primero): árbol lateral virtualizado, accesible por teclado.
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Page, PageNode } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { flattenTree } from "./flatten";
import { PageTree } from "./PageTree";

const page = (id: string, title: string, parentId: string | null = null): Page => ({
  id, parentId, position: id, title, icon: null, cover: null, kind: "note", favorite: false,
  style: {}, description: null, locked: false, coverCredit: null, createdAt: 0, updatedAt: 0, deletedAt: null, deletedRootId: null,
});
const node = (id: string, title: string, children: PageNode[] = []): PageNode => ({ page: page(id, title), children });

const sample: PageNode[] = [
  node("a", "A", [node("a1", "A1", [node("a1x", "A1X")]), node("a2", "A2")]),
  node("b", "B"),
];

describe("flattenTree", () => {
  it("solo incluye los hijos de nodos expandidos, con su profundidad", () => {
    expect(flattenTree(sample, new Set()).map((r) => r.node.page.id)).toEqual(["a", "b"]);
    const rows = flattenTree(sample, new Set(["a", "a1"]));
    expect(rows.map((r) => [r.node.page.id, r.depth])).toEqual([["a", 0], ["a1", 1], ["a1x", 2], ["a2", 1], ["b", 0]]);
    expect(rows[0]).toMatchObject({ hasChildren: true, expanded: true });
    expect(rows[4]).toMatchObject({ hasChildren: false, expanded: false });
  });
  it("un nodo expandido sin hijos no rompe nada", () => {
    expect(flattenTree([node("x", "X")], new Set(["x"]))).toHaveLength(1);
  });
  it("aplana 5 000 páginas en menos de 50 ms", () => {
    const big = Array.from({ length: 50 }, (_, i) => node(`n${i}`, `N${i}`, Array.from({ length: 99 }, (_, j) => node(`n${i}-${j}`, `H${j}`))));
    const t = performance.now();
    const rows = flattenTree(big, new Set(big.map((n) => n.page.id)));
    expect(rows).toHaveLength(5000);
    expect(performance.now() - t).toBeLessThan(50);
  });
});

const noop = () => {};
const renderTree = (props: Partial<React.ComponentProps<typeof PageTree>> = {}) =>
  renderWithI18n(<PageTree nodes={sample} expanded={new Set(["a"])} selectedId={null} onSelect={noop} onToggle={noop} height={400} {...props} />);

describe("PageTree", () => {
  it("expone un árbol accesible con niveles y estado de expansión", async () => {
    await renderTree();
    expect(screen.getByRole("tree")).toBeInTheDocument();
    const items = screen.getAllByRole("treeitem");
    expect(items.map((i) => i.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("A"), expect.stringContaining("B")]));
    const a = screen.getByRole("treeitem", { name: /^A$/ });
    expect(a).toHaveAttribute("aria-level", "1");
    expect(a).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("treeitem", { name: /^A1$/ })).toHaveAttribute("aria-level", "2");
    expect(screen.getByRole("treeitem", { name: /^B$/ })).not.toHaveAttribute("aria-expanded");
  });
  it("marca la página seleccionada", async () => {
    await renderTree({ selectedId: "b" });
    expect(screen.getByRole("treeitem", { name: /^B$/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("treeitem", { name: /^A$/ })).toHaveAttribute("aria-selected", "false");
  });
  it("un clic selecciona y el botón de despliegue alterna sin seleccionar", async () => {
    const onSelect = vi.fn(); const onToggle = vi.fn();
    await renderTree({ onSelect, onToggle });
    const user = userEvent.setup();
    await user.click(screen.getByRole("treeitem", { name: /^B$/ }));
    expect(onSelect).toHaveBeenCalledWith("b");
    onSelect.mockClear();
    await user.click(screen.getByRole("button", { name: /alternar subpáginas de A$/i }));
    expect(onToggle).toHaveBeenCalledWith("a");
    expect(onSelect).not.toHaveBeenCalled();
  });
  it("las páginas sin título se muestran como «Sin título» (CL-2)", async () => {
    await renderTree({ nodes: [node("x", "   ")], expanded: new Set() });
    expect(screen.getByRole("treeitem", { name: "Sin título" })).toBeInTheDocument();
  });
  it("con muchas páginas solo dibuja las visibles (virtualización)", async () => {
    const big = Array.from({ length: 5000 }, (_, i) => node(`p${i}`, `Página ${i}`));
    await renderTree({ nodes: big, expanded: new Set(), height: 320 });
    const rendered = screen.getAllByRole("treeitem").length;
    expect(rendered).toBeGreaterThan(5);
    expect(rendered).toBeLessThan(60);
  });
  it("al desplazarse se dibujan otras filas", async () => {
    const big = Array.from({ length: 5000 }, (_, i) => node(`p${i}`, `Página ${i}`));
    await renderTree({ nodes: big, expanded: new Set(), height: 320 });
    expect(screen.queryByRole("treeitem", { name: "Página 2500" })).toBeNull();
    const scroller = screen.getByRole("tree");
    act(() => { scroller.scrollTop = 2500 * 32; fireEvent.scroll(scroller); });
    expect(await screen.findByRole("treeitem", { name: "Página 2500" })).toBeInTheDocument();
  });
  it("navegación con teclado: flechas, Enter, derecha e izquierda", async () => {
    const onSelect = vi.fn(); const onToggle = vi.fn();
    await renderTree({ onSelect, onToggle, expanded: new Set(["a"]), selectedId: "a" });
    const tree = screen.getByRole("tree");
    const user = userEvent.setup();
    tree.focus();
    await user.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenLastCalledWith("a1");
    await user.keyboard("{ArrowUp}");
    expect(onSelect).toHaveBeenLastCalledWith("a");
    await user.keyboard("{ArrowLeft}"); // contraer A (está expandido)
    expect(onToggle).toHaveBeenLastCalledWith("a");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("a");
  });
});

// ---- Spec 002 (U-079 a U-082): filas del árbol con el estándar ----
describe("filas del estándar (RF-4.2, RF-4.3, CL-1, CL-7)", () => {
  const deep = (n: number): PageNode => { let cur = node(`n${n}`, `Nivel ${n}`); for (let i = n - 1; i >= 0; i--) cur = node(`n${i}`, `Nivel ${i}`, [cur]); return cur; };
  const open = (ids: string[]) => new Set(ids);

  it("la fila mide 32 px por defecto y 28 px en densidad compacta", async () => {
    await renderWithI18n(<PageTree nodes={[node("a", "A")]} expanded={new Set()} selectedId={null} onSelect={() => {}} onToggle={() => {}} />);
    expect(screen.getByRole("treeitem", { name: "A" })).toHaveStyle({ height: "32px" });
    await renderWithI18n(<PageTree nodes={[node("c", "C")]} expanded={new Set()} selectedId={null} onSelect={() => {}} onToggle={() => {}} rowHeight={28} />);
    expect(screen.getByRole("treeitem", { name: "C" })).toHaveStyle({ height: "28px" });
  });
  it("la página activa lleva barra de acento y fondo (no depende solo del color)", async () => {
    await renderWithI18n(<PageTree nodes={[node("a", "A"), node("b", "B")]} expanded={new Set()} selectedId="b" onSelect={() => {}} onToggle={() => {}} />);
    const sel = screen.getByRole("treeitem", { name: "B" });
    expect(sel.className).toContain("border-[var(--c-accent)]");
    expect(sel.className).toContain("bg-[var(--c-raised)]");
    expect(screen.getByRole("treeitem", { name: "A" }).className).not.toContain("border-[var(--c-accent)]");
  });
  it("muestra un ícono de tipo (nota, base de datos, tablero) y respeta el emoji de la página", async () => {
    const db = { ...node("d", "Base"), page: { ...page("d", "Base"), kind: "database" as const } };
    const withIcon = { ...node("e", "Con ícono"), page: { ...page("e", "Con ícono"), icon: "📁" } };
    await renderWithI18n(<PageTree nodes={[node("a", "Nota"), db, withIcon]} expanded={new Set()} selectedId={null} onSelect={() => {}} onToggle={() => {}} />);
    expect(screen.getByRole("treeitem", { name: "Nota" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("treeitem", { name: "Base" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("treeitem", { name: "Con ícono" })).toHaveTextContent("📁");
  });
  it("sangría de 16 px por nivel con tope a 6 niveles (10 niveles sangran como 6)", async () => {
    await renderWithI18n(<PageTree nodes={[deep(10)]} expanded={open(Array.from({ length: 11 }, (_, i) => `n${i}`))} selectedId={null} onSelect={() => {}} onToggle={() => {}} height={900} />);
    const pad = (name: string) => (screen.getByRole("treeitem", { name }) as HTMLElement).style.paddingLeft;
    expect(pad("Nivel 1")).toBe("22px"); // 6 px base + 2 px de borde = 8 px, más 16 px por nivel
    expect(pad("Nivel 10")).toBe(pad("Nivel 6"));
    expect(pad("Nivel 8")).toBe(pad("Nivel 6"));
  });
  it("el título completo está disponible como tooltip del nombre truncado", async () => {
    const long = "T".repeat(150);
    await renderWithI18n(<PageTree nodes={[node("a", long)]} expanded={new Set()} selectedId={null} onSelect={() => {}} onToggle={() => {}} />);
    const row = screen.getByRole("treeitem");
    expect(row.querySelector("[data-row-title]")).toHaveAttribute("title", long);
    expect(row.querySelector("[data-row-title]")!.className).toContain("truncate");
  });
  it("las acciones de la fila aparecen al pasar el cursor o con foco, sin desplazar el texto (posición absoluta)", async () => {
    const onCreateChild = vi.fn();
    await renderWithI18n(<PageTree nodes={[node("a", "A")]} expanded={new Set()} selectedId={null} onSelect={() => {}} onToggle={() => {}} onCreateChild={onCreateChild} />);
    const btn = screen.getByRole("button", { name: "Nueva subpágina en A" });
    const wrap = btn.parentElement!;
    expect(wrap.className).toContain("absolute");
    expect(wrap.className).toContain("opacity-0");
    expect(wrap.className).toContain("group-hover:opacity-100");
    expect(wrap.className).toContain("focus-within:opacity-100");
    await userEvent.click(btn);
    expect(onCreateChild).toHaveBeenCalledWith("a");
  });
  it("hacer clic en la acción no selecciona la fila", async () => {
    const onSelect = vi.fn();
    await renderWithI18n(<PageTree nodes={[node("a", "A")]} expanded={new Set()} selectedId={null} onSelect={onSelect} onToggle={() => {}} onCreateChild={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Nueva subpágina en A" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
