// T-414: cada caso límite CL-1 a CL-36 tiene un archivo de pruebas que existe y que se ejecuta con el resto.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const matrix = readFileSync(resolve(root, "docs/acceptance-cl-matrix.md"), "utf8");
const rows = [...matrix.matchAll(/^\| CL-(\d+) \| `([^`]+)` \|$/gm)].map((m) => ({ n: Number(m[1]), file: m[2]! }));

describe("matriz de casos límite (T-414)", () => {
  it("cubre CL-1 a CL-36 sin huecos ni repetidos", () => {
    expect(rows.map((r) => r.n)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
  });
  it.each(rows)("CL-$n: $file existe", ({ file }) => {
    expect(existsSync(resolve(root, file))).toBe(true);
  });
});
