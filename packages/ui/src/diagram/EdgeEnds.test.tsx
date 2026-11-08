// G-072 (prueba primero): panel de extremos del conector, la vía de teclado equivalente a arrastrar (RF-18, DP-10).
import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { EdgeEnds } from "./EdgeEnds";
import { addNode, connect, emptyDiagram } from "@vnote/core";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
let d = emptyDiagram();
d = addNode(d, { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram;
d = addNode(d, { shape: "decision", x: 400, y: 200, id: "b", text: "" }).diagram;
const r = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }));
const free = must(connect(d, { node: "a", anchor: "e" }, { x: 10, y: 20 }));

describe("extremos unidos", () => {
  it("muestra la forma y el punto de unión de Origen y Destino", async () => {
    await renderWithI18n(<EdgeEnds diagram={r.diagram} edge={r.edge} onChange={() => {}} />);
    expect(screen.getByLabelText("Origen: Forma")).toHaveValue("a");
    expect(screen.getByLabelText("Origen: Punto de unión")).toHaveValue("e");
    expect(screen.getByLabelText("Destino: Forma")).toHaveValue("b");
    expect(screen.getByLabelText("Destino: Punto de unión")).toHaveValue("w");
    expect(screen.getAllByRole("option", { name: "Decisión (sin texto)" })).toHaveLength(2); // una forma sin texto se nombra por su tipo
    expect(screen.getAllByRole("option", { name: /^izquierda$|^derecha$|^arriba$|^abajo$/ }).length).toBeGreaterThan(0);
  });
  it("cambiar el punto de unión reubica solo ese extremo", async () => {
    const onChange = vi.fn();
    await renderWithI18n(<EdgeEnds diagram={r.diagram} edge={r.edge} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Origen: Punto de unión"), { target: { value: "s" } });
    expect(onChange).toHaveBeenCalledWith("from", { node: "a", anchor: "s" });
  });
  it("cambiar de forma conserva el punto de unión", async () => {
    const onChange = vi.fn();
    await renderWithI18n(<EdgeEnds diagram={r.diagram} edge={r.edge} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Destino: Forma"), { target: { value: "a" } });
    expect(onChange).toHaveBeenCalledWith("to", { node: "a", anchor: "w" });
  });
  it("elegir «Libre» deja el extremo en la posición actual de su punto de unión", async () => {
    const onChange = vi.fn();
    await renderWithI18n(<EdgeEnds diagram={r.diagram} edge={r.edge} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Destino: Forma"), { target: { value: "__free__" } });
    expect(onChange).toHaveBeenCalledWith("to", { x: 400, y: 240 });
  });
});

describe("extremo libre", () => {
  it("muestra X e Y en lugar del punto de unión y permite editarlos", async () => {
    const onChange = vi.fn();
    await renderWithI18n(<EdgeEnds diagram={free.diagram} edge={free.edge} onChange={onChange} />);
    expect(screen.getByLabelText("Destino: Forma")).toHaveValue("__free__");
    expect(screen.queryByLabelText("Destino: Punto de unión")).toBeNull();
    expect(screen.getByLabelText("Destino: X")).toHaveValue(10);
    fireEvent.change(screen.getByLabelText("Destino: Y"), { target: { value: "99" } });
    expect(onChange).toHaveBeenCalledWith("to", { x: 10, y: 99 });
  });
  it("volver a elegir una forma lo une a su primer punto de unión", async () => {
    const onChange = vi.fn();
    await renderWithI18n(<EdgeEnds diagram={free.diagram} edge={free.edge} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Destino: Forma"), { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith("to", { node: "b", anchor: "w" });
  });
  it("un valor no numérico no genera cambio", async () => {
    const onChange = vi.fn();
    await renderWithI18n(<EdgeEnds diagram={free.diagram} edge={free.edge} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Destino: X"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
