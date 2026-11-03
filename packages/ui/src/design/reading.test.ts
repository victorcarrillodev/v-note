// U-155 (RF-5.3): texto de lectura 16/26 (15/22 en densidad compacta) con líneas de 60 a 80 caracteres.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { typography, sizes } from "./tokens";

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");
const compactBlock = css.slice(css.indexOf('[data-density="compact"]'));
/** Ancho medio de un carácter de la fuente de lectura ≈ 0,56 em (estimación para texto en español). */
const EM = 0.56;
const GUTTER = 48; // 24 px por lado, como en la página

describe("texto de lectura", () => {
  it("normal 16/26 y compacta 15/22", () => {
    expect(typography.reading).toMatchObject({ size: 16, line: 26 });
    expect(css).toContain("--text-reading-size: 16px;");
    expect(compactBlock).toContain("--text-reading-size: 15px;");
    expect(compactBlock).toContain("--text-reading-line: 22px;");
  });
  it("el ancho de lectura da entre 60 y 80 caracteres por línea en ambas densidades", () => {
    for (const size of [16, 15]) {
      const chars = (sizes.readingWidth - GUTTER) / (size * EM);
      expect(chars, `size ${size}`).toBeGreaterThanOrEqual(60);
      expect(chars, `size ${size}`).toBeLessThanOrEqual(80);
    }
  });
});
