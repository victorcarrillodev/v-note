// U-051 a U-054 (RF-8.3, RF-14.4, RF-14.9): campos y controles.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField, TextArea, Select } from "./fields";
import { Checkbox, Switch, Segmented } from "./controls";

describe("TextField", () => {
  it("la etiqueta siempre es visible y asociada al campo", () => {
    render(<TextField label="Título" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Título")).toBeInTheDocument();
    expect(screen.getByText("Título")).toBeVisible();
  });
  it("sin borde (relleno), altura de 32 px y radio base", () => {
    render(<TextField label="Nombre" value="" onChange={() => {}} />);
    const cls = screen.getByLabelText("Nombre").className;
    expect(cls).not.toContain("border");
    expect(cls).toContain("bg-[var(--c-raised)]");
    expect(cls).toContain("h-8");
    expect(cls).toContain("rounded");
  });
  it("error: borde de peligro, aria-invalid y mensaje de TEXTO ligado (no solo color)", () => {
    render(<TextField label="Hora" value="x" onChange={() => {}} error="La hora de fin debe ser posterior" />);
    const input = screen.getByLabelText("Hora");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toContain("var(--c-danger)");
    expect(screen.getByRole("alert")).toHaveTextContent("La hora de fin debe ser posterior");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });
  it("escribir dispara onChange", async () => {
    const onChange = vi.fn();
    render(<TextField label="Nombre" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Nombre"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });
});

describe("TextArea", () => {
  it("varias líneas con etiqueta y error", () => {
    render(<TextArea label="Notas" value="" onChange={() => {}} error="Demasiado largo" />);
    expect(screen.getByLabelText("Notas").tagName).toBe("TEXTAREA");
    expect(screen.getByRole("alert")).toHaveTextContent("Demasiado largo");
  });
  it("crece con el contenido (filas según líneas)", () => {
    render(<TextArea label="Notas" value={"a\nb\nc\nd"} onChange={() => {}} />);
    expect(Number(screen.getByLabelText("Notas").getAttribute("rows"))).toBeGreaterThanOrEqual(4);
  });
});

describe("Select (se comporta como lista de opciones accesible)", () => {
  it("elige una opción con teclado", async () => {
    const onChange = vi.fn();
    render(<Select label="Tipo" value="a" onChange={onChange} options={[{ value: "a", label: "Uno" }, { value: "b", label: "Dos" }]} />);
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "b");
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("Checkbox, Switch y Segmented (RF-14.4, RF-14.9)", () => {
  it("la casilla mide al menos 24 px y marca por forma (ícono), no solo color", () => {
    render(<Checkbox label="Hecho" checked onChange={() => {}} />);
    const box = screen.getByRole("checkbox", { name: "Hecho" });
    expect(box.closest("label")!.className).toContain("min-h-6");
    expect(box.closest("label")!.querySelector("svg")).not.toBeNull();
  });
  it("la casilla alterna", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Hecho" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Hecho" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it("el interruptor expone role=switch con estado y alterna con Espacio", async () => {
    const onChange = vi.fn();
    render(<Switch label="Ancho completo" checked={false} onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Ancho completo" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    sw.focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it("el segmentado marca el valor activo con forma (aria-checked y marca visible)", async () => {
    const onChange = vi.fn();
    render(<Segmented label="Densidad" value="comfortable" onChange={onChange} options={[{ value: "comfortable", label: "Cómoda" }, { value: "compact", label: "Compacta" }]} />);
    expect(screen.getByRole("radio", { name: "Cómoda" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "Compacta" }));
    expect(onChange).toHaveBeenCalledWith("compact");
  });
  it("el segmentado se recorre con flechas", async () => {
    const onChange = vi.fn();
    render(<Segmented label="Tema" value="light" onChange={onChange} options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Oscuro" }]} />);
    screen.getByRole("radio", { name: "Claro" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("dark");
  });
});
