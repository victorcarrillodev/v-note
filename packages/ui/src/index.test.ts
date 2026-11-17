import { describe, it, expect } from "vitest";
import * as pkg from "./index";

describe("@vnote/ui", () => {
  it("el paquete carga", () => {
    expect(pkg).toBeDefined();
  });
  it("exporta el catálogo de temas (spec 006)", () => {
    expect(pkg.PALETTE_IDS).toHaveLength(10);
    expect(pkg.THEMES).toHaveLength(10);
    expect(pkg.variantOf("grafito")).toBe("dark");
    expect(pkg.isPaletteId("oceano")).toBe(true);
  });
});
