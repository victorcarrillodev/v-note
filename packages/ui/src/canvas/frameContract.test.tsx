// R-183 (spec 004, RNF-8): una sola suite del marco compartido que se ejecuta con los dos bloques (diagrama y mapa mental).
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, screen, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DiagramEditor } from "../diagram/DiagramEditor";
import { MindMapEditor } from "../diagram/MindMapEditor";
import { addChild, addNode, emptyDiagram, newTree, serializeDiagram, serializeTree } from "@vnote/core";

const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("no ok"); return r.value as T; };
type Host = { name: string; testId: string; label: string; value: (view?: { height: number }) => string; render: (value: string, onChange: (s: string) => void) => ReactElement; view: (saved: string) => { height?: number } | undefined };
const hosts: Host[] = [
  {
    name: "diagrama", testId: "diagram", label: "Lienzo del diagrama",
    value: (view) => serializeDiagram({ ...addNode(emptyDiagram(), { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram, ...(view ? { view } : {}) }),
    render: (value, onChange) => <DiagramEditor value={value} onChange={onChange} />, view: (s) => JSON.parse(s).view,
  },
  {
    name: "mapa mental", testId: "mindmap", label: "Mapa mental",
    value: (view) => serializeTree({ ...must(addChild(newTree("Tema"), "root", "A", "a")).tree, ...(view ? { view } : {}) }),
    render: (value, onChange) => <MindMapEditor value={value} onChange={onChange} />, view: (s) => JSON.parse(s).view,
  },
];

beforeEach(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe.each(hosts)("marco compartido: $name", (h) => {
  const mount = async (view?: { height: number }) => {
    const saved: string[] = [];
    await renderWithI18n(h.render(h.value(view), (s) => { saved.push(s); }));
    return saved;
  };
  const frame = () => screen.getByTestId(h.testId);
  it("es un grupo con nombre y con el ancho de la columna", async () => {
    await mount();
    expect(frame()).toHaveAttribute("role", "group"); expect(frame()).toHaveAccessibleName(h.label); expect(frame().style.width).toBe("100%");
  });
  it("abrirlo no lo reescribe", async () => { expect(await mount()).toHaveLength(0); });
  it("usa el alto guardado", async () => { await mount({ height: 520 }); expect(frame().style.height).toBe("520px"); });
  it("el alto se cambia con el teclado: un paso, guardado en view, y se deshace", async () => {
    const saved = await mount({ height: 400 });
    fireEvent.keyDown(screen.getByRole("separator", { name: "Alto del lienzo" }), { key: "ArrowDown" });
    expect(saved).toHaveLength(1); expect(h.view(saved[0]!)).toEqual({ height: 420 });
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(h.view(saved[saved.length - 1]!)).toEqual({ height: 400 });
  });
  it("ofrece ampliar y salir, cuadrícula y zoom", async () => {
    await mount();
    for (const name of ["Ampliar", "Mostrar cuadrícula", "Acomodar a la cuadrícula", "Deshacer", "Rehacer", "Restablecer al 100 %", "Acercar", "Alejar"]) expect(screen.getByRole("button", { name }), name).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    expect(frame()).toHaveAttribute("data-expanded");
    fireEvent.click(screen.getByRole("button", { name: "Salir de la vista ampliada" }));
    expect(frame()).not.toHaveAttribute("data-expanded");
  });
  it("Esc sale de la vista ampliada", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    fireEvent.keyDown(frame(), { key: "Escape" });
    expect(frame()).not.toHaveAttribute("data-expanded");
  });
  it("los interruptores de cuadrícula son compartidos (el estado se guarda en el dispositivo)", async () => {
    await mount();
    const show = screen.getByRole("button", { name: "Mostrar cuadrícula" });
    const was = show.getAttribute("aria-pressed");
    fireEvent.click(show);
    expect(screen.getByRole("button", { name: "Mostrar cuadrícula" }).getAttribute("aria-pressed")).not.toBe(was);
  });
});
