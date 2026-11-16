// T-031 (prueba primero): el nombre del producto no puede estar escrito fuera de brand.config (constitución, art. 7).
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { findBrandLeaks } from "./support/brandLeaks";

const root = resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", "target", ".git", "spikes", "specs", "docs", "tests", ".github", "graphify-out", ".serena"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json|html|rs|toml|md)$/.test(name)) out.push(p);
  }
  return out;
}

describe("nombre del producto", () => {
  it("detecta el nombre escrito a mano en un texto de ejemplo", () => {
    expect(findBrandLeaks("const t = 'Bienvenido a v-note';", "x.ts")).toHaveLength(1);
  });
  it("no detecta falsos positivos en nombres ajenos", () => {
    expect(findBrandLeaks("const t = 'my-note';", "x.ts")).toHaveLength(0);
  });
  it("el código del producto no escribe el nombre a mano", () => {
    const leaks = walk(root)
      .filter((f) => !/brand\.config|brand\.test|package\.json|tsconfig|AGENTS|CLAUDE/.test(relative(root, f)))
      .flatMap((f) => findBrandLeaks(readFileSync(f, "utf8"), relative(root, f)));
    expect(leaks).toEqual([]);
  });
});
