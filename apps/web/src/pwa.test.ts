// T-146 (prueba primero): el manifiesto de la PWA sale de la configuración de marca y cumple lo necesario para poder instalarse.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildManifest } from "../pwa.manifest";

const brand = JSON.parse(readFileSync(resolve(__dirname, "../../../brand.config.json"), "utf8")) as { name: string; appId: string };

describe("manifiesto de la PWA", () => {
  const m = buildManifest(brand);
  it("el nombre sale de brand.config.json, no está escrito a mano", () => {
    expect(m.name).toBe(brand.name);
    expect(m.short_name).toBe(brand.name);
  });
  it("es instalable: ventana propia, inicio y alcance, idioma y colores", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.lang).toBe("es-MX");
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it("incluye iconos de 192 y 512 px (uno enmascarable) y los archivos existen", () => {
    const sizes = m.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(m.icons.some((i) => i.purpose?.includes("maskable"))).toBe(true);
    for (const i of m.icons) expect(existsSync(resolve(__dirname, "../public", i.src.replace(/^\//, ""))), i.src).toBe(true);
  });
  it("los iconos son PNG válidos del tamaño declarado", () => {
    for (const i of m.icons) {
      const buf = readFileSync(resolve(__dirname, "../public", i.src.replace(/^\//, "")));
      expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const [w] = i.sizes.split("x").map(Number);
      expect(buf.readUInt32BE(16)).toBe(w);
    }
  });
});

describe("colores del manifiesto (spec 002)", () => {
  it("usan el acento y el lienzo del sistema de diseño, no valores sueltos", async () => {
    const { colors } = await import("../../../packages/ui/src/design/tokens");
    const m = buildManifest(brand);
    expect(m.theme_color).toBe(colors.accent.light);
    expect(m.background_color).toBe(colors.canvas.light);
  });
});
