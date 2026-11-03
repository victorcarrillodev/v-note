// U-042 a U-045 (RF-1.6, RF-14.7): conjunto único de íconos, tamaños y trazos, accesibilidad y mapa semántico sin duplicados.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { Icon, ICON_SIZES } from "./Icon";
import { iconMap, type IconName } from "./iconMap";

describe("componente Icon (RF-1.6)", () => {
  it("tamaños permitidos: 14, 16, 20, 24 (y 40, 48 para ilustración)", () => {
    expect([...ICON_SIZES]).toEqual([14, 16, 20, 24, 40, 48]);
  });
  it("por defecto mide 16 px con trazo 1,75", () => {
    const { container } = render(<Icon name="create" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("stroke-width")).toBe("1.75");
  });
  it("de 24 px en adelante el trazo baja a 1,5", () => {
    const { container } = render(<Icon name="create" size={24} />);
    expect(container.querySelector("svg")!.getAttribute("stroke-width")).toBe("1.5");
  });
  it("hereda el color del texto (currentColor)", () => {
    const { container } = render(<Icon name="search" />);
    expect(container.querySelector("svg")!.getAttribute("stroke")).toBe("currentColor");
  });
});

describe("accesibilidad del ícono (RF-14.7)", () => {
  it("decorativo: oculto a lectores de pantalla", () => {
    const { container } = render(<Icon name="create" />);
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
  it("con nombre: expone role=img y la etiqueta", () => {
    render(<Icon name="delete" label="Eliminar" />);
    expect(screen.getByRole("img", { name: "Eliminar" })).toBeInTheDocument();
  });
});

describe("mapa semántico significado → ícono (plan 5)", () => {
  it("incluye todos los significados del estándar", () => {
    const needed: IconName[] = ["create", "delete", "search", "restore", "settings", "edit", "favorite", "duplicate", "note", "export", "import", "database", "board", "backup", "reminder", "calendar", "task", "taskDone", "graph", "collapse", "expand", "more", "warning", "error", "success", "info", "close", "sidebar", "inbox", "undo", "loading", "tag"];
    for (const n of needed) expect(iconMap, n).toHaveProperty(n);
  });
  it("un significado = un ícono: no hay dos significados con el mismo ícono", () => {
    const seen = new Map<unknown, string>();
    for (const [name, comp] of Object.entries(iconMap)) {
      expect(seen.get(comp), `«${name}» repite el ícono de «${seen.get(comp)}»`).toBeUndefined();
      seen.set(comp, name);
    }
  });
});

describe("toda la interfaz usa el componente (RNF-4)", () => {
  const root = resolve(__dirname, "..");
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "node_modules") walk(p); } else if (/\.tsx$/.test(f) && !/\.test\.tsx$/.test(f)) files.push(p); } };
  walk(root);
  it("ningún archivo de interfaz fuera de `design` importa lucide-react directamente", () => {
    const bad = files.filter((f) => !f.includes("/design/") && /from\s+["']lucide-react["']/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
