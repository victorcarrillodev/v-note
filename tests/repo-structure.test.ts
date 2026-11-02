// T-027 (prueba primero): el monorepo declara los 6 workspaces esperados y cada uno es un paquete válido.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const expected = ["packages/core", "packages/ui", "packages/adapters-web", "packages/adapters-tauri", "apps/web", "apps/desktop"];

describe("estructura del monorepo", () => {
  it("la raíz usa workspaces de Bun", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.workspaces).toEqual(["packages/*", "apps/*"]);
  });
  it.each(expected)("%s existe con package.json y nombre en el ámbito @vnote", (dir) => {
    const file = resolve(root, dir, "package.json");
    expect(existsSync(file)).toBe(true);
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    expect(pkg.name).toMatch(/^@vnote\//);
  });
  it("el núcleo no depende de React, del DOM ni de Tauri (art. 3)", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "packages/core/package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /^(react|react-dom|@tauri-apps\/|@blocknote\/)/.test(d))).toEqual([]);
  });
});
