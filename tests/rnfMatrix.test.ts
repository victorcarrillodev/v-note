// T-415: cada requisito no funcional RNF-1 a RNF-13 tiene una verificación que existe.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const matrix = readFileSync(resolve(root, "docs/acceptance-rnf-matrix.md"), "utf8");
const rows = [...matrix.matchAll(/^\| RNF-(\d+) \| `([^`]+)` \|$/gm)].map((m) => ({ n: Number(m[1]), file: m[2]! }));

describe("matriz de requisitos no funcionales (T-415)", () => {
  it("cubre RNF-1 a RNF-13 sin huecos", () => {
    expect(rows.map((r) => r.n)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
  });
  it.each(rows)("RNF-$n: $file existe", ({ file }) => { expect(existsSync(resolve(root, file))).toBe(true); });
});
