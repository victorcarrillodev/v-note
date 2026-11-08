// G-019, G-020 (prueba primero): colores y conjuntos permitidos del estilo de diagramas.
import { describe, it, expect } from "vitest";
import {
  isColor, isFillColor, PALETTE_IDS, DASHES, CAPS, ROUTES, EDGE_WIDTHS, NODE_STROKE_WIDTHS,
  defaultNodeStyle, defaultEdgeStyle, strongHexLight, dashArray, completeNodeStyle, completeEdgeStyle, paletteIdForHex, fillHexLight,
} from "./style";

describe("colores", () => {
  it("acepta ids de paleta y hexadecimales de 3, 4, 6 y 8 dígitos", () => {
    for (const c of ["palette:blue", "palette:ink", "#abc", "#abcd", "#aabbcc", "#AABBCCDD"]) expect(isColor(c), c).toBe(true);
  });
  it("rechaza valores inválidos o peligrosos", () => {
    for (const c of ["", "red", "palette:", "palette:nope", "#abcde", "#ggg", "rgb(1,2,3)", 'red" onload="x', "url(x)", "palette:blue;x", 12 as unknown as string]) expect(isColor(c), String(c)).toBe(false);
  });
  it("«none» solo vale como relleno", () => {
    expect(isColor("none")).toBe(false);
    expect(isFillColor("none")).toBe(true);
    expect(isFillColor("palette:red")).toBe(true);
    expect(isFillColor("nope")).toBe(false);
  });
  it("la paleta incluye los ocho tonos de relleno y la tinta", () => {
    for (const id of ["blue", "green", "yellow", "red", "purple", "orange", "gray", "white", "ink"]) expect(PALETTE_IDS).toContain(id);
  });
  it("un hex de la paleta de la versión 1 se reconoce sin importar mayúsculas", () => {
    expect(paletteIdForHex("#DBEAFE")).toBe("blue");
    expect(paletteIdForHex("#ffffff")).toBe("white");
    expect(paletteIdForHex("#123456")).toBeNull();
    expect(fillHexLight("blue")).toBe("#dbeafe");
  });
});

describe("conjuntos permitidos", () => {
  it("líneas, puntas, trazados y grosores", () => {
    expect([...DASHES]).toEqual(["solid", "dashed", "dotted"]);
    expect([...CAPS]).toEqual(["none", "arrow", "circle", "diamond"]);
    expect([...ROUTES]).toEqual(["straight", "orthogonal", "curved", "free"]);
    expect([...EDGE_WIDTHS]).toEqual(["thin", "medium", "thick"]);
    expect([...NODE_STROKE_WIDTHS]).toEqual([1, 2, 3, 4]);
  });
});

describe("estilos del sistema", () => {
  it("la forma nace con el aspecto que ya tenía: relleno azul, contorno y texto de tinta, contorno de 2", () => {
    expect(defaultNodeStyle("process")).toEqual({ fill: "palette:blue", fillOpacity: 1, stroke: "palette:ink", strokeWidth: 2, strokeDash: "solid", textColor: "palette:ink" });
  });
  it("la nota tenía el contorno discontinuo", () => {
    expect(defaultNodeStyle("note").strokeDash).toBe("dashed");
  });
  it("el conector nace con flecha al final", () => {
    expect(defaultEdgeStyle()).toEqual({ color: "palette:ink", width: "medium", dash: "solid", startCap: "none", endCap: "arrow", textColor: "palette:ink" });
  });
  it("completar un estilo parcial rellena con el del sistema y descarta lo inválido", () => {
    expect(completeNodeStyle("process", { fill: "#ff0000" }).fill).toBe("#ff0000");
    expect(completeNodeStyle("process", { fill: "red" }).fill).toBe("palette:blue");
    expect(completeNodeStyle("process", { fillOpacity: 5 }).fillOpacity).toBe(1);
    expect(completeNodeStyle("process", { fillOpacity: 0.4 }).fillOpacity).toBe(0.4);
    expect(completeNodeStyle("process", { strokeWidth: 7 }).strokeWidth).toBe(2);
    expect(completeEdgeStyle({ endCap: "flecha" as never }).endCap).toBe("arrow");
    expect(completeEdgeStyle({ width: "thick", dash: "dotted" })).toMatchObject({ width: "thick", dash: "dotted", startCap: "none" });
  });
});

describe("tonos fuertes del tema claro para contorno, línea y texto al exportar", () => {
  it("cada color de paleta (salvo blanco y tinta) tiene su tono fuerte", () => {
    for (const id of PALETTE_IDS.filter((i) => i !== "white" && i !== "ink")) expect(strongHexLight(id), id).toMatch(/^#[0-9A-F]{6}$/);
  });
  it("la tinta y el blanco no tienen tono propio (se resuelven aparte)", () => {
    expect(strongHexLight("ink")).toBeUndefined(); expect(strongHexLight("white")).toBeUndefined();
  });
});

describe("trama de las líneas (compartida por el lienzo y la exportación)", () => {
  it("continua no lleva trama; discontinua y punteada dependen del grosor", () => {
    expect(dashArray("solid", 2)).toBeUndefined();
    expect(dashArray("dashed", 2)).toBe("10 8"); expect(dashArray("dotted", 2)).toBe("2 6");
    expect(dashArray("dashed", 4)).toBe("18 14"); expect(dashArray("dotted", 1)).toBe("1 4");
  });
});
