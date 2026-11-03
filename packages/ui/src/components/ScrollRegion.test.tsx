// U-080 (RF-15.3): las vistas anchas se desplazan por sí solas, con desvanecimiento en el borde, sin ensanchar la pantalla.
import { describe, it, expect, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ScrollRegion } from "./ScrollRegion";

const patch = (sw: number, cw: number) => {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => sw });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => cw });
};
afterEach(() => { delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth; delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth; });

describe("ScrollRegion", () => {
  it("contiene su desplazamiento: ancho propio (min-w-0) y overflow-x-auto, para que 30 columnas no ensanchen la pantalla", () => {
    const { container } = render(<ScrollRegion label="Tabla"><table><tbody><tr>{Array.from({ length: 30 }, (_, i) => <td key={i}>c{i}</td>)}</tr></tbody></table></ScrollRegion>);
    const region = container.querySelector("[data-scroll-region]")!;
    expect(region.className).toContain("overflow-x-auto");
    expect(region.className).toContain("min-w-0");
    expect(container.firstElementChild!.className).toContain("min-w-0");
  });
  it("es una región enfocable con nombre, para poder desplazarla con el teclado", () => {
    const { getByRole } = render(<ScrollRegion label="Tabla de proyectos"><p>x</p></ScrollRegion>);
    const r = getByRole("region", { name: "Tabla de proyectos" });
    expect(r).toHaveAttribute("tabindex", "0");
  });
  it("marca el desbordamiento y muestra el desvanecimiento cuando no cabe", () => {
    patch(900, 300);
    const { container } = render(<ScrollRegion label="t"><p>x</p></ScrollRegion>);
    expect(container.querySelector("[data-overflow]")).not.toBeNull();
    expect(container.querySelector("[data-scroll-fade]")).not.toBeNull();
  });
  it("sin desbordamiento no marca nada", () => {
    patch(200, 300);
    const { container } = render(<ScrollRegion label="t"><p>x</p></ScrollRegion>);
    expect(container.querySelector("[data-overflow]")).toBeNull();
    expect(container.querySelector("[data-scroll-fade]")).toBeNull();
  });
});
