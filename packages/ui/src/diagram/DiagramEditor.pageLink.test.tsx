// study-features-2 T-7 (prueba primero): enlazar una forma con una página desde el lienzo y abrirla.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addNode, emptyDiagram, parseDiagram, serializeDiagram, setNodePage } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DiagramEditor } from "./DiagramEditor";
import { GRID_PREFS_KEY } from "../canvas/gridPrefs";
import { LinkProvider, type LinkApi } from "../editor/LinkContext";

const one = (linked = false) => {
  const d = addNode(emptyDiagram(), { shape: "process", x: 0, y: 0, id: "a", text: "Pilas" }).diagram;
  return linked ? setNodePage(d, "a", "p1") : d;
};
const links = (state: "ok" | "trashed" | "missing" = "ok"): LinkApi & { openSpy: ReturnType<typeof vi.fn> } => {
  const openSpy = vi.fn();
  return {
    openSpy,
    resolve: async (id) => ({ state, id, title: state === "missing" ? "" : "Pilas y colas" }),
    open: openSpy,
    restore: async () => {},
    find: async (q) => (q ? [{ id: "p1", title: "Pilas y colas" }] : []),
  };
};
async function mount(value: string, api: LinkApi) {
  const saved: string[] = [];
  const onChange = vi.fn((t: string) => { saved.push(t); });
  await renderWithI18n(<LinkProvider value={api}><DiagramEditor value={value} onChange={onChange} /></LinkProvider>);
  return { saved, last: () => { const r = parseDiagram(saved[saved.length - 1]!); if (!r.ok) throw new Error("x"); return r.value; } };
}
const node = (id: string) => [...document.querySelectorAll(".react-flow__node")].find((n) => n.getAttribute("data-id") === id) as HTMLElement;

beforeEach(() => { try { localStorage.clear(); localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: true, snap: false })); } catch { /* sin almacenamiento */ } });
afterEach(cleanup);

describe("forma enlazada con una página", () => {
  it("al seleccionar una forma se puede buscar una página y enlazarla; el cambio se guarda y aparece la insignia", async () => {
    const api = links();
    const { last } = await mount(serializeDiagram(one()), api);
    expect(document.querySelector("[data-page-link]")).toBeNull();
    fireEvent.click(node("a"));
    const user = userEvent.setup();
    await user.type(await screen.findByRole("combobox", { name: "Enlazar con una página" }), "pi");
    await user.click(await screen.findByRole("option", { name: "Pilas y colas" }));
    expect(last().nodes[0]!.page).toBe("p1");
    await waitFor(() => expect(document.querySelector('[data-page-link="p1"]')).not.toBeNull());
  });

  it("la insignia abre la página enlazada y no cambia el diagrama", async () => {
    const api = links();
    const { saved } = await mount(serializeDiagram(one(true)), api);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Abrir página enlazada" }));
    expect(api.openSpy).toHaveBeenCalledWith("p1");
    expect(saved).toEqual([]);
  });

  it("si la página enlazada ya no existe, la insignia avisa y no abre nada", async () => {
    const api = links("missing");
    await mount(serializeDiagram(one(true)), api);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Abrir página enlazada" }));
    expect(await screen.findByText("La página enlazada ya no existe.")).toBeInTheDocument();
    expect(api.openSpy).not.toHaveBeenCalled();
  });

  it("si está en la papelera, la insignia lo dice y no la abre", async () => {
    const api = links("trashed");
    await mount(serializeDiagram(one(true)), api);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Abrir página enlazada" }));
    expect(await screen.findByText("La página enlazada está en la papelera.")).toBeInTheDocument();
    expect(api.openSpy).not.toHaveBeenCalled();
  });

  it("si no se puede comprobar la página (resolve rechaza), la insignia avisa en vez de quedarse muda", async () => {
    const api = { ...links(), resolve: async () => { throw new Error("base cerrada"); } };
    await mount(serializeDiagram(one(true)), api);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Abrir página enlazada" }));
    expect(await screen.findByText("La página enlazada ya no existe.")).toBeInTheDocument();
    expect(api.openSpy).not.toHaveBeenCalled();
  });

  it("sin contexto de enlaces (p. ej. fuera del editor) no hay insignia ni sección y el lienzo funciona igual", async () => {
    await renderWithI18n(<DiagramEditor value={serializeDiagram(one(true))} onChange={() => {}} />);
    fireEvent.click(node("a"));
    expect(screen.queryByRole("combobox", { name: "Enlazar con una página" })).toBeNull();
    expect(document.querySelector("[data-page-link]")).toBeNull();
  });
});
