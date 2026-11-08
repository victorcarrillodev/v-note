// G-129, G-130, G-132, G-134 (prueba primero): selector de color con paleta del sistema, campo hexadecimal y color nativo.
import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { ColorPicker } from "./ColorPicker";

const setup = async (over: Partial<Parameters<typeof ColorPicker>[0]> = {}) => {
  const onChange = vi.fn();
  await renderWithI18n(<ColorPicker label="Relleno" role="fill" value="palette:blue" recents={[]} onChange={onChange} {...over} />);
  return { onChange, group: screen.getByRole("group", { name: "Relleno" }) };
};

describe("paleta del sistema (G-129)", () => {
  it("cada color de relleno es un botón con nombre accesible, y el actual está marcado", async () => {
    const { group } = await setup();
    const names = within(group).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    for (const n of ["Azul", "Verde", "Amarillo", "Rojo", "Morado", "Naranja", "Gris", "Blanco", "Marrón", "Rosa"]) expect(names).toContain(n);
    expect(within(group).getByRole("button", { name: "Azul" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "Rojo" })).toHaveAttribute("aria-pressed", "false");
  });
  it("«Sin relleno» solo se ofrece si se permite", async () => {
    const a = await setup({ allowNone: true });
    expect(within(a.group).getByRole("button", { name: "Sin relleno" })).toBeInTheDocument();
  });
  it("elegir un color de paleta lo aplica de inmediato como id de paleta", async () => {
    const { onChange, group } = await setup();
    fireEvent.click(within(group).getByRole("button", { name: "Rojo" }));
    expect(onChange).toHaveBeenCalledWith("palette:red");
  });
  it("para contorno y texto la paleta es la de tonos fuertes con la tinta", async () => {
    await renderWithI18n(<ColorPicker label="Contorno" role="stroke" value="palette:ink" recents={[]} onChange={() => {}} />);
    const names = within(screen.getByRole("group", { name: "Contorno" })).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names[0]).toBe("Tinta"); expect(names).not.toContain("Blanco"); expect(names).toContain("Marrón");
  });
  it("se maneja con teclado: cada color es un botón alcanzable con Tab", async () => {
    const { group } = await setup();
    for (const b of within(group).getAllByRole("button")) expect(b.tabIndex).toBeGreaterThanOrEqual(0);
  });
});

describe("color personalizado (G-130)", () => {
  it("un hexadecimal válido se aplica de inmediato", async () => {
    const { onChange } = await setup();
    fireEvent.change(screen.getByLabelText("Relleno: hexadecimal"), { target: { value: "#1a73e8" } });
    expect(onChange).toHaveBeenCalledWith("#1a73e8");
  });
  it("acepta 3, 6 y 8 dígitos; uno inválido no se aplica y se marca con un aviso", async () => {
    const { onChange } = await setup();
    const input = screen.getByLabelText("Relleno: hexadecimal");
    fireEvent.change(input, { target: { value: "#abc" } }); expect(onChange).toHaveBeenLastCalledWith("#abc");
    fireEvent.change(input, { target: { value: "#aabbccdd" } }); expect(onChange).toHaveBeenLastCalledWith("#aabbccdd");
    onChange.mockClear();
    fireEvent.change(input, { target: { value: "#12" } });
    expect(onChange).not.toHaveBeenCalled(); expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Escribe un color hexadecimal válido (3, 6 u 8 dígitos).")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "rojo" } }); expect(onChange).not.toHaveBeenCalled();
  });
  it("sin # delante también se entiende", async () => {
    const { onChange } = await setup();
    fireEvent.change(screen.getByLabelText("Relleno: hexadecimal"), { target: { value: "ff8800" } });
    expect(onChange).toHaveBeenCalledWith("#ff8800");
  });
  it("el color nativo del sistema también aplica", async () => {
    const { onChange } = await setup();
    fireEvent.change(screen.getByLabelText("Relleno: elegir color"), { target: { value: "#336699" } });
    expect(onChange).toHaveBeenCalledWith("#336699");
  });
  it("el campo muestra el valor actual si es personalizado, y vacío si es de paleta", async () => {
    await renderWithI18n(<ColorPicker label="Relleno" role="fill" value="#ff8800" recents={[]} onChange={() => {}} />);
    expect(screen.getByLabelText("Relleno: hexadecimal")).toHaveValue("#ff8800");
  });
});

describe("usados recientemente (G-131)", () => {
  it("se muestran como botones con su valor y aplican al pulsarlos", async () => {
    const { onChange, group } = await setup({ recents: ["#ff8800", "#336699"] });
    expect(within(group).getByRole("group", { name: "Usados recientemente" })).toBeInTheDocument();
    fireEvent.click(within(group).getByRole("button", { name: "#336699" }));
    expect(onChange).toHaveBeenCalledWith("#336699");
  });
  it("sin recientes no se dibuja la sección", async () => {
    const { group } = await setup();
    expect(within(group).queryByRole("group", { name: "Usados recientemente" })).toBeNull();
  });
});

describe("color visible en cada tema (G-132)", () => {
  it("los de paleta se dibujan con el token del tema y los personalizados con su valor fijo", async () => {
    const { group } = await setup({ value: "#ff8800", recents: ["#336699"] });
    expect(within(group).getByRole("button", { name: "Azul" }).getAttribute("data-swatch")).toBe("var(--block-blue-bg)");
    expect(within(group).getByRole("button", { name: "#336699" }).getAttribute("data-swatch")).toBe("#336699");
  });
});
