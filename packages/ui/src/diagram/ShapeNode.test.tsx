// G-126, G-127, G-132 (prueba primero): la forma dibuja su estilo con los colores del tema (paleta) o fijos (personalizados).
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DecisionOutline, shapeStyle } from "./ShapeNode";
import { defaultNodeStyle, type NodeStyle } from "@vnote/core";

const st = (over: Partial<NodeStyle> = {}): NodeStyle => ({ ...defaultNodeStyle("process"), ...over });

describe("colores", () => {
  it("un color de paleta se dibuja con el token del tema (cambia con el tema)", () => {
    const s = shapeStyle("process", st({ fill: "palette:green", stroke: "palette:red", textColor: "palette:blue" }));
    expect(s.background).toBe("var(--block-green-bg)");
    expect(String(s.border)).toContain("var(--block-red-text)");
    expect(s.color).toBe("var(--block-blue-text)");
  });
  it("un color personalizado se dibuja tal cual: igual en ambos temas", () => {
    const s = shapeStyle("process", st({ fill: "#fff3b0", stroke: "#b45309", textColor: "#3b2400" }));
    expect(s.background).toBe("#fff3b0"); expect(String(s.border)).toContain("#b45309"); expect(s.color).toBe("#3b2400");
  });
});

describe("opacidad solo en el relleno (G-127, CL-8)", () => {
  it("con opacidad completa el relleno no se mezcla; con menos, se mezcla con transparente sin tocar contorno ni texto", () => {
    expect(shapeStyle("process", st()).background).toBe("var(--block-blue-bg)");
    const half = shapeStyle("process", st({ fillOpacity: 0.4 }));
    expect(String(half.background)).toBe("color-mix(in srgb, var(--block-blue-bg) 40%, transparent)");
    expect(half.opacity).toBeUndefined();
    expect(String(half.border)).toContain("var(--c-text)"); expect(half.color).toBe("var(--c-text)");
  });
  it("sin relleno y al 0 % la forma sigue ocupando su caja (se puede seleccionar por el interior)", () => {
    for (const s of [st({ fill: "none" }), st({ fillOpacity: 0 })]) {
      const css = shapeStyle("process", s);
      expect(css.width).toBe("100%"); expect(css.height).toBe("100%"); expect(css.pointerEvents).toBeUndefined();
    }
    expect(shapeStyle("process", st({ fill: "none" })).background).toBe("transparent");
  });
});

describe("contorno", () => {
  it("grosor y tipo de línea", () => {
    const s = shapeStyle("process", st({ strokeWidth: 4, strokeDash: "dotted" }));
    expect(String(s.border)).toBe("4px dotted var(--c-text)");
  });
  it("la decisión recorta la caja en rombo y deja el dibujo al SVG (sin borde ni sombra rectangulares)", () => {
    const s = shapeStyle("decision", st({ strokeWidth: 3, stroke: "#112233" }));
    expect(s.clipPath).toContain("polygon"); expect(s.border).toBe("none"); expect(s.boxShadow).toBeUndefined(); expect(s.background).toBe("transparent");
  });
  it("el contorno del rombo sigue sus cuatro lados con el color, el grosor y el tipo de línea", () => {
    const { container } = render(<DecisionOutline style={st({ strokeWidth: 3, stroke: "#112233", strokeDash: "dashed" })} />);
    const p = container.querySelector("polygon")!;
    expect(p.getAttribute("points")).toBe("50,0 100,50 50,100 0,50");
    expect(p.getAttribute("stroke")).toBe("#112233"); expect(p.getAttribute("stroke-width")).toBe("6"); expect(p.getAttribute("stroke-dasharray")).toBe("9 6");
  });
});
