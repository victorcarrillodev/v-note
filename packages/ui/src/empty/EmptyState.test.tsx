// U-173 y U-174 (RF-12.1, RF-13.5): ilustraciones de línea propias y componente de estado vacío.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ILLUSTRATIONS, Illustration, type IllustrationName } from "../design/Illustration";
import { EmptyState } from "./EmptyState";

describe("ilustraciones", () => {
  it("hay seis, todas SVG en línea que heredan el color del texto (legibles en ambos temas)", () => {
    const names = Object.keys(ILLUSTRATIONS) as IllustrationName[];
    expect(names).toHaveLength(6);
    for (const n of names) {
      const { container, unmount } = render(<Illustration name={n} />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}|rgb/i);
      expect(svg.outerHTML).toContain("currentColor");
      expect(svg.innerHTML).not.toContain("<image");
      unmount();
    }
  });
});
describe("EmptyState", () => {
  it("muestra ilustración, frase y una acción principal", async () => {
    const onAction = vi.fn();
    const { container } = render(<EmptyState illustration="pages" title="Aún no hay páginas" hint="Crea la primera" action={{ label: "Nueva página", onClick: onAction }} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Aún no hay páginas" })).toBeInTheDocument();
    expect(screen.getByText("Crea la primera")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Nueva página" }));
    expect(onAction).toHaveBeenCalled();
  });
  it("la acción es opcional y no hay botón sin ella", () => {
    render(<EmptyState illustration="search" title="Sin resultados" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("se anuncia como estado (role=status)", () => {
    render(<EmptyState illustration="trash" title="Vacía" />);
    expect(screen.getByRole("status")).toHaveTextContent("Vacía");
  });
});
