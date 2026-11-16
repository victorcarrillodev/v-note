// Portada: gramática y crédito (plan 005, §4.3 y DP-3). Tareas E-026 a E-030.
import { describe, it, expect } from "vitest";
import { parseCover, formatCover, parseCoverCredit, COVER_GRADIENTS, type Cover } from "./cover";

describe("valores actuales (E-026)", () => {
  it("acepta cada degradado del tema", () => {
    expect([...COVER_GRADIENTS]).toEqual(["sand", "sage", "sky", "lavender", "rose", "graphite"]);
    for (const name of COVER_GRADIENTS) expect(parseCover(`gradient:${name}`)).toEqual({ kind: "gradient", name });
  });
  it("acepta un color de versiones anteriores y lo normaliza a minúsculas", () => {
    expect(parseCover("color:#A1B2C3")).toEqual({ kind: "color", hex: "#a1b2c3" });
  });
  it("rechaza degradados desconocidos, colores mal formados y valores vacíos", () => {
    for (const bad of ["gradient:ocean", "color:red", "color:#abc", "color:#12345g", "", null, undefined, "otra-cosa"]) expect(parseCover(bad)).toBeNull();
  });
});

describe("degradado propio (E-027)", () => {
  it("acepta 2 o 3 colores y un ángulo de 0 a 359", () => {
    expect(parseCover("lgrad:135:#F3E7D3,#33291c")).toEqual({ kind: "lgrad", angle: 135, colors: ["#f3e7d3", "#33291c"] });
    expect(parseCover("lgrad:0:#000000,#ffffff,#ff0000")).toEqual({ kind: "lgrad", angle: 0, colors: ["#000000", "#ffffff", "#ff0000"] });
  });
  it("rechaza ángulos fuera de rango o no enteros, y colores mal formados o en número incorrecto", () => {
    for (const bad of ["lgrad:360:#000000,#ffffff", "lgrad:-1:#000000,#ffffff", "lgrad:12.5:#000000,#ffffff", "lgrad:a:#000000,#ffffff",
      "lgrad:90:#000000", "lgrad:90:#000000,#111111,#222222,#333333", "lgrad:90:000000,#ffffff", "lgrad:90:#000000,", "lgrad:90"]) {
      expect(parseCover(bad), bad).toBeNull();
    }
  });
});

describe("imagen del almacén (E-028)", () => {
  const h = "a".repeat(64);
  it("acepta un hash SHA-256 válido", () => {
    expect(parseCover(`asset:${h}`)).toEqual({ kind: "asset", hash: h });
  });
  it("rechaza hashes cortos, con mayúsculas o con caracteres de ruta", () => {
    for (const bad of [`asset:${"a".repeat(63)}`, `asset:${"A".repeat(64)}`, `asset:../${"a".repeat(61)}`, "asset:"]) expect(parseCover(bad), bad).toBeNull();
  });
});

describe("formatCover (E-029)", () => {
  const samples: Cover[] = [
    { kind: "gradient", name: "sky" },
    { kind: "color", hex: "#a1b2c3" },
    { kind: "lgrad", angle: 45, colors: ["#000000", "#ffffff"] },
    { kind: "lgrad", angle: 270, colors: ["#000000", "#ffffff", "#123456"] },
    { kind: "asset", hash: "b".repeat(64) },
  ];
  it("ida y vuelta: parseCover(formatCover(c)) devuelve c", () => {
    for (const c of samples) expect(parseCover(formatCover(c))).toEqual(c);
  });
  it("produce el texto esperado", () => {
    expect(formatCover({ kind: "lgrad", angle: 45, colors: ["#000000", "#ffffff"] })).toBe("lgrad:45:#000000,#ffffff");
    expect(formatCover({ kind: "asset", hash: "b".repeat(64) })).toBe(`asset:${"b".repeat(64)}`);
  });
});

describe("crédito de la foto (E-030)", () => {
  const ok = { source: "unsplash", photoId: "abc123", author: "Ana Pérez", authorUrl: "https://unsplash.com/@ana?utm_source=x&utm_medium=referral", photoUrl: "https://unsplash.com/photos/abc123?utm_source=x&utm_medium=referral" };
  it("acepta un crédito válido como objeto o como texto JSON, y quita claves de más", () => {
    expect(parseCoverCredit(ok)).toEqual(ok);
    expect(parseCoverCredit(JSON.stringify({ ...ok, extra: "x" }))).toEqual(ok);
  });
  it("rechaza URLs que no son https, fuentes desconocidas y campos vacíos o ausentes", () => {
    for (const bad of [
      { ...ok, authorUrl: "http://unsplash.com/@ana" }, { ...ok, photoUrl: "javascript:alert(1)" }, { ...ok, source: "pexels" },
      { ...ok, author: "  " }, { ...ok, photoId: undefined }, "no es json", null, 42,
    ]) expect(parseCoverCredit(bad as never)).toBeNull();
  });
});
