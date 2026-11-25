import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

describe("saltos de línea en Windows (CRLF)", () => {
  it("el repositorio fuerza LF en todos los archivos de texto", () => {
    const file = resolve(root, ".gitattributes");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toMatch(/^\*\s+text=auto\s+eol=lf\s*$/m);
  });

  it("git resuelve eol=lf para los archivos que leen las pruebas", () => {
    const out = execFileSync("git", ["check-attr", "eol", "--", "packages/ui/src/editor/editor.css", "packages/ui/src/design/tokens.css"], { cwd: root, encoding: "utf8" });
    const lines = out.trim().split(/\r?\n/);
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l).toMatch(/: eol: lf$/);
  });
});
