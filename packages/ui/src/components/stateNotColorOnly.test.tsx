// Spec 006, T-027 (RF-5.4, RNF-2): el estado nunca se comunica solo con color; los avisos llevan icono y texto, los chips su texto.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { InlineAlert } from "./InlineAlert";
import { Chip } from "./Chip";

describe("el estado no depende solo del color", () => {
  it.each(["info", "success", "warning", "error"] as const)("aviso %s: icono y texto", (tone) => {
    const { container } = render(<InlineAlert tone={tone} title="Título">Detalle</InlineAlert>);
    expect(container.querySelector("svg"), "icono").not.toBeNull();
    expect(screen.getByText("Título")).toBeInTheDocument();
    expect(screen.getByText("Detalle")).toBeInTheDocument();
  });
  it.each(["info", "success", "warning", "error"] as const)("chip %s: lleva texto", (tone) => {
    render(<Chip tone={tone}>Etiqueta</Chip>);
    expect(screen.getByText("Etiqueta")).toBeInTheDocument();
  });
  it("las llamadas del editor asocian un icono a cada variante", () => {
    const src = readFileSync(resolve(__dirname, "../editor/schema.tsx"), "utf8");
    expect(src).toMatch(/ICON: Record<Variant, IconName> = \{ info: "info", success: "success", warning: "warning", danger: "error" \}/);
  });
});
