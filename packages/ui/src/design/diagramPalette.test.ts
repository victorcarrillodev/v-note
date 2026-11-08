// U-257 (RF-1, RF-2.5): los diagramas se dibujan con tokens del tema sin cambiar el color guardado.
import { describe, it, expect } from "vitest";
import { DIAGRAM_COLORS, fillFor, strokeFor, PALETTE_IDS, paletteFor } from "./diagramPalette";
import { PALETTE_IDS as CORE_IDS, strongHexLight } from "@vnote/core";
import { blockColors } from "./tokens";

describe("paleta de diagramas", () => {
  it("cada color de la paleta se traduce a un token existente", () => {
    for (const c of DIAGRAM_COLORS) {
      const m = /--block-([a-z]+)-bg/.exec(c.token);
      if (m) expect(Object.keys(blockColors), c.id).toContain(m[1]);
      else expect(c.token).toBe("var(--c-card)");
    }
  });
  it("un color guardado de la paleta se dibuja con su token, sin distinguir mayúsculas", () => {
    expect(fillFor("#DBEAFE")).toBe("var(--block-blue-bg)");
    expect(fillFor("#ffffff")).toBe("var(--c-card)");
  });
  it("un color que no es de la paleta se respeta tal cual", () => { expect(fillFor("#123456")).toBe("#123456"); });
  it("los hexadecimales guardados no cambian (el formato de archivo sigue igual)", () => {
    expect(DIAGRAM_COLORS.map((c) => c.hex)).toEqual(["#dbeafe", "#dcfce7", "#fef9c3", "#fee2e2", "#ede9fe", "#ffedd5", "#e5e7eb", "#ffffff"]);
  });

  it("los ids de la paleta de la interfaz son los mismos que acepta el núcleo (G-035)", () => {
    expect([...PALETTE_IDS].sort()).toEqual([...CORE_IDS].sort());
  });
  it("un id de paleta como relleno se traduce al token de fondo del color de bloque; «none» es transparente", () => {
    expect(fillFor("palette:green")).toBe("var(--block-green-bg)");
    expect(fillFor("palette:brown")).toBe("var(--block-brown-bg)");
    expect(fillFor("palette:white")).toBe("var(--c-card)");
    expect(fillFor("none")).toBe("transparent");
  });
  it("como contorno o texto, un id se traduce al token de texto del color; la tinta y el blanco usan el texto principal", () => {
    expect(strokeFor("palette:ink")).toBe("var(--c-text)");
    expect(strokeFor("palette:red")).toBe("var(--block-red-text)");
    expect(strokeFor("palette:white")).toBe("var(--c-text)");
    expect(strokeFor("#b45309")).toBe("#b45309");
  });
  it("todos los ids de la paleta existen como colores de bloque o son tinta/blanco", () => {
    for (const id of PALETTE_IDS) if (id !== "ink" && id !== "white") expect(Object.keys(blockColors), id).toContain(id);
  });

  it("la paleta ofrecida cambia según el uso: relleno incluye blanco, marrón y rosa; contorno y texto, la tinta y los tonos fuertes (G-129)", () => {
    expect(paletteFor("fill")).toEqual(["blue", "green", "yellow", "red", "purple", "orange", "gray", "white", "brown", "pink"]);
    expect(paletteFor("stroke")).toEqual(["ink", "gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"]);
    expect(paletteFor("text")).toEqual(paletteFor("stroke"));
    for (const id of [...paletteFor("fill"), ...paletteFor("stroke")]) expect(PALETTE_IDS, id).toContain(id);
  });
  it("los tonos fuertes que usa la exportación son los de los tokens del tema claro (no pueden desfasarse)", () => {
    for (const id of Object.keys(blockColors)) expect(strongHexLight(id)!.toLowerCase(), id).toBe(blockColors[id]!.light.text.toLowerCase());
  });
});
