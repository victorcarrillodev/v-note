// G-066 a G-071 (prueba primero): controles propios del lienzo (RF-15, RF-16): acercar, alejar, ajustar y nivel de zoom.
import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { CanvasControls } from "./CanvasControls";

const setup = async (over: Partial<Parameters<typeof CanvasControls>[0]> = {}) => {
  const fns = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onFit: vi.fn() };
  await renderWithI18n(<CanvasControls zoom={1} minZoom={0.02} maxZoom={4} {...fns} {...over} />);
  return fns;
};

describe("contenido y nombres accesibles (G-066)", () => {
  it("tres botones con nombre y el nivel de zoom en porcentaje", async () => {
    await setup({ zoom: 1.5 });
    expect(screen.getByRole("group", { name: "Zoom del diagrama" })).toBeInTheDocument();
    for (const n of ["Acercar", "Alejar", "Ajustar a pantalla"]) expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
    expect(screen.getByText("150 %")).toBeInTheDocument();
  });
  it("cada botón avisa a quien lo usa", async () => {
    const f = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Acercar" })); expect(f.onZoomIn).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Alejar" })); expect(f.onZoomOut).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Ajustar a pantalla" })); expect(f.onFit).toHaveBeenCalledTimes(1);
  });
  it("el nivel se redondea al entero más cercano", async () => {
    await setup({ zoom: 0.333 });
    expect(screen.getByText("33 %")).toBeInTheDocument();
  });
});

describe("estados (G-069)", () => {
  it("acercar se deshabilita en el zoom máximo y alejar en el mínimo", async () => {
    await setup({ zoom: 4 });
    expect(screen.getByRole("button", { name: "Acercar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Alejar" })).toBeEnabled();
  });
  it("alejar se deshabilita en el mínimo", async () => {
    await setup({ zoom: 0.02 });
    expect(screen.getByRole("button", { name: "Alejar" })).toBeDisabled();
  });
  it("los estados normal, hover, foco, activo y deshabilitado tienen estilo propio", async () => {
    await setup();
    const cls = screen.getByRole("button", { name: "Acercar" }).className;
    for (const token of ["hover:", "disabled:", "focus-visible:", "active:"]) expect(cls, token).toContain(token);
  });
});

describe("objetivos táctiles (G-070)", () => {
  it("32 px con puntero fino y 44 px con puntero grueso", async () => {
    await setup();
    const cls = screen.getByRole("button", { name: "Alejar" }).className;
    expect(cls).toContain("h-8"); expect(cls).toContain("w-8");
    expect(cls).toContain("[@media(pointer:coarse)]:h-11"); expect(cls).toContain("[@media(pointer:coarse)]:w-11");
  });
});

describe("contraste y capa (G-068, G-071)", () => {
  it("usa solo tokens: superficie de tarjeta, borde de control y texto principal", async () => {
    await setup();
    const group = screen.getByRole("group", { name: "Zoom del diagrama" });
    expect(group.className).toContain("var(--c-card)"); expect(group.className).toContain("var(--c-border-control)");
    expect(group.className).toContain("var(--c-text)");
    expect(screen.getByRole("button", { name: "Acercar" }).className).toContain("var(--c-text)"); // íconos con el texto principal
  });
  it("va por encima de formas y conectores (capa del estándar)", async () => {
    await setup();
    expect(screen.getByRole("group", { name: "Zoom del diagrama" }).className).toContain("z-[var(--z-sticky)]");
  });
});
