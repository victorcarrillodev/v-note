// U-088, U-091 (RF-13.1, RF-13.2, RF-13.4, CL-26): logotipo derivado del nombre del producto.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { brand } from "@vnote/core";
import { Logo, Wordmark } from "./Logo";
import { monogram } from "../layout/monogram";

describe("Logo", () => {
  it("el símbolo muestra el monograma derivado del nombre configurado", () => {
    render(<Logo />);
    expect(screen.getByText(monogram(brand.name))).toBeInTheDocument();
  });
  it("el degradado del acento está SOLO en el símbolo", () => {
    const { container } = render(<Wordmark />);
    const symbol = container.querySelector("[data-logo-symbol]")!;
    expect(symbol.className).toContain("from-[var(--c-accent)]");
    expect(container.querySelector("[data-logo-name]")!.className).not.toContain("gradient");
  });
  it("es legible a 16 px: tamaño mínimo soportado y texto del símbolo que escala", () => {
    const { container } = render(<Logo size={16} />);
    const el = container.querySelector("[data-logo-symbol]") as HTMLElement;
    expect(el.style.width).toBe("16px");
    expect(el.style.height).toBe("16px");
  });
  it("el wordmark compone monograma + nombre del producto", () => {
    render(<Wordmark />);
    expect(screen.getByText(brand.name)).toBeInTheDocument();
  });
  it("es decorativo si va junto al nombre y con nombre accesible si va solo", () => {
    const { container, rerender } = render(<Logo />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    rerender(<Logo label="Mi producto" />);
    expect(screen.getByRole("img", { name: "Mi producto" })).toBeInTheDocument();
  });
  it("cambiar el nombre cambia el símbolo sin tocar pantallas (el símbolo usa la función de monograma)", () => {
    expect(monogram("Zeta")).toBe("Z");
    expect(monogram("Uno")).toBe("U");
  });
});
