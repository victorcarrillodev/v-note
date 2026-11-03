// U-249 (RF-1, RF-14): el lienzo del grafo toma sus colores de los tokens del tema vigente, no de valores fijos.
import { describe, it, expect } from "vitest";
import { readTokens, GRAPH_TOKENS } from "./canvasColors";

describe("readTokens", () => {
  it("lee cada token del elemento y cae en el valor de respaldo si no está definido", () => {
    const el = document.createElement("div");
    el.style.setProperty("--c-accent", "#112233");
    document.body.append(el);
    const c = readTokens(el, { accent: "--c-accent", missing: "--no-existe" }, { missing: "rgb(1,2,3)" });
    expect(c.accent).toBe("#112233");
    expect(c.missing).toBe("rgb(1,2,3)");
    el.remove();
  });
  it("el grafo define sus colores solo con nombres de token", () => {
    for (const v of Object.values(GRAPH_TOKENS)) expect(v).toMatch(/^--[a-z-]+$/);
  });
  it("cambia al cambiar el tema (los valores se leen en cada dibujo)", () => {
    const el = document.createElement("div");
    document.body.append(el);
    el.style.setProperty("--c-accent", "#000001");
    const a = readTokens(el, { x: "--c-accent" }).x;
    el.style.setProperty("--c-accent", "#000002");
    expect(readTokens(el, { x: "--c-accent" }).x).not.toBe(a);
    el.remove();
  });
});
