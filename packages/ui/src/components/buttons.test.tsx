// U-047 a U-050 (RF-1, RF-14.3, RF-14.4, RF-14.7): botón, botón de ícono y tooltip.
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { TooltipProvider } from "./Tooltip";

describe("Button", () => {
  it("variantes: primario, secundario, fantasma y peligro usan tokens (no valores sueltos)", () => {
    for (const v of ["primary", "secondary", "ghost", "danger"] as const) {
      const { container, unmount } = render(<Button variant={v}>Ok</Button>);
      const cls = container.querySelector("button")!.className;
      expect(cls, v).toContain("var(--c-");
      expect(cls, v).not.toMatch(/#[0-9a-f]{3,8}/i);
      unmount();
    }
  });
  it("primario usa el acento con texto sobre-acento", () => {
    render(<Button variant="primary">Guardar</Button>);
    const cls = screen.getByRole("button", { name: "Guardar" }).className;
    expect(cls).toContain("bg-[var(--c-accent)]");
    expect(cls).toContain("text-[var(--c-on-accent)]");
  });
  it("peligro usa el color de peligro", () => {
    render(<Button variant="danger">Eliminar</Button>);
    expect(screen.getByRole("button", { name: "Eliminar" }).className).toContain("var(--c-danger)");
  });
  it("tamaños: 32 px (principal) y 28 px (secundario), ambos ≥ 24 px", () => {
    render(<><Button>a</Button><Button size="sm">b</Button></>);
    expect(screen.getByRole("button", { name: "a" }).className).toContain("h-8");
    expect(screen.getByRole("button", { name: "b" }).className).toContain("h-7");
  });
  it("deshabilitado: no dispara clic y no cambia con hover", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>No</Button>);
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "No" })).toBeDisabled();
  });
  it("con teclado: Enter y Espacio activan", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ir</Button>);
    screen.getByRole("button", { name: "Ir" }).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });
  it("carga: conserva el texto (mismo ancho), se marca ocupado y no permite clics", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Guardar</Button>);
    const b = screen.getByRole("button", { name: /Guardar/ });
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b).toBeDisabled();
    expect(b.textContent).toContain("Guardar");
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });
  it("es type=button por defecto (no envía formularios sin querer)", () => {
    render(<Button>x</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("IconButton (RF-14.7)", () => {
  it("expone el nombre accesible y mide 32 px", () => {
    render(<TooltipProvider><IconButton icon="settings" label="Ajustes" /></TooltipProvider>);
    const b = screen.getByRole("button", { name: "Ajustes" });
    expect(b.className).toContain("h-8");
    expect(b.className).toContain("w-8");
  });
  it("sin nombre accesible falla en tiempo de prueba", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TooltipProvider><IconButton icon="settings" label="" /></TooltipProvider>)).toThrow(/nombre accesible/i);
    spy.mockRestore();
  });
  it("muestra un tooltip con el nombre al enfocar con teclado", async () => {
    render(<TooltipProvider><IconButton icon="settings" label="Ajustes" /></TooltipProvider>);
    await userEvent.tab();
    expect((await screen.findAllByText("Ajustes")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Ajustes");
  });
});

describe("Tooltip (RF-14.6)", () => {
  it("con ratón aparece tras ~500 ms, no antes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TooltipProvider><IconButton icon="search" label="Buscar" /></TooltipProvider>);
    await user.hover(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
    await act(async () => { vi.advanceTimersByTime(520); });
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    vi.useRealTimers();
  });
  it("Escape lo oculta y el foco sigue en el botón (no recibe el foco)", async () => {
    render(<TooltipProvider><IconButton icon="search" label="Buscar" /></TooltipProvider>);
    await userEvent.tab();
    await screen.findByRole("tooltip");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Buscar" }));
  });
});
