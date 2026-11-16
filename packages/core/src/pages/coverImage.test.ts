// Imagen de portada (plan 005, §5.1): formato por bytes, límites y tamaño de salida. Tareas E-031 a E-034.
import { describe, it, expect } from "vitest";
import { sniffImage, validateCoverInput, MAX_COVER_INPUT_BYTES, coverOutputSize, isLowResolution } from "./coverImage";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);
const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
const PDF = bytes(0x25, 0x50, 0x44, 0x46);

describe("formato por bytes mágicos (E-031)", () => {
  it("reconoce PNG, JPEG y WebP", () => {
    expect(sniffImage(PNG)).toBe("png");
    expect(sniffImage(JPEG)).toBe("jpeg");
    expect(sniffImage(WEBP)).toBe("webp");
  });
  it("no acepta GIF, PDF, un RIFF que no es WebP ni datos demasiado cortos", () => {
    expect(sniffImage(GIF)).toBeNull();
    expect(sniffImage(PDF)).toBeNull();
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("validateCoverInput (E-032)", () => {
  it("el límite es de 20 MB exactos", () => {
    expect(MAX_COVER_INPUT_BYTES).toBe(20 * 1024 * 1024);
    expect(validateCoverInput(PNG, MAX_COVER_INPUT_BYTES)).toEqual({ ok: true, format: "png" });
    expect(validateCoverInput(PNG, MAX_COVER_INPUT_BYTES + 1)).toEqual({ ok: false, error: "tooLarge" });
  });
  it("un archivo vacío no es una imagen", () => {
    expect(validateCoverInput(new Uint8Array(), 0)).toEqual({ ok: false, error: "empty" });
  });
  it("manda el contenido, no la extensión: un PDF llamado .png se rechaza", () => {
    expect(validateCoverInput(PDF, PDF.length)).toEqual({ ok: false, error: "unsupported" });
    expect(validateCoverInput(WEBP, WEBP.length)).toEqual({ ok: true, format: "webp" });
  });
});

describe("coverOutputSize (E-033)", () => {
  it("no agranda imágenes pequeñas", () => {
    expect(coverOutputSize(300, 200)).toEqual({ width: 300, height: 200 });
    expect(coverOutputSize(2560, 1440)).toEqual({ width: 2560, height: 1440 });
  });
  it("reduce a 2560 px de ancho conservando la proporción", () => {
    expect(coverOutputSize(6000, 4000)).toEqual({ width: 2560, height: 1707 });
    expect(coverOutputSize(4000, 2670)).toEqual({ width: 2560, height: 1709 });
  });
  it("una imagen muy vertical solo se limita por el ancho (el encuadre elige la parte visible)", () => {
    expect(coverOutputSize(1000, 4000)).toEqual({ width: 1000, height: 4000 });
  });
});

describe("isLowResolution (E-034)", () => {
  it("avisa por debajo de 1200 px de ancho", () => {
    expect(isLowResolution(1199)).toBe(true);
    expect(isLowResolution(1200)).toBe(false);
  });
});
