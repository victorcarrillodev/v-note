// T-106 (prueba primero): el núcleo no depende de React, del DOM ni de Tauri (constitución, art. 3).
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const root = resolve(__dirname, "..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === "node_modules" || n === "dist" ? [] : walk(p)) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

describe("arquitectura", () => {
  it("packages/core no importa React, DOM, Tauri ni BlockNote", () => {
    const bad = walk(resolve(root, "packages/core/src")).filter((f) => !/\.test\.ts$/.test(f) && !/\.contract\.ts$/.test(f)).flatMap((f) => {
      const text = readFileSync(f, "utf8");
      const hits = [
        /from\s+["'](react|react-dom|@tauri-apps\/[^"']+|@blocknote\/[^"']+|@vnote\/ui|@vnote\/adapters-[a-z]+)["']/,
        /\b(window|document|localStorage|sessionStorage|navigator\.)\b/,
      ].filter((re) => re.test(text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));
      return hits.length ? [relative(root, f)] : [];
    });
    expect(bad).toEqual([]);
  });
  it("las suites de contrato son el único código de producción del núcleo que importa vitest", () => {
    const withVitest = walk(resolve(root, "packages/core/src")).filter((f) => /from\s+["']vitest["']/.test(readFileSync(f, "utf8")));
    for (const f of withVitest) expect(/\.(test|contract)\.ts$/.test(f)).toBe(true);
  });
});
