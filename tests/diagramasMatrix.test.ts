// G-174, G-175 (spec 003): cada caso límite CL-1 a CL-14 y cada requisito no funcional RNF-1 a RNF-8 de los diagramas tiene una verificación que existe.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const doc = readFileSync(resolve(root, "docs/acceptance-diagramas.md"), "utf8");
const rows = (prefix: string) => [...doc.matchAll(new RegExp(`^\\| ${prefix}-(\\d+) \\| ([^|]+) \\| (.+) \\|$`, "gm"))].map((m) => ({ n: Number(m[1]), files: [...m[2]!.matchAll(/`([^`]+)`/g)].map((f) => f[1]!), what: m[3]! }));
const cl = rows("CL"), rnf = rows("RNF");

describe("matriz de verificación de la spec 003 (G-174, G-175)", () => {
  it("cubre CL-1 a CL-14 y RNF-1 a RNF-8 sin huecos ni repetidos", () => {
    expect(cl.map((r) => r.n)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(rnf.map((r) => r.n)).toEqual(Array.from({ length: 8 }, (_, i) => i + 1));
  });
  it.each([...cl.map((r) => ({ id: `CL-${r.n}`, ...r })), ...rnf.map((r) => ({ id: `RNF-${r.n}`, ...r }))])("$id: cada archivo de verificación existe y la fila dice qué comprueba", ({ files, what }) => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(existsSync(resolve(root, f)), f).toBe(true);
    expect(what.trim().length).toBeGreaterThan(10);
  });
});
