// U-055, U-056, U-066 a U-069 (RF-1, RF-6.1, RF-11.2, RF-12.3, RF-12.4, RF-14.8, RF-14.9, RF-15.3, CL-9): chips, pestañas, tarjeta, progreso, esqueleto y aviso en línea.
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chip, ChipList } from "./Chip";
import { Tabs } from "./Tabs";
import { Card, CountBadge, Progress, ListRow } from "./Card";
import { Skeleton } from "./Skeleton";
import { InlineAlert } from "./InlineAlert";

describe("Chip", () => {
  it("usa los colores semánticos del sistema", () => {
    render(<Chip tone="warning">Vence hoy</Chip>);
    const cls = screen.getByText("Vence hoy").parentElement!.className;
    expect(cls).toContain("var(--chip-warning-fg)");
    expect(cls).toContain("var(--chip-warning-bg)");
  });
  it("con onRemove muestra un botón «Quitar» con nombre accesible", async () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove} removeLabel="Quitar Urgente">Urgente</Chip>);
    await userEvent.click(screen.getByRole("button", { name: "Quitar Urgente" }));
    expect(onRemove).toHaveBeenCalled();
  });
  it("la lista muestra los que caben y un «+N» con el resto (CL-9)", () => {
    const chips = Array.from({ length: 8 }, (_, i) => ({ id: String(i), label: `Etiqueta ${i}` }));
    render(<ChipList chips={chips} max={3} moreLabel={(n) => `+${n}`} />);
    expect(screen.getAllByText(/^Etiqueta/)).toHaveLength(3);
    expect(screen.getByText("+5")).toBeInTheDocument();
  });
  it("sin exceso no muestra «+N»", () => {
    render(<ChipList chips={[{ id: "1", label: "A" }]} max={3} moreLabel={(n) => `+${n}`} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });
  it("«+N» abre el resto con el teclado", async () => {
    const chips = Array.from({ length: 5 }, (_, i) => ({ id: String(i), label: `E${i}` }));
    render(<ChipList chips={chips} max={2} moreLabel={(n) => `+${n}`} />);
    await userEvent.click(screen.getByRole("button", { name: "+3" }));
    expect(await screen.findByText("E4")).toBeInTheDocument();
  });
});

describe("Tabs (RF-6.1)", () => {
  const tabs = [{ value: "table", label: "Tabla" }, { value: "board", label: "Tablero" }, { value: "calendar", label: "Calendario" }];
  it("se recorre con flechas y la activa se marca con subrayado de acento y peso mayor", async () => {
    const onChange = vi.fn();
    render(<Tabs label="Vistas" value="table" onChange={onChange} tabs={tabs} />);
    const active = screen.getByRole("tab", { name: "Tabla" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active.className).toContain("border-[var(--c-accent)]");
    expect(active.className).toContain("font-semibold");
    active.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Tablero" })).toHaveFocus();
  });
  it("marca el desbordamiento cuando no caben (desvanecimiento en el borde)", () => {
    const sw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
    const cw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 200 });
    const { container } = render(<Tabs label="Vistas" value="table" onChange={() => {}} tabs={tabs} />);
    expect(container.querySelector("[data-overflow]")).not.toBeNull();
    if (sw) Object.defineProperty(HTMLElement.prototype, "scrollWidth", sw); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
    if (cw) Object.defineProperty(HTMLElement.prototype, "clientWidth", cw); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  });
});

describe("Card, CountBadge, Progress y ListRow", () => {
  it("la tarjeta usa superficie de tarjeta, radio medio, relleno 16 y elevación 2", () => {
    render(<Card>contenido</Card>);
    const cls = screen.getByText("contenido").className;
    expect(cls).toContain("bg-[var(--c-card)]");
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("p-4");
    expect(cls).toContain("var(--elevation-2)");
  });
  it("la insignia de conteo no pasa de «99+»", () => {
    render(<><CountBadge value={7} /><CountBadge value={250} /></>);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
  it("progreso conocido: role=progressbar con valor, máximo y nombre", () => {
    render(<Progress label="Exportando" value={30} max={120} />);
    const p = screen.getByRole("progressbar", { name: "Exportando" });
    expect(p).toHaveAttribute("aria-valuenow", "30");
    expect(p).toHaveAttribute("aria-valuemax", "120");
  });
  it("progreso desconocido: sin valor y con nombre", () => {
    render(<Progress label="Cargando" />);
    const p = screen.getByRole("progressbar", { name: "Cargando" });
    expect(p).not.toHaveAttribute("aria-valuenow");
  });
  it("la fila de lista mide 32 px (28 en densidad compacta) y marca la seleccionada con forma", () => {
    render(<ListRow selected>Página</ListRow>);
    const r = screen.getByText("Página").closest("[data-row]")!;
    expect(r.className).toContain("h-8");
    expect(r.className).toContain("data-density=compact");
    expect(r.getAttribute("aria-current")).toBe("true");
    expect(r.className).toContain("border-l-2"); // barra de acento: no depende solo del color
  });
});

describe("Skeleton (RF-12.4, RF-14.8)", () => {
  it("reserva el espacio indicado y se oculta a lectores", () => {
    const { container } = render(<Skeleton height={44} width={200} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe("44px");
    expect(el.style.width).toBe("200px");
    expect(el).toHaveAttribute("aria-hidden", "true");
  });
  it("con «reducir movimiento» no se anima", () => {
    const { container } = render(<Skeleton height={10} />);
    expect((container.firstElementChild as HTMLElement).className).toContain("motion-reduce:animate-none");
  });
});

describe("InlineAlert (RF-11.2, RF-14.9)", () => {
  it("un error comunica con ícono Y texto, y usa role=alert", () => {
    const { container } = render(<InlineAlert tone="error" title="No se pudo respaldar" action={{ label: "Reintentar", onClick: () => {} }}>Token inválido</InlineAlert>);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo respaldar");
    expect(screen.getByRole("alert")).toHaveTextContent("Token inválido");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
  it("la información usa role=status", () => {
    render(<InlineAlert tone="info">Solo lectura</InlineAlert>);
    expect(screen.getByRole("status")).toHaveTextContent("Solo lectura");
  });
  it("NO desaparece sola, aunque pase el tiempo", () => {
    vi.useFakeTimers();
    render(<InlineAlert tone="error">Fallo</InlineAlert>);
    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    vi.useRealTimers();
  });
  it("solo se cierra de forma manual y si se ofrece onDismiss", async () => {
    const onDismiss = vi.fn();
    render(<InlineAlert tone="warning" onDismiss={onDismiss} dismissLabel="Cerrar aviso">Ojo</InlineAlert>);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
