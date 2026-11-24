import { describe, it, expect } from "vitest";
import { parseIcon, formatIconImage } from "./icon";

const H = "a".repeat(64);
describe("icono de página", () => {
  it("un emoji o texto corto es un icono de texto", () => {
    expect(parseIcon("📓")).toEqual({ kind: "emoji", text: "📓" });
    expect(parseIcon("👨‍💻")).toEqual({ kind: "emoji", text: "👨‍💻" });
  });
  it("«asset:» con un hash válido es una imagen, y se escribe de vuelta igual", () => {
    expect(parseIcon(`asset:${H}`)).toEqual({ kind: "image", hash: H });
    expect(parseIcon(formatIconImage(H))).toEqual({ kind: "image", hash: H });
  });
  it("vacío, nulo o con un hash mal formado no es un icono", () => {
    for (const bad of ["", null, undefined, "asset:", "asset:corto", `asset:${H.toUpperCase()}`, `asset:../${H}`]) expect(parseIcon(bad)).toBeNull();
  });
});
