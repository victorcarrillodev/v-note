// U-257 (RF-1, RF-2.5): los diagramas se dibujan con tokens del tema sin cambiar el color guardado.
import { describe, it, expect } from "vitest";
import { DIAGRAM_COLORS, fillFor } from "./diagramPalette";
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
});
