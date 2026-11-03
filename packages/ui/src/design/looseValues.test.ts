// U-032 (RF-1, RNF-4): ningún color, tamaño o radio suelto fuera del sistema de diseño. La lista de excepciones solo puede encogerse.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { scanSource } from "./looseValues";

describe("escáner de valores sueltos", () => {
  it("detecta colores hexadecimales", () => { expect(scanSource('<div style={{ color: "#fff" }} />')).toBe(1); });
  it("detecta valores arbitrarios de Tailwind con px o color", () => {
    expect(scanSource('className="text-[13px] rounded-[5px] bg-[#abc]"')).toBe(3);
  });
  it("permite variables del sistema y clases normales", () => {
    expect(scanSource('className="bg-[var(--c-canvas)] text-[length:var(--text-ui-size)] p-2"')).toBe(0);
  });
  it("detecta SVG sueltos", () => { expect(scanSource("<svg viewBox='0 0 1 1'/>")).toBe(1); });
  it("las anclas como #contenido no cuentan", () => { expect(scanSource('<a href="#contenido">x</a>')).toBe(0); });
});

describe("la interfaz no tiene valores sueltos nuevos", () => {
  const root = resolve(__dirname, "..");
  const baseline: Record<string, number> = JSON.parse(readFileSync(resolve(__dirname, "looseValues.baseline.json"), "utf8"));
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "node_modules" && f !== "design") walk(p); } else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(p); } };
  walk(root);
  const counts = Object.fromEntries(files.map((f) => [relative(root, f), scanSource(readFileSync(f, "utf8"))]).filter(([, n]) => (n as number) > 0));

  it("ningún archivo supera su excepción registrada; los archivos nuevos no tienen ninguna", () => {
    const over = Object.entries(counts).filter(([f, n]) => (n as number) > (baseline[f] ?? 0)).map(([f, n]) => `${f}: ${n} > ${baseline[f] ?? 0}`);
    expect(over).toEqual([]);
  });
  it("la lista de excepciones no guarda archivos que ya están limpios (solo puede encogerse)", () => {
    const stale = Object.keys(baseline).filter((f) => !(f in counts));
    expect(stale).toEqual([]);
  });
  it("la lista de excepciones no permite más de lo que hay hoy", () => {
    const loose = Object.entries(baseline).filter(([f, n]) => n > (counts[f] as number ?? 0)).map(([f]) => f);
    expect(loose).toEqual([]);
  });
});
