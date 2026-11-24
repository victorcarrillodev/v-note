import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { assignWorkspaceColors, hashText, workspaceColorForName } from "./workspaceAvatar";
import { WorkspaceAvatar } from "./WorkspaceAvatar";

function parseHsl(value: string): [number, number, number] {
  const m = value.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
  if (!m) throw new Error(`HSL inválido: ${value}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function hslContrast(bg: string, fg: string): number {
  const toRgb = ([h, s, l]: [number, number, number]) => {
    const sn = s / 100, ln = l / 100;
    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ln - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r + m) + 0.7152 * lin(g + m) + 0.0722 * lin(b + m);
  };
  const l1 = toRgb(parseHsl(bg));
  const l2 = toRgb(parseHsl(fg));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe("workspaceAvatar", () => {
  it("es determinista para el mismo texto (ignorando mayúsculas y espacios externos)", () => {
    expect(hashText("  Personal ")).toBe(hashText("personal"));
    expect(workspaceColorForName("Trabajo")).toEqual(workspaceColorForName("trabajo"));
  });

  it("genera colores vibrantes en HSL con contraste WCAG >= 4.5:1", () => {
    for (const name of ["Personal", "Trabajo", "Notas", "Universidad", "Proyectos", "Ideas"]) {
      const c = workspaceColorForName(name);
      const [, s, l] = parseHsl(c.background);
      expect(s).toBeGreaterThanOrEqual(75);
      expect(l).toBeGreaterThanOrEqual(40);
      expect(l).toBeLessThanOrEqual(55);
      expect(hslContrast(c.background, c.foreground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("evita repetir colores incluso cuando dos espacios tienen exactamente el mismo nombre", () => {
    const spaces = [
      { id: "1", name: "Personal" },
      { id: "2", name: "Personal" },
      { id: "3", name: "Personal" },
      { id: "4", name: "Trabajo" },
      { id: "5", name: "Notas" },
    ];
    const colors = assignWorkspaceColors(spaces);
    const hues = spaces.map((s) => colors.get(s.id)!.hue);
    expect(new Set(hues).size).toBe(spaces.length);
  });

  it("soporta más de 12 espacios sin repetir colores", () => {
    const spaces = Array.from({ length: 15 }, (_, i) => ({ id: `w${i}`, name: `Espacio ${i}` }));
    const colors = assignWorkspaceColors(spaces);
    const hues = spaces.map((s) => colors.get(s.id)!.hue);
    expect(new Set(hues).size).toBe(spaces.length);
  });

  it("respeta el color manual sólido o degradado cuando está configurado", () => {
    const colors = assignWorkspaceColors([
      { id: "1", name: "Personal", color: "#112233" },
      { id: "2", name: "Trabajo", color: "#ff0000~#0000ff" },
      { id: "3", name: "Notas" },
    ]);
    expect(colors.get("1")!.background).toBe("#112233");
    expect(colors.get("1")!.foreground).toBe("#ffffff");
    expect(colors.get("2")!.background).toBe("linear-gradient(135deg, #ff0000, #0000ff)");
    expect(colors.get("3")!.background).toMatch(/^hsl\(/);
  });

  it("WorkspaceAvatar renderiza la inicial en mayúscula y el color asignado", () => {
    const color = workspaceColorForName("estudio");
    const { container } = render(<WorkspaceAvatar name="  estudio" color={color} size={24} />);
    const el = container.querySelector("[data-workspace-avatar]") as HTMLElement;
    expect(el).toHaveTextContent("E");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.style.width).toBe("24px");
    expect(el.style.backgroundColor).not.toBe("");
  });
});
