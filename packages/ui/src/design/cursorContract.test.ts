// R-024 (prueba primero): ningún componente fija el cursor en línea; todo pasa por las clases de utilidad (plan 004, §6.1).
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(__dirname, "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (f === "node_modules" || f === "dist") return [];
  return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(f) && !/\.test\./.test(f) ? [p] : [];
});

describe("cursor en línea", () => {
  it("no hay `cursor:` dentro de objetos de estilo en ningún componente", () => {
    const hits: string[] = [];
    for (const f of files(SRC)) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => { if (/style=\{\{[^]*?\bcursor\s*:|^\s*cursor\s*:\s*["'`]|[{,]\s*cursor\s*:\s*["'`a-z]/i.test(line) && !/\bcursor-(pointer|not-allowed|grab|default|text|move)\b/.test(line.replace(/cursor\s*:/g, "X"))) hits.push(`${f.replace(SRC + "/", "")}:${i + 1}`); });
    }
    expect(hits).toEqual([]);
  });
});
