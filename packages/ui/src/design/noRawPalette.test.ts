// U-134 a U-140 (RF-11.2): los avisos usan los tokens semánticos, nunca la paleta cruda de Tailwind.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
describe("sin colores crudos de la paleta de Tailwind", () => {
  it("ningún componente usa red/amber/green/sky/blue-NNN", () => {
    const bad = walk(join(__dirname, ".."))
      .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
      .filter((f) => /(?<![\w-])(?:bg|text|border|ring)-(?:red|amber|green|sky|blue)-\d{2,3}/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
