import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import * as pkg from "./index";

describe("@vnote/core", () => {
  it("el paquete carga", () => {
    expect(pkg).toBeDefined();
  });

  it("exporta lo nuevo de la spec 005 (E-073)", () => {
    for (const name of [
      "parseStyle", "normalizeStyle", "applyStylePatch", "cssVarsFor", "parseCover", "formatCover", "parseCoverCredit",
      "validateCoverInput", "coverOutputSize", "loadPageDefaultStyle", "savePageDefaultStyle", "pageStats", "extractHeadings",
      "collectAssetRefs", "gcAssets", "cleanDescription", "PagesRepo",
    ]) expect(pkg, name).toHaveProperty(name);
  });
  it("exporta lo nuevo de la spec 006: la hoja con paleta", () => {
    for (const name of ["buildExportCss", "EXPORT_CHIPS", "EXPORT_BLOCK_COLORS"]) expect(pkg, name).toHaveProperty(name);
  });
});

// E-074: el núcleo es TypeScript puro; nada de React, DOM, editor ni Tauri.
describe("dependencias del núcleo (E-074)", () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith(".contract.ts") ? [p] : [];
  });
  const FORBIDDEN_IMPORT = /from\s+["'](react|react-dom|@tauri-apps\/[^"']*|@blocknote\/[^"']*|@vnote\/(ui|adapters-[^"']*)|@radix-ui\/[^"']*|electron)["']/;
  const DOM_GLOBAL = /\b(document|window|localStorage|sessionStorage)\./;
  it("ningún archivo importa React, el editor, Tauri ni la interfaz, ni toca el DOM", () => {
    const offenders: string[] = [];
    for (const f of files(resolve(__dirname))) {
      const code = readFileSync(f, "utf8").split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
      if (FORBIDDEN_IMPORT.test(code) || DOM_GLOBAL.test(code)) offenders.push(f.slice(__dirname.length + 1));
    }
    expect(offenders).toEqual([]);
  });
});
